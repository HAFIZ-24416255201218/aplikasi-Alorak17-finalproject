import { HttpBackend, HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { PendingSyncService } from '../services/pending-sync.service';

function clearSession(router: Router): void {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('access_token_expires_at');
  localStorage.removeItem('refresh_token_expires_at');
  localStorage.removeItem('user');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  localStorage.setItem('hasLoggedOut', 'true');
  router.navigate(['/login'], { replaceUrl: true });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const httpBackend = inject(HttpBackend);
  const pendingSyncService = inject(PendingSyncService);
  const rawHttp = new HttpClient(httpBackend);
  const token = localStorage.getItem('access_token');

  let authReq = req;
  if (token && !req.url.includes('/login') && !req.url.includes('/refresh')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError(err => {
      const isAuthEndpoint = req.url.includes('/login') || req.url.includes('/refresh');
      const canQueueOffline = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        !isAuthEndpoint &&
        !req.headers.has('X-Skip-Pending-Queue');

      if (err.status === 0 && canQueueOffline) {
        pendingSyncService.enqueue(req.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE', req.url, req.body);
      }

      if (err.status !== 401 || isAuthEndpoint) {
        if (err.status === 401 && req.url.includes('/login')) {
          return throwError(() => err);
        }

        if (err.status === 401) {
          clearSession(router);
        }

        return throwError(() => err);
      }

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        clearSession(router);
        return throwError(() => err);
      }

      return rawHttp
        .post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
          refresh_expires_in: number;
          user: unknown;
        }>(
          `${environment.apiUrl}/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        )
        .pipe(
          switchMap(response => {
            const now = Date.now();
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
            localStorage.setItem('access_token_expires_at', String(now + response.expires_in * 1000));
            localStorage.setItem('refresh_token_expires_at', String(now + response.refresh_expires_in * 1000));
            localStorage.setItem('user', JSON.stringify(response.user));

            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.access_token}`,
              },
            });

            return next(retryReq);
          }),
          catchError(refreshErr => {
            clearSession(router);
            return throwError(() => refreshErr);
          })
        );
    })
  );
};
