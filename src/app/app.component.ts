import { Component } from '@angular/core';
import { App } from '@capacitor/app';
import { AlertController, Platform } from '@ionic/angular';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  username = 'Pengguna';
  userRole = 'Admin Gudang';
  userInitials = 'P';
  private isExitAlertOpen = false;

  constructor(
    private router: Router,
    private platform: Platform,
    private alertController: AlertController,
  ) {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('ion-palette-dark', darkMode);
    document.body.classList.toggle('app-dark-mode', darkMode);
    localStorage.removeItem('password');
    this.loadCurrentUser();
    this.setupBackButtonHandler();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadCurrentUser();
        this.keepLoginSession();
      });
  }

  get isAuthPage(): boolean {
    const authRoutes = ['/onboarding', '/login', '/register'];
    return authRoutes.some(route => this.router.url.startsWith(route));
  }

  logout(): void {
    localStorage.removeItem('isLoggedIn');
    localStorage.setItem('hasLoggedOut', 'true');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private keepLoginSession(): void {
    const currentRoute = this.router.url.split('?')[0];
    const hasSavedAccount = Boolean(localStorage.getItem('email'));
    const hasLoggedOut = localStorage.getItem('hasLoggedOut') === 'true';
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || (hasSavedAccount && !hasLoggedOut);
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true';
    const publicRoutes = ['/onboarding', '/login', '/register'];
    const isPublicRoute = publicRoutes.includes(currentRoute);

    if (isLoggedIn && isPublicRoute) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && !hasCompletedOnboarding && currentRoute !== '/onboarding') {
      this.router.navigate(['/onboarding'], { replaceUrl: true });
      return;
    }

    if (!isLoggedIn && hasCompletedOnboarding && currentRoute === '/onboarding') {
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

      window.history.back();
    });
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
      header: 'Keluar aplikasi',
      subHeader: 'Sesi ini akan ditutup',
      cssClass: 'exit-app-alert',
      message: 'Yakin mau tinggalin aku dan semua barang ini? 🥺',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
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
    const storedUsername = localStorage.getItem('username')?.trim();
    const storedRole = localStorage.getItem('role')?.trim();

    this.username = storedUsername || 'Pengguna';
    this.userRole = storedRole || 'Admin Gudang';
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
