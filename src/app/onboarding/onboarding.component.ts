import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface OnboardingSlide {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
  standalone: false,
})
export class OnboardingComponent implements OnInit {
  currentIndex = 0;
  private touchStartX = 0;

  readonly slides: OnboardingSlide[] = [
    {
      title: 'Selamat Datang!',
      description: 'Kelola stok gudang dengan mudah, cepat, dan akurat dalam satu aplikasi.',
      image: 'assets/privacy/orang1.jpg',
      imageAlt: 'Ilustrasi pekerja gudang mengelola stok barang',
    },
    {
      title: 'Fitur Utama',
      description: 'Pantau stok, pindai barcode, dan kelola barang masuk & keluar secara langsung.',
      image: 'assets/privacy/rame2.jpg',
      imageAlt: 'Ilustrasi dashboard dan proses scan barcode',
    },
    {
      title: 'Data Aman & Terjamin',
      description: 'Semua data stok tersimpan aman dengan sistem keamanan modern dan backup otomatis.',
      image: 'assets/privacy/privasi3.jpg',
      imageAlt: 'Ilustrasi keamanan data stok gudang',
    },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true';

    if (isLoggedIn) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }

    if (hasCompletedOnboarding) {
      const hasAcceptedPrivacyPolicy = localStorage.getItem('hasAcceptedPrivacyPolicy') === 'true';
      this.router.navigate([hasAcceptedPrivacyPolicy ? '/login' : '/privacy-policy'], { replaceUrl: true });
    }
  }

  get isFirstSlide() {
    return this.currentIndex === 0;
  }

  get isLastSlide() {
    return this.currentIndex === this.slides.length - 1;
  }

  goToSlide(index: number) {
    this.currentIndex = index;
  }

  nextSlide() {
    if (this.isLastSlide) {
      this.startApp();
      return;
    }

    this.currentIndex += 1;
  }

  previousSlide() {
    if (!this.isFirstSlide) {
      this.currentIndex -= 1;
    }
  }

  startApp() {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    this.router.navigate(['/privacy-policy']);
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const touchEndX = event.changedTouches[0].clientX;
    const swipeDistance = touchEndX - this.touchStartX;

    if (Math.abs(swipeDistance) < 48) {
      return;
    }

    if (swipeDistance < 0) {
      this.nextSlide();
    } else {
      this.previousSlide();
    }
  }
}
