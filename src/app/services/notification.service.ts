import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject, Observable, Subscription, forkJoin, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MonitoringService } from './monitoring.service';
import { InventoryService } from '../inventory/inventory.service';

export interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  icon: string;
  read: boolean;
  category: 'low' | 'medium';
  key: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private pollingSubscription?: Subscription;
  private readonly readStatusStorageKey = 'alorack-notifications-read';
  private toastedKeys = new Set<string>();

  constructor(
    private authService: AuthService,
    private monitoringService: MonitoringService,
    private inventoryService: InventoryService,
    private toastController: ToastController,
    private router: Router
  ) {
    this.startPolling();
  }

  startPolling() {
    this.stopPolling();
    // Poll every 15 seconds
    this.pollingSubscription = timer(0, 15000).pipe(
      switchMap(() => {
        const user = this.authService.getCurrentUser();
        if (!user) {
          return of([]);
        }

        if (user.role === 'admin') {
          return forkJoin({
            allStocks: this.monitoringService.getStocks(),
          }).pipe(
            switchMap(({ allStocks }) => {
              const newNotifications: Notification[] = [];
              let notificationId = 1;
              const readMap = this.getReadStatusMap();

              allStocks.forEach(item => {
                const quantity = Number(item.current_stock || 0);
                const lowLimit = Number(item.low_stock_alert ?? 10);
                const mediumLimit = Number(item.medium_stock_alert ?? 50);

                if (quantity <= lowLimit) {
                  const key = this.createStockKey('admin', item.id, 'low', quantity);
                  newNotifications.push({
                    id: notificationId++,
                    title: quantity <= 0 ? 'Stok Habis' : 'Stok Rendah',
                    message: quantity <= 0
                      ? `Item "${item.name}" sudah habis (0 ${item.unit})`
                      : `Item "${item.name}" stok tersisa ${quantity} ${item.unit}`,
                    timestamp: item.updated_at || new Date().toISOString(),
                    icon: 'warning-outline',
                    read: !!readMap[key],
                    category: 'low',
                    key,
                  });
                } else if (quantity <= mediumLimit) {
                  const key = this.createStockKey('admin', item.id, 'medium', quantity);
                  newNotifications.push({
                    id: notificationId++,
                    title: 'Stok Hampir Rendah',
                    message: `Item "${item.name}" stok hampir habis (${quantity} ${item.unit})`,
                    timestamp: item.updated_at || new Date().toISOString(),
                    icon: 'warning-outline',
                    read: !!readMap[key],
                    category: 'medium',
                    key,
                  });
                }
              });

              return of(newNotifications);
            }),
            catchError(() => of([]))
          );
        } else {
          // Operator
          return this.inventoryService.getItems().pipe(
            switchMap(items => {
              const newNotifications: Notification[] = [];
              let notificationId = 1;
              const readMap = this.getReadStatusMap();

              items.forEach(item => {
                const stockStatus = this.inventoryService.getStockStatus(item);
                if (stockStatus === 'low') {
                  const key = this.createStockKey('operator', item.id, 'low', item.quantity);
                  newNotifications.push({
                    id: notificationId++,
                    title: 'Stok Rendah',
                    message: `Item "${item.name}" stok sudah di bawah ${item.minThreshold || 10} unit`,
                    timestamp: item.updatedAt || new Date().toISOString(),
                    icon: 'warning-outline',
                    read: !!readMap[key],
                    category: 'low',
                    key,
                  });
                } else if (stockStatus === 'medium') {
                  const key = this.createStockKey('operator', item.id, 'medium', item.quantity);
                  newNotifications.push({
                    id: notificationId++,
                    title: 'Stok Hampir Rendah',
                    message: `Item "${item.name}" stok hampir habis`,
                    timestamp: item.updatedAt || new Date().toISOString(),
                    icon: 'warning-outline',
                    read: !!readMap[key],
                    category: 'medium',
                    key,
                  });
                }
              });

              return of(newNotifications);
            }),
            catchError(() => of([]))
          );
        }
      })
    ).subscribe(notifications => {
      this.processNewNotifications(notifications);
    });
  }

  stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  refresh() {
    this.startPolling();
  }

  markAllAsRead() {
    const notifications = this.notificationsSubject.value;
    const readMap = this.getReadStatusMap();

    notifications.forEach(notif => {
      notif.read = true;
      readMap[notif.key] = true;
    });

    this.saveReadStatusMap(readMap);
    this.notificationsSubject.next([...notifications]);
    this.unreadCountSubject.next(0);
  }

  private processNewNotifications(notifications: Notification[]) {
    const sortedNotifications = this.sortNotifications(notifications);
    const unreadCount = sortedNotifications.filter(n => !n.read).length;
    this.notificationsSubject.next(sortedNotifications);
    this.unreadCountSubject.next(unreadCount);

    // Check for any new unread notification that hasn't been toasted yet
    sortedNotifications.forEach(notif => {
      if (!notif.read && !this.toastedKeys.has(notif.key)) {
        this.toastedKeys.add(notif.key);
        this.showToast(notif);
      }
    });
  }

  private async showToast(notif: Notification) {
    const toast = await this.toastController.create({
      message: `${notif.title}: ${notif.message}`,
      duration: 5000,
      position: 'top',
      color: notif.category === 'low' ? 'danger' : 'warning',
      buttons: [
        {
          text: 'Buka',
          role: 'info',
          handler: () => {
            this.router.navigate(['/notifications']);
          }
        },
        {
          text: 'Tutup',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  private getReadStatusMap(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(this.readStatusStorageKey) || '{}') || {};
    } catch {
      return {};
    }
  }

  private saveReadStatusMap(map: Record<string, boolean>) {
    localStorage.setItem(this.readStatusStorageKey, JSON.stringify(map));
  }

  private createStockKey(role: 'admin' | 'operator', itemId: string | number, category: 'low' | 'medium', quantity: number) {
    return `${role}_${itemId}_${category}_${quantity}`;
  }

  private sortNotifications(notifications: Notification[]) {
    return [...notifications].sort((a, b) => {
      const timeDiff = this.toTime(b.timestamp) - this.toTime(a.timestamp);

      if (timeDiff !== 0) {
        return timeDiff;
      }

      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }

      return a.title.localeCompare(b.title);
    });
  }

  private toTime(timestamp: string) {
    if (!timestamp) {
      return 0;
    }

    const formattedTimestamp = timestamp.includes(' ') && !timestamp.includes('T')
      ? timestamp.replace(' ', 'T')
      : timestamp;
    const time = new Date(formattedTimestamp).getTime();

    return Number.isNaN(time) ? 0 : time;
  }
}
