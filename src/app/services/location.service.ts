import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getLocations(): Observable<LocationItem[]> {
    return this.http.get<LocationItem[] | PaginatedResponse<LocationItem>>(`${this.apiUrl}/locations`, { params: firstPageParams() }).pipe(
      map(response => extractList(response)),
      catchError(() => of([]))
    );
  }
}
