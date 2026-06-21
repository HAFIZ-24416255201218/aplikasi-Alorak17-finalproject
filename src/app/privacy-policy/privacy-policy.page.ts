import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: false,
})
export class PrivacyPolicyPage {
  readonly privacyPolicyUrl = 'https://sites.google.com/view/alorack17/halaman-muka';
  hasAgreed = localStorage.getItem('hasAcceptedPrivacyPolicy') === 'true';

  constructor(private router: Router) {}

  goBack(): void {
    localStorage.removeItem('hasCompletedOnboarding');
    localStorage.removeItem('hasAcceptedPrivacyPolicy');
    this.router.navigate(['/onboarding']);
  }

  continueToLogin(): void {
    if (!this.hasAgreed) {
      return;
    }

    localStorage.setItem('hasCompletedOnboarding', 'true');
    localStorage.setItem('hasAcceptedPrivacyPolicy', 'true');
    this.router.navigate(['/login']);
  }
}
