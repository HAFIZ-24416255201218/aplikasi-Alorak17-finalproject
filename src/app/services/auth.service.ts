import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  created_at?: string;
  updated_at?: string;
}

export interface LoginResponse {
  message: string;
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private httpBackend: HttpBackend, private router: Router) {}

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      map(response => {
        this.saveSession(response);
        return response;
      })
    );
  }

  refresh(): Observable<LoginResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token tidak tersedia.'));
    }

    const rawHttp = new HttpClient(this.httpBackend);
    return rawHttp.post<LoginResponse>(`${this.apiUrl}/refresh`, {}, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    }).pipe(
      map(response => {
        this.saveSession(response);
        return response;
      })
    );
  }

  logout(): void {
    this.clearStoredSession();
    localStorage.setItem('hasLoggedOut', 'true');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  isLoggedIn(): boolean {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const refreshExpiresAt = Number(localStorage.getItem('refresh_token_expires_at') || 0);

    if (!isLoggedIn || !accessToken || !refreshToken) {
      return false;
    }

    if (refreshExpiresAt > 0 && Date.now() >= refreshExpiresAt) {
      this.clearStoredSession();
      localStorage.setItem('hasLoggedOut', 'true');
      return false;
    }

    return true;
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  getFriendlyRole(): string {
    const user = this.getCurrentUser();
    if (!user) return 'Pengguna';
    return user.role === 'admin' ? 'Admin Gudang' : 'Operator Gudang';
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/operator/profile`).pipe(
      map(user => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('username', user.name);
        localStorage.setItem('role', user.role);
        return user;
      })
    );
  }

  updateProfile(profileData: { name: string; email: string; password?: string }): Observable<User> {
    const payload: any = {
      name: profileData.name,
      email: profileData.email,
    };
    if (profileData.password) {
      payload.password = profileData.password;
    }

    return this.http.put<User>(`${this.apiUrl}/operator/profile`, payload).pipe(
      map(user => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('username', user.name);
        localStorage.setItem('role', user.role);
        return user;
      })
    );
  }

  private saveSession(response: LoginResponse): void {
    const now = Date.now();

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('access_token_expires_at', String(now + response.expires_in * 1000));
    localStorage.setItem('refresh_token_expires_at', String(now + response.refresh_expires_in * 1000));
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('username', response.user.name);
    localStorage.setItem('role', response.user.role);
    localStorage.removeItem('hasLoggedOut');
  }

  private clearStoredSession(): void {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token_expires_at');
    localStorage.removeItem('refresh_token_expires_at');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
  }
}
