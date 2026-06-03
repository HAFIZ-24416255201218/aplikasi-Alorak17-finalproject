import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryItem, InventoryService } from '../inventory/inventory.service';
import { TransactionItem, TransactionService } from '../transactions/transaction.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
  ) {}

  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const sku = params.get('sku');
        if (!sku) {
          this.router.navigate(['/inventory']);
          return;
        }

        this.item = this.inventoryService.getItemById(sku);
        if (!this.item) {
          this.router.navigate(['/inventory']);
          return;
        }

        this.transactions = this.transactionService
          .getTransactionsByProduct(this.item.id, this.item.sku, this.item.name)
          .slice(0, 8)
          .map(transaction => this.toTransactionLine(transaction));
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    // Refresh data setiap kali view di-enter
    const sku = this.route.snapshot.paramMap.get('sku');
    if (sku) {
      this.item = this.inventoryService.getItemById(sku);
      if (this.item) {
        this.transactions = this.transactionService
          .getTransactionsByProduct(this.item.id, this.item.sku, this.item.name)
          .slice(0, 8)
          .map(transaction => this.toTransactionLine(transaction));
      }
    }
  }

  goBack() {
    this.router.navigate(['/inventory']);
  }

  deleteItem() {
    if (!this.item) {
      return;
    }

    const confirmed = window.confirm(`Hapus item ${this.item.name} dari inventory?`);
    if (!confirmed) {
      return;
    }

    this.inventoryService.deleteItem(this.item.id);
    this.router.navigate(['/inventory']);
  }

  openItemHistory() {
    if (!this.item) {
      return;
    }

    this.router.navigate(['/history'], {
      queryParams: {
        productId: this.item.id,
        productName: this.item.name,
      },
    });
  }

  editItem() {
    if (!this.item) {
      return;
    }
    // Navigate ke halaman edit dengan SKU sebagai parameter
    // Halaman edit akan dibuat dengan form untuk mengubah data produk
    this.router.navigate(['/inventory-edit', this.item.sku]);
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

  get healthStatus() {
    if (!this.item) {
      return 'UNKNOWN';
    }

    const minThreshold = this.item.minThreshold || 50;
    const mediumThreshold = this.item.mediumThreshold || 150;

    if (this.item.quantity < minThreshold) return 'LOW';
    if (this.item.quantity < mediumThreshold) return 'MEDIUM';
    return 'HEALTHY';
  }

  get productLocations() {
    if (!this.item) {
      return [];
    }

    if (this.item.locations?.length) {
      return this.item.locations;
    }

    return [{ name: this.item.location, quantity: this.item.quantity }];
  }

  get totalLocationStock() {
    return this.productLocations.reduce((total, location) => total + location.quantity, 0);
  }

  get lastUpdatedText() {
    if (!this.item?.updatedAt) {
      return '-';
    }

    return this.getRelativeTime(this.item.updatedAt);
  }

  private toTransactionLine(transaction: TransactionItem): TransactionLine {
    const iconClass = transaction.type === 'move' ? 'mutation' : transaction.type === 'out' ? 'out' : 'in';
    return {
      icon: transaction.type === 'move' ? 'swap-horizontal-outline' : transaction.type === 'out' ? 'arrow-up-outline' : 'arrow-down-outline',
      iconClass,
      amount: transaction.type === 'move' ? `<>${Math.abs(Number(transaction.amount.replace(/[^\d.-]/g, '')) || 0)}` : transaction.amount,
      type: transaction.type === 'move' ? 'MUTATION' : transaction.type.toUpperCase(),
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
      return `${diffMinutes} minutes ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hours ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
}
