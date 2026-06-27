import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { InventoryItem, InventoryLocation, InventoryService, LaravelCategory } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';
import { LocationService, LocationItem } from '../services/location.service';
import { NotificationService } from '../services/notification.service';
import { SearchableSelectOption } from '../shared/searchable-select/searchable-select.component';

@Component({
  selector: 'app-goods-in',
  templateUrl: './goods-in.page.html',
  styleUrls: ['./goods-in.page.scss'],
  standalone: false,
})
export class GoodsInPage {
  form = {
    selectedItem: '',
    itemName: '',
    itemCode: '',
    barcode: '',
    category: '',
    unit: 'pcs',
    minThreshold: '',
    mediumThreshold: '',
    destLocation: '',
    quantity: '',
    notes: '',
  };

  readonly defaultDestLocations = [
    'Rak A1-01',
    'Rak A1-02',
    'Rak A1-03',
    'Rak B1-01',
    'Rak B1-02',
    'Rak B1-03',
    'Rak C1-01',
    'Rak C1-02',
    'Rak C1-03',
    'Gate Inbound',
    'Area Receiving',
  ];

  isScannerOpen = false;
  isSubmitting = false;
  barcodeLookupMessage = '';
  inventoryItems: InventoryItem[] = [];
  categoryOptions: LaravelCategory[] = [];
  locationsList: LocationItem[] = [];
  private lookupTimers: Partial<Record<'barcode' | 'code', number>> = {};
  private lastLookupKeys: Partial<Record<'barcode' | 'code', string>> = {};
  activeLookupSource: 'barcode' | 'code' | '' = '';

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
    private locationService: LocationService,
    private notificationService: NotificationService,
  ) {}

  ionViewWillEnter() {
    this.isSubmitting = false;
    this.closeBarcodeScanner();
    this.resetForm();
    this.inventoryService.getItems().subscribe(items => {
      this.inventoryItems = items;
    });
    this.inventoryService.getCategories().subscribe(categories => {
      this.categoryOptions = categories.filter(category => category.status !== false);

      if (!this.form.category && this.categoryOptions.length) {
        this.form.category = this.categoryOptions[0].name;
      }
    });
    this.locationService.getLocations().subscribe(locations => {
      this.locationsList = locations;
      if (!this.form.destLocation && locations.length) {
        this.form.destLocation = String(locations[0].id);
      }
    });
  }

  close() {
    this.router.navigate(['/home']);
  }

  onSelectItem(sku: string) {
    this.inventoryService.getItemById(sku).subscribe(selectedItem => {
      if (!selectedItem) {
        return;
      }

      this.fillFormFromItem(selectedItem);
    });
  }

  get locationOptions(): SearchableSelectOption[] {
    return this.locationsList.map(location => ({
      value: String(location.id),
      label: location.display_name || location.name,
    }));
  }

  get categorySelectOptions(): SearchableSelectOption[] {
    return this.categoryOptions.map(category => ({
      value: category.name,
      label: category.name,
    }));
  }

  get itemFieldsLocked() {
    return Boolean(this.form.selectedItem);
  }

  get isCodeFieldLocked() {
    return this.itemFieldsLocked && this.activeLookupSource !== 'code';
  }

  get isBarcodeFieldLocked() {
    return this.itemFieldsLocked && this.activeLookupSource !== 'barcode';
  }

  get areItemDetailFieldsLocked() {
    return this.itemFieldsLocked;
  }

  get destLocationOptions() {
    const savedLocations = this.inventoryItems.reduce<string[]>((locations, item) => {
      if (item.locations?.length) {
        return [...locations, ...item.locations.map(location => location.name)];
      }

      return [...locations, item.location];
    }, []);

    return Array.from(new Set([...this.defaultDestLocations, ...savedLocations].filter(Boolean)));
  }



  generateItemCode() {
    this.clearSelectedItemLock();
    this.form.itemCode = this.createRandomItemCode();
  }

  lookupExistingItemFromCode() {
    this.lookupExistingItem(this.form.itemCode, 'code');
  }

  lookupExistingItemFromBarcode() {
    this.lookupExistingItem(this.form.barcode, 'barcode');
  }

  scheduleExistingItemLookup(value: string, source: 'barcode' | 'code') {
    const cleanValue = String(value || '').trim();

    if (this.lookupTimers[source]) {
      window.clearTimeout(this.lookupTimers[source]);
      this.lookupTimers[source] = undefined;
    }

    if (!cleanValue) {
      this.clearSelectedItemLock();
      this.barcodeLookupMessage = '';
      return;
    }

    this.lookupTimers[source] = window.setTimeout(() => {
      this.lookupExistingItem(cleanValue, source);
    }, 450);
  }

  openBarcodeScanner() {
    if (this.isBarcodeFieldLocked) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.isScannerOpen = true;
  }

  closeBarcodeScanner() {
    this.isScannerOpen = false;
  }



  submit() {
    if (this.isSubmitting) {
      return;
    }

    const quantity = Number(this.form.quantity);
    const minThreshold = Number(this.form.minThreshold);
    const mediumThreshold = Number(this.form.mediumThreshold);
    const barcodeValue = this.form.barcode.trim() || this.form.itemCode.trim();

    if (!this.form.itemCode || !this.form.unit || !this.form.destLocation || !quantity) {
      window.alert('Lengkapi kode barang, satuan, lokasi tujuan, dan jumlah terlebih dahulu.');
      return;
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      window.alert('Jumlah harus berupa angka yang valid.');
      return;
    }

    if (Number.isNaN(minThreshold) || Number.isNaN(mediumThreshold) || minThreshold < 0 || mediumThreshold < 0) {
      window.alert('Batas stok harus berupa angka yang valid.');
      return;
    }

    if (mediumThreshold <= minThreshold) {
      window.alert('Batas stok sedang harus lebih besar dari batas minimum stok.');
      return;
    }

    this.isSubmitting = true;

    const existingItem = this.findExistingItemForSubmit();

    if (existingItem) {
      this.addGoodsInForExistingItem(existingItem, quantity, barcodeValue);
      return;
    }

    this.lookupItemBeforeCreate(barcodeValue).subscribe({
      next: item => {
        if (item) {
          this.inventoryItems = this.upsertLoadedInventoryItem(item);
          this.addGoodsInForExistingItem(item, quantity, barcodeValue);
          return;
        }

        this.createNewItem(quantity, barcodeValue, minThreshold, mediumThreshold);
      },
      error: () => {
        this.createNewItem(quantity, barcodeValue, minThreshold, mediumThreshold);
      }
    });
  }

  private createNewItem(quantity: number, barcodeValue: string, minThreshold: number, mediumThreshold: number) {
      if (!this.form.itemName.trim()) {
        window.alert('Barang belum terdaftar. Lengkapi nama barang terlebih dahulu untuk membuat data barang baru.');
        this.isSubmitting = false;
        return;
      }

      const selectedCategoryId = this.getSelectedCategoryId();
      if (!selectedCategoryId) {
        window.alert('Kategori belum valid dari server. Buka ulang halaman Barang Masuk, pilih kategori dari daftar, atau minta admin membuat kategori di web.');
        this.isSubmitting = false;
        return;
      }

      const selectedLocationName = this.getSelectedLocationName();
      const newItem: InventoryItem = {
        id: '',
        name: this.form.itemName,
        sku: this.form.itemCode,
        barcode: barcodeValue,
        location: selectedLocationName,
        quantity: 0,
        unit: this.form.unit,
        category: this.form.category.trim() || 'Umum',
        categoryId: selectedCategoryId,
        icon: 'cube-outline',
        badgeClass: 'badge-green',
        quantityClass: 'qty-high',
        minThreshold: minThreshold,
        mediumThreshold: mediumThreshold
      };

      this.inventoryService.upsertItem(newItem).subscribe({
        next: (createdItem: any) => {
          const createdPayload = createdItem?.data || createdItem?.item || createdItem;
          const newId = String(createdPayload.id || createdPayload.item_id || createdPayload.item?.id || '').trim();
          if (!newId) {
            window.alert('Barang berhasil dibuat, tetapi ID barang dari server kosong. Refresh inventori lalu coba catat barang masuk lagi.');
            this.isSubmitting = false;
            return;
          }

          this.saveDisplayMeta([newId, this.form.itemCode, barcodeValue, createdPayload.barcode, createdPayload.sku, createdPayload.code]);
          this.saveGoodsInTransaction(newId, quantity);
        },
        error: error => {
          this.handleCreateItemError(error, quantity);
        }
      });
  }

  private resetForm() {
    this.form = {
      selectedItem: '',
      itemName: '',
      itemCode: this.createRandomItemCode(),
      barcode: '',
      category: '',
      unit: 'pcs',
      minThreshold: '50',
      mediumThreshold: '150',
      destLocation: '',
      quantity: '',
      notes: '',
    };
    this.activeLookupSource = '';
    this.barcodeLookupMessage = '';
  }

  private createRandomItemCode() {
    const datePart = new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

    return `GIN-${datePart}-${randomPart}`;
  }

  applyScannedBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();

    if (!barcode) {
      window.alert('Barcode tidak terbaca. Coba scan ulang.');
      return;
    }

    this.form.barcode = barcode;
    this.closeBarcodeScanner();
    this.lookupExistingItem(barcode, 'barcode', true);
  }

  private lookupExistingItem(rawValue: string, source: 'barcode' | 'code', fromScan = false) {
    const value = rawValue.trim();

    if (!value) {
      return;
    }

    const lookupKey = this.normalizeBarcode(value);
    if (this.lastLookupKeys[source] === lookupKey && this.form.selectedItem) {
      return;
    }
    this.lastLookupKeys[source] = lookupKey;

    const sourceLabel = source === 'barcode' ? 'barcode' : 'kode barang';
    this.barcodeLookupMessage = `Mencari barang dari ${sourceLabel}...`;

    const localItem = this.findLoadedItemByCodeOrBarcode(value);
    if (localItem) {
      this.fillFormFromItem(localItem, source === 'barcode' ? value : undefined, source);
      this.barcodeLookupMessage = 'Barang ditemukan. Data otomatis terisi.';
      return;
    }

    const lookup$ = source === 'barcode'
      ? this.inventoryService.getItemByBarcode(value)
      : this.inventoryService.getItemById(value);

    lookup$.subscribe({
      next: item => {
        if (!item) {
          if (fromScan || source === 'barcode') {
            this.form.selectedItem = '';
            this.barcodeLookupMessage = 'Barang belum terdaftar. Lengkapi data barang baru, lalu simpan.';
          } else {
            this.barcodeLookupMessage = 'Kode barang belum terdaftar. Lengkapi data barang baru, lalu simpan.';
          }
          return;
        }

        this.fillFormFromItem(item, source === 'barcode' ? value : undefined, source);
        this.barcodeLookupMessage = 'Barang ditemukan. Data otomatis terisi.';
      },
      error: () => {
        this.form.selectedItem = '';
        this.barcodeLookupMessage = 'Barang belum terdeteksi dari server. Lengkapi data barang baru, lalu simpan.';
      }
    });
  }

  private findLoadedItemByCodeOrBarcode(value: string) {
    const normalizedValue = this.normalizeBarcode(value);

    return this.inventoryItems.find(item => {
      const normalizedSku = this.normalizeBarcode(item.sku);
      const normalizedBarcodeField = item.barcode ? this.normalizeBarcode(item.barcode) : '';
      const normalizedId = this.normalizeBarcode(item.id);
      const normalizedName = this.normalizeBarcode(item.name);

      return normalizedSku === normalizedValue ||
        normalizedBarcodeField === normalizedValue ||
        normalizedSku.replace(/^sku-/, '') === normalizedValue ||
        normalizedId === normalizedValue ||
        normalizedName === normalizedValue;
    });
  }

  private fillFormFromItem(item: InventoryItem, scannedBarcode?: string, source: 'barcode' | 'code' = scannedBarcode ? 'barcode' : 'code') {
    this.form.selectedItem = item.id;
    this.activeLookupSource = source;
    this.form.itemName = item.name;
    this.form.itemCode = item.sku;
    this.form.barcode = scannedBarcode || item.barcode || '';
    this.form.unit = item.unit;
    this.form.category = item.category || '';
    this.form.minThreshold = String(item.minThreshold || 50);
    this.form.mediumThreshold = String(item.mediumThreshold || 150);
    this.form.destLocation = this.resolveLocationIdFromName(item.location);
    this.form.notes = item.notes || '';
  }

  private clearSelectedItemLock() {
    this.form.selectedItem = '';
    this.activeLookupSource = '';
    this.lastLookupKeys = {};
  }

  private resolveLocationIdFromName(name?: string): string {
    if (!name) return '';
    const cleanName = name.trim().toLowerCase();
    
    if (/^\d+$/.test(cleanName)) {
      return cleanName;
    }

    const searchName = cleanName
      .replace('gudang utama', 'main warehouse')
      .replace('area receiving', 'receiving area')
      .replace('gate inbound', 'receiving area')
      .replace('packing area', 'packing area')
      .replace('retail outlet', 'retail outlet');

    const found = this.locationsList.find(l => 
      l.name.toLowerCase() === searchName || 
      l.name.toLowerCase().includes(searchName) ||
      (l.display_name && (l.display_name.toLowerCase() === searchName || l.display_name.toLowerCase().includes(searchName)))
    );

    if (found) {
      return String(found.id);
    }

    const partialFound = this.locationsList.find(l => 
      searchName.includes(l.name.toLowerCase()) || 
      (l.display_name && searchName.includes(l.display_name.toLowerCase()))
    );

    if (partialFound) {
      return String(partialFound.id);
    }

    return this.locationsList.length ? String(this.locationsList[0].id) : '';
  }

  private normalizeBarcode(value: string) {
    return value.trim().toLowerCase();
  }

  private findExistingItemForSubmit() {
    if (this.form.selectedItem) {
      const selectedItem = this.inventoryItems.find(item => item.id === this.form.selectedItem);
      if (selectedItem) {
        return selectedItem;
      }
    }

    const normalizedCode = this.normalizeBarcode(this.form.itemCode);
    const normalizedBarcode = this.normalizeBarcode(this.form.barcode);
    const normalizedName = this.normalizeBarcode(this.form.itemName);

    return this.inventoryItems.find(item =>
      this.normalizeBarcode(item.sku) === normalizedCode ||
      (item.barcode && this.normalizeBarcode(item.barcode) === normalizedBarcode) ||
      this.normalizeBarcode(item.name) === normalizedName
    );
  }

  private lookupItemBeforeCreate(barcodeValue: string) {
    const cleanBarcode = barcodeValue.trim();

    if (cleanBarcode) {
      return this.inventoryService.getItemByBarcode(cleanBarcode);
    }

    return this.inventoryService.getItemById(this.form.itemCode);
  }

  private addGoodsInForExistingItem(existingItem: InventoryItem, quantity: number, barcodeValue: string) {
    this.form.selectedItem = existingItem.id;
    this.form.itemName = existingItem.name || this.form.itemName;
    this.form.itemCode = existingItem.sku || this.form.itemCode;
    this.form.barcode = this.form.barcode || existingItem.barcode || barcodeValue;
    this.form.unit = existingItem.unit || this.form.unit;
    this.form.category = existingItem.category || this.form.category || '';

    this.saveDisplayMeta([existingItem.id, existingItem.sku, existingItem.barcode, this.form.itemCode, barcodeValue]);
    this.saveGoodsInTransaction(existingItem.id, quantity);
  }

  private upsertLoadedInventoryItem(item: InventoryItem): InventoryItem[] {
    const itemKeys = [item.id, item.sku, item.barcode]
      .filter(Boolean)
      .map(key => this.normalizeBarcode(String(key)));

    const withoutDuplicate = this.inventoryItems.filter(existing => {
      const existingKeys = [existing.id, existing.sku, existing.barcode]
        .filter(Boolean)
        .map(key => this.normalizeBarcode(String(key)));

      return !existingKeys.some(key => itemKeys.includes(key));
    });

    return [item, ...withoutDuplicate];
  }

  private getSelectedCategoryId(): number | undefined {
    const selectedCategoryName = this.form.category.trim().toLowerCase();
    const selectedCategory = this.categoryOptions.find(category =>
      category.name.toLowerCase() === selectedCategoryName
    );

    return selectedCategory?.id;
  }

  private handleCreateItemError(error: unknown, quantity: number) {
    this.inventoryService.getItems().subscribe(items => {
      this.inventoryItems = items;
      const existingItem = this.findExistingItemForSubmit();

      if (existingItem) {
        this.saveGoodsInTransaction(existingItem.id, quantity);
        return;
      }

      this.isSubmitting = false;
      alert(this.createSaveErrorMessage(error));
    });
  }

  private saveGoodsInTransaction(itemId: string, quantity: number) {
    this.transactionService.addTransaction({
      itemId,
      type: 'in',
      quantity,
      notes: this.form.notes,
      toLocationName: String(this.form.destLocation),
      itemName: this.form.itemName,
      sku: this.form.itemCode,
      route: this.getSelectedLocationName(),
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.inventoryService.invalidateCache();
        this.notificationService.refresh();
        this.router.navigate(['/inventory']);
      },
      error: (error: any) => {
        this.isSubmitting = false;
        console.error('Transaction failed:', error);
        let errMsg = 'Barang sudah terdaftar, tetapi transaksi barang masuk gagal dicatat.';
        if (error?.error?.message) {
          errMsg += ` (${error.error.message})`;
        } else if (error?.message) {
          errMsg += ` (${error.message})`;
        }
        alert(errMsg);
      }
    });
  }

  private saveDisplayMeta(keys: Array<string | number | undefined>) {
    const locationName = this.getSelectedLocationName();
    const locationId = String(this.form.destLocation || '').trim();

    this.inventoryService.saveItemDisplayMeta(keys, {
      location: locationName,
      parentLocation: undefined,
      minThreshold: Number(this.form.minThreshold),
      mediumThreshold: Number(this.form.mediumThreshold),
      locations: [{
        name: locationName,
        parentLocation: undefined,
        backendValue: locationId || undefined,
        quantity: Number(this.form.quantity || 0),
      }],
    });
  }

  private getSelectedLocationName(): string {
    const selectedValue = String(this.form.destLocation || '').trim();
    const selectedLoc = this.locationsList.find(l =>
      String(l.id) === selectedValue ||
      this.getLocationLabel(l).toLowerCase() === selectedValue.toLowerCase() ||
      l.name.toLowerCase() === selectedValue.toLowerCase()
    );

    return selectedLoc ? this.getLocationLabel(selectedLoc) : (selectedValue || 'Main Warehouse');
  }

  private getLocationLabel(location: LocationItem): string {
    return location.display_name || location.name;
  }

  private createSaveErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      if (error instanceof Error) {
        return `Gagal mendaftarkan barang baru: ${error.message}`;
      }

      return 'Gagal mendaftarkan barang baru.';
    }

    const validationErrors = error.error?.errors;
    if (validationErrors) {
      const firstMessage = Object.values(validationErrors)
        .reduce<string[]>((messages, value) => {
          if (Array.isArray(value)) {
            return [...messages, ...value.filter((message): message is string => typeof message === 'string')];
          }

          if (typeof value === 'string') {
            return [...messages, value];
          }

          return messages;
        }, [])[0];

      if (firstMessage) {
        return `Gagal mendaftarkan barang baru: ${firstMessage}`;
      }
    }

    if (error.error?.message) {
      return `Gagal mendaftarkan barang baru: ${error.error.message}`;
    }

    if (error.status === 0) {
      return 'Gagal mendaftarkan barang baru. HP tidak bisa terhubung ke server.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gagal mendaftarkan barang baru. Akun operator tidak punya akses untuk menambah barang.';
    }

    if (error.status === 422) {
      return 'Gagal mendaftarkan barang baru. Data barang belum sesuai aturan server.';
    }

    return `Gagal mendaftarkan barang baru. Kode error: ${error.status}.`;
  }
}
