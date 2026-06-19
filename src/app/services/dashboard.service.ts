import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DashboardSummary {
  total_items: number;
  total_stock: number;
  total_transactions: number;
  low_stock_count: number;
  empty_stock_count: number;
  transactions_by_type: {
    in?: number;
    out?: number;
    mutation?: number;
  };
  latest_activity: DashboardActivity[];
}

export interface DashboardActivity {
  id: number;
  item_id: number;
  user_id: number;
  type: 'in' | 'out' | 'mutation';
  quantity: number;
  date: string;
  from_location?: number | null;
  to_location?: number | null;
  created_at: string;
  updated_at: string;
  item?: {
    id: number;
    name: string;
    unit: string;
    current_stock: number;
  };
  user?: {
    id: number;
    name: string;
  };
  from_location_data?: {
    id: number;
    name: string;
  };
  to_location_data?: {
    id: number;
    name: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/admin/dashboard`).pipe(
      catchError(() =>
        of({
          total_items: 0,
          total_stock: 0,
          total_transactions: 0,
          low_stock_count: 0,
          empty_stock_count: 0,
          transactions_by_type: {},
          latest_activity: [],
        })
      )
    );
  }
}
