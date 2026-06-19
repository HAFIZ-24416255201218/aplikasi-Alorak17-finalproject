import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';
import { AuthService } from '../services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage {
  username = 'Pengguna';
  role = 'Admin Gudang';
  email = 'pengguna@gudangku.com';
  status = 'Aktif';
  profileInitials = 'P';
  darkMode = localStorage.getItem('darkMode') === 'true';
  stats = [
    { value: '0', label: 'Transaksi' },
    { value: '0', label: 'Barang Masuk' },
    { value: '0', label: 'Barang Keluar' },
  ];

  totalSKUs = 0;
  totalStock = 0;

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
    private authService: AuthService
  ) {}

  ionViewWillEnter() {
    this.applyDarkMode(this.darkMode);
    this.loadUserProfile();

    forkJoin({
      items: this.inventoryService.getItems(),
      transactions: this.transactionService.getTransactions()
    }).subscribe(({ items, transactions }) => {
      const todayKey = this.toDateKey(new Date());
      const todayTransactions = transactions.filter(
        t => this.toDateKey(new Date(t.createdAt)) === todayKey
      );

      const itemsIn = todayTransactions
        .filter(t => t.type === 'in')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

      const itemsOut = todayTransactions
        .filter(t => t.type === 'out')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

      this.stats = [
        { value: `${todayTransactions.length}`, label: 'Transaksi' },
        { value: `${itemsIn}`, label: 'Barang Masuk' },
        { value: `${itemsOut}`, label: 'Barang Keluar' },
      ];

      this.totalSKUs = items.length;
      this.totalStock = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    });
  }

  private loadUserProfile() {
    this.authService.getProfile().subscribe({
      next: user => {
        this.username = user.name;
        this.email = user.email;
        this.role = this.authService.getFriendlyRole();
        this.profileInitials = this.createInitials(user.name);
      },
      error: () => {
        const user = this.authService.getCurrentUser();
        if (user) {
          this.username = user.name;
          this.email = user.email;
          this.role = this.authService.getFriendlyRole();
          this.profileInitials = this.createInitials(user.name);
        }
      },
    });
  }

  private toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private createInitials(name: string) {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('');

    return initials || 'P';
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToInventory() {
    this.router.navigate(['/inventory']);
  }

  goToHistory() {
    this.router.navigate(['/history']);
  }

  openNotifications() {
    this.router.navigate(['/notifications'], { queryParams: { from: 'profile' } });
  }

  openHelpSupport() {
    this.router.navigate(['/help-support']);
  }

  openAboutApp() {
    this.router.navigate(['/about-app']);
  }

  openEditProfile() {
    this.router.navigate(['/edit-profile']);
  }

  toggleDarkMode(event: CustomEvent) {
    this.darkMode = Boolean(event.detail.checked);
    localStorage.setItem('darkMode', String(this.darkMode));
    this.applyDarkMode(this.darkMode);
  }

  private applyDarkMode(shouldEnable: boolean) {
    document.documentElement.classList.toggle('ion-palette-dark', shouldEnable);
    document.body.classList.toggle('app-dark-mode', shouldEnable);
  }

  logout() {
    this.authService.logout();
  }
}
