import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { extractList, firstPageParams, PaginatedResponse } from './pagination.util';

export interface MonitoringTransaction {
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
    category?: {
      id: number;
      name: string;
    };
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

export interface InventoryHistoryItem {
  id: number;
  item_id: number;
  transaction_id: number;
  stock_before: number;
  stock_after: number;
  change_amount: number;
  type: string;
  recorded_at: string;
  item?: {
    id: number;
    name: string;
    unit: string;
    category?: {
      id: number;
      name: string;
    };
  };
  transaction?: {
    id: number;
    type: 'in' | 'out' | 'mutation';
    quantity: number;
    date: string;
    from_location?: unknown;
    to_location?: unknown;
    from_location_relation?: {
      id: number;
      name: string;
      display_name?: string;
    };
    to_location_relation?: {
      id: number;
      name: string;
      display_name?: string;
    };
    user?: {
      id: number;
      name: string;
    };
  };
}

export interface StockItem {
  id: number;
  name: string;
  category_id: number;
  unit: string;
  initial_stock: number;
  current_stock: number;
  status: boolean;
  low_stock_alert?: number;
  medium_stock_alert?: number;
  created_at: string;
  updated_at: string;
  category?: {
    id: number;
    name: string;
    description?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MonitoringService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // === Admin Monitoring Endpoints ===

  getGoodsIn(): Observable<MonitoringTransaction[]> {
    return this.list<MonitoringTransaction>(`${this.apiUrl}/admin/monitoring/goods-in`);
  }

  private list<T>(url: string): Observable<T[]> {
    return this.http.get<T[] | PaginatedResponse<T>>(url, { params: firstPageParams() }).pipe(
      map(response => extractList(response)),
      catchError(() => of([]))
    );
  }

  getGoodsOut(): Observable<MonitoringTransaction[]> {
    return this.list<MonitoringTransaction>(`${this.apiUrl}/admin/monitoring/goods-out`);
  }

  getMutations(): Observable<MonitoringTransaction[]> {
    return this.list<MonitoringTransaction>(`${this.apiUrl}/admin/monitoring/mutations`);
  }

  getHistory(): Observable<InventoryHistoryItem[]> {
    return this.list<InventoryHistoryItem>(`${this.apiUrl}/admin/monitoring/history`);
  }

  // === Admin Stock Endpoints ===

  getStocks(): Observable<StockItem[]> {
    return this.list<StockItem>(`${this.apiUrl}/admin/stocks`);
  }

  getLowStocks(): Observable<StockItem[]> {
    return this.list<StockItem>(`${this.apiUrl}/admin/stocks/low`);
  }

  getEmptyStocks(): Observable<StockItem[]> {
    return this.list<StockItem>(`${this.apiUrl}/admin/stocks/empty`);
  }

  // === Operator History Endpoint ===

  getOperatorHistory(): Observable<InventoryHistoryItem[]> {
    return this.list<InventoryHistoryItem>(`${this.apiUrl}/operator/history`);
  }
}
