import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  loginForm: FormGroup;
  showPassword = false;
  loading = false;
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Silakan isi semua field dengan benar';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      // Simulasi login lokal - ganti dengan API autentikasi sebenarnya jika sudah tersedia.
      const { email } = this.loginForm.value;
      
      // Simulasi delay API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Jika username belum tersimpan, ekstrak dari email
      const storedUsername = localStorage.getItem('username');
      if (!storedUsername) {
        const nameFromEmail = email.split('@')[0];
        localStorage.setItem('username', nameFromEmail);
      }
      localStorage.setItem('email', email);
      localStorage.removeItem('password');
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('hasLoggedOut');
      
      // Redirect ke dashboard setelah login sukses dan hapus halaman login dari history.
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (error) {
      this.errorMessage = 'Login gagal. Silakan coba lagi.';
      console.error('Login error:', error);
    } finally {
      this.loading = false;
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
