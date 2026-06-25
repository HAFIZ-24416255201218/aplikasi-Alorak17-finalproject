import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryService } from '../inventory/inventory.service';
import { TransactionItem, TransactionService } from '../transactions/transaction.service';
import { NotificationService } from '../services/notification.service';
import { forkJoin, Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  username = '';
  greetingText = 'Selamat Datang';
  locationText = '';
  unreadCount = 0;
  private notificationSub?: Subscription;

  statistics = [
    { value: '0', label: 'TOTAL BARANG', theme: 'primary' },
    { value: '0', label: 'STOK MASUK', theme: 'success' },
    { value: '0', label: 'STOK KELUAR', theme: 'warning' },
    { value: '0', label: 'SISA STOK', theme: 'light' },
  ];

  lowStockItems: Array<{ id: string; name: string; sku: string; current: number; total: number; percentage: number }> = [];
  stockSummaryItems: Array<{ label: string; percent: number; color: string }> = [
    { label: 'Elektronik', percent: 35, color: '#0874e8' },
    { label: 'Kebutuhan Kantor', percent: 25, color: '#19bf78' },
    { label: 'Bahan Baku', percent: 20, color: '#f7a614' },
    { label: 'Lainnya', percent: 20, color: '#9c9f59' },
  ];
  pieGradient = this.buildPieGradient(this.stockSummaryItems);
  recentActivities: Array<{ icon: string; typeLabel: string; name: string; change: string; time: string; color: string; imageData?: string }> = [];

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
    private notificationService: NotificationService,
  ) {
    this.loadUserData();
  }

  ionViewWillEnter() {
    this.loadDashboardData();
    this.notificationSub = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
    });
  }

  ionViewWillLeave() {
    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
      this.notificationSub = undefined;
    }
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  private loadUserData() {
    const storedUsername = localStorage.getItem('username');
    this.username = storedUsername || 'Pengguna';
  }

  goToNotifications() {
    this.router.navigate(['/notifications'], { queryParams: { from: 'home' } });
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.setItem('hasLoggedOut', 'true');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  goToInventory() {
    this.router.navigate(['/inventory']);
  }

  goToHistory() {
    this.router.navigate(['/history']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToProductDetail(id: string) {
    this.router.navigate(['/inventory-detail', id]);
  }

  private loadDashboardData() {
    forkJoin({
      items: this.inventoryService.getItems(),
      transactions: this.transactionService.getTransactionsForTab('all')
    }).subscribe(({ items, transactions }) => {
      const totalStock = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      const totalIn = transactions
        .filter(t => t.type === 'in')
        .reduce((sum, t) => sum + this.getTransactionQuantity(t), 0);

      const totalOut = transactions
        .filter(t => t.type === 'out')
        .reduce((sum, t) => sum + this.getTransactionQuantity(t), 0);

      this.statistics = [
        {
          value: this.formatNumber(items.length),
          label: 'TOTAL BARANG',
          theme: 'primary',
        },
        {
          value: this.formatNumber(totalIn),
          label: 'STOK MASUK',
          theme: 'success',
        },
        {
          value: this.formatNumber(totalOut),
          label: 'STOK KELUAR',
          theme: 'warning',
        },
        {
          value: this.formatNumber(Math.max(totalStock, 0)),
          label: 'SISA STOK',
          theme: 'light',
        },
      ];

      this.stockSummaryItems = this.buildStockSummary(items);
      this.pieGradient = this.buildPieGradient(this.stockSummaryItems);

      this.lowStockItems = items
        .filter(item => item.quantity <= (item.mediumThreshold || 100))
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 3)
        .map(item => {
          const total = item.mediumThreshold || 100;
          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            current: item.quantity,
            total,
            percentage: Math.min(100, Math.round((item.quantity / total) * 100)),
          };
        });

      this.recentActivities = transactions.slice(0, 3).map(transaction => {
        const product = this.findTransactionProduct(transaction, items);
        const isMove = transaction.type === 'move';
        const isOut = transaction.type === 'out';

        return {
          icon: isMove ? 'swap-horizontal-outline' : isOut ? 'log-out-outline' : 'log-in-outline',
          typeLabel: isMove ? 'Mutasi Barang' : isOut ? 'Stok Keluar' : 'Stok Masuk',
          name: transaction.name,
          change: transaction.amount,
          time: this.getRelativeTime(transaction.createdAt),
          color: isMove ? '#0874e8' : isOut ? '#f7a614' : '#19bf78',
          imageData: product?.imageData,
        };
      });
    });
  }

  private formatNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(value || 0);
  }

  private getTransactionQuantity(transaction: TransactionItem) {
    return Math.abs(Number(String(transaction.amount).replace(/[^\d.-]/g, '')) || 0);
  }

  private buildStockSummary(items: InventoryItem[]) {
    const colors = ['#0874e8', '#19bf78', '#f7a614', '#9c9f59'];
    const totals = items.reduce<Record<string, number>>((summary, item) => {
      const category = item.category || 'Lainnya';
      summary[category] = (summary[category] || 0) + (Number(item.quantity) || 0);
      return summary;
    }, {});

    const totalStock = Object.values(totals).reduce((sum, value) => sum + value, 0);

    if (!totalStock) {
      return this.stockSummaryItems;
    }

    const topCategories = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return topCategories.map(([label, total], index) => ({
      label,
      percent: Math.round((total / totalStock) * 100),
      color: colors[index] || colors[colors.length - 1],
    }));
  }

  private buildPieGradient(items: Array<{ percent: number; color: string }>) {
    let cursor = 0;
    const segments = items.map(item => {
      const next = cursor + item.percent;
      const segment = `${item.color} ${cursor}% ${next}%`;
      cursor = next;
      return segment;
    });

    if (cursor < 100 && segments.length > 0) {
      segments.push(`${items[items.length - 1].color} ${cursor}% 100%`);
    }

    return `conic-gradient(${segments.join(', ')})`;
  }

  private findTransactionProduct(transaction: TransactionItem, items: InventoryItem[]) {
    return items.find(item =>
      (!!transaction.productId && item.id === transaction.productId) ||
      (!!transaction.sku && item.sku === transaction.sku) ||
      item.name === transaction.name
    );
  }

  private getRelativeTime(createdAt: string) {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(1, Math.floor((now - created) / 60000));

    if (diffMinutes < 60) {
      return `${diffMinutes} menit`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} jam`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Kemarin';
    }

    return `${diffDays} hari`;
  }
}
