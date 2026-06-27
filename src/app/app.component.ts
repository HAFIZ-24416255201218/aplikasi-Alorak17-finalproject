import { Component, OnDestroy } from '@angular/core';
import { App } from '@capacitor/app';
import { AlertController, Platform } from '@ionic/angular';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnDestroy {
  username = 'Pengguna';
  userRole = 'Admin Gudang';
  userInitials = 'P';
  isSplashMounted = true;
  isSplashVisible = true;
  isSplashDark = false;
  splashProgress = 8;
  splashStatus = 'Menyiapkan Alorack17';
  private isExitAlertOpen = false;
  private splashProgressTimer?: number;
  private splashStatusTimer?: number;
  private splashHideTimer?: number;
  private splashUnmountTimer?: number;

  constructor(
    private router: Router,
    private platform: Platform,
    private alertController: AlertController,
    private authService: AuthService
  ) {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    this.isSplashDark = darkMode;
    this.splashStatus = 'Memuat data gudang';
    document.documentElement.classList.toggle('ion-palette-dark', darkMode);
    document.body.classList.toggle('app-dark-mode', darkMode);
    localStorage.removeItem('password');
    this.startSplashSequence();
    this.loadCurrentUser();
    this.setupBackButtonHandler();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadCurrentUser();
        this.keepLoginSession();
      });
  }

  ngOnDestroy(): void {
    this.clearSplashTimers();
  }

  get isAuthPage(): boolean {
    const authRoutes = ['/onboarding', '/privacy-policy', '/login'];
    return authRoutes.some(route => this.router.url.startsWith(route));
  }

  logout(): void {
    this.authService.logout();
  }

  private keepLoginSession(): void {
    const currentRoute = this.router.url.split('?')[0];
    const isLoggedIn = this.authService.isLoggedIn();
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true';
    const hasAcceptedPrivacyPolicy = localStorage.getItem('hasAcceptedPrivacyPolicy') === 'true';
    const publicRoutes = ['/onboarding', '/privacy-policy', '/login'];
    const isPublicRoute = publicRoutes.includes(currentRoute);

    if (isLoggedIn && isPublicRoute) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && !hasCompletedOnboarding && currentRoute !== '/onboarding') {
      this.router.navigate(['/onboarding'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && hasCompletedOnboarding && !hasAcceptedPrivacyPolicy && currentRoute !== '/privacy-policy') {
      this.router.navigate(['/privacy-policy'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && hasCompletedOnboarding && hasAcceptedPrivacyPolicy && currentRoute === '/onboarding') {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && !isPublicRoute) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private setupBackButtonHandler(): void {
    this.platform.backButton.subscribeWithPriority(10, async () => {
      if (this.isDashboardRoute()) {
        await this.confirmExitApp();
        return;
      }

      if (this.router.url.split('?')[0] === '/login') {
        this.router.navigate(['/privacy-policy']);
        return;
      }

      if (this.router.url.split('?')[0] === '/privacy-policy') {
        localStorage.removeItem('hasCompletedOnboarding');
        localStorage.removeItem('hasAcceptedPrivacyPolicy');
        this.router.navigate(['/onboarding']);
        return;
      }

      window.history.back();
    });
  }

  private startSplashSequence(): void {
    const statusMessages = [
      'Memuat data gudang',
      'Menyiapkan dashboard',
      'Sinkronisasi inventori',
      'Hampir selesai',
    ];
    let statusIndex = 0;

    this.splashProgressTimer = window.setInterval(() => {
      this.splashProgress = Math.min(96, this.splashProgress + 4);
    }, 140);

    this.splashStatusTimer = window.setInterval(() => {
      statusIndex = (statusIndex + 1) % statusMessages.length;
      this.splashStatus = statusMessages[statusIndex];
    }, 760);

    this.splashHideTimer = window.setTimeout(() => {
      this.splashProgress = 100;
      this.isSplashVisible = false;

      this.splashUnmountTimer = window.setTimeout(() => {
        this.isSplashMounted = false;
        this.clearSplashTimers();
      }, 420);
    }, 3200);
  }

  private clearSplashTimers(): void {
    if (this.splashProgressTimer) {
      window.clearInterval(this.splashProgressTimer);
      this.splashProgressTimer = undefined;
    }

    if (this.splashStatusTimer) {
      window.clearInterval(this.splashStatusTimer);
      this.splashStatusTimer = undefined;
    }

    if (this.splashHideTimer) {
      window.clearTimeout(this.splashHideTimer);
      this.splashHideTimer = undefined;
    }

    if (this.splashUnmountTimer) {
      window.clearTimeout(this.splashUnmountTimer);
      this.splashUnmountTimer = undefined;
    }
  }

  private isDashboardRoute(): boolean {
    return ['/dashboard', '/home'].includes(this.router.url.split('?')[0]);
  }

  private async confirmExitApp(): Promise<void> {
    if (this.isExitAlertOpen) {
      return;
    }

    this.isExitAlertOpen = true;
    const alert = await this.alertController.create({
      header: 'Keluar aplikasi?',
      subHeader: 'Aplikasi akan ditutup',
      cssClass: 'exit-app-alert',
      message: 'Pastikan pekerjaan yang sedang berjalan sudah selesai sebelum keluar.',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'exit-cancel-button',
          handler: () => {
            this.isExitAlertOpen = false;
          },
        },
        {
          text: 'Keluar',
          cssClass: 'exit-confirm-button',
          handler: async () => {
            this.isExitAlertOpen = false;
            await App.exitApp();
          },
        },
      ],
      backdropDismiss: false,
    });

    await alert.present();
    await alert.onDidDismiss();
    this.isExitAlertOpen = false;
  }

  private loadCurrentUser(): void {
    const user = this.authService.getCurrentUser();
    this.username = user ? user.name : 'Pengguna';
    this.userRole = this.authService.getFriendlyRole();
    this.userInitials = this.createInitials(this.username);
  }

  private createInitials(name: string): string {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('');

    return initials || 'P';
  }
}
