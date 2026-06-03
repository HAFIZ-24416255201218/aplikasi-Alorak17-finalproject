import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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
  ) {
    this.profileForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
    });
  }

  ionViewWillEnter() {
    this.profileForm.patchValue({
      username: localStorage.getItem('username') || 'Pengguna',
      email: localStorage.getItem('email') || 'pengguna@gudangku.com',
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

    const { username, email } = this.profileForm.value;

    localStorage.setItem('username', username.trim());
    localStorage.setItem('email', email.trim());
    localStorage.removeItem('password');

    this.errorMessage = '';
    this.successMessage = 'Profil berhasil diperbarui.';

    setTimeout(() => {
      this.router.navigate(['/profile']);
    }, 500);
  }

  goBack() {
    this.router.navigate(['/profile']);
  }
}
