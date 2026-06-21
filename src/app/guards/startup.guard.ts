import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

function completedOnboarding(): boolean {
  return localStorage.getItem('hasCompletedOnboarding') === 'true';
}

function acceptedPrivacyPolicy(): boolean {
  return localStorage.getItem('hasAcceptedPrivacyPolicy') === 'true';
}

export const startupGuard: CanActivateFn = (): UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isLoggedIn = authService.isLoggedIn();
  const hasOnboarded = completedOnboarding();
  const hasAccepted = acceptedPrivacyPolicy();

  if (isLoggedIn) {
    return router.createUrlTree(['/dashboard']);
  }

  if (!hasOnboarded) {
    return router.createUrlTree(['/onboarding']);
  }

  return router.createUrlTree([hasAccepted ? '/login' : '/privacy-policy']);
};

export const publicOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isLoggedIn = authService.isLoggedIn();

  if (isLoggedIn) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  if (!completedOnboarding()) {
    return router.createUrlTree(['/onboarding']);
  }

  return router.createUrlTree([acceptedPrivacyPolicy() ? '/login' : '/privacy-policy']);
};
