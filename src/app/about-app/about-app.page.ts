import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-about-app',
  templateUrl: './about-app.page.html',
  styleUrls: ['./about-app.page.scss'],
  standalone: false,
})
export class AboutAppPage {
  appVersion = '1.9.0';
  releaseDate = '2026';
  features = [
    {
      icon: 'cube-outline',
      title: 'Manajemen Inventori',
      description: 'Kelola stok produk dengan mudah dan pantauan waktu nyata'
    },
    {
      icon: 'swap-horizontal-outline',
      title: 'Mutasi Stok',
      description: 'Pindahkan stok antar lokasi dengan pelacakan lengkap'
    },
    {
      icon: 'arrow-down-outline',
      title: 'Barang Masuk/Keluar',
      description: 'Catat masuk dan keluarnya barang dari gudang'
    },
    {
      icon: 'time-outline',
      title: 'Riwayat Transaksi',
      description: 'Lihat riwayat lengkap semua aktivitas gudang'
    },
    {
      icon: 'alert-circle-outline',
      title: 'Peringatan Stok',
      description: 'Notifikasi otomatis untuk stok rendah'
    },
    {
      icon: 'barcode-outline',
      title: 'Pindai Barcode',
      description: 'Bantu isi kode barang lebih cepat melalui kamera'
    }
  ];

  constructor(private router: Router) { }

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
