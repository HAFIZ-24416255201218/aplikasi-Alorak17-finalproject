import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-help-support',
  templateUrl: './help-support.page.html',
  styleUrls: ['./help-support.page.scss'],
  standalone: false,
})
export class HelpSupportPage {
  faqs = [
    {
      id: 1,
      question: 'Bagaimana cara menambah barang ke inventori?',
      answer: 'Masuk ke halaman Inventori, pilih tombol Tambah, lalu isi nama barang, kode barang, lokasi, dan jumlah stok.',
      expanded: false,
    },
    {
      id: 2,
      question: 'Bagaimana cara melakukan transaksi barang masuk?',
      answer: 'Pilih menu Barang Masuk di halaman utama, kemudian masukkan detail barang termasuk jumlah dan lokasi penyimpanan.',
      expanded: false,
    },
    {
      id: 3,
      question: 'Bagaimana cara melihat riwayat transaksi?',
      answer: 'Buka menu Riwayat untuk melihat semua transaksi barang masuk dan keluar.',
      expanded: false,
    },
    {
      id: 4,
      question: 'Bagaimana cara mengubah profil saya?',
      answer: 'Buka halaman Profil dan klik tombol ubah untuk mengganti informasi profil Anda.',
      expanded: false,
    },
  ];

  contactInfo = {
    email: 'finalproject00017@gmail.com',
  };

  constructor(private router: Router) {}

  toggleFaq(faq: any) {
    faq.expanded = !faq.expanded;
  }

  goBack() {
    this.router.navigate(['/profile']);
  }
}
