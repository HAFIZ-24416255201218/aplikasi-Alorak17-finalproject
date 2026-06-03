import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-about-app',
  templateUrl: './about-app.page.html',
  styleUrls: ['./about-app.page.scss'],
  standalone: false,
})
export class AboutAppPage {
  appVersion = '2.4.1';
  releaseDate = '2026';
  features = [
    {
      icon: 'cube-outline',
      title: 'Manajemen Inventory',
      description: 'Kelola stok produk dengan mudah dan real-time monitoring'
    },
    {
      icon: 'swap-horizontal-outline',
      title: 'Stock Mutation',
      description: 'Pindahkan stok antar lokasi dengan tracking lengkap'
    },
    {
      icon: 'arrow-down-outline',
      title: 'Goods In/Out',
      description: 'Catat masuk dan keluarnya barang dari gudang'
    },
    {
      icon: 'time-outline',
      title: 'Riwayat Transaksi',
      description: 'Lihat history lengkap semua aktivitas gudang'
    },
    {
      icon: 'alert-circle-outline',
      title: 'Alert Stok',
      description: 'Notifikasi otomatis untuk stok rendah atau kadaluarsa'
    },
    {
      icon: 'camera-outline',
      title: 'Dokumentasi Foto',
      description: 'Foto produk untuk referensi dan verifikasi stok'
    }
  ];

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/profile']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
