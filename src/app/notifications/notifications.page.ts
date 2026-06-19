import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Notification, NotificationService } from '../services/notification.service';
import { Subscription } from 'rxjs';

type NotificationCategory = 'low' | 'medium';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  activeCategory: NotificationCategory = 'low';
  tabs: Array<{ key: NotificationCategory; label: string; tone: string }> = [
    { key: 'low', label: 'Stok Rendah', tone: 'danger' },
    { key: 'medium', label: 'Stok Hampir Rendah', tone: 'warning' },
  ];
  private readonly fallbackRoute = '/profile';
  private subscription?: Subscription;
  private refreshInterval?: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.subscription = this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
    });

    this.refreshInterval = setInterval(() => {
      this.notifications = [...this.notifications];
    }, 30000);
  }

  ionViewWillLeave() {
    this.notificationService.markAllAsRead();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  getRelativeTime(timestamp: string): string {
    if (!timestamp) {
      return 'Baru saja';
    }

    const formattedTimestamp = timestamp.includes(' ') && !timestamp.includes('T')
      ? timestamp.replace(' ', 'T')
      : timestamp;

    const time = new Date(formattedTimestamp).getTime();
    const now = Date.now();
    const diffSeconds = Math.floor((now - time) / 1000);

    if (diffSeconds < 60) {
      return 'Baru saja';
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} menit lalu`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} jam lalu`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
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
