import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LocationService, LocationItem } from '../services/location.service';
import { AuthService } from '../services/auth.service';
import { InventoryHistoryItem, MonitoringTransaction } from '../services/monitoring.service';
import { extractList, firstPageParams, PaginatedResponse } from '../services/pagination.util';

export type TransactionType = 'in' | 'out' | 'move';

export interface TransactionItem {
  type: TransactionType;
  name: string;
  productId?: string;
  sku?: string;
  time: string;
  operator: string;
  route: string;
  amount: string;
  note?: string;
  createdAt: string;
}

export interface LaravelTransaction {
  id: number;
  item_id: number;
  user_id: number;
  type: 'in' | 'out' | 'mutation';
  quantity: number;
  date: string;
  from_location?: any;
  to_location?: any;
  created_at: string;
  updated_at: string;
  item?: {
    id: number;
    name: string;
    unit: string;
  };
  user?: {
    id: number;
    name: string;
  };
  from_location_relation?: {
    id: number;
    name: string;
  };
  to_location_relation?: {
    id: number;
    name: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private locationService: LocationService,
    private authService: AuthService
  ) {}

  getTransactionsForTab(tab: 'all' | 'in' | 'out' | 'move'): Observable<TransactionItem[]> {
    const user = this.authService.getCurrentUser();

    if (user?.role === 'admin') {
      if (tab === 'all') {
        return this.http
          .get<InventoryHistoryItem[] | PaginatedResponse<InventoryHistoryItem>>(`${this.apiUrl}/admin/monitoring/history`, { params: firstPageParams() })
          .pipe(
            map(response => extractList(response).map(item => this.mapHistoryToTransactionItem(item))),
            catchError(() => of([]))
          );
      }

      const monitoringPaths: Record<'in' | 'out' | 'move', string> = {
        in: 'goods-in',
        out: 'goods-out',
        move: 'mutations',
      };

      return this.http
        .get<MonitoringTransaction[] | PaginatedResponse<MonitoringTransaction>>(`${this.apiUrl}/admin/monitoring/${monitoringPaths[tab]}`, { params: firstPageParams() })
        .pipe(
          map(response => extractList(response).map(t => this.mapMonitoringToTransactionItem(t))),
          catchError(() =>
            this.getTransactions().pipe(
              map(transactions => transactions.filter(transaction => transaction.type === tab))
            )
          )
        );
    }

    if (tab === 'all') {
      return this.http
          .get<InventoryHistoryItem[] | PaginatedResponse<InventoryHistoryItem>>(`${this.apiUrl}/operator/history`, { params: firstPageParams() })
          .pipe(
            map(response => extractList(response).map(item => this.mapHistoryToTransactionItem(item))),
            catchError(() => this.getTransactions())
          );
    }

    return this.http
      .get<InventoryHistoryItem[] | PaginatedResponse<InventoryHistoryItem>>(`${this.apiUrl}/operator/history`, { params: firstPageParams() })
      .pipe(
        map(response => extractList(response)
          .map(item => this.mapHistoryToTransactionItem(item))
          .filter(transaction => transaction.type === tab)
        ),
        catchError(() =>
          this.getTransactions().pipe(
            map(transactions => transactions.filter(transaction => transaction.type === tab))
          )
        )
      );
  }

  getTransactions(): Observable<TransactionItem[]> {
    return this.http.get<LaravelTransaction[] | PaginatedResponse<LaravelTransaction>>(`${this.apiUrl}/operator/transactions`, { params: firstPageParams() }).pipe(
      map(response => extractList(response).map(t => this.mapToTransactionItem(t))),
      catchError(() => of([]))
    );
  }

  addTransaction(transactionData: {
    itemId: string;
    type: TransactionType;
    quantity: number;
    notes?: string;
    fromLocationName?: string;
    toLocationName?: string;
    itemName?: string;
    sku?: string;
    route?: string;
  }): Observable<any> {
    const itemId = Number(transactionData.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return throwError(() => new Error('Barang ini belum punya ID valid dari server. Refresh inventory lalu pilih barang dari daftar server.'));
    }

    const fromLoc = this.normalizeTransactionLocation(transactionData.fromLocationName);
    const toLoc = this.normalizeTransactionLocation(transactionData.toLocationName);
    const payload = {
      item_id: itemId,
      type: transactionData.type === 'move' ? 'mutation' : transactionData.type,
      quantity: transactionData.quantity,
      date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      from_location: fromLoc,
      to_location: toLoc,
      notes: transactionData.notes || undefined,
    };

    return this.http.post(`${this.apiUrl}/operator/transactions`, payload).pipe(
      timeout(20000)
    );
  }

  getTransactionsByProduct(productId: string, sku?: string, name?: string): Observable<TransactionItem[]> {
    return this.getTransactions().pipe(
      map(transactions => 
        transactions.filter(t => 
          t.productId === productId || 
          (sku && t.sku === sku) || 
          (name && t.name.toLowerCase() === name.toLowerCase())
        )
      )
    );
  }

  private findOrCreateLocation(locations: LocationItem[], name?: string): number | null {
    if (!name) return null;
    const cleanName = name.trim();
    
    if (/^\d+$/.test(cleanName)) {
      return Number(cleanName);
    }

    const cleanLower = cleanName.toLowerCase();
    const searchName = cleanLower
      .replace('gudang utama', 'main warehouse')
      .replace('area receiving', 'receiving area')
      .replace('gate inbound', 'receiving area')
      .replace('packing area', 'packing area')
      .replace('retail outlet', 'retail outlet');

    const found = this.findBestLocationMatch(locations, searchName);
    if (found) return found.id;
    
    return 1;
  }

  private mapMonitoringToTransactionItem(t: MonitoringTransaction): TransactionItem {
    return this.mapToTransactionItem({
      id: t.id,
      item_id: t.item_id,
      user_id: t.user_id,
      type: t.type,
      quantity: t.quantity,
      date: t.date,
      from_location: t.from_location_data,
      to_location: t.to_location_data,
      created_at: t.created_at,
      updated_at: t.updated_at,
      item: t.item,
      user: t.user,
    });
  }

  private mapHistoryToTransactionItem(history: InventoryHistoryItem): TransactionItem {
    const transaction = history.transaction;
    const typeMapped: TransactionType =
      history.type === 'mutation' || transaction?.type === 'mutation' ? 'move' : (history.type as 'in' | 'out');

    const recordedAt = history.recorded_at || transaction?.date || new Date().toISOString();
    const dateObj = new Date(recordedAt);
    const changeAmount = history.change_amount ?? transaction?.quantity ?? 0;
    const route = this.resolveHistoryRoute(history, typeMapped);

    return {
      type: typeMapped,
      name: history.item?.name || 'Item Terhapus',
      productId: history.item_id.toString(),
      sku: `SKU-${history.item_id}`,
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: transaction?.user?.name || 'System',
      route,
      amount:
        typeMapped === 'in'
          ? `+${Math.abs(changeAmount)}`
          : typeMapped === 'out'
            ? `-${Math.abs(changeAmount)}`
            : `${Math.abs(changeAmount)}`,
      createdAt: recordedAt,
    };
  }

  private mapToTransactionItem(t: LaravelTransaction): TransactionItem {
    const dateObj = new Date(t.date || t.created_at);
    const typeMapped: TransactionType = t.type === 'mutation' ? 'move' : t.type;
    
    const fromName = this.resolveLocationName(t.from_location, t.from_location_relation?.name);
    const toName = this.resolveLocationName(t.to_location, t.to_location_relation?.name);

    let route = 'Gudang Utama';
    if (typeMapped === 'move') {
      route = `${fromName} -> ${toName}`;
    } else if (typeMapped === 'in') {
      route = toName;
    } else {
      route = fromName;
    }

    return {
      type: typeMapped,
      name: t.item?.name || 'Item Terhapus',
      productId: t.item_id.toString(),
      sku: t.item_id ? `SKU-${t.item_id}` : '',
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: t.user?.name || 'System',
      route: route,
      amount: typeMapped === 'in' ? `+${t.quantity}` : typeMapped === 'out' ? `-${t.quantity}` : `${t.quantity}`,
      createdAt: t.created_at || t.date,
    };
  }

  private resolveHistoryRoute(history: InventoryHistoryItem, type: TransactionType): string {
    const transaction = history.transaction;
    const fromName = this.resolveLocationName(transaction?.from_location, transaction?.from_location_relation?.display_name || transaction?.from_location_relation?.name);
    const toName = this.resolveLocationName(transaction?.to_location, transaction?.to_location_relation?.display_name || transaction?.to_location_relation?.name);

    if (type === 'move') {
      return `${fromName} -> ${toName}`;
    }

    return type === 'in' ? toName : fromName;
  }

  private resolveLocationName(location: any, fallback?: string): string {
    if (location && typeof location === 'object') {
      return location.display_name || location.name || fallback || 'Gudang Utama';
    }

    return fallback || (location ? `Lokasi ${location}` : 'Gudang Utama');
  }

  private normalizeTransactionLocation(location?: string): string | null {
    const cleanLocation = String(location || '').trim();

    if (!cleanLocation) {
      return null;
    }

    return cleanLocation;
  }

  private findBestLocationMatch(locations: LocationItem[], searchName: string): LocationItem | undefined {
    const cleanSearch = this.normalizeLocationSearch(searchName);
    const lastSegment = cleanSearch.split('/').pop()?.trim() || cleanSearch;
    const candidates = locations.map(location => ({
      location,
      name: this.normalizeLocationSearch(location.name),
      displayName: this.normalizeLocationSearch(location.display_name || location.name),
    }));

    return candidates.find(candidate =>
      candidate.name === cleanSearch || candidate.displayName === cleanSearch
    )?.location || candidates.find(candidate =>
      candidate.name === lastSegment || candidate.displayName === lastSegment
    )?.location || candidates
      .filter(candidate =>
        cleanSearch.includes(candidate.name) ||
        cleanSearch.includes(candidate.displayName) ||
        candidate.name.includes(cleanSearch) ||
        candidate.displayName.includes(cleanSearch)
      )
      .sort((a, b) => Math.max(b.name.length, b.displayName.length) - Math.max(a.name.length, a.displayName.length))[0]?.location;
  }

  private normalizeLocationSearch(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace('gudang utama', 'main warehouse')
      .replace('area receiving', 'receiving area')
      .replace('gate inbound', 'receiving area')
      .replace('packing area', 'packing area')
      .replace('retail outlet', 'retail outlet');
  }

}
