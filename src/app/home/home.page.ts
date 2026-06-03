import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryItem, InventoryService } from '../inventory/inventory.service';
import { TransactionItem, TransactionService } from '../transactions/transaction.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  username = '';
  greetingText = 'Selamat Datang';
  locationText = '';

  statistics = [
    { icon: 'cube-outline', value: '0', label: 'Total SKU', trend: '0 produk di inventory', color: '#2563eb', theme: 'primary' },
    { icon: 'archive-outline', value: '0', label: 'Total Stock', trend: '0 unit tersimpan', color: '#16a34a', theme: 'success' },
    { icon: 'log-in-outline', value: '0', label: 'Barang Masuk', trend: '0 unit transaksi masuk', color: '#22c55e', theme: 'success' },
    { icon: 'log-out-outline', value: '0', label: 'Barang Keluar', trend: '0 unit transaksi keluar', color: '#f97316', theme: 'warning' },
  ];

  quickActions = [
    { label: 'Barang Masuk', icon: 'arrow-down-outline', color: '#22c55e', action: 'goodsIn' },
    { label: 'Barang Keluar', icon: 'arrow-up-outline', color: '#f97316', action: 'goodsOut' },
    { label: 'Barang Berpindah', icon: 'swap-horizontal-outline', color: '#0066cc', action: 'mutations' },
  ];

  lowStockItems: Array<{ id: string; name: string; sku: string; current: number; total: number; percentage: number }> = [];
  recentActivities: Array<{ icon: string; name: string; change: string; time: string; color: string; imageData?: string }> = [];

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
  ) {
    this.loadUserData();
  }

  ionViewWillEnter() {
    this.loadDashboardData();
  }

  private loadUserData() {
    // Ambil username dari localStorage
    const storedUsername = localStorage.getItem('username');
    this.username = storedUsername || 'Pengguna';
  }

  goToNotifications() {
    this.router.navigate(['/notifications'], { queryParams: { from: 'home' } });
  }

  handleQuickAction(action: string) {
    if (action === 'goodsIn') {
      this.router.navigate(['/goods-in']);
      return;
    }

    if (action === 'goodsOut') {
      this.router.navigate(['/goods-out']);
      return;
    }

    if (action === 'mutations') {
      this.router.navigate(['/stock-mutation']);
      return;
    }

    console.log('Action:', action);
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
    const items = this.inventoryService.getItems();
    const transactions = this.transactionService.getTransactions();
    const todayTransactions = this.transactionService.getTodayTransactions();
    const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalInToday = this.transactionService.getTodayTotalByType('in');
    const totalOutToday = this.transactionService.getTodayTotalByType('out');

    this.statistics = [
      {
        icon: 'cube-outline',
        value: `${items.length}`,
        label: 'Total SKU',
        trend: `${items.length} produk di inventory`,
        color: '#2563eb',
        theme: 'primary',
      },
      {
        icon: 'archive-outline',
        value: `${totalStock}`,
        label: 'Total Stock',
        trend: `${totalStock} unit tersimpan`,
        color: '#16a34a',
        theme: 'success',
      },
      {
        icon: 'log-in-outline',
        value: `${totalInToday}`,
        label: 'Barang Masuk',
        trend: `${todayTransactions.filter(item => item.type === 'in').length} transaksi hari ini`,
        color: '#22c55e',
        theme: 'success',
      },
      {
        icon: 'log-out-outline',
        value: `${totalOutToday}`,
        label: 'Barang Keluar',
        trend: `${todayTransactions.filter(item => item.type === 'out').length} transaksi hari ini`,
        color: '#f97316',
        theme: 'warning',
      },
    ];

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

      return {
        icon: transaction.type === 'move' ? 'swap-horizontal-outline' : transaction.type === 'out' ? 'arrow-up-outline' : 'arrow-down-outline',
        name: transaction.name,
        change: transaction.amount,
        time: this.getRelativeTime(transaction.createdAt),
        color: transaction.type === 'move' ? '#0066cc' : transaction.type === 'out' ? '#f59e0b' : '#22c55e',
        imageData: product?.imageData,
      };
    });
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
