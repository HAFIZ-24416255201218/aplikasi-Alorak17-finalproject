import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';

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
  ) {}

  ionViewWillEnter() {
    this.applyDarkMode(this.darkMode);
    this.loadUserProfile();

    const todayTransactions = this.transactionService.getTodayTransactions();
    const inventoryItems = this.inventoryService.getItems();
    const totalManagedItems = inventoryItems.length;
    const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

    const itemsIn = this.transactionService.getTodayTotalByType('in');
    const itemsOut = this.transactionService.getTodayTotalByType('out');

    this.stats = [
      { value: `${todayTransactions.length}`, label: 'Transaksi' },
      { value: `${itemsIn}`, label: 'Barang Masuk' },
      { value: `${itemsOut}`, label: 'Barang Keluar' },
    ];

    this.totalSKUs = totalManagedItems;
    this.totalStock = totalQuantity;
  }

  private loadUserProfile() {
    const storedUsername = localStorage.getItem('username') || 'Pengguna';
    const storedEmail = localStorage.getItem('email') || 'pengguna@gudangku.com';

    this.username = storedUsername;
    this.email = storedEmail;
    this.profileInitials = this.createInitials(storedUsername);
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
    localStorage.removeItem('isLoggedIn');
    localStorage.setItem('hasLoggedOut', 'true');
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
