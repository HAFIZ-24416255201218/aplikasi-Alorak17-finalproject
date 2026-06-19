import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
  standalone: false,
})
export class EditProfilePage {
  profileForm: FormGroup;
  showPassword = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.profileForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
    });
  }

  ionViewWillEnter() {
    const user = this.authService.getCurrentUser();
    this.profileForm.patchValue({
      username: user ? user.name : 'Pengguna',
      email: user ? user.email : 'pengguna@gudangku.com',
      password: '',
    });
    this.successMessage = '';
    this.errorMessage = '';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      this.errorMessage = 'Silakan isi nama dan email dengan benar.';
      this.successMessage = '';
      return;
    }

    const { username, email, password } = this.profileForm.value;

    this.authService.updateProfile({
      name: username.trim(),
      email: email.trim(),
      password: password ? password.trim() : undefined
    }).subscribe({
      next: () => {
        this.errorMessage = '';
        this.successMessage = 'Profil berhasil diperbarui.';
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 800);
      },
      error: (err) => {
        this.successMessage = '';
        if (err?.error?.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'Gagal memperbarui profil.';
        }
        console.error(err);
      }
    });
  }

  goBack() {
    this.router.navigate(['/profile']);
  }
}
