import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { extractList, firstPageParams, PaginatedResponse } from './pagination.util';

export interface LocationItem {
  id: number;
  name: string;
  description?: string;
  display_name?: string;
  parent_location?: number | string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private apiUrl = environment.apiUrl;
  private cache?: { expiresAt: number; stream$: Observable<LocationItem[]> };
  private readonly cacheMs = 300000;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getLocations(): Observable<LocationItem[]> {
    if (this.cache?.expiresAt && this.cache.expiresAt > Date.now()) {
      return this.cache.stream$;
    }

    const stream$ = this.http.get<LocationItem[] | PaginatedResponse<LocationItem>>(`${this.apiUrl}/locations`, { params: firstPageParams() }).pipe(
      map(response => extractList(response)),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache = {
      expiresAt: Date.now() + this.cacheMs,
      stream$,
    };

    return stream$;
  }
}
