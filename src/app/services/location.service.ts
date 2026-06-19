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
      catchError(() => of(this.getFallbackLocations()))
    );
  }

  getFallbackLocations(): LocationItem[] {
    return [
      { id: 8, name: '03', display_name: 'Main Warehouse/Rak A/03', parent_location: '5' },
      { id: 7, name: '02', display_name: 'Main Warehouse/Rak A/02', parent_location: '5' },
      { id: 6, name: '01', display_name: 'Main Warehouse/Rak A/01', parent_location: '5' },
      { id: 5, name: 'Rak A', display_name: 'Main Warehouse/Rak A', parent_location: '1' },
      { id: 1, name: 'Main Warehouse', display_name: 'Main Warehouse', description: 'Primary storage zone' },
    ];
  }
}
