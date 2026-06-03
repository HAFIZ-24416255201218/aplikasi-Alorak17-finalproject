import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService } from '../inventory/inventory.service';

interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  icon: string;
  read: boolean;
  category: NotificationCategory;
}

type NotificationCategory = 'low' | 'medium' | 'expiry';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage {
  notifications: Notification[] = [];
  activeCategory: NotificationCategory = 'low';
  tabs: Array<{ key: NotificationCategory; label: string; tone: string }> = [
    { key: 'low', label: 'Stok Rendah', tone: 'danger' },
    { key: 'medium', label: 'Stok Hampir Rendah', tone: 'warning' },
    { key: 'expiry', label: 'Kadaluarsa', tone: 'orange' },
  ];
  private readonly fallbackRoute = '/profile';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inventoryService: InventoryService,
  ) {
    this.generateNotifications();
  }

  private generateNotifications() {
    const items = this.inventoryService.getItems();
    const newNotifications: Notification[] = [];
    let notificationId = 1;

    items.forEach(item => {
      const stockStatus = this.inventoryService.getStockStatus(item);

      if (stockStatus === 'low') {
        newNotifications.push({
          id: notificationId++,
          title: 'Stok Rendah',
          message: `Item "${item.name}" stok sudah di bawah ${item.minThreshold || 50} unit`,
          timestamp: 'Baru saja',
          icon: 'warning-outline',
          read: false,
          category: 'low',
        });
      } else if (stockStatus === 'medium') {
        newNotifications.push({
          id: notificationId++,
          title: 'Stok Hampir Rendah',
          message: `Item "${item.name}" stok hampir habis`,
          timestamp: 'Baru saja',
          icon: 'warning-outline',
          read: false,
          category: 'medium',
        });
      }

      if (this.inventoryService.isItemExpiringSoon(item, 7)) {
        const expirationDate = new Date(item.expirationDate!);
        const today = new Date();
        const daysLeft = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        newNotifications.push({
          id: notificationId++,
          title: 'Barang Kadaluarsa',
          message: `Item "${item.name}" akan kadaluarsa dalam ${daysLeft} hari`,
          timestamp: 'Baru saja',
          icon: 'alert-circle-outline',
          read: false,
          category: 'expiry',
        });
      }

      if (this.inventoryService.isItemExpired(item)) {
        newNotifications.push({
          id: notificationId++,
          title: 'Barang Kadaluarsa',
          message: `Item "${item.name}" sudah kadaluarsa`,
          timestamp: 'Baru saja',
          icon: 'alert-circle-outline',
          read: false,
          category: 'expiry',
        });
      }
    });

    this.notifications = newNotifications;
  }

  get filteredNotifications() {
    return this.notifications.filter(notification => notification.category === this.activeCategory);
  }

  selectCategory(category: NotificationCategory) {
    this.activeCategory = category;
  }

  goBack() {
    const sourcePage = this.route.snapshot.queryParamMap.get('from');
    const targetRoute = sourcePage === 'home' ? '/home' : this.fallbackRoute;

    this.router.navigate([targetRoute]);
  }
}
