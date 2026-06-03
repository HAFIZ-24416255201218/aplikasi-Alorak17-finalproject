import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryService } from './inventory.service';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: false,
})
export class InventoryPage {
  searchTerm = '';
  categorySearchTerm = '';
  itemCount = 0;
  items: InventoryItem[] = [];
  isCategoryPanelOpen = false;
  selectedSort = 'all';
  selectedCategory = 'all';
  showBarcodeScanner = false;
  isScanning = false;

  @ViewChild('video', { static: false }) videoElement?: ElementRef;

  private codeReader = new BrowserMultiFormatReader();

  filterOptions = [
    { id: 'all', label: 'Semua' },
    { id: 'low-to-high', label: 'Stok Rendah Ke Tinggi' },
    { id: 'high-to-low', label: 'Stok Tinggi Ke Rendah' },
    { id: 'expiration-nearest', label: 'Kadaluarsa Terdekat' },
    { id: 'name-a-z', label: 'Abjad A-Z' },
    { id: 'name-z-a', label: 'Abjad Z-A' },
  ];

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
  ) {}

  ionViewWillEnter() {
    this.loadItems();
  }

  get filteredItems() {
    const keyword = this.searchTerm.trim().toLowerCase();

    let filtered = this.items;

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter((item) => (item.category || 'Umum') === this.selectedCategory);
    }

    if (keyword) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword) ||
        (item.category || 'Umum').toLowerCase().includes(keyword)
      );
    }

    return this.sortItems(filtered);
  }

  get categoryOptions() {
    const categoryMap = this.items.reduce((acc, item) => {
      const category = item.category || 'Umum';
      acc.set(category, (acc.get(category) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredCategoryOptions() {
    const keyword = this.categorySearchTerm.trim().toLowerCase();

    if (!keyword) {
      return this.categoryOptions;
    }

    return this.categoryOptions.filter(category => category.name.toLowerCase().includes(keyword));
  }

  get selectedSortLabel() {
    return this.filterOptions.find(option => option.id === this.selectedSort)?.label || '';
  }

  get selectedCategoryLabel() {
    return this.selectedCategory === 'all' ? 'Semua' : this.selectedCategory;
  }

  private sortItems(items: InventoryItem[]): InventoryItem[] {
    const sorted = [...items];

    switch (this.selectedSort) {
      case 'low-to-high':
        return sorted.sort((a, b) => a.quantity - b.quantity);

      case 'high-to-low':
        return sorted.sort((a, b) => b.quantity - a.quantity);

      case 'expiration-nearest':
        return sorted.sort((a, b) => {
          const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
          const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
          return dateA - dateB;
        });

      case 'name-a-z':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));

      case 'name-z-a':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));

      default:
        return sorted;
    }
  }

  toggleCategoryPanel() {
    this.isCategoryPanelOpen = !this.isCategoryPanelOpen;
  }

  closeCategoryPanel() {
    this.isCategoryPanelOpen = false;
  }

  selectSort(sortId: string) {
    this.selectedSort = sortId;
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
  }

  resetCategory() {
    this.selectedCategory = 'all';
    this.categorySearchTerm = '';
  }

  private loadItems() {
    this.items = this.inventoryService.getItems().map(item => {
      const stockStatus = this.inventoryService.getStockStatus(item);
      const updatedItem = { ...item };

      updatedItem.quantityClass = this.getQuantityClass(stockStatus);
      updatedItem.badgeClass = this.getBadgeClass(stockStatus);

      return updatedItem;
    });
    this.itemCount = this.items.length;
  }

  private getQuantityClass(status: 'low' | 'medium' | 'high'): string {
    switch (status) {
      case 'low':
        return 'qty-low';
      case 'medium':
        return 'qty-medium';
      case 'high':
        return 'qty-high';
      default:
        return 'qty-high';
    }
  }

  private getBadgeClass(status: 'low' | 'medium' | 'high'): string {
    switch (status) {
      case 'low':
        return 'badge-red';
      case 'medium':
        return 'badge-yellow';
      case 'high':
        return 'badge-green';
      default:
        return 'badge-green';
    }
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToHistory() {
    this.router.navigate(['/history']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToGoodsIn() {
    this.router.navigate(['/goods-in']);
  }

  openItemDetail(id: string) {
    this.router.navigate(['/inventory-detail', id]);
  }

  async openBarcodeScanner() {
    const allowed = window.confirm('izinkan kamera atau tidak');

    if (!allowed) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.showBarcodeScanner = true;
    this.isScanning = true;
    
    setTimeout(() => {
      this.startScanning();
    }, 100);
  }

  closeBarcodeScanner() {
    this.showBarcodeScanner = false;
    this.stopScanning();
  }

  private startScanning() {
    const videoElement = this.videoElement?.nativeElement;
    if (!videoElement) {
      console.error('Video element not found');
      return;
    }

    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        videoElement.srcObject = stream;
        videoElement.play();
        this.continuousScanning(videoElement);
      })
      .catch(err => {
        console.error('Error accessing camera:', err);
        this.showCameraError();
      });
  }

  private continuousScanning(videoElement: HTMLVideoElement) {
    let lastScannedCode = '';
    let lastScanTime = 0;

    const decodeFromVideo = () => {
      try {
        // Get the canvas for drawing the video frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          requestAnimationFrame(decodeFromVideo);
          return;
        }

        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Try to decode the image - convert canvas to data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg');

        this.codeReader.decodeFromImage(imageDataUrl)
          .then(result => {
            if (result && result.getText()) {
              const scannedCode = result.getText();
              const now = Date.now();
              
              // Avoid scanning the same barcode multiple times within 2 seconds
              if (scannedCode !== lastScannedCode || now - lastScanTime > 2000) {
                lastScannedCode = scannedCode;
                lastScanTime = now;
                this.handleScannedBarcode(scannedCode);
              }
            }

            // Continue scanning
            if (this.isScanning) {
              requestAnimationFrame(decodeFromVideo);
            }
          })
          .catch(err => {
            if (!(err instanceof NotFoundException)) {
              // console.error('Scanning error:', err);
            }
            // Continue scanning
            if (this.isScanning) {
              requestAnimationFrame(decodeFromVideo);
            }
          });
      } catch (error) {
        console.error('Error in continuous scanning:', error);
        if (this.isScanning) {
          requestAnimationFrame(decodeFromVideo);
        }
      }
    };

    decodeFromVideo();
  }

  private handleScannedBarcode(barcode: string) {
    console.log('Barcode scanned:', barcode);
    this.searchTerm = barcode;
    this.stopScanning();
    this.closeBarcodeScanner();
  }

  private stopScanning() {
    this.isScanning = false;

    const videoElement = this.videoElement?.nativeElement;
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  }

  private showCameraError() {
    alert('Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin akses kamera.');
    this.closeBarcodeScanner();
  }
}
