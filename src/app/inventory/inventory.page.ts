import { Component, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryService } from './inventory.service';
import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType, NotFoundException } from '@zxing/library';

const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const BARCODE_FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'qr_code', 'upc_a', 'upc_e', 'codabar'];

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

  @ViewChild('video', { static: false }) videoElement?: ElementRef<HTMLVideoElement>;

  scannerMessage = 'Arahkan kamera ke QR atau kode batang produk.';
  private codeReader = new BrowserMultiFormatReader(BARCODE_HINTS, 100);
  private barcodeStream?: MediaStream;
  private nativeScanTimer?: number;

  filterOptions = [
    { id: 'all', label: 'Semua' },
    { id: 'low-to-high', label: 'Stok Rendah Ke Tinggi' },
    { id: 'high-to-low', label: 'Stok Tinggi Ke Rendah' },
    { id: 'name-a-z', label: 'Abjad A-Z' },
    { id: 'name-z-a', label: 'Abjad Z-A' },
  ];

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private ngZone: NgZone,
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
        item.id.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword) ||
        (item.barcode || '').toLowerCase().includes(keyword) ||
        item.sku.replace(/^sku-/i, '').toLowerCase().includes(keyword) ||
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
    this.inventoryService.getItems().subscribe(items => {
      this.items = items.map(item => {
        const stockStatus = this.inventoryService.getStockStatus(item);
        const updatedItem = { ...item };

        updatedItem.quantityClass = this.getQuantityClass(stockStatus);
        updatedItem.badgeClass = this.getBadgeClass(stockStatus);

        return updatedItem;
      });
      this.itemCount = this.items.length;
    });
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
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.showBarcodeScanner = true;
    this.isScanning = true;
    this.scannerMessage = 'Membuka kamera...';

    try {
      const video = await this.waitForScannerVideo();
      await this.startScanning(video);
    } catch (error) {
      console.error('Kesalahan membuka scanner:', error);
      this.showCameraError();
    }
  }

  closeBarcodeScanner() {
    this.showBarcodeScanner = false;
    this.stopScanning();
  }

  private async startScanning(videoElement: HTMLVideoElement) {
    this.barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, min: 15 },
      },
      audio: false,
    });
    await this.optimizeCameraTrack(this.barcodeStream);

    videoElement.srcObject = this.barcodeStream;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'true');
    await videoElement.play();

    this.scannerMessage = 'Scanner siap. Dekatkan barcode kecil sampai memenuhi kotak, lalu tahan sebentar.';

    if (this.startNativeBarcodeDetector(videoElement, this.barcodeStream)) {
      return;
    }

    this.scannerMessage = 'Arahkan QR atau kode batang ke tengah kotak. Untuk barcode kecil, dekatkan perlahan sampai fokus.';

    await this.codeReader.decodeFromStream(this.barcodeStream, videoElement, (result, error) => {
      if (!this.isScanning) {
        return;
      }

      const scannedCode = result?.getText()?.trim();
      if (scannedCode) {
        this.ngZone.run(() => this.handleScannedBarcode(scannedCode));
        return;
      }

      if (error && !(error instanceof NotFoundException)) {
        this.scannerMessage = 'Belum terbaca. Jaga barcode tetap rata, terang, dan masuk penuh di kotak.';
      }
    }).catch(error => {
      console.error('Kesalahan menjalankan scanner:', error);
      this.showCameraError();
    });
  }

  private async waitForScannerVideo(): Promise<HTMLVideoElement> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const video = this.videoElement?.nativeElement;
      if (video) {
        return video;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('Elemen video scanner belum siap.');
  }

  private handleScannedBarcode(barcode: string) {
    this.searchTerm = barcode;
    this.stopScanning();
    this.closeBarcodeScanner();
  }

  private stopScanning() {
    this.isScanning = false;
    this.codeReader.reset();

    if (this.nativeScanTimer) {
      window.clearInterval(this.nativeScanTimer);
      this.nativeScanTimer = undefined;
    }

    const videoElement = this.videoElement?.nativeElement;
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }

    this.barcodeStream?.getTracks().forEach(track => track.stop());
    this.barcodeStream = undefined;
  }

  private showCameraError() {
    alert('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan dan coba buka scanner lagi.');
    this.closeBarcodeScanner();
  }

  private startNativeBarcodeDetector(video: HTMLVideoElement, stream: MediaStream) {
    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      return false;
    }

    const detector = new BarcodeDetectorCtor({ formats: BARCODE_FORMATS });
    this.scannerMessage = 'Scanner siap. Dekatkan barcode kecil sampai garisnya terlihat tajam.';

    this.nativeScanTimer = window.setInterval(async () => {
      if (!this.isScanning || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        const barcode = barcodes[0]?.rawValue?.trim();

        if (barcode) {
          this.ngZone.run(() => this.handleScannedBarcode(barcode));
        }
      } catch {
        window.clearInterval(this.nativeScanTimer);
        this.nativeScanTimer = undefined;
        this.ngZone.run(() => {
          this.scannerMessage = 'Scanner bawaan tidak tersedia. Mencoba mode cadangan...';
          this.codeReader.decodeFromStream(stream, video, (result, error) => {
            if (!this.isScanning) {
              return;
            }

            const scannedCode = result?.getText()?.trim();
            if (scannedCode) {
              this.ngZone.run(() => this.handleScannedBarcode(scannedCode));
              return;
            }

            if (error && !(error instanceof NotFoundException)) {
              this.scannerMessage = 'Belum terbaca. Coba arahkan ulang kamera.';
            }
          });
        });
      }
    }, 120);

    return true;
  }

  private async optimizeCameraTrack(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];

    if (!track?.getCapabilities || !track.applyConstraints) {
      return;
    }

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[];
      zoom?: { min?: number; max?: number; step?: number };
    };
    const advanced: Array<Record<string, unknown>> = [];

    if (capabilities.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }

    if (capabilities.zoom?.max && capabilities.zoom.max > 1) {
      const zoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min || 1, 1.5));
      advanced.push({ zoom });
    }

    if (!advanced.length) {
      return;
    }

    try {
      await track.applyConstraints({ advanced } as MediaTrackConstraints);
    } catch (error) {
      console.warn('Optimasi kamera inventory tidak didukung perangkat ini:', error);
    }
  }
}
