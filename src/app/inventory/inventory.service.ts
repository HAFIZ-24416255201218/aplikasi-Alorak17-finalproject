import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { extractList, firstPageParams, PaginatedResponse } from '../services/pagination.util';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  location: string;
  parentLocation?: string;
  quantity: number;
  unit: string;
  category?: string;
  categoryId?: number;
  icon: string;
  badgeClass: string;
  quantityClass: string;
  expirationDate?: string;
  notes?: string;
  imageData?: string;
  minThreshold?: number;
  mediumThreshold?: number;
  locations?: InventoryLocation[];
  updatedAt?: string;
  hasServerStockLocations?: boolean;
}

export interface InventoryLocation {
  name: string;
  parentLocation?: string;
  backendValue?: string;
  quantity: number;
}

export interface LaravelCategory {
  id: number;
  name: string;
  description?: string;
  status: boolean | string | number;
}

export interface LaravelItem {
  id: number;
  item_id?: number;
  category_id?: number;
  name?: string;
  sku?: string;
  barcode?: string;
  item_code?: string;
  code?: string;
  unit?: string;
  initial_stock?: number;
  current_stock?: number;
  stock_quantity?: number;
  location_stock?: number;
  location_quantity?: number;
  available_stock?: number;
  quantity?: number;
  stock?: number;
  status?: boolean;
  created_at?: string;
  updated_at?: string;
  category?: LaravelCategory;
  item?: LaravelItem;
  location?: {
    id?: number;
    name?: string;
    display_name?: string;
  };
  locations?: LaravelStockLocation[];
  stock_locations?: LaravelStockLocation[];
  stockLocations?: LaravelStockLocation[];
  item_locations?: LaravelStockLocation[];
  location_id?: number | string;
  stock_location_id?: number | string;
  low_stock_alert?: number;
  medium_stock_alert?: number;
}

export interface LaravelStockLocation {
  id?: number | string;
  location_id?: number | string;
  stock_location_id?: number | string;
  name?: string;
  display_name?: string;
  location_name?: string;
  quantity?: number | string;
  stock?: number | string;
  current_stock?: number | string;
  stock_quantity?: number | string;
  location_stock?: number | string;
  location_quantity?: number | string;
  available_stock?: number | string;
  pivot?: {
    quantity?: number | string;
    stock?: number | string;
  };
  location?: {
    id?: number | string;
    name?: string;
    display_name?: string;
  };
}

interface ItemDisplayMeta {
  location?: string;
  parentLocation?: string;
  minThreshold?: number;
  mediumThreshold?: number;
  locations?: InventoryLocation[];
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private apiUrl = environment.apiUrl;
  private readonly displayMetaStorageKey = 'alorack-item-display-meta';
  private readonly recentItemsStorageKey = 'alorack-recent-items-v2';
  private readonly shortCacheMs = 15000;
  private readonly longCacheMs = 300000;
  private itemsCache?: { key: string; expiresAt: number; stream$: Observable<InventoryItem[]> };
  private categoriesCache?: { key: string; expiresAt: number; stream$: Observable<LaravelCategory[]> };
  private stockLocationsCache?: { expiresAt: number; stream$: Observable<any[]> };
  private historyLocationsCache?: { key: string; expiresAt: number; stream$: Observable<{ history: any[]; locations: any[] }> };

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  invalidateCache(): void {
    this.itemsCache = undefined;
    this.stockLocationsCache = undefined;
    this.historyLocationsCache = undefined;
  }

  getItems(forceRefresh = false): Observable<InventoryItem[]> {
    const user = this.authService.getCurrentUser();
    const endpoint = user?.role === 'admin' 
      ? `${this.apiUrl}/admin/items` 
      : `${this.apiUrl}/operator/stocks`;
    const cacheKey = `${user?.role || 'guest'}:${endpoint}`;

    if (!forceRefresh && this.itemsCache?.key === cacheKey && this.itemsCache.expiresAt > Date.now()) {
      return this.itemsCache.stream$;
    }

    const stream$ = this.http.get<LaravelItem[] | PaginatedResponse<LaravelItem>>(endpoint, { params: firstPageParams() }).pipe(
      map(response => this.mergeRecentItems(this.mergeDuplicateItems(extractList(response).map(item => this.mapToInventoryItem(item))))),
      switchMap(items => user?.role === 'admin' ? of(items) : this.applyServerStockLocations(items)),
      switchMap(items => this.applyHistoryLocations(items, user?.role === 'admin' ? 'admin' : 'operator')),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.itemsCache = {
      key: cacheKey,
      expiresAt: Date.now() + this.shortCacheMs,
      stream$,
    };

    return stream$;
  }

  getItemById(id: string): Observable<InventoryItem | undefined> {
    const user = this.authService.getCurrentUser();
    const rolePrefix = user?.role === 'admin' ? 'admin' : 'operator';
    const cleanId = id.trim();

    if (rolePrefix === 'operator') {
      return this.getItems().pipe(
        switchMap(items => {
          const normalizedId = cleanId.toLowerCase();
          const stockItem = items.find(item =>
            item.id.toLowerCase() === normalizedId ||
            item.sku.toLowerCase() === normalizedId ||
            item.sku.replace(/^sku-/i, '').toLowerCase() === normalizedId ||
            (item.barcode || '').toLowerCase() === normalizedId
          );

          if (stockItem) {
            return of(stockItem);
          }

          return this.getItemDetailById(rolePrefix, cleanId);
        })
      );
    }

    return this.getItemDetailById(rolePrefix, cleanId);
  }

  private getItemDetailById(rolePrefix: string, cleanId: string): Observable<InventoryItem | undefined> {
    return this.http.get<LaravelItem>(`${this.apiUrl}/${rolePrefix}/items/${cleanId}`).pipe(
      map(item => this.mapToInventoryItem(item)),
      catchError(() =>
        this.http.get<LaravelItem>(`${this.apiUrl}/items/${cleanId}`).pipe(
          map(item => this.mapToInventoryItem(item)),
          catchError(() => of(undefined))
        )
      )
    );
  }

  getItemBySku(sku: string): Observable<InventoryItem | undefined> {
    const cleanId = sku.startsWith('SKU-') ? sku.replace('SKU-', '') : sku;
    return this.getItemById(cleanId);
  }

  getCategories(): Observable<LaravelCategory[]> {
    const user = this.authService.getCurrentUser();
    const cacheKey = user?.role || 'guest';

    if (this.categoriesCache?.key === cacheKey && this.categoriesCache.expiresAt > Date.now()) {
      return this.categoriesCache.stream$;
    }

    const categoryEndpoints = user?.role === 'admin'
      ? ['categories', 'admin/categories', 'operator/categories']
      : ['categories', 'operator/categories', 'admin/categories'];

    const stream$ = this.tryCategoryEndpoints(categoryEndpoints).pipe(
      catchError(() => this.getCategoriesFromItems()),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.categoriesCache = {
      key: cacheKey,
      expiresAt: Date.now() + this.longCacheMs,
      stream$,
    };

    return stream$;
  }

  getItemByBarcode(barcode: string): Observable<InventoryItem | undefined> {
    const cleanBarcode = barcode.trim();
    const encodedBarcode = encodeURIComponent(cleanBarcode);
    const user = this.authService.getCurrentUser();
    const rolePrefix = user?.role === 'admin' ? 'admin' : 'operator';
    const attempts = [
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/items/barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/items?barcode=${encodedBarcode}&page=1` },
      { method: 'GET', url: `${this.apiUrl}/items/barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/items?barcode=${encodedBarcode}&page=1` },
    ];

    return this.findItemLocallyByBarcode(cleanBarcode).pipe(
      switchMap(item => item ? of(item) : this.tryBarcodeEndpoint(attempts, cleanBarcode))
    );
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/items/${id}`);
  }

  updateStockAlerts(item: InventoryItem, minThreshold: number, mediumThreshold: number): Observable<any> {
    const payload = {
      low_stock_alert: minThreshold,
      medium_stock_alert: mediumThreshold,
    };

    return this.http.patch<LaravelItem>(`${this.apiUrl}/operator/items/${item.id}`, payload).pipe(
      map(response => {
        this.saveItemDisplayMeta([item.id, item.sku, item.barcode], {
          minThreshold,
          mediumThreshold,
        });

        this.saveRecentItem({
          ...item,
          minThreshold,
          mediumThreshold,
          updatedAt: response.updated_at || new Date().toISOString(),
        });

        return response;
      })
    );
  }

  upsertItem(item: InventoryItem): Observable<any> {
    const user = this.authService.getCurrentUser();
    const isAdmin = user?.role === 'admin';
    const itemsEndpoint = isAdmin ? 'admin/items' : 'operator/items';

    const saveItem = (categoryId: number) => {
      const isNew = !item.id || item.id.startsWith('inv-');
      const barcodeValue = (item.barcode || item.sku || '').trim();
      const basePayload: any = {
        name: item.name,
        code: item.sku,
        category_id: categoryId,
        unit: item.unit || 'pcs',
        initial_stock: isNew ? item.quantity || 0 : 0,
        status: true,
        low_stock_alert: item.minThreshold,
        medium_stock_alert: item.mediumThreshold,
      };

      if (!isNew) {
        basePayload.current_stock = item.quantity || 0;
      }

      const request$ = isNew ? (() => {
        const payloadWithBarcode = {
          ...basePayload,
          barcode: barcodeValue,
          sku: item.sku,
          item_code: item.sku,
        };

        return this.http.post(`${this.apiUrl}/${itemsEndpoint}`, payloadWithBarcode).pipe(
          catchError(firstError =>
            this.http.post(`${this.apiUrl}/${itemsEndpoint}`, basePayload).pipe(
              catchError(() => throwError(() => firstError))
            )
          )
        );
      })() : this.http.put(`${this.apiUrl}/${itemsEndpoint}/${item.id}`, {
        ...basePayload,
        barcode: barcodeValue,
        sku: item.sku,
        item_code: item.sku,
      });

      return request$.pipe(
        map(res => {
          const resPayload = (res as any)?.data || (res as any)?.item || res;
          const idToUse = (resPayload as any)?.id?.toString() || item.id;
          const skuToUse = (resPayload as any)?.barcode || (resPayload as any)?.sku || (resPayload as any)?.code || item.sku;
          
          if (item.location) {
            this.saveItemDisplayMeta([idToUse, skuToUse, item.id, item.sku], {
              location: item.location,
              parentLocation: undefined,
              minThreshold: item.minThreshold,
              mediumThreshold: item.mediumThreshold,
            });
          }

          this.saveRecentItem({
            ...item,
            id: idToUse,
            sku: skuToUse,
            updatedAt: new Date().toISOString(),
          });

          return res;
        })
      );
    };

    if (!isAdmin) {
      return this.resolveCategoryId(item).pipe(
        switchMap(categoryId => saveItem(categoryId))
      );
    }

    return this.http.get<LaravelCategory[] | PaginatedResponse<LaravelCategory>>(`${this.apiUrl}/admin/categories`, { params: firstPageParams() }).pipe(
      map(response => extractList(response)),
      switchMap(categories => {
        const categoryName = item.category || 'Umum';
        const existingCategory = categories.find(
          c => c.name.toLowerCase() === categoryName.toLowerCase()
        );

        if (existingCategory) {
          return of(existingCategory.id);
        } else {
          return this.http.post<LaravelCategory>(`${this.apiUrl}/admin/categories`, {
            name: categoryName,
            description: 'Kategori baru dari frontend',
            status: true,
          }).pipe(
            map(newCategory => newCategory.id),
            catchError(() => of(1))
          );
        }
      }),
      switchMap(categoryId => saveItem(categoryId))
    );
  }

  saveItemDisplayMeta(keys: Array<string | number | undefined>, meta: ItemDisplayMeta) {
    const cleanKeys = keys
      .map(key => String(key || '').trim().toLowerCase())
      .filter(Boolean);

    if (!cleanKeys.length) {
      return;
    }

    const allMeta = this.getAllItemDisplayMeta();
    cleanKeys.forEach(key => {
      allMeta[key] = {
        ...allMeta[key],
        ...meta,
      };
    });

    localStorage.setItem(this.displayMetaStorageKey, JSON.stringify(allMeta));
  }

  rememberItemSnapshot(item: InventoryItem): void {
    this.saveRecentItem(item);
  }

  getStockStatus(item: InventoryItem): 'low' | 'medium' | 'high' {
    const minThreshold = item.minThreshold || 10;
    const mediumThreshold = item.mediumThreshold || 50;

    if (item.quantity <= minThreshold) return 'low';
    if (item.quantity <= mediumThreshold) return 'medium';
    return 'high';
  }



  private mapToInventoryItem(rawItem: LaravelItem): InventoryItem {
    const item = this.getBackendItem(rawItem);
    const itemId = this.getBackendItemId(rawItem, item);
    const rawQuantity = item.current_stock ?? rawItem.current_stock ?? item.stock ?? item.quantity ?? item.initial_stock ?? rawItem.stock ?? rawItem.quantity ?? rawItem.initial_stock ?? 0;
    const quantity = Number(rawQuantity) || 0;
    const sku = item.code || item.sku || item.item_code || rawItem.code || rawItem.sku || rawItem.item_code || `SKU-${itemId}`;
    const barcode = item.barcode || rawItem.barcode || '';
    const displayMeta = this.getItemDisplayMeta(item, sku);

    const minThreshold = item.low_stock_alert !== undefined && item.low_stock_alert !== null
      ? Number(item.low_stock_alert)
      : (displayMeta.minThreshold ?? 10);

    const mediumThreshold = item.medium_stock_alert !== undefined && item.medium_stock_alert !== null
      ? Number(item.medium_stock_alert)
      : (displayMeta.mediumThreshold ?? 50);

    const status = quantity <= minThreshold ? 'low' : quantity <= mediumThreshold ? 'medium' : 'high';

    const backendLocation = this.extractBackendLocation(rawItem, item);
    const backendLocationName = backendLocation.name;
    const backendLocationId = backendLocation.id;
    const hasBackendLocation = !!backendLocationName || !!backendLocationId;
    const backendLocationQuantity = this.extractBackendLocationQuantity(rawItem, item, quantity);
    const backendLocations = this.extractBackendLocations(rawItem, item);
    const locationName = backendLocationName || 'Main Warehouse';
    const parentLocation = backendLocationName
      ? ''
      : '';
    const fullLocation = parentLocation && !locationName.includes('/')
      ? `${parentLocation}/${locationName}`
      : locationName;
    const trustedDisplayLocations = this.getTrustedDisplayLocations(displayMeta.locations, quantity);
    const locations = this.normalizeDisplayLocations(
      backendLocations.length
        ? backendLocations
        : trustedDisplayLocations?.length
        ? trustedDisplayLocations
        : backendLocationName
        ? [{ name: backendLocationName, backendValue: backendLocationId, quantity: backendLocationQuantity }]
        : undefined,
      locationName,
      parentLocation,
      quantity,
      backendLocationId || (!hasBackendLocation ? '1' : undefined),
      !backendLocationName
    );

    return {
      id: itemId,
      name: item.name || rawItem.name || 'Barang',
      sku,
      barcode,
      location: fullLocation,
      parentLocation,
      quantity: quantity,
      unit: item.unit || rawItem.unit || 'pcs',
      category: item.category?.name || rawItem.category?.name || 'Umum',
      categoryId: item.category_id || item.category?.id || rawItem.category_id || rawItem.category?.id,
      icon: 'cube-outline',
      badgeClass: status === 'low' ? 'badge-red' : status === 'medium' ? 'badge-yellow' : 'badge-green',
      quantityClass: status === 'low' ? 'qty-low' : status === 'medium' ? 'qty-medium' : 'qty-high',
      minThreshold,
      mediumThreshold,
      locations,
      updatedAt: item.updated_at || rawItem.updated_at,
    };
  }

  private getBackendItem(rawItem: LaravelItem): LaravelItem {
    return rawItem.item || rawItem;
  }

  private getBackendItemId(rawItem: LaravelItem, item: LaravelItem = this.getBackendItem(rawItem)): string {
    const id = item.id || rawItem.item_id || rawItem.id;
    return String(id || '').trim();
  }

  private extractBackendLocation(rawItem: LaravelItem, item: LaravelItem): { id?: string; name?: string } {
    const raw = rawItem as any;
    const backendItem = item as any;
    const locationObject =
      raw.location ||
      raw.location_data ||
      raw.stock_location ||
      raw.stockLocation ||
      raw.location_relation ||
      raw.stock?.location ||
      backendItem.location ||
      backendItem.location_data ||
      backendItem.stock_location ||
      backendItem.stockLocation;

    const id =
      locationObject?.id ??
      raw.location_id ??
      raw.stock_location_id ??
      raw.locationId ??
      raw.stockLocationId ??
      raw.stock?.location_id ??
      backendItem.location_id ??
      backendItem.stock_location_id ??
      backendItem.locationId ??
      backendItem.stockLocationId;

    const name =
      locationObject?.display_name ||
      locationObject?.name ||
      locationObject?.location_name ||
      raw.location_name ||
      raw.display_location ||
      backendItem.location_name ||
      backendItem.display_location;

    return {
      id: id !== undefined && id !== null ? String(id) : undefined,
      name: name ? String(name) : undefined,
    };
  }

  private extractBackendLocations(rawItem: LaravelItem, item: LaravelItem): InventoryLocation[] {
    const raw = rawItem as any;
    const backendItem = item as any;
    const candidates = [
      raw.stock_locations,
      raw.stockLocations,
      raw.locations,
      raw.item_locations,
      raw.itemLocations,
      raw.stocks,
      raw.location_stocks,
      backendItem.stock_locations,
      backendItem.stockLocations,
      backendItem.locations,
      backendItem.item_locations,
      backendItem.itemLocations,
      backendItem.stocks,
      backendItem.location_stocks,
    ].find(value => Array.isArray(value)) as LaravelStockLocation[] | undefined;

    if (!candidates?.length) {
      return [];
    }

    return candidates
      .map(location => this.mapBackendStockLocation(location))
      .filter((location): location is InventoryLocation => !!location);
  }

  private mapBackendStockLocation(location: LaravelStockLocation): InventoryLocation | undefined {
    const raw = location as any;
    const locationObject = raw.location || raw.location_data || raw.stock_location || raw.stockLocation;
    const id =
      locationObject?.id ??
      raw.location_id ??
      raw.stock_location_id ??
      raw.locationId ??
      raw.stockLocationId ??
      raw.id;

    const name =
      locationObject?.display_name ||
      locationObject?.name ||
      raw.display_name ||
      raw.name ||
      raw.location_name ||
      (id ? `Lokasi ${id}` : '');

    const quantity =
      raw.stock_quantity ??
      raw.location_stock ??
      raw.location_quantity ??
      raw.available_stock ??
      raw.current_stock ??
      raw.quantity ??
      raw.stock ??
      raw.pivot?.quantity ??
      raw.pivot?.stock;

    const normalizedQuantity = Number(quantity || 0);
    if (!name || normalizedQuantity <= 0) {
      return undefined;
    }

    return {
      name: String(name),
      backendValue: id !== undefined && id !== null ? String(id) : undefined,
      quantity: normalizedQuantity,
    };
  }

  private extractBackendLocationQuantity(rawItem: LaravelItem, item: LaravelItem, fallbackQuantity: number): number {
    const raw = rawItem as any;
    const backendItem = item as any;
    const locationQuantity =
      raw.stock_quantity ??
      raw.location_stock ??
      raw.location_quantity ??
      raw.available_stock ??
      raw.stock?.quantity ??
      raw.stock?.current_stock ??
      raw.pivot?.quantity ??
      raw.pivot?.stock ??
      backendItem.stock_quantity ??
      backendItem.location_stock ??
      backendItem.location_quantity ??
      backendItem.available_stock;

    if (locationQuantity !== undefined && locationQuantity !== null) {
      return Number(locationQuantity) || 0;
    }

    const hasLocationData = !!this.extractBackendLocation(rawItem, item).id || !!this.extractBackendLocation(rawItem, item).name;
    if (hasLocationData && raw.quantity !== undefined && raw.quantity !== null) {
      return Number(raw.quantity) || 0;
    }

    return fallbackQuantity;
  }

  private resolveCategoryId(item: InventoryItem): Observable<number> {
    const existingCategoryId = Number(item.categoryId || 0);
    if (existingCategoryId > 0) {
      return of(existingCategoryId);
    }

    const cleanCategoryName = (item.category || 'Umum').trim().toLowerCase();

    return this.getCategories().pipe(
      map(categories => {
        const selectedCategory = categories.find(
          category => category.name.toLowerCase() === cleanCategoryName
        );

        const categoryId = selectedCategory?.id || categories[0]?.id;
        if (!categoryId) {
          throw new Error('Kategori belum tersedia dari server. Minta admin membuat kategori terlebih dahulu.');
        }

        return categoryId;
      }),
      catchError(error => throwError(() => error))
    );
  }

  private tryCategoryEndpoints(endpoints: string[], index = 0): Observable<LaravelCategory[]> {
    if (index >= endpoints.length) {
      return throwError(() => new Error('Endpoint kategori tidak tersedia untuk akun ini.'));
    }

    return this.http
      .get<LaravelCategory[] | PaginatedResponse<LaravelCategory>>(`${this.apiUrl}/${endpoints[index]}`, { params: firstPageParams() })
      .pipe(
        map(response => extractList(response)
          .map(category => this.normalizeCategory(category))
          .filter((category): category is LaravelCategory => !!category)
        ),
        switchMap(categories => categories.length ? of(categories) : this.tryCategoryEndpoints(endpoints, index + 1)),
        catchError(() => this.tryCategoryEndpoints(endpoints, index + 1))
      );
  }

  private normalizeCategory(category: Partial<LaravelCategory> | null | undefined): LaravelCategory | undefined {
    const id = Number(category?.id || 0);
    const name = String(category?.name || '').trim();

    if (!id || !name) {
      return undefined;
    }

    const rawStatus = category?.status;
    const status = rawStatus === undefined || rawStatus === null
      ? true
      : rawStatus === true || rawStatus === 1 || rawStatus === '1' || String(rawStatus).toLowerCase() === 'true';

    return {
      ...category,
      id,
      name,
      status,
    };
  }

  private getCategoriesFromItems(): Observable<LaravelCategory[]> {
    return this.getItems().pipe(
      map(items => {
        const categories = new Map<string, LaravelCategory>();

        items.forEach(item => {
          const name = item.category || 'Umum';
          const id = item.categoryId;

          if (!id) {
            return;
          }

          categories.set(name.toLowerCase(), {
            id,
            name,
            status: true,
          });
        });

        return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name));
      })
    );
  }

  private tryBarcodeEndpoint(
    attempts: Array<{ method: string; url: string; body?: { barcode: string } }>,
    barcode: string,
    index = 0
  ): Observable<InventoryItem | undefined> {
    if (index >= attempts.length) {
      return this.findItemLocallyByBarcode(barcode);
    }

    const attempt = attempts[index];
    const request$ = attempt.method === 'POST'
      ? this.http.post<unknown>(attempt.url, attempt.body)
      : this.http.get<unknown>(attempt.url);

    return request$.pipe(
      map(response => this.mapBarcodeResponse(response, barcode)),
      switchMap(item => item ? of(item) : this.tryBarcodeEndpoint(attempts, barcode, index + 1)),
      catchError(() => this.tryBarcodeEndpoint(attempts, barcode, index + 1))
    );
  }

  private findItemLocallyByBarcode(barcode: string): Observable<InventoryItem | undefined> {
    const normalizedBarcode = barcode.trim().toLowerCase();

    return this.getItems().pipe(
      map(items => items.find(item =>
        (item.barcode && item.barcode.toLowerCase() === normalizedBarcode) ||
        item.sku.toLowerCase() === normalizedBarcode ||
        item.sku.replace(/^SKU-/i, '').toLowerCase() === normalizedBarcode
      ))
    );
  }

  private findItemLocallyById(id: string): Observable<InventoryItem | undefined> {
    const normalizedId = id.trim().toLowerCase();

    return this.getItems().pipe(
      map(items => items.find(item =>
        item.id.toLowerCase() === normalizedId ||
        item.sku.toLowerCase() === normalizedId ||
        item.sku.replace(/^sku-/i, '').toLowerCase() === normalizedId ||
        (item.barcode || '').toLowerCase() === normalizedId
      ))
    );
  }

  private mapBarcodeResponse(response: unknown, barcode: string): InventoryItem | undefined {
    const item = this.extractLaravelItem(response, barcode);

    if (!item || !item.id || !item.name) {
      return undefined;
    }

    const mappedItem = this.mapToInventoryItem(item);
    const scannedCode = barcode.trim();

    return {
      ...mappedItem,
      sku: mappedItem.sku || scannedCode,
    };
  }

  private extractLaravelItem(response: unknown, barcode: string): LaravelItem | undefined {
    if (!response) {
      return undefined;
    }

    if (Array.isArray(response)) {
      return this.findMatchingLaravelItem(response as LaravelItem[], barcode);
    }

    const payload = response as {
      data?: unknown;
      items?: unknown;
      item?: unknown;
      result?: unknown;
      stock?: { item?: unknown };
    };

    if (Array.isArray(payload.data)) {
      return this.findMatchingLaravelItem(payload.data as LaravelItem[], barcode);
    }

    if (Array.isArray(payload.items)) {
      return this.findMatchingLaravelItem(payload.items as LaravelItem[], barcode);
    }

    if (Array.isArray(payload.result)) {
      return this.findMatchingLaravelItem(payload.result as LaravelItem[], barcode);
    }

    if (payload.stock?.item) {
      const stockItem = payload.stock.item as LaravelItem;
      return this.laravelItemMatchesBarcode(stockItem, barcode) ? stockItem : undefined;
    }

    const item = (payload.data || payload.item || payload.result || response) as LaravelItem;
    const hasBarcodeField = !!(item.barcode || item.sku || item.item_code || item.code);

    if (hasBarcodeField && !this.laravelItemMatchesBarcode(item, barcode)) {
      return undefined;
    }

    return item;
  }

  private findMatchingLaravelItem(items: LaravelItem[], barcode: string): LaravelItem | undefined {
    return items.find(item => this.laravelItemMatchesBarcode(item, barcode));
  }

  private laravelItemMatchesBarcode(item: LaravelItem, barcode: string): boolean {
    const normalizedBarcode = this.normalizeBarcode(barcode);
    const candidates = [
      item.barcode,
      item.sku,
      item.item_code,
      item.code,
      item.id ? `SKU-${item.id}` : undefined,
      item.id ? String(item.id) : undefined,
    ];

    return candidates.some(candidate => {
      if (!candidate) {
        return false;
      }

      const normalizedCandidate = this.normalizeBarcode(String(candidate));
      return normalizedCandidate === normalizedBarcode ||
        normalizedCandidate.replace(/^sku-/, '') === normalizedBarcode;
    });
  }

  private normalizeBarcode(value: string): string {
    return value.trim().toLowerCase();
  }

  private getItemDisplayMeta(item: LaravelItem, sku: string): ItemDisplayMeta {
    const allMeta = this.getAllItemDisplayMeta();
    const itemId = this.getBackendItemId(item);
    const keys = [
      itemId,
      item.id,
      item.item_id,
      sku,
      item.barcode,
      item.sku,
      item.item_code,
      item.code,
    ]
      .map(key => String(key || '').trim().toLowerCase())
      .filter(Boolean);

    return keys.reduce<ItemDisplayMeta>((meta, key) => ({ ...meta, ...allMeta[key] }), {});
  }

  private getAllItemDisplayMeta(): Record<string, ItemDisplayMeta> {
    try {
      return JSON.parse(localStorage.getItem(this.displayMetaStorageKey) || '{}') || {};
    } catch {
      return {};
    }
  }

  private getTrustedDisplayLocations(locations: InventoryLocation[] | undefined, totalQuantity: number): InventoryLocation[] | undefined {
    if (!locations?.length) {
      return undefined;
    }

    const cleanLocations = locations
      .map(location => ({
        ...location,
        backendValue: location.backendValue ? String(location.backendValue) : this.inferBackendLocationValue(location),
        quantity: Number(location.quantity || 0),
      }))
      .filter(location => location.name && location.quantity > 0 && !!location.backendValue);

    const locationTotal = cleanLocations.reduce((total, location) => total + location.quantity, 0);

    return locationTotal === Number(totalQuantity || 0) ? cleanLocations : undefined;
  }

  private inferBackendLocationValue(location: Pick<InventoryLocation, 'name' | 'parentLocation'>): string | undefined {
    const path = (location.parentLocation && !location.name.includes('/')
      ? `${location.parentLocation}/${location.name}`
      : location.name
    ).trim().toLowerCase();

    if (/^lokasi\s+\d+$/.test(path)) {
      return path.replace(/[^\d]/g, '');
    }

    if (/^\d+$/.test(path)) {
      return path;
    }

    if (path === 'main warehouse' || path === 'gudang utama') {
      return '1';
    }

    if (path === 'main warehouse/rak a') {
      return '5';
    }

    if (path.endsWith('/01') || path === '01') {
      return '6';
    }

    if (path.endsWith('/02') || path === '02') {
      return '7';
    }

    if (path.endsWith('/03') || path === '03') {
      return '8';
    }

    return undefined;
  }

  private getRecentItems(): InventoryItem[] {
    try {
      const recentItems = JSON.parse(localStorage.getItem(this.recentItemsStorageKey) || '[]') || [];
      return Array.isArray(recentItems)
        ? recentItems.filter(item => item?.id && this.isBackendId(item.id))
        : [];
    } catch {
      return [];
    }
  }

  private saveRecentItem(item: InventoryItem): void {
    const recentItems = this.getRecentItems();
    const nextItems = [item, ...recentItems.filter(existing =>
      existing.id !== item.id &&
      existing.sku !== item.sku &&
      existing.barcode !== item.barcode
    )].slice(0, 25);

    localStorage.setItem(this.recentItemsStorageKey, JSON.stringify(nextItems));
  }

  private mergeDuplicateItems(items: InventoryItem[]): InventoryItem[] {
    const itemMap = new Map<string, InventoryItem>();

    items.forEach(item => {
      const existing = itemMap.get(item.id);

      if (!existing) {
        itemMap.set(item.id, item);
        return;
      }

      const locations = this.mergeLocationLists(existing.locations || [], item.locations || []);
      const locationTotal = locations.reduce((total, location) => total + Number(location.quantity || 0), 0);
      const quantity = Math.max(Number(existing.quantity || 0), Number(item.quantity || 0), locationTotal);

      itemMap.set(item.id, {
        ...existing,
        barcode: existing.barcode || item.barcode,
        quantity,
        locations,
        location: locations[0] ? this.getLocationPath(locations[0]) : existing.location,
        parentLocation: locations[0]?.parentLocation || existing.parentLocation,
        updatedAt: this.getLatestDate(existing.updatedAt, item.updatedAt),
      });
    });

    return Array.from(itemMap.values());
  }

  private mergeLocationLists(first: InventoryLocation[], second: InventoryLocation[]): InventoryLocation[] {
    const locationMap = new Map<string, InventoryLocation>();

    [...first, ...second].forEach(location => {
      const key = this.getLocationKey(location);
      const existing = locationMap.get(key);

      if (existing) {
        existing.quantity += Number(location.quantity || 0);
        existing.backendValue = existing.backendValue || location.backendValue;
        locationMap.set(key, existing);
        return;
      }

      locationMap.set(key, {
        ...location,
        quantity: Number(location.quantity || 0),
      });
    });

    return Array.from(locationMap.values()).filter(location => location.quantity > 0);
  }

  private getLatestDate(first?: string, second?: string): string | undefined {
    if (!first) {
      return second;
    }

    if (!second) {
      return first;
    }

    return new Date(first).getTime() >= new Date(second).getTime() ? first : second;
  }

  private mergeRecentItems(items: InventoryItem[]): InventoryItem[] {
    const recentItems = this.getRecentItems();
    return items.map(item => this.mergeItemWithRecentMeta(item, recentItems));
  }

  private mergeItemWithRecentMeta(item: InventoryItem, recentItems: InventoryItem[]): InventoryItem {
    const itemKeys = this.getItemKeys(item);
    const recentItem = recentItems.find(recent =>
      this.getItemKeys(recent).some(key => itemKeys.includes(key))
    );

    if (!recentItem) {
      return item;
    }

    return {
      ...item,
      barcode: item.barcode || recentItem.barcode,
      notes: item.notes || recentItem.notes,
    };
  }

  private applyHistoryLocations(items: InventoryItem[], role: 'admin' | 'operator'): Observable<InventoryItem[]> {
    if (items.length && items.every(item => item.hasServerStockLocations)) {
      return of(items);
    }

    const historyEndpoint = role === 'admin'
      ? `${this.apiUrl}/admin/monitoring/history`
      : `${this.apiUrl}/operator/history`;
    const cacheKey = role;

    if (!this.historyLocationsCache || this.historyLocationsCache.key !== cacheKey || this.historyLocationsCache.expiresAt <= Date.now()) {
      this.historyLocationsCache = {
        key: cacheKey,
        expiresAt: Date.now() + this.shortCacheMs,
        stream$: forkJoin({
          history: this.http
            .get<any[] | PaginatedResponse<any>>(historyEndpoint, { params: firstPageParams() })
            .pipe(
              map(response => extractList(response)),
              catchError(() => of([]))
            ),
          locations: this.http
            .get<any[] | PaginatedResponse<any>>(`${this.apiUrl}/locations`, { params: firstPageParams() })
            .pipe(
              map(response => extractList(response)),
              catchError(() => of([]))
            ),
        }).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        ),
      };
    }

    return this.historyLocationsCache.stream$.pipe(
      map(({ history, locations }) => this.mergeLocationsFromHistory(items, history, locations)),
      catchError(() => of(items))
    );
  }

  private applyServerStockLocations(items: InventoryItem[]): Observable<InventoryItem[]> {
    return this.fetchServerStockLocations().pipe(
      map(records => this.mergeServerStockLocations(items, records)),
      catchError(() => of(items))
    );
  }

  private fetchServerStockLocations(): Observable<any[]> {
    if (this.stockLocationsCache?.expiresAt && this.stockLocationsCache.expiresAt > Date.now()) {
      return this.stockLocationsCache.stream$;
    }

    const stream$ = this.fetchServerStockLocationsAttempt().pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.stockLocationsCache = {
      expiresAt: Date.now() + this.shortCacheMs,
      stream$,
    };

    return stream$;
  }

  private fetchServerStockLocationsAttempt(index = 0): Observable<any[]> {
    const endpoints = [
      `${this.apiUrl}/operator/stock-locations`,
      `${this.apiUrl}/operator/stock-location`,
      `${this.apiUrl}/operator/stocks/locations`,
      `${this.apiUrl}/stock-locations`,
      `${this.apiUrl}/stock-location`,
    ];

    if (index >= endpoints.length) {
      return of([]);
    }

    return this.http.get<any[] | PaginatedResponse<any>>(endpoints[index], { params: firstPageParams() }).pipe(
      map(response => extractList(response)),
      switchMap(records => records.length ? of(records) : this.fetchServerStockLocationsAttempt(index + 1)),
      catchError(() => this.fetchServerStockLocationsAttempt(index + 1))
    );
  }

  private mergeServerStockLocations(items: InventoryItem[], records: any[]): InventoryItem[] {
    if (!records.length) {
      return items;
    }

    const locationMap = new Map<string, InventoryLocation[]>();

    records.forEach(record => {
      const itemId = this.extractStockLocationItemId(record);
      const location = this.mapBackendStockLocation(record);

      if (!itemId || !location) {
        return;
      }

      const currentLocations = locationMap.get(itemId) || [];
      currentLocations.push(location);
      locationMap.set(itemId, currentLocations);
    });

    return items.map(item => {
      const locations = locationMap.get(item.id) || [];
      const total = locations.reduce((sum, location) => sum + Number(location.quantity || 0), 0);

      if (!locations.length || total <= 0) {
        return item;
      }

      return {
        ...item,
        quantity: Math.max(Number(item.quantity || 0), total),
        location: this.getLocationPath(locations[0]),
        parentLocation: locations[0].parentLocation,
        locations,
        hasServerStockLocations: true,
      };
    });
  }

  private extractStockLocationItemId(record: any): string {
    const id =
      record.item_id ??
      record.itemId ??
      record.product_id ??
      record.productId ??
      record.inventory_item_id ??
      record.item?.id ??
      record.product?.id;

    return id !== undefined && id !== null ? String(id) : '';
  }

  private getLocationKey(location: InventoryLocation): string {
    return location.backendValue || this.getLocationPath(location).toLowerCase();
  }

  private mergeLocationsFromHistory(items: InventoryItem[], historyItems: any[], backendLocations: any[]): InventoryItem[] {
    if (!historyItems.length) {
      return items;
    }

    const itemIds = new Set(items.map(item => item.id));
    const locationMaps = new Map<string, Map<string, InventoryLocation>>();
    const locationNameById = this.createLocationNameMap(backendLocations);
    const sortedHistory = [...historyItems].sort((a, b) => {
      const aDate = new Date(a.recorded_at || a.transaction?.date || a.created_at || 0).getTime();
      const bDate = new Date(b.recorded_at || b.transaction?.date || b.created_at || 0).getTime();
      return aDate - bDate || Number(a.id || 0) - Number(b.id || 0);
    });

    sortedHistory.forEach(history => {
      const transaction = history.transaction || history;
      const itemId = String(history.item_id || transaction.item_id || '').trim();
      if (!itemIds.has(itemId)) {
        return;
      }

      const historyLocation = this.extractHistoryLocation(
        history.location_relation || history.location_data || history.location,
        history.location_id,
        locationNameById
      );
      const historyChange = Number(history.change_amount ?? 0);
      if (historyLocation && historyChange !== 0) {
        const itemLocations = this.getHistoryLocationMap(locationMaps, itemId);

        if (historyChange > 0) {
          this.addHistoryLocationQuantity(itemLocations, historyLocation, historyChange);
        } else {
          this.subtractHistoryLocationQuantity(itemLocations, historyLocation, Math.abs(historyChange));
        }
        return;
      }

      const type = history.type === 'mutation' || transaction.type === 'mutation'
        ? 'mutation'
        : (history.type || transaction.type);
      const quantity = type === 'mutation'
        ? Math.abs(Number(transaction.quantity ?? history.quantity ?? 0))
        : Math.abs(Number(history.change_amount ?? transaction.quantity ?? history.quantity ?? 0));
      if (!quantity) {
        return;
      }

      const itemLocations = this.getHistoryLocationMap(locationMaps, itemId);
      const fromLocation = this.extractHistoryLocation(
        transaction.from_location_relation || transaction.from_location_data || history.from_location_relation || history.from_location_data,
        transaction.from_location ?? history.from_location,
        locationNameById
      );
      const toLocation = this.extractHistoryLocation(
        transaction.to_location_relation || transaction.to_location_data || history.to_location_relation || history.to_location_data,
        transaction.to_location ?? history.to_location,
        locationNameById
      );

      if (type === 'in' && toLocation) {
        this.addHistoryLocationQuantity(itemLocations, toLocation, quantity);
        return;
      }

      if (type === 'out' && fromLocation) {
        this.subtractHistoryLocationQuantity(itemLocations, fromLocation, quantity);
        return;
      }

      if (type === 'mutation' && fromLocation && toLocation) {
        const movedQuantity = this.subtractHistoryLocationQuantity(itemLocations, fromLocation, quantity);
        this.addHistoryLocationQuantity(itemLocations, toLocation, movedQuantity || quantity);
      }
    });

    return items.map(item => {
      if (item.hasServerStockLocations) {
        return item;
      }

      const historyLocations = Array.from(locationMaps.get(item.id)?.values() || [])
        .filter(location => location.quantity > 0);
      let historyTotal = historyLocations.reduce((total, location) => total + location.quantity, 0);
      const itemQuantity = Number(item.quantity || 0);

      if (!historyLocations.length || historyTotal <= 0 || historyTotal > itemQuantity) {
        return item;
      }

      if (historyTotal < itemQuantity) {
        const remainderLocationMap = this.getHistoryLocationMap(locationMaps, item.id);
        this.addHistoryLocationQuantity(
          remainderLocationMap,
          this.getFallbackHistoryLocation(item),
          itemQuantity - historyTotal
        );
        historyLocations.splice(
          0,
          historyLocations.length,
          ...Array.from(remainderLocationMap.values()).filter(location => location.quantity > 0)
        );
        historyTotal = historyLocations.reduce((total, location) => total + location.quantity, 0);
      }

      if (historyTotal !== itemQuantity) {
        return item;
      }

      return {
        ...item,
        location: this.getLocationPath(historyLocations[0]),
        parentLocation: historyLocations[0].parentLocation,
        locations: historyLocations,
      };
    });
  }

  private createLocationNameMap(locations: any[]): Map<string, string> {
    const locationMap = new Map<string, string>();

    locations.forEach(location => {
      const id = location?.id;
      if (id === undefined || id === null) {
        return;
      }

      locationMap.set(String(id), String(location.display_name || location.name || `Lokasi ${id}`));
    });

    return locationMap;
  }

  private getHistoryLocationMap(
    locationMaps: Map<string, Map<string, InventoryLocation>>,
    itemId: string
  ): Map<string, InventoryLocation> {
    if (!locationMaps.has(itemId)) {
      locationMaps.set(itemId, new Map<string, InventoryLocation>());
    }

    return locationMaps.get(itemId)!;
  }

  private getFallbackHistoryLocation(item: InventoryItem): InventoryLocation {
    const location = item.locations?.[0];

    if (location) {
      return {
        ...location,
        quantity: 0,
      };
    }

    return {
      name: item.location || 'Main Warehouse',
      parentLocation: item.parentLocation,
      backendValue: this.inferBackendLocationValue({ name: item.location || 'Main Warehouse', parentLocation: item.parentLocation }),
      quantity: 0,
    };
  }

  private extractHistoryLocation(
    relation: any,
    rawLocation: any,
    locationNameById: Map<string, string>
  ): InventoryLocation | undefined {
    const rawId = relation?.id ?? (typeof rawLocation === 'object' ? rawLocation?.id : rawLocation);
    const id = rawId !== undefined && rawId !== null ? String(rawId) : undefined;
    const name = relation?.display_name || relation?.name ||
      (typeof rawLocation === 'object' ? (rawLocation.display_name || rawLocation.name) : undefined) ||
      (id ? locationNameById.get(id) : undefined) ||
      (id ? `Lokasi ${id}` : '');

    if (!name && !id) {
      return undefined;
    }

    return {
      name: String(name || `Lokasi ${id}`),
      backendValue: id,
      quantity: 0,
    };
  }

  private addHistoryLocationQuantity(
    locations: Map<string, InventoryLocation>,
    location: InventoryLocation,
    quantity: number
  ): void {
    const key = this.getLocationKey(location);
    const current = locations.get(key) || { ...location, quantity: 0 };
    current.quantity += quantity;
    locations.set(key, current);
  }

  private subtractHistoryLocationQuantity(
    locations: Map<string, InventoryLocation>,
    location: InventoryLocation,
    quantity: number
  ): number {
    const key = this.getLocationKey(location);
    const current = locations.get(key);
    if (!current) {
      return 0;
    }

    const movedQuantity = Math.min(current.quantity, quantity);
    current.quantity -= movedQuantity;

    if (current.quantity <= 0) {
      locations.delete(key);
    } else {
      locations.set(key, current);
    }

    return movedQuantity;
  }

  private getLocationPath(location: Pick<InventoryLocation, 'name' | 'parentLocation'>): string {
    return location.parentLocation && !location.name.includes('/')
      ? `${location.parentLocation}/${location.name}`
      : location.name;
  }

  private getItemKeys(item: InventoryItem): string[] {
    return [item.id, item.sku, item.barcode]
      .filter(key => !!key)
      .map(key => String(key).toLowerCase());
  }

  private isBackendId(id: string): boolean {
    return /^\d+$/.test(String(id || '').trim());
  }

  private normalizeDisplayLocations(
    savedLocations: InventoryLocation[] | undefined,
    fallbackLocation: string,
    fallbackParentLocation: string,
    totalQuantity: number,
    fallbackBackendValue?: string,
    balanceToTotal = true
  ): InventoryLocation[] {
    const locations = (savedLocations?.length
      ? savedLocations
      : [{ name: fallbackLocation, parentLocation: fallbackParentLocation, quantity: totalQuantity }]
    )
      .map(location => ({
        name: location.name,
        parentLocation: location.parentLocation,
        backendValue: location.backendValue,
        quantity: Number(location.quantity || 0),
      }))
      .filter(location => location.name && location.quantity > 0);

    if (!locations.length) {
      return [{ name: fallbackLocation, parentLocation: fallbackParentLocation, backendValue: fallbackBackendValue, quantity: totalQuantity }];
    }

    if (!balanceToTotal) {
      return locations;
    }

    const locationTotal = locations.reduce((sum, location) => sum + location.quantity, 0);
    const difference = totalQuantity - locationTotal;

    if (difference > 0) {
      locations[0] = {
        ...locations[0],
        quantity: locations[0].quantity + difference,
      };
    } else if (difference < 0) {
      let remainingReduction = Math.abs(difference);

      for (const location of locations) {
        if (remainingReduction <= 0) {
          break;
        }

        const reduced = Math.min(location.quantity, remainingReduction);
        location.quantity -= reduced;
        remainingReduction -= reduced;
      }
    }

    return locations.filter(location => location.quantity > 0);
  }
}
