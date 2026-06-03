import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryItem, InventoryService } from '../inventory/inventory.service';

@Component({
  selector: 'app-inventory-edit',
  templateUrl: './inventory-edit.page.html',
  styleUrls: ['./inventory-edit.page.scss'],
  standalone: false,
})
export class InventoryEditPage {
  item?: InventoryItem;
  formData: Partial<InventoryItem> = {};
  isSaving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
  ) {}

  ionViewWillEnter() {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (!sku) {
      this.router.navigate(['/inventory']);
      return;
    }

    this.item = this.inventoryService.getItemBySku(sku);
    if (!this.item) {
      this.router.navigate(['/inventory']);
      return;
    }

    // Copy item data ke form
    this.formData = {
      ...this.item,
    };
  }

  goBack() {
    this.router.navigate(['/inventory-detail', this.item?.id]);
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.formData.imageData = typeof reader.result === 'string' ? reader.result : this.formData.imageData;
    };
    reader.readAsDataURL(file);
  }

  saveChanges() {
    if (!this.item || !this.formData.name || !this.formData.sku) {
      alert('Mohon isi semua field yang diperlukan');
      return;
    }

    this.isSaving = true;
    const nextQuantity = Number(this.formData.quantity ?? this.item.quantity);
    const nextLocation = (this.formData.location || this.item.location).trim();

    // Merge formData dengan item original
    const updatedItem: InventoryItem = {
      ...this.item,
      name: this.formData.name,
      sku: this.formData.sku,
      location: nextLocation,
      quantity: nextQuantity,
      unit: this.formData.unit || this.item.unit,
      category: this.formData.category?.trim() || 'Umum',
      expirationDate: this.formData.expirationDate,
      notes: this.formData.notes,
      imageData: this.formData.imageData,
      minThreshold: this.formData.minThreshold,
      mediumThreshold: this.formData.mediumThreshold,
      locations: [
        {
          name: nextLocation,
          quantity: nextQuantity,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    // Simpan ke service
    this.inventoryService.upsertItem(updatedItem);

    setTimeout(() => {
      this.isSaving = false;
      alert('Data produk berhasil diperbarui');
      this.router.navigate(['/inventory-detail', updatedItem.id]);
    }, 500);
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
}
