import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionItem, TransactionService } from '../transactions/transaction.service';

interface TransactionGroup {
  label: string;
  transactions: TransactionItem[];
}

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false,
})
export class HistoryPage {
  transactions: TransactionItem[] = [];
  filteredTransactions: TransactionItem[] = [];
  transactionGroups: TransactionGroup[] = [];
  activeTab: 'all' | 'in' | 'out' | 'move' = 'all';
  searchQuery: string = '';
  productIdFilter = '';
  productNameFilter = '';

  stats = {
    total: 0,
    in: 0,
    out: 0,
    move: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private transactionService: TransactionService,
  ) {}

  ionViewWillEnter() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.productIdFilter = queryParams.get('productId') || '';
    this.productNameFilter = queryParams.get('productName') || '';
    this.loadTransactions();
  }

  selectTab(tab: 'all' | 'in' | 'out' | 'move') {
    this.activeTab = tab;
    this.loadTransactions();
  }

  private loadTransactions() {
    this.transactionService.getTransactionsForTab(this.activeTab).subscribe(transactions => {
      this.transactions = transactions;
      this.updateStats();
      this.filterTransactions();
    });
  }

  updateStats() {
    const transactions = this.productIdFilter
      ? this.transactions.filter(transaction => transaction.productId === this.productIdFilter)
      : this.transactions;

    this.stats.total = transactions.length;
    this.stats.in = this.sumTransactions(transactions.filter(transaction => transaction.type === 'in'));
    this.stats.out = this.sumTransactions(transactions.filter(transaction => transaction.type === 'out'));
    this.stats.move = this.sumTransactions(transactions.filter(transaction => transaction.type === 'move'));
  }

  filterTransactions() {
    let filtered = [...this.transactions];

    if (this.productIdFilter) {
      filtered = filtered.filter(t => t.productId === this.productIdFilter);
    }

    if (this.activeTab !== 'all') {
      filtered = filtered.filter(t => t.type === this.activeTab);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.sku || '').toLowerCase().includes(query) ||
        t.operator.toLowerCase().includes(query) ||
        t.route.toLowerCase().includes(query)
      );
    }

    this.filteredTransactions = filtered;
    this.transactionGroups = this.groupTransactionsByDate(filtered);
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    this.filterTransactions();
  }

  clearSearch() {
    this.searchQuery = '';
    this.filterTransactions();
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToInventory() {
    this.router.navigate(['/inventory']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goBackToProductDetail() {
    if (!this.productIdFilter) {
      this.router.navigate(['/inventory']);
      return;
    }

    this.router.navigate(['/inventory-detail', this.productIdFilter]);
  }

  getCardClass(type: TransactionItem['type']) {
    return {
      in: type === 'in',
      out: type === 'out',
      move: type === 'move',
    };
  }

  private groupTransactionsByDate(transactions: TransactionItem[]): TransactionGroup[] {
    const groups = new Map<string, TransactionItem[]>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const key = this.toDateKey(date);
      const items = groups.get(key) || [];

      items.push(transaction);
      groups.set(key, items);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      label: this.getGroupLabel(key),
      transactions: items,
    }));
  }

  private sumTransactions(transactions: TransactionItem[]) {
    return transactions.reduce((total, transaction) => total + Math.abs(Number(transaction.amount.replace(/[^\d.-]/g, '')) || 0), 0);
  }

  private getGroupLabel(dateKey: string) {
    const date = this.fromDateKey(dateKey);
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    if (dateKey === this.toDateKey(today)) {
      return 'HARI INI';
    }

    if (dateKey === this.toDateKey(yesterday)) {
      return `KEMARIN, ${this.formatFullDate(date).toUpperCase()}`;
    }

    return this.formatFullDate(date).toUpperCase();
  }

  private toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private fromDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);

    return new Date(year, month - 1, day);
  }

  private formatFullDate(date: Date) {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
