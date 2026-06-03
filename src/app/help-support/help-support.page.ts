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
      question: 'Bagaimana cara menambah item ke inventory?',
      answer: 'Anda dapat menambah item dengan masuk ke halaman Inventory, kemudian klik tombol tambah dan isi informasi item seperti nama, SKU, lokasi, dan stok.',
      expanded: false,
    },
    {
      id: 2,
      question: 'Bagaimana cara melakukan transaksi barang masuk?',
      answer: 'Pilih menu Goods In di halaman utama, kemudian masukkan detail barang yang masuk termasuk jumlah dan lokasi penyimpanan.',
      expanded: false,
    },
    {
      id: 3,
      question: 'Bagaimana cara melihat riwayat transaksi?',
      answer: 'Buka menu History untuk melihat semua riwayat transaksi barang masuk dan keluar.',
      expanded: false,
    },
    {
      id: 4,
      question: 'Bagaimana cara mengubah profil saya?',
      answer: 'Buka halaman Profile dan klik tombol edit untuk mengubah informasi profil Anda.',
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
