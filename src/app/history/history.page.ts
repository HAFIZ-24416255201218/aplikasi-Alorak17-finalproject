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
  productSkuFilter = '';
  productBarcodeFilter = '';
  isScannerOpen = false;

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
  ) { }

  ionViewWillEnter() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.productIdFilter = queryParams.get('productId') || '';
    this.productNameFilter = queryParams.get('productName') || '';
    this.productSkuFilter = queryParams.get('productSku') || '';
    this.productBarcodeFilter = queryParams.get('productBarcode') || '';
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
    const transactions = this.getProductFilteredTransactions(this.transactions);

    this.stats.total = transactions.length;
    this.stats.in = this.sumTransactions(transactions.filter(transaction => transaction.type === 'in'));
    this.stats.out = this.sumTransactions(transactions.filter(transaction => transaction.type === 'out'));
    this.stats.move = this.sumTransactions(transactions.filter(transaction => transaction.type === 'move'));
  }

  filterTransactions() {
    let filtered = [...this.transactions];

    filtered = this.getProductFilteredTransactions(filtered);

    if (this.activeTab !== 'all') {
      filtered = filtered.filter(t => t.type === this.activeTab);
    }

    if (this.searchQuery.trim()) {
      const query = this.normalizeSearchValue(this.searchQuery);
      filtered = filtered.filter(t =>
        this.normalizeSearchValue(t.name).includes(query) ||
        this.normalizeSearchValue(t.productId || '').includes(query) ||
        this.normalizeSearchValue(t.sku || '').includes(query) ||
        this.normalizeSearchValue(t.sku || '').replace(/^sku-/, '').includes(query) ||
        this.normalizeSearchValue(t.barcode || '').includes(query) ||
        this.normalizeSearchValue(t.operator).includes(query) ||
        this.normalizeSearchValue(t.route).includes(query)
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

  openBarcodeScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.isScannerOpen = true;
  }

  closeBarcodeScanner() {
    this.isScannerOpen = false;
  }

  applyScannedBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();

    if (!barcode) {
      window.alert('Barcode tidak terbaca. Coba scan ulang.');
      return;
    }

    this.searchQuery = barcode;
    this.closeBarcodeScanner();
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

  private getProductFilteredTransactions(transactions: TransactionItem[]) {
    if (!this.productIdFilter && !this.productSkuFilter && !this.productBarcodeFilter) {
      return transactions;
    }

    const productId = this.normalizeSearchValue(this.productIdFilter);
    const productSku = this.normalizeSearchValue(this.productSkuFilter);
    const productSkuNoPrefix = productSku.replace(/^sku-/, '');
    const productBarcode = this.normalizeSearchValue(this.productBarcodeFilter);

    return transactions.filter(transaction => {
      const transactionId = this.normalizeSearchValue(transaction.productId || '');
      const transactionSku = this.normalizeSearchValue(transaction.sku || '');
      const transactionSkuNoPrefix = transactionSku.replace(/^sku-/, '');
      const transactionBarcode = this.normalizeSearchValue(transaction.barcode || '');

      return Boolean(
        (productId && transactionId === productId) ||
        (productSku && (transactionSku === productSku || transactionSkuNoPrefix === productSkuNoPrefix)) ||
        (productBarcode && transactionBarcode === productBarcode)
      );
    });
  }

  private normalizeSearchValue(value: string) {
    return String(value || '').trim().toLowerCase();
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
