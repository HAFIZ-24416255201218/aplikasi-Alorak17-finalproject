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
  selector: 'app-goods-out',
  templateUrl: './goods-out.page.html',
  styleUrls: ['./goods-out.page.scss'],
  standalone: false,
})
export class GoodsOutPage {
  form = {
    selectedItem: '',
    quantity: '',
    fromLocation: '',
    notes: '',
  };

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

  close() {
    this.router.navigate(['/home']);
  }

  onSelectItemChange() {
    this.form.quantity = '';
    this.form.fromLocation = this.sourceLocationOptions[0]?.value || '';
  }

  submit() {
    if (this.isSubmitting) {
      return;
    }

    const selectedItem = this.inventoryItems.find(item => item.id === this.form.selectedItem);
    const quantity = Number(this.form.quantity);
    const sourceLocation = this.sourceLocationOptions.find(location => location.value === this.form.fromLocation);

    if (!selectedItem || Number.isNaN(quantity) || quantity <= 0 || !this.form.fromLocation) {
      window.alert('Pilih barang, lokasi asal, dan isi jumlah yang valid.');
      return;
    }

    if (quantity > selectedItem.quantity) {
      window.alert(`Jumlah melebihi total stok yang tersedia (${selectedItem.quantity} ${selectedItem.unit}).`);
      return;
    }

    if (sourceLocation && quantity > sourceLocation.quantity) {
      window.alert(`Jumlah melebihi stok di ${sourceLocation.label} (${sourceLocation.quantity} ${selectedItem.unit}).`);
      return;
    }

    const fromLocationId = sourceLocation?.backendValue || this.form.fromLocation;
    if (!/^\d+$/.test(fromLocationId)) {
      window.alert('Lokasi asal belum punya ID valid dari server. Refresh inventori, lalu pilih barang dari daftar server.');
      return;
    }

    this.isSubmitting = true;

    this.transactionService.addTransaction({
      itemId: selectedItem.id,
      type: 'out',
      quantity: quantity,
      notes: this.form.notes,
      fromLocationName: fromLocationId,
      itemName: selectedItem.name,
      sku: selectedItem.sku,
      route: sourceLocation?.label,
    }).subscribe({
      next: response => {
        this.rememberUpdatedStock(selectedItem, quantity, sourceLocation, response);
        this.notificationService.refresh();
        this.router.navigate(['/inventory-detail', selectedItem.id]);
      },
      error: error => {
        this.isSubmitting = false;
        window.alert(this.createGoodsOutErrorMessage(error));
      }
    });
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

  private getBalancedSourceLocations(item: InventoryItem): InventoryLocation[] {
    const locations = (item.locations?.length
      ? item.locations
      : [{ name: item.location, parentLocation: item.parentLocation, quantity: item.quantity }]
    ).map(location => ({
      ...location,
      quantity: Number(location.quantity || 0),
    }));

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

  private resetForm() {
    this.form = {
      selectedItem: '',
      quantity: '',
      fromLocation: '',
      notes: '',
    };
  }

  private rememberUpdatedStock(
    item: InventoryItem,
    quantity: number,
    sourceLocation: LocationOption | undefined,
    response: any
  ) {
    const responseItem = response?.item || response?.data?.item || response?.transaction?.item;
    const nextQuantity = Math.max(0, Number(responseItem?.current_stock ?? item.quantity - quantity));
    const updatedAt = responseItem?.updated_at || response?.updated_at || new Date().toISOString();
    const updatedLocations = this.reduceSourceLocationStock(item, sourceLocation, quantity, nextQuantity);

    this.inventoryService.saveItemDisplayMeta([item.id, item.sku, item.barcode], {
      location: updatedLocations[0]?.name || item.location,
      parentLocation: updatedLocations[0]?.parentLocation || item.parentLocation,
      locations: updatedLocations,
    });

    this.inventoryService.rememberItemSnapshot({
      ...item,
      quantity: nextQuantity,
      locations: updatedLocations,
      updatedAt,
      quantityClass: this.getQuantityClass(nextQuantity, item),
    });
  }

  private reduceSourceLocationStock(
    item: InventoryItem,
    sourceLocation: LocationOption | undefined,
    quantity: number,
    totalQuantity: number
  ): InventoryLocation[] {
    const sourceLabel = sourceLocation?.label || item.location;
    const sourceBackendValue = sourceLocation?.backendValue || sourceLocation?.value;
    const locations = this.getBalancedSourceLocations(item).map(location => ({
      ...location,
      quantity: Number(location.quantity || 0),
    }));

    const targetIndex = locations.findIndex(location =>
      this.getLocationPath(location) === sourceLabel ||
      location.backendValue === sourceBackendValue
    );

    if (targetIndex >= 0) {
      locations[targetIndex] = {
        ...locations[targetIndex],
        quantity: Math.max(0, Number(locations[targetIndex].quantity || 0) - quantity),
      };
    } else if (locations.length) {
      locations[0] = {
        ...locations[0],
        quantity: Math.max(0, Number(locations[0].quantity || 0) - quantity),
      };
    }

    const filteredLocations = locations.filter(location => location.name && location.quantity > 0);

    if (filteredLocations.length) {
      return filteredLocations;
    }

    return totalQuantity > 0
      ? [{ name: item.location, parentLocation: item.parentLocation, backendValue: sourceBackendValue, quantity: totalQuantity }]
      : [];
  }

  private getQuantityClass(quantity: number, item: InventoryItem) {
    const minThreshold = item.minThreshold || 10;
    const mediumThreshold = item.mediumThreshold || 50;

    if (quantity <= minThreshold) {
      return 'qty-low';
    }

    if (quantity <= mediumThreshold) {
      return 'qty-medium';
    }

    return 'qty-high';
  }

  private getLocationPath(location: Pick<InventoryLocation, 'name' | 'parentLocation'>) {
    return location.parentLocation && !location.name.includes('/')
      ? `${location.parentLocation}/${location.name}`
      : location.name;
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

    const bestMatch = this.findBestLocationMatch(searchName);
    if (bestMatch) {
      return String(bestMatch.id);
    }

    return '';
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

  private createGoodsOutErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      if (error instanceof Error) {
        return `Gagal mencatat barang keluar: ${error.message}`;
      }

      return 'Gagal mencatat transaksi barang keluar.';
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
        return `Gagal mencatat barang keluar: ${firstMessage}`;
      }
    }

    if (error.status === 0) {
      return 'Gagal mencatat barang keluar. HP tidak bisa terhubung ke server.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gagal mencatat barang keluar. Akun tidak punya akses transaksi.';
    }

    if (error.error?.message) {
      return `Gagal mencatat barang keluar: ${error.error.message}`;
    }

    return `Gagal mencatat barang keluar. Kode error: ${error.status}.`;
  }
}
