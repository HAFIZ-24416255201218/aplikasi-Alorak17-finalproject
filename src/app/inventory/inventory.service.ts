import { Injectable } from '@angular/core';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  location: string;
  parentLocation?: string;
  quantity: number;
  unit: string;
  category?: string;
  icon: string;
  badgeClass: string;
  quantityClass: string;
  expirationDate?: string;
  notes?: string;
  imageData?: string;
  minThreshold?: number;
  mediumThreshold?: number;
  locations?: InventoryLocation[];
  updatedAt?: string;
}

export interface InventoryLocation {
  name: string;
  parentLocation?: string;
  quantity: number;
}

const STORAGE_KEY = 'gudangfp_inventory_items';

const DEFAULT_ITEMS: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'ciu',
    sku: 'BC-3C79/176',
    location: 'Jakarta',
    quantity: 800,
    unit: 'pcs',
    category: 'Minuman',
    icon: 'partly-sunny-outline',
    badgeClass: 'badge-sky',
    quantityClass: 'qty-high',
    expirationDate: '2026-08-15',
    minThreshold: 50,
    mediumThreshold: 150,
  },
  {
    id: 'inv-2',
    name: 'Plastic Housing H-20',
    sku: 'FIN-008',
    location: 'D1-05',
    quantity: 180,
    unit: 'units',
    category: 'Komponen',
    icon: 'cube-outline',
    badgeClass: 'badge-green',
    quantityClass: 'qty-high',
    expirationDate: '2026-12-20',
    minThreshold: 50,
    mediumThreshold: 150,
  },
  {
    id: 'inv-3',
    name: 'Bubble Wrap Roll',
    sku: 'PKG-009',
    location: 'C2-14',
    quantity: 28,
    unit: 'rolls',
    category: 'Packaging',
    icon: 'cube-outline',
    badgeClass: 'badge-red',
    quantityClass: 'qty-low',
    expirationDate: '2026-06-30',
    minThreshold: 50,
    mediumThreshold: 150,
  },
  {
    id: 'inv-4',
    name: 'Screw Set M4x12',
    sku: 'SPR-010',
    location: 'E2-19',
    quantity: 156,
    unit: 'boxes',
    category: 'Sparepart',
    icon: 'cube-outline',
    badgeClass: 'badge-green',
    quantityClass: 'qty-high',
    expirationDate: '2027-03-10',
    minThreshold: 50,
    mediumThreshold: 150,
  },
];

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  getItems(): InventoryItem[] {
    const savedItems = localStorage.getItem(STORAGE_KEY);

    if (!savedItems) {
      const normalizedDefaults = DEFAULT_ITEMS.map((item, index) => this.normalizeItem(item, index));
      this.saveItems(normalizedDefaults);
      return normalizedDefaults;
    }

    try {
      const parsedItems = JSON.parse(savedItems) as InventoryItem[];
      const normalizedItems = parsedItems.map((item, index) => this.normalizeItem(item, index));
      this.saveItems(normalizedItems);
      return normalizedItems;
    } catch {
      const normalizedDefaults = DEFAULT_ITEMS.map((item, index) => this.normalizeItem(item, index));
      this.saveItems(normalizedDefaults);
      return normalizedDefaults;
    }
  }

  addItem(item: InventoryItem) {
    const items = this.getItems();
    items.unshift(item);
    this.saveItems(items);
  }

  upsertItem(item: InventoryItem) {
    const items = this.getItems();
    const index = items.findIndex(existing => existing.id === item.id);

    if (index >= 0) {
      items[index] = item;
    } else {
      items.unshift(item);
    }

    this.saveItems(items);
  }

  getItemBySku(sku: string) {
    return this.getItems().find(item => item.sku === sku);
  }

  getItemById(id: string) {
    return this.getItems().find(item => item.id === id);
  }

  deleteItem(id: string) {
    const items = this.getItems().filter(item => item.id !== id);
    this.saveItems(items);
  }

  private saveItems(items: InventoryItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private createId(index = 0) {
    return `inv-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeItem(item: InventoryItem, index = 0): InventoryItem {
    const locations = item.locations?.length
      ? item.locations
      : [{ name: item.location || 'Gudang Utama', quantity: item.quantity }];

    return {
      ...item,
      id: item.id || this.createId(index),
      location: item.location || locations[0]?.name || 'Gudang Utama',
      parentLocation: item.parentLocation || locations[0]?.parentLocation || '',
      category: item.category || 'Umum',
      locations,
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  }

  getStockStatus(item: InventoryItem): 'low' | 'medium' | 'high' {
    const minThreshold = item.minThreshold || 50;
    const mediumThreshold = item.mediumThreshold || 150;

    if (item.quantity < minThreshold) return 'low';
    if (item.quantity < mediumThreshold) return 'medium';
    return 'high';
  }

  isItemExpiringSoon(item: InventoryItem, daysThreshold = 7): boolean {
    if (!item.expirationDate) return false;
    const expirationDate = new Date(item.expirationDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
  }

  isItemExpired(item: InventoryItem): boolean {
    if (!item.expirationDate) return false;
    const expirationDate = new Date(item.expirationDate);
    const today = new Date();
    return expirationDate < today;
  }
}
