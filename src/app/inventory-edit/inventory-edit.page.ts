import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryItem, InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../services/notification.service';

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
    private notificationService: NotificationService,
  ) {}

  ionViewWillEnter() {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (!sku) {
      this.router.navigate(['/inventory']);
      return;
    }

    this.inventoryService.getItemBySku(sku).subscribe(item => {
      if (!item) {
        this.router.navigate(['/inventory']);
        return;
      }

      this.item = item;
      this.formData = {
        ...item,
      };
    });
  }

  goBack() {
    this.router.navigate(['/inventory-detail', this.item?.id]);
  }

  saveChanges() {
    if (!this.item) {
      alert('Data produk tidak ditemukan');
      return;
    }

    const minThreshold = Number(this.formData.minThreshold ?? this.item.minThreshold ?? 0);
    const mediumThreshold = Number(this.formData.mediumThreshold ?? this.item.mediumThreshold ?? 0);

    if (Number.isNaN(minThreshold) || Number.isNaN(mediumThreshold) || minThreshold < 0 || mediumThreshold < 0) {
      alert('Batas stok harus berupa angka yang valid.');
      return;
    }

    if (mediumThreshold <= minThreshold) {
      alert('Batas stok sedang harus lebih besar dari batas minimum stok.');
      return;
    }

    this.isSaving = true;

    this.inventoryService.updateStockAlerts(this.item, minThreshold, mediumThreshold).subscribe({
      next: (updatedBackendItem) => {
        const updatedItem = {
          ...this.item!,
          minThreshold: Number(updatedBackendItem?.low_stock_alert ?? minThreshold),
          mediumThreshold: Number(updatedBackendItem?.medium_stock_alert ?? mediumThreshold),
          updatedAt: updatedBackendItem?.updated_at || new Date().toISOString(),
        };

        this.notificationService.refresh();
        this.isSaving = false;
        alert('Batas stok produk berhasil diperbarui');
        this.router.navigate(['/inventory-detail', updatedItem.id]);
      },
      error: (err) => {
        this.isSaving = false;
        alert(this.createUpdateErrorMessage(err));
        console.error(err);
      }
    });
  }

  private createUpdateErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return error instanceof Error
        ? `Gagal memperbarui data produk: ${error.message}`
        : 'Gagal memperbarui data produk.';
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
        return `Gagal memperbarui data produk: ${firstMessage}`;
      }
    }

    if (error.error?.message) {
      return `Gagal memperbarui data produk: ${error.error.message}`;
    }

    if (error.status === 0) {
      return 'Gagal memperbarui data produk. HP tidak bisa terhubung ke server.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gagal memperbarui data produk. Akun tidak punya akses edit produk.';
    }

    return `Gagal memperbarui data produk. Kode error: ${error.status}.`;
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
