import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, timeout } from 'rxjs/operators';
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
  barcode?: string;
  userId?: number;
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
    sku?: string;
    code?: string;
    item_code?: string;
    barcode?: string;
  };
  user?: {
    id: number;
    name: string;
  };
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
}

interface LocationLike {
  id?: number | string;
  name?: string;
  display_name?: string;
  parent_location?: number | string | LocationLike | null;
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
            switchMap(response => this.locationService.getLocations().pipe(
              map(locations => extractList(response).map(item => this.mapHistoryToTransactionItem(item, locations)))
            )),
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
          switchMap(response => this.locationService.getLocations().pipe(
            map(locations => extractList(response).map(t => this.mapMonitoringToTransactionItem(t, locations)))
          )),
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
            switchMap(response => this.locationService.getLocations().pipe(
              map(locations => extractList(response).map(item => this.mapHistoryToTransactionItem(item, locations)))
            )),
            catchError(() => this.getTransactions())
          );
    }

    return this.http
      .get<InventoryHistoryItem[] | PaginatedResponse<InventoryHistoryItem>>(`${this.apiUrl}/operator/history`, { params: firstPageParams() })
      .pipe(
        switchMap(response => this.locationService.getLocations().pipe(
          map(locations => extractList(response)
            .map(item => this.mapHistoryToTransactionItem(item, locations))
            .filter(transaction => transaction.type === tab)
          )
        )),
        catchError(() =>
          this.getTransactions().pipe(
            map(transactions => transactions.filter(transaction => transaction.type === tab))
          )
        )
      );
  }

  getTransactions(): Observable<TransactionItem[]> {
    return this.http.get<LaravelTransaction[] | PaginatedResponse<LaravelTransaction>>(`${this.apiUrl}/operator/transactions`, { params: firstPageParams() }).pipe(
      switchMap(response => this.locationService.getLocations().pipe(
        map(locations => extractList(response).map(t => this.mapToTransactionItem(t, locations)))
      )),
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

  private mapMonitoringToTransactionItem(t: MonitoringTransaction, locations: LocationItem[]): TransactionItem {
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
    }, locations);
  }

  private mapHistoryToTransactionItem(history: InventoryHistoryItem, locations: LocationItem[]): TransactionItem {
    const transaction = history.transaction;
    const typeMapped: TransactionType =
      history.type === 'mutation' || transaction?.type === 'mutation' ? 'move' : (history.type as 'in' | 'out');

    const recordedAt = history.recorded_at || transaction?.date || new Date().toISOString();
    const dateObj = new Date(recordedAt);
    const changeAmount = history.change_amount ?? transaction?.quantity ?? 0;
    const route = this.resolveHistoryRoute(history, typeMapped, locations);

    return {
      type: typeMapped,
      name: history.item?.name || 'Item Terhapus',
      productId: history.item_id.toString(),
      sku: this.resolveItemCode(history.item, history.item_id),
      barcode: this.resolveItemBarcode(history.item),
      userId: transaction?.user?.id,
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

  private mapToTransactionItem(t: LaravelTransaction, locations: LocationItem[]): TransactionItem {
    const dateObj = new Date(t.date || t.created_at);
    const typeMapped: TransactionType = t.type === 'mutation' ? 'move' : t.type;
    
    const fromName = this.resolveLocationName(
      t.from_location,
      t.from_location_relation?.display_name || t.from_location_relation?.name,
      locations
    );
    const toName = this.resolveLocationName(
      t.to_location,
      t.to_location_relation?.display_name || t.to_location_relation?.name,
      locations
    );

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
      sku: this.resolveItemCode(t.item, t.item_id),
      barcode: this.resolveItemBarcode(t.item),
      userId: t.user_id,
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: t.user?.name || 'System',
      route: route,
      amount: typeMapped === 'in' ? `+${t.quantity}` : typeMapped === 'out' ? `-${t.quantity}` : `${t.quantity}`,
      createdAt: t.created_at || t.date,
    };
  }

  private resolveHistoryRoute(history: InventoryHistoryItem, type: TransactionType, locations: LocationItem[]): string {
    const transaction = history.transaction;
    const fromName = this.resolveLocationName(
      transaction?.from_location,
      transaction?.from_location_relation?.display_name || transaction?.from_location_relation?.name,
      locations
    );
    const toName = this.resolveLocationName(
      transaction?.to_location,
      transaction?.to_location_relation?.display_name || transaction?.to_location_relation?.name,
      locations
    );

    if (type === 'move') {
      return `${fromName} -> ${toName}`;
    }

    return type === 'in' ? toName : fromName;
  }

  private resolveItemCode(item: { sku?: string; code?: string; item_code?: string } | undefined, fallbackId?: number) {
    return item?.sku || item?.code || item?.item_code || (fallbackId ? `SKU-${fallbackId}` : '');
  }

  private resolveItemBarcode(item: { barcode?: string } | undefined) {
    return item?.barcode || '';
  }

  private resolveLocationName(location: unknown, fallback?: string, locations: LocationItem[] = []): string {
    const locationObject = this.asLocationLike(location);
    const relationName = locationObject?.display_name || locationObject?.name;
    const relationId = this.getLocationId(relationName);

    if (relationName && !relationId) {
      return relationName;
    }

    const fallbackName = fallback?.trim();
    const fallbackId = this.getLocationId(fallbackName);
    if (fallbackName && !fallbackId) {
      return fallbackName;
    }

    const locationId = this.getLocationId(locationObject?.id ?? location) ?? relationId ?? fallbackId;
    const locationItem = locationId ? locations.find(item => Number(item.id) === locationId) : undefined;
    if (locationItem) {
      return this.getLocationDisplayName(locationItem, locations);
    }

    return fallbackName || relationName || (location ? `Lokasi ${location}` : 'Gudang Utama');
  }

  private asLocationLike(location: unknown): LocationLike | undefined {
    return location && typeof location === 'object' ? location as LocationLike : undefined;
  }

  private getLocationId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return undefined;
    }

    return Number(trimmed);
  }

  private getLocationDisplayName(location: LocationItem, locations: LocationItem[]): string {
    if (location.display_name) {
      return location.display_name;
    }

    const parentId = this.getLocationId(location.parent_location);
    const parentLocation = parentId ? locations.find(item => Number(item.id) === parentId) : undefined;
    const parentName = parentLocation ? this.getLocationDisplayName(parentLocation, locations) : undefined;

    return parentName && !location.name.includes('/')
      ? `${parentName}/${location.name}`
      : location.name;
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
