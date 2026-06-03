import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';

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

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
  ) {}

  ionViewWillEnter() {
    this.inventoryItems = this.inventoryService.getItems();
    this.resetForm();
  }

  close() {
    this.router.navigate(['/home']);
  }

  submit() {
    const selectedItem = this.inventoryService.getItemById(this.form.selectedItem);
    const quantity = Number(this.form.quantity);

    if (!selectedItem || Number.isNaN(quantity) || quantity <= 0) {
      window.alert('Pilih item dan isi quantity yang valid.');
      return;
    }

    if (quantity > selectedItem.quantity) {
      window.alert('Quantity melebihi stok yang tersedia.');
      return;
    }

    const nextQuantity = selectedItem.quantity - quantity;
    const minThreshold = selectedItem.minThreshold || 50;
    const mediumThreshold = selectedItem.mediumThreshold || 150;

    this.inventoryService.upsertItem({
      ...selectedItem,
      quantity: nextQuantity,
      locations: this.removeStockFromLocations(selectedItem.locations, quantity),
      updatedAt: new Date().toISOString(),
      badgeClass: nextQuantity < minThreshold ? 'badge-red' : nextQuantity < mediumThreshold ? 'badge-yellow' : 'badge-green',
      quantityClass: nextQuantity < minThreshold ? 'qty-low' : nextQuantity < mediumThreshold ? 'qty-medium' : 'qty-high',
    });

    const createdAt = new Date();
    this.transactionService.addTransaction({
      type: 'out',
      name: selectedItem.name,
      productId: selectedItem.id,
      sku: selectedItem.sku,
      time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: localStorage.getItem('username') || 'Operator Gudang',
      route: selectedItem.location,
      amount: `-${quantity}`,
      note: this.form.notes,
      createdAt: createdAt.toISOString(),
    });

    this.router.navigate(['/inventory-detail', selectedItem.id]);
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
      ? item.locations.map(location => location.parentLocation ? `${location.parentLocation}/${location.name}` : location.name)
      : [item.location];

    return Array.from(new Set(locations.filter(Boolean)));
  }

  private resetForm() {
    this.form = {
      selectedItem: '',
      quantity: '',
      fromLocation: '',
      notes: '',
    };
  }

  private removeStockFromLocations(locations: InventoryLocation[] = [], quantity: number) {
    let remaining = quantity;

    return locations
      .map(location => {
        if (remaining <= 0) {
          return { ...location };
        }

        const deducted = Math.min(location.quantity, remaining);
        remaining -= deducted;
        return {
          ...location,
          quantity: location.quantity - deducted,
        };
      })
      .filter(location => location.quantity > 0);
  }
}
