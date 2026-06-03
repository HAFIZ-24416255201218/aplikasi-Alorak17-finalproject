import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';

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

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
  ) {}

  ionViewWillEnter() {
    this.inventoryItems = this.inventoryService.getItems();
    this.resetForm();
  }

  onSelectItemChange() {
    this.form.fromLocation = '';
    this.form.toLocation = '';
  }

  close() {
    this.router.navigate(['/home']);
  }

  get selectedItem() {
    return this.inventoryItems.find(item => item.id === this.form.selectedItem);
  }

  get sourceLocationOptions() {
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
    const savedLocations = this.inventoryItems.reduce<string[]>((locations, item) => {
      if (item.locations?.length) {
        return [...locations, ...item.locations.map(location => location.name)];
      }

      return [...locations, item.location];
    }, []);

    return Array.from(new Set([...this.defaultDestLocations, ...savedLocations].filter(Boolean)))
      .map(location => ({ value: location, label: location }));
  }

  submit() {
    const selectedItem = this.inventoryService.getItemById(this.form.selectedItem);
    const quantity = Number(this.form.quantity);
    const fromLocation = this.form.fromLocation.trim();
    const toLocation = this.form.toLocation.trim();

    if (!selectedItem || Number.isNaN(quantity) || quantity <= 0 || !fromLocation || !toLocation) {
      window.alert('Pilih item, isi quantity, lokasi asal, dan lokasi tujuan dengan benar.');
      return;
    }

    if (fromLocation === toLocation) {
      window.alert('Lokasi tujuan harus berbeda dari lokasi asal.');
      return;
    }

    if (quantity > selectedItem.quantity) {
      window.alert('Quantity mutasi melebihi stok yang tersedia.');
      return;
    }

    const sourceLocation = selectedItem.locations?.find(location => this.getLocationPath(location) === fromLocation);
    if (!sourceLocation || quantity > sourceLocation.quantity) {
      window.alert('Quantity mutasi melebihi stok pada lokasi asal.');
      return;
    }

    const minThreshold = selectedItem.minThreshold || 50;
    const mediumThreshold = selectedItem.mediumThreshold || 150;

    const nextLocations = this.moveStockBetweenLocations(selectedItem.locations, fromLocation, toLocation, quantity);
    const nextQuantity = nextLocations.reduce((total, location) => total + location.quantity, 0);

    this.inventoryService.upsertItem({
      ...selectedItem,
      locations: nextLocations,
      quantity: nextQuantity,
      updatedAt: new Date().toISOString(),
      badgeClass: nextQuantity < minThreshold ? 'badge-red' : nextQuantity < mediumThreshold ? 'badge-yellow' : 'badge-green',
      quantityClass: nextQuantity < minThreshold ? 'qty-low' : nextQuantity < mediumThreshold ? 'qty-medium' : 'qty-high',
    });

    const createdAt = new Date();
    this.transactionService.addTransaction({
      type: 'move',
      name: selectedItem.name,
      productId: selectedItem.id,
      sku: selectedItem.sku,
      time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: localStorage.getItem('username') || 'Operator Gudang',
      route: `${fromLocation} -> ${toLocation}`,
      amount: `${quantity}`,
      note: this.form.notes,
      createdAt: createdAt.toISOString(),
    });

    this.router.navigate(['/inventory-detail', selectedItem.id]);
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
    locations: InventoryLocation[] = [],
    fromLocation: string,
    toLocation: string,
    quantity: number,
  ) {
    const nextLocations = locations.map(location => ({ ...location }));
    const source = nextLocations.find(location => this.getLocationPath(location) === fromLocation);

    if (source) {
      source.quantity = Math.max(0, source.quantity - quantity);
    }

    const destination = nextLocations.find(location => this.getLocationPath(location) === toLocation);
    if (destination) {
      destination.quantity += quantity;
    } else {
      const destinationLocation = this.parseLocationPath(toLocation);
      nextLocations.push({ ...destinationLocation, quantity });
    }

    return nextLocations.filter(location => location.quantity > 0);
  }

  private uniqueLocationOptions(locations: InventoryLocation[]) {
    const options = locations
      .filter(location => location.name)
      .map(location => {
        const path = this.getLocationPath(location);
        return { value: path, label: path };
      });

    return Array.from(new Map(options.map(option => [option.value, option])).values());
  }

  private getLocationPath(location: Pick<InventoryLocation, 'name' | 'parentLocation'>) {
    return location.parentLocation ? `${location.parentLocation}/${location.name}` : location.name;
  }

  private parseLocationPath(path: string): Pick<InventoryLocation, 'name' | 'parentLocation'> {
    const parts = path.split('/');
    const name = parts.pop() || path;
    const parentLocation = parts.join('/');

    return parentLocation ? { name, parentLocation } : { name };
  }
}
