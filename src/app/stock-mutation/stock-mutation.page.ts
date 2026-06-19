import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';
import { LocationService, LocationItem } from '../services/location.service';
import { NotificationService } from '../services/notification.service';

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
    quantity: '',
    fromLocation: '',
    toLocation: '',
    notes: '',
  };

  readonly defaultDestLocations = [
    'Rak A1-01',
    'Rak A1-02',
    'Rak A1-03',
    'Rak A1-04',
    'Rak B1-01',
    'Rak B1-02',
    'Rak B1-03',
    'Rak B1-04',
    'Rak C1-01',
    'Rak C1-02',
    'Rak C1-03',
    'Rak C1-04',
    'Gate Inbound',
    'Area Receiving',
  ];

  inventoryItems: InventoryItem[] = [];
  locationsList: LocationItem[] = [];
  isSubmitting = false;

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
    private locationService: LocationService,
    private notificationService: NotificationService,
  ) {}

  ionViewWillEnter() {
    this.inventoryService.getItems().subscribe(items => {
      this.inventoryItems = items;
    });
    this.locationService.getLocations().subscribe(locations => {
      this.locationsList = locations;
    });
    this.resetForm();
  }

  onSelectItemChange() {
    this.form.fromLocation = this.sourceLocationOptions[0]?.value || '';
    this.form.toLocation = '';
    this.form.quantity = '';
  }

  close() {
    this.router.navigate(['/home']);
  }

  get selectedItem() {
    return this.inventoryItems.find(item => item.id === this.form.selectedItem);
  }

  get sourceLocationOptions(): LocationOption[] {
    const item = this.selectedItem;

    if (!item) {
      return [];
    }

    const locations = item.locations?.length
      ? item.locations
      : [{ name: item.location, parentLocation: item.parentLocation, quantity: item.quantity }];

    return this.uniqueLocationOptions(locations);
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
        this.notificationService.refresh();
        const nextLocations = this.moveStockBetweenLocations(
          selectedItem.locations?.length
            ? selectedItem.locations
            : [{ name: selectedItem.location, parentLocation: selectedItem.parentLocation, quantity: selectedItem.quantity }],
          fromLocationOption.label,
          toLocationName,
          quantity
        );

        this.inventoryService.saveItemDisplayMeta([selectedItem.id, selectedItem.sku], {
          location: toLocationName,
          parentLocation: undefined,
          minThreshold: selectedItem.minThreshold,
          mediumThreshold: selectedItem.mediumThreshold,
          locations: nextLocations,
        });

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
      quantity: '',
      fromLocation: '',
      toLocation: '',
      notes: '',
    };
  }

  private moveStockBetweenLocations(
    locations: InventoryLocation[],
    fromLocation: string,
    toLocation: string,
    quantity: number
  ): InventoryLocation[] {
    const nextLocations = locations.map(location => ({ ...location, quantity: Number(location.quantity || 0) }));
    const fromPath = this.normalizeLocationPath(fromLocation);
    const toLocationParts = this.parseLocationPath(toLocation);
    const toPath = this.normalizeLocationPath(this.getLocationPath(toLocationParts));
    const source = nextLocations.find(location => this.normalizeLocationPath(this.getLocationPath(location)) === fromPath);

    if (source) {
      source.quantity = Math.max(0, source.quantity - quantity);
    }

    const destination = nextLocations.find(location => this.normalizeLocationPath(this.getLocationPath(location)) === toPath);
    if (destination) {
      destination.quantity += quantity;
    } else {
      nextLocations.push({ ...toLocationParts, quantity });
    }

    return nextLocations.filter(location => location.quantity > 0);
  }

  private uniqueLocationOptions(locations: InventoryLocation[]) {
    const options = locations
      .filter(location => location.name)
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
