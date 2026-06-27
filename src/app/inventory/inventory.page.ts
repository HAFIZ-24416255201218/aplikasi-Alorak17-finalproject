import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryService } from './inventory.service';

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
  isScannerOpen = false;

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

  openBarcodeScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.isScannerOpen = true;
  }

  closeBarcodeScanner() {
    this.isScannerOpen = false;
  }

  applyScannedBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();

    if (!barcode) {
      window.alert('Barcode tidak terbaca. Coba scan ulang.');
      return;
    }

    this.searchTerm = barcode;
    this.closeBarcodeScanner();
  }
}
