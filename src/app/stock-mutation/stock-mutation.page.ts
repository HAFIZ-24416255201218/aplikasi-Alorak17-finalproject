import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';
import { LocationService, LocationItem } from '../services/location.service';
import { NotificationService } from '../services/notification.service';
import { SearchableSelectOption } from '../shared/searchable-select/searchable-select.component';

interface LocationOption {
  value: string;
  backendValue: string;
  label: string;
  quantity: number;
}

@Component({
  selector: 'app-stock-mutation',
  templateUrl: './stock-mutation.page.html',
  styleUrls: ['./stock-mutation.page.scss'],
  standalone: false,
})
export class StockMutationPage {
  form = {
    selectedItem: '',
    itemName: '',
    itemCode: '',
    barcode: '',
    category: '',
    unit: 'pcs',
    minThreshold: '',
    mediumThreshold: '',
    quantity: '',
    fromLocation: '',
    toLocation: '',
    notes: '',
  };

  inventoryItems: InventoryItem[] = [];
  locationsList: LocationItem[] = [];
  isSubmitting = false;
  isScannerOpen = false;
  lookupMessage = '';
  activeLookupSource: 'barcode' | 'code' | '' = '';
  private lookupTimers: Partial<Record<'barcode' | 'code', number>> = {};
  private lastLookupKeys: Partial<Record<'barcode' | 'code', string>> = {};

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
    this.inventoryService.getItems().subscribe(items => {
      this.inventoryItems = items;
    });
    this.locationService.getLocations().subscribe(locations => {
      this.locationsList = locations;
    });
    this.resetForm();
  }

  get sourceSelectOptions(): SearchableSelectOption[] {
    return this.sourceLocationOptions.map(location => ({
      value: location.value,
      label: location.quantity > 0
        ? `${location.label} - ${location.quantity} ${this.selectedItem?.unit || 'unit'}`
        : location.label,
    }));
  }

  get destinationSelectOptions(): SearchableSelectOption[] {
    return this.destinationLocationOptions.map(location => ({
      value: location.value,
      label: location.label,
    }));
  }

  close() {
    this.router.navigate(['/home']);
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

  lookupExistingItemFromCode() {
    this.lookupExistingItem(this.form.itemCode, 'code');
  }

  lookupExistingItemFromBarcode() {
    this.lookupExistingItem(this.form.barcode, 'barcode');
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

  applyScannedBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();

    if (!barcode) {
      window.alert('Barcode tidak terbaca. Coba scan ulang.');
      return;
    }

    this.form.barcode = barcode;
    this.closeBarcodeScanner();
    this.lookupExistingItem(barcode, 'barcode');
  }

  scheduleExistingItemLookup(value: string, source: 'barcode' | 'code') {
    const cleanValue = String(value || '').trim();

    if (this.lookupTimers[source]) {
      window.clearTimeout(this.lookupTimers[source]);
      this.lookupTimers[source] = undefined;
    }

    if (!cleanValue) {
      this.clearSelectedItemLock();
      this.lookupMessage = '';
      return;
    }

    this.lookupTimers[source] = window.setTimeout(() => {
      this.lookupExistingItem(cleanValue, source);
    }, 450);
  }

  get selectedItem() {
    return this.inventoryItems.find(item => item.id === this.form.selectedItem);
  }

  get sourceLocationOptions(): LocationOption[] {
    const item = this.selectedItem;

    if (!item) {
      return [];
    }

    const locations = this.getBalancedSourceLocations(item);
    const sourceOptions = this.uniqueLocationOptions(locations);

    return Array.from(new Map(sourceOptions.map(option => [option.label, option])).values());
  }

  get destinationLocationOptions() {
    return this.locationsList.map(loc => ({
      value: String(loc.id),
      label: loc.display_name || loc.name,
    }));
  }

  submit() {
    if (this.isSubmitting) {
      return;
    }

    const selectedItem = this.inventoryItems.find(item => item.id === this.form.selectedItem);
    const quantity = Number(this.form.quantity);
    const fromLocationOption = this.sourceLocationOptions.find(location => location.value === this.form.fromLocation);
    const toLocation = this.form.toLocation.trim();

    if (!selectedItem || Number.isNaN(quantity) || quantity <= 0 || !fromLocationOption || !toLocation) {
      window.alert('Pilih barang, isi jumlah, lokasi asal, dan lokasi tujuan dengan benar.');
      return;
    }

    if (quantity > selectedItem.quantity) {
      window.alert(`Jumlah mutasi melebihi total stok yang tersedia (${selectedItem.quantity} ${selectedItem.unit}).`);
      return;
    }

    if (quantity > fromLocationOption.quantity) {
      window.alert(`Jumlah mutasi melebihi stok di ${fromLocationOption.label} (${fromLocationOption.quantity} ${selectedItem.unit}).`);
      return;
    }

    const matchingTo = this.locationsList.find(l =>
      String(l.id) === String(toLocation) ||
      (l.display_name || l.name).toLowerCase() === toLocation.toLowerCase() ||
      l.name.toLowerCase() === toLocation.toLowerCase()
    );
    const toLocationName = matchingTo ? (matchingTo.display_name || matchingTo.name) : toLocation;
    const fromLocationVal = fromLocationOption.backendValue || this.resolveBackendLocationValue(fromLocationOption.label);
    const toLocationVal = matchingTo ? String(matchingTo.id) : (this.resolveBackendLocationValue(toLocationName) || toLocation);

    if (!/^\d+$/.test(fromLocationVal) || !/^\d+$/.test(toLocationVal)) {
      window.alert('Lokasi asal atau tujuan belum punya ID valid dari server. Refresh halaman, lalu pilih lokasi dari daftar server.');
      return;
    }

    if (this.isSameLocation(fromLocationOption.label, toLocationName, fromLocationVal, toLocationVal)) {
      window.alert('Lokasi tujuan harus berbeda dari lokasi asal.');
      return;
    }

    this.isSubmitting = true;

    this.transactionService.addTransaction({
      itemId: selectedItem.id,
      type: 'move',
      quantity: quantity,
      notes: this.form.notes,
      fromLocationName: fromLocationVal,
      toLocationName: toLocationVal,
      itemName: selectedItem.name,
      sku: selectedItem.sku,
      route: `${fromLocationOption.label} -> ${toLocationName}`,
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.notificationService.refresh();
        const nextLocations = this.moveStockBetweenLocations(
          this.getBalancedSourceLocations(selectedItem),
          fromLocationOption.label,
          toLocationName,
          fromLocationVal,
          toLocationVal,
          quantity
        );

        this.inventoryService.saveItemDisplayMeta([selectedItem.id, selectedItem.sku, selectedItem.barcode], {
          location: toLocationName,
          parentLocation: undefined,
          minThreshold: selectedItem.minThreshold,
          mediumThreshold: selectedItem.mediumThreshold,
          locations: nextLocations,
        });
        this.inventoryService.invalidateCache();

        this.router.navigate(['/inventory-detail', selectedItem.id]);
      },
      error: error => {
        this.isSubmitting = false;
        window.alert(this.createMutationErrorMessage(error));
      },
    });
  }

  private resetForm() {
    this.form = {
      selectedItem: '',
      itemName: '',
      itemCode: '',
      barcode: '',
      category: '',
      unit: 'pcs',
      minThreshold: '',
      mediumThreshold: '',
      quantity: '',
      fromLocation: '',
      toLocation: '',
      notes: '',
    };
    this.lookupMessage = '';
    this.activeLookupSource = '';
    this.lastLookupKeys = {};
  }

  private lookupExistingItem(rawValue: string, source: 'barcode' | 'code') {
    const value = rawValue.trim();

    if (!value) {
      return;
    }

    const lookupKey = this.normalizeLookupValue(value);
    if (this.lastLookupKeys[source] === lookupKey && this.form.selectedItem) {
      return;
    }
    this.lastLookupKeys[source] = lookupKey;

    this.lookupMessage = `Mencari barang dari ${source === 'barcode' ? 'barcode' : 'kode barang'}...`;

    const localItem = this.findLoadedItemByCodeOrBarcode(value);
    if (localItem) {
      this.fillFormWithDetailedItem(localItem, source);
      return;
    }

    const lookup$ = source === 'barcode'
      ? this.inventoryService.getItemByBarcode(value)
      : this.inventoryService.getItemById(value);

    lookup$.subscribe({
      next: item => {
        if (!item) {
          this.clearSelectedItemLock();
          this.lookupMessage = 'Barang belum terdaftar. Mutasi hanya bisa untuk barang yang sudah ada.';
          return;
        }

        this.inventoryItems = this.upsertLoadedInventoryItem(item);
        this.fillFormFromItem(item, source);
        this.lookupMessage = 'Barang ditemukan. Data otomatis terisi.';
      },
      error: () => {
        this.clearSelectedItemLock();
        this.lookupMessage = 'Barang belum terdeteksi dari server.';
      },
    });
  }

  private fillFormWithDetailedItem(localItem: InventoryItem, source: 'barcode' | 'code') {
    this.inventoryService.getItemById(localItem.id).subscribe({
      next: detailedItem => {
        const item = detailedItem || localItem;
        this.inventoryItems = this.upsertLoadedInventoryItem(item);
        this.fillFormFromItem(item, source);
        this.lookupMessage = 'Barang ditemukan. Data otomatis terisi.';
      },
      error: () => {
        this.fillFormFromItem(localItem, source);
        this.lookupMessage = 'Barang ditemukan. Data otomatis terisi.';
      },
    });
  }

  private fillFormFromItem(item: InventoryItem, source: 'barcode' | 'code') {
    this.form.selectedItem = item.id;
    this.activeLookupSource = source;
    this.form.itemName = item.name;
    this.form.itemCode = item.sku;
    this.form.barcode = source === 'barcode' ? this.form.barcode : (item.barcode || '');
    this.form.category = item.category || '';
    this.form.unit = item.unit;
    this.form.minThreshold = String(item.minThreshold || 50);
    this.form.mediumThreshold = String(item.mediumThreshold || 150);
    this.form.fromLocation = this.sourceLocationOptions[0]?.value || this.resolveBackendLocationValue(item.location);
    this.form.toLocation = '';
    this.form.quantity = '';
  }

  private clearSelectedItemLock() {
    this.form.selectedItem = '';
    this.activeLookupSource = '';
    this.lastLookupKeys = {};
  }

  private findLoadedItemByCodeOrBarcode(value: string) {
    const normalizedValue = this.normalizeLookupValue(value);

    return this.inventoryItems.find(item =>
      this.normalizeLookupValue(item.sku) === normalizedValue ||
      this.normalizeLookupValue(item.sku).replace(/^sku-/, '') === normalizedValue ||
      (item.barcode && this.normalizeLookupValue(item.barcode) === normalizedValue) ||
      this.normalizeLookupValue(item.id) === normalizedValue
    );
  }

  private upsertLoadedInventoryItem(item: InventoryItem): InventoryItem[] {
    const itemKeys = [item.id, item.sku, item.barcode]
      .filter(Boolean)
      .map(key => this.normalizeLookupValue(String(key)));

    const withoutDuplicate = this.inventoryItems.filter(existing => {
      const existingKeys = [existing.id, existing.sku, existing.barcode]
        .filter(Boolean)
        .map(key => this.normalizeLookupValue(String(key)));

      return !existingKeys.some(key => itemKeys.includes(key));
    });

    return [item, ...withoutDuplicate];
  }

  private normalizeLookupValue(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private getBalancedSourceLocations(item: InventoryItem): InventoryLocation[] {
    const primaryLocation = this.getPrimarySourceLocation(item);
    const serverLocations = item.hasServerStockLocations && item.locations?.length
      ? item.locations.filter(location => Number(location.quantity || 0) > 0)
      : [];
    const sourceLocations = serverLocations.length
      ? serverLocations
      : [primaryLocation];
    const locations = sourceLocations.map(location => ({
      ...location,
      quantity: Number(location.quantity || 0),
    }));

    if (serverLocations.length) {
      return locations;
    }

    const totalStock = Number(item.quantity || 0);
    const locationTotal = locations.reduce((sum, location) => sum + Number(location.quantity || 0), 0);

    if (!locations.length || totalStock <= 0 || locationTotal >= totalStock) {
      return locations;
    }

    const difference = totalStock - locationTotal;
    const firstLocation = locations[0];

    return [
      {
        ...firstLocation,
        quantity: Number(firstLocation.quantity || 0) + difference,
      },
      ...locations.slice(1),
    ];
  }

  private getPrimarySourceLocation(item: InventoryItem): InventoryLocation {
    const name = item.location || 'Main Warehouse';
    return {
      name,
      parentLocation: item.parentLocation,
      backendValue: this.resolveBackendLocationValue(name) || '1',
      quantity: Number(item.quantity || 0),
    };
  }

  private moveStockBetweenLocations(
    locations: InventoryLocation[],
    fromLocation: string,
    toLocation: string,
    fromBackendValue: string,
    toBackendValue: string,
    quantity: number
  ): InventoryLocation[] {
    const nextLocations = locations.map(location => ({ ...location, quantity: Number(location.quantity || 0) }));
    const fromPath = this.normalizeLocationPath(fromLocation);
    const toLocationParts = this.parseLocationPath(toLocation);
    const toPath = this.normalizeLocationPath(this.getLocationPath(toLocationParts));
    const source = nextLocations.find(location => this.normalizeLocationPath(this.getLocationPath(location)) === fromPath);

    if (source) {
      source.quantity = Math.max(0, source.quantity - quantity);
      source.backendValue = source.backendValue || fromBackendValue;
    }

    const destination = nextLocations.find(location => this.normalizeLocationPath(this.getLocationPath(location)) === toPath);
    if (destination) {
      destination.quantity += quantity;
      destination.backendValue = destination.backendValue || toBackendValue;
    } else {
      nextLocations.push({ ...toLocationParts, backendValue: toBackendValue, quantity });
    }

    return nextLocations.filter(location => location.quantity > 0);
  }

  private uniqueLocationOptions(locations: InventoryLocation[]) {
    const options = locations
      .filter(location => location.name && Number(location.quantity || 0) > 0)
      .map(location => {
        const label = this.getLocationPath(location);
        const backendValue = location.backendValue || this.resolveBackendLocationValue(label);
        return {
          value: backendValue || label,
          backendValue,
          label,
          quantity: Number(location.quantity || 0),
        };
      });

    return Array.from(new Map(options.map(option => [option.label, option])).values());
  }

  private getLocationPath(location: Pick<InventoryLocation, 'name' | 'parentLocation'>) {
    return location.parentLocation && !location.name.includes('/') ? `${location.parentLocation}/${location.name}` : location.name;
  }

  private parseLocationPath(path: string): Pick<InventoryLocation, 'name' | 'parentLocation'> {
    const parts = path.split('/').map(part => part.trim()).filter(Boolean);
    const name = parts.pop() || path;
    const parentLocation = parts.join('/');

    return parentLocation ? { name, parentLocation } : { name };
  }

  private normalizeLocationPath(path: string): string {
    return path
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace('gudang utama', 'main warehouse')
      .replace('area receiving', 'receiving area')
      .replace('gate inbound', 'receiving area');
  }

  private resolveBackendLocationValue(locationName: string): string {
    const cleanName = locationName.trim();
    const normalizedName = cleanName.toLowerCase();

    if (/^\d+$/.test(cleanName)) {
      return cleanName;
    }

    const searchName = normalizedName
      .replace('gudang utama', 'main warehouse')
      .replace('area receiving', 'receiving area')
      .replace('gate inbound', 'receiving area')
      .replace('packing area', 'packing area')
      .replace('retail outlet', 'retail outlet');

    if (searchName === 'main warehouse' || searchName === 'gudang utama') {
      return '1';
    }

    if (searchName === 'main warehouse/rak a') {
      return '5';
    }

    if (searchName.endsWith('/01') || searchName === '01') {
      return '6';
    }

    if (searchName.endsWith('/02') || searchName === '02') {
      return '7';
    }

    if (searchName.endsWith('/03') || searchName === '03') {
      return '8';
    }

    const match = this.findBestLocationMatch(searchName);

    return match?.id ? String(match.id) : '';
  }

  private findBestLocationMatch(searchName: string): LocationItem | undefined {
    const lastSegment = searchName.split('/').pop()?.trim() || searchName;
    const candidates = this.locationsList.map(location => ({
      location,
      name: location.name.toLowerCase(),
      displayName: (location.display_name || location.name).toLowerCase(),
    }));

    return candidates.find(candidate =>
      candidate.name === searchName || candidate.displayName === searchName
    )?.location || candidates.find(candidate =>
      candidate.name === lastSegment || candidate.displayName === lastSegment
    )?.location || candidates
      .filter(candidate =>
        searchName.includes(candidate.name) ||
        searchName.includes(candidate.displayName) ||
        candidate.name.includes(searchName) ||
        candidate.displayName.includes(searchName)
      )
      .sort((a, b) => Math.max(b.name.length, b.displayName.length) - Math.max(a.name.length, a.displayName.length))[0]?.location;
  }

  private isSameLocation(fromLabel: string, toLabel: string, fromValue: string, toValue: string): boolean {
    const fromBackendId = /^\d+$/.test(fromValue) ? fromValue : '';
    const toBackendId = /^\d+$/.test(toValue) ? toValue : '';

    if (fromBackendId && toBackendId) {
      return fromBackendId === toBackendId;
    }

    return this.normalizeLocationPath(fromLabel) === this.normalizeLocationPath(toLabel);
  }

  private createMutationErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Gagal memproses mutasi barang.';
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
        return `Gagal memproses mutasi barang: ${firstMessage}`;
      }
    }

    if (error.status === 0) {
      return 'Gagal memproses mutasi barang. HP tidak bisa terhubung ke server.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gagal memproses mutasi barang. Akun tidak punya akses transaksi.';
    }

    if (error.error?.message) {
      return `Gagal memproses mutasi barang: ${error.error.message}`;
    }

    return `Gagal memproses mutasi barang. Kode error: ${error.status}.`;
  }
}
