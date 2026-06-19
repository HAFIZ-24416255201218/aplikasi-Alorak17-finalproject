import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
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
  location_id?: number | string;
  stock_location_id?: number | string;
  low_stock_alert?: number;
  medium_stock_alert?: number;
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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getItems(): Observable<InventoryItem[]> {
    const user = this.authService.getCurrentUser();
    const endpoint = user?.role === 'admin' 
      ? `${this.apiUrl}/admin/items` 
      : `${this.apiUrl}/operator/stocks`;

    return this.http.get<LaravelItem[] | PaginatedResponse<LaravelItem>>(endpoint, { params: firstPageParams() }).pipe(
      map(response => this.mergeRecentItems(extractList(response).map(item => this.mapToInventoryItem(item)))),
      catchError(() => of(this.getRecentItems()))
    );
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
          catchError(() => this.findItemLocallyById(cleanId))
        )
      )
    );
  }

  getItemBySku(sku: string): Observable<InventoryItem | undefined> {
    // Di backend, parameter ID digunakan sebagai rujukan utama.
    // Jika rute mengirimkan SKU or ID, kita panggil endpoint detail.
    const cleanId = sku.startsWith('SKU-') ? sku.replace('SKU-', '') : sku;
    return this.getItemById(cleanId);
  }

  getCategories(): Observable<LaravelCategory[]> {
    const user = this.authService.getCurrentUser();
    const categoryEndpoints = user?.role === 'admin'
      ? ['categories', 'admin/categories', 'operator/categories']
      : ['categories', 'operator/categories', 'admin/categories'];

    return this.tryCategoryEndpoints(categoryEndpoints).pipe(
      catchError(() => this.getCategoriesFromItems())
    );
  }

  getItemByBarcode(barcode: string): Observable<InventoryItem | undefined> {
    const cleanBarcode = barcode.trim();
    const encodedBarcode = encodeURIComponent(cleanBarcode);
    const user = this.authService.getCurrentUser();
    const rolePrefix = user?.role === 'admin' ? 'admin' : 'operator';
    const attempts = [
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/items/barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/items/scan/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/scan-barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/${rolePrefix}/items?barcode=${encodedBarcode}&page=1` },
      { method: 'GET', url: `${this.apiUrl}/items/barcode/${encodedBarcode}` },
      { method: 'GET', url: `${this.apiUrl}/items?barcode=${encodedBarcode}&page=1` },
      { method: 'POST', url: `${this.apiUrl}/${rolePrefix}/items/scan`, body: { barcode: cleanBarcode } },
      { method: 'POST', url: `${this.apiUrl}/${rolePrefix}/scan-barcode`, body: { barcode: cleanBarcode } },
    ];

    return this.tryBarcodeEndpoint(attempts, cleanBarcode);
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
        current_stock: item.quantity || 0,
        status: true,
        low_stock_alert: item.minThreshold,
        medium_stock_alert: item.mediumThreshold,
      };

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
          // Buat kategori baru di backend
          return this.http.post<LaravelCategory>(`${this.apiUrl}/admin/categories`, {
            name: categoryName,
            description: 'Kategori baru dari frontend',
            status: true,
          }).pipe(
            map(newCategory => newCategory.id),
            catchError(() => of(1)) // fallback ke id 1
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
    const rawQuantity = rawItem.current_stock ?? rawItem.quantity ?? rawItem.stock ?? item.current_stock ?? item.quantity ?? item.stock ?? item.initial_stock ?? 0;
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
    const locationName = backendLocationName || (hasBackendLocation ? displayMeta.location : '') || 'Main Warehouse';
    const parentLocation = backendLocationName
      ? ''
      : (hasBackendLocation ? (displayMeta.parentLocation || '') : '');
    const fullLocation = parentLocation && !locationName.includes('/')
      ? `${parentLocation}/${locationName}`
      : locationName;
    const locations = this.normalizeDisplayLocations(
      backendLocationName
        ? [{ name: backendLocationName, backendValue: backendLocationId, quantity: backendLocationQuantity }]
        : (hasBackendLocation ? displayMeta.locations : undefined),
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
