import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { AuthService } from '../services/auth.service';
import { TransactionItem, TransactionService } from '../transactions/transaction.service';

interface TransactionLine {
  icon: string;
  iconClass: string;
  amount: string;
  type: string;
  meta: string;
}

@Component({
  selector: 'app-inventory-detail',
  templateUrl: './inventory-detail.page.html',
  styleUrls: ['./inventory-detail.page.scss'],
  standalone: false,
})
export class InventoryDetailPage implements OnInit, OnDestroy {
  item?: InventoryItem;
  transactions: TransactionLine[] = [];
  private destroy$ = new Subject<void>();
  private lastLoadedItemId = '';
  private lastLoadedAt = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
    private authService: AuthService
  ) {}

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  get healthStatus(): 'RENDAH' | 'SEDANG' | 'TINGGI' {
    if (!this.item) {
      return 'RENDAH';
    }

    const minThreshold = this.item.minThreshold ?? 10;
    const mediumThreshold = this.item.mediumThreshold ?? 50;

    if (this.item.quantity <= minThreshold) return 'RENDAH';
    if (this.item.quantity <= mediumThreshold) return 'SEDANG';
    return 'TINGGI';
  }

  get healthStatusClass(): 'low' | 'medium' | 'high' {
    if (!this.item) {
      return 'low';
    }

    const minThreshold = this.item.minThreshold ?? 10;
    const mediumThreshold = this.item.mediumThreshold ?? 50;

    if (this.item.quantity <= minThreshold) return 'low';
    if (this.item.quantity <= mediumThreshold) return 'medium';
    return 'high';
  }

  get productLocations(): InventoryLocation[] {
    if (!this.item) {
      return [];
    }

    if (this.item.locations?.length) {
      return this.item.locations.map(location => ({
        ...location,
        name: location.parentLocation && !location.name.includes('/')
          ? `${location.parentLocation}/${location.name}`
          : location.name,
      }));
    }

    return [{ name: this.item.location, quantity: this.item.quantity }];
  }

  get totalLocationStock(): number {
    return this.productLocations.reduce((total, location) => total + Number(location.quantity || 0), 0);
  }

  get lastUpdatedText(): string {
    if (!this.item?.updatedAt) {
      return '-';
    }

    return this.getRelativeTime(this.item.updatedAt);
  }

  ngOnInit() {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => this.loadItem(params.get('sku') || params.get('id') || ''))
      )
      .subscribe(item => this.applyLoadedItem(item));
  }

  ionViewWillEnter() {
    const itemId = this.route.snapshot.paramMap.get('sku') || this.route.snapshot.paramMap.get('id') || '';
    const wasJustLoaded = itemId === this.lastLoadedItemId && Date.now() - this.lastLoadedAt < 500;

    if (!itemId || wasJustLoaded) {
      return;
    }

    this.loadItem(itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(item => this.applyLoadedItem(item));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.router.navigate(['/inventory']);
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

  editItem() {
    if (!this.item) {
      return;
    }

    this.router.navigate(['/inventory-edit', this.item.id]);
  }

  openItemHistory() {
    this.router.navigate(['/history']);
  }

  deleteItem() {
    if (!this.item) {
      return;
    }

    if (!this.isAdmin) {
      window.alert('Produk hanya bisa dihapus oleh admin melalui akun admin.');
      return;
    }

    const confirmed = window.confirm(`Hapus barang ${this.item.name} dari inventori?`);
    if (!confirmed) {
      return;
    }

    this.inventoryService.deleteItem(this.item.id).subscribe({
      next: () => {
        this.router.navigate(['/inventory']);
      },
      error: error => {
        window.alert(this.getDeleteErrorMessage(error));
      },
    });
  }

  private loadTransactions(item: InventoryItem) {
    this.transactionService
      .getTransactionsByProduct(item.id, item.sku, item.name)
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => {
        this.transactions = transactions.map(transaction => this.toTransactionLine(transaction));
      });
  }

  private loadItem(itemId: string) {
    if (!itemId) {
      return of(undefined);
    }

    this.lastLoadedItemId = itemId;
    this.lastLoadedAt = Date.now();

    return this.inventoryService.getItemById(itemId);
  }

  private applyLoadedItem(item: InventoryItem | undefined) {
    if (!item) {
      window.alert('Barang tidak ditemukan.');
      this.router.navigate(['/inventory']);
      return;
    }

    this.item = item;
    this.loadTransactions(item);
  }

  private toTransactionLine(transaction: TransactionItem): TransactionLine {
    const iconClass = transaction.type === 'move' ? 'mutation' : transaction.type === 'out' ? 'out' : 'in';
    const amount = Math.abs(Number(transaction.amount.replace(/[^\d.-]/g, '')) || 0);

    return {
      icon: transaction.type === 'move' ? 'swap-horizontal-outline' : transaction.type === 'out' ? 'arrow-up-outline' : 'arrow-down-outline',
      iconClass,
      amount: transaction.type === 'move' ? `${amount}` : transaction.amount,
      type: transaction.type === 'move' ? 'MUTASI' : transaction.type === 'out' ? 'KELUAR' : 'MASUK',
      meta: `${this.formatDate(transaction.createdAt)} - ${transaction.operator}`,
    };
  }

  private formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private getRelativeTime(dateString: string) {
    const created = new Date(dateString).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(1, Math.floor((now - created) / 60000));

    if (diffMinutes < 60) {
      return `${diffMinutes} menit lalu`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} jam lalu`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  }

  private getDeleteErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Gagal menghapus produk.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gagal menghapus produk. Akun ini tidak punya akses hapus barang.';
    }

    if (error.status === 0) {
      return 'Gagal menghapus produk. HP tidak bisa terhubung ke server.';
    }

    if (error.error?.message) {
      return `Gagal menghapus produk: ${error.error.message}`;
    }

    return `Gagal menghapus produk. Kode error: ${error.status}.`;
  }
}
