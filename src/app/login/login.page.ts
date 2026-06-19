import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

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
    private router: Router,
    private authService: AuthService
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
      const credentials = this.loginForm.value;
      await firstValueFrom(this.authService.login(credentials));
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (error) {
      this.errorMessage = this.getLoginErrorMessage(error);
      console.error('Login error:', error);
    } finally {
      this.loading = false;
    }
  }

  private getLoginErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Login gagal. Terjadi kesalahan pada aplikasi.';
    }

    if (error.status === 0) {
      return 'Login gagal. Tidak bisa terhubung ke server. Periksa internet HP atau coba lagi.';
    }

    if (error.status === 401) {
      return 'Email atau password salah.';
    }

    if (error.status === 403) {
      return 'Akun ini tidak memiliki akses ke aplikasi mobile.';
    }

    if (error.status === 422) {
      return error.error?.message || 'Data login belum sesuai.';
    }

    if (error.status >= 500) {
      return 'Server sedang bermasalah. Coba lagi beberapa saat.';
    }

    return error.error?.message || 'Login gagal. Coba periksa kembali akun Anda.';
  }
}
