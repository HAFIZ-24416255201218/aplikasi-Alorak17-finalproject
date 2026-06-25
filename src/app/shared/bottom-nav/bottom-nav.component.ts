import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

type BottomNavPage = 'dashboard' | 'inventory' | 'history' | 'profile';

@Component({
  selector: 'app-bottom-nav',
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
  standalone: false,
})
export class BottomNavComponent {
  @Input() active: BottomNavPage = 'dashboard';

  isQuickMenuOpen = false;

  constructor(private router: Router) {}

  toggleQuickMenu(event: Event) {
    event.stopPropagation();
    this.isQuickMenuOpen = !this.isQuickMenuOpen;
  }

  closeQuickMenu() {
    this.isQuickMenuOpen = false;
  }

  goToDashboard() {
    this.closeQuickMenu();
    this.router.navigate(['/dashboard']);
  }

  goToInventory() {
    this.closeQuickMenu();
    this.router.navigate(['/inventory']);
  }

  goToHistory() {
    this.closeQuickMenu();
    this.router.navigate(['/history']);
  }

  goToProfile() {
    this.closeQuickMenu();
    this.router.navigate(['/profile']);
  }

  goToGoodsIn() {
    this.closeQuickMenu();
    this.router.navigate(['/goods-in']);
  }

  goToGoodsOut() {
    this.closeQuickMenu();
    this.router.navigate(['/goods-out']);
  }

  goToStockMutation() {
    this.closeQuickMenu();
    this.router.navigate(['/stock-mutation']);
  }
}
