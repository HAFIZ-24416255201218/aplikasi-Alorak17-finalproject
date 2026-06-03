import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { InventoryItem, InventoryLocation, InventoryService } from '../inventory/inventory.service';
import { TransactionService } from '../transactions/transaction.service';

@Component({
  selector: 'app-goods-in',
  templateUrl: './goods-in.page.html',
  styleUrls: ['./goods-in.page.scss'],
  standalone: false,
})
export class GoodsInPage {
  @ViewChild('scannerVideo') scannerVideo?: ElementRef<HTMLVideoElement>;

  form = {
    selectedItem: '',
    itemName: '',
    itemCode: '',
    category: '',
    unit: 'pcs',
    minThreshold: '50',
    mediumThreshold: '150',
    expirationDate: '',
    destLocation: '',
    quantity: '',
    notes: '',
  };

  readonly defaultDestLocations = [
    'Rak A1-01',
    'Rak A1-02',
    'Rak A1-03',
    'Rak B1-01',
    'Rak B1-02',
    'Rak B1-03',
    'Rak C1-01',
    'Rak C1-02',
    'Rak C1-03',
    'Gate Inbound',
    'Area Receiving',
  ];

  selectedFileName = '';
  previewImage = '';
  isScannerOpen = false;
  scanMessage = 'Arahkan kamera ke barcode produk.';
  inventoryItems: InventoryItem[] = [];
  private barcodeStream?: MediaStream;
  private scanFrameId?: number;
  private codeReader = new BrowserMultiFormatReader();

  constructor(
    private router: Router,
    private inventoryService: InventoryService,
    private transactionService: TransactionService,
  ) {}

  ionViewWillEnter() {
    this.inventoryItems = this.inventoryService.getItems();
    this.resetForm();
  }

  close() {
    this.router.navigate(['/home']);
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.selectedFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  onSelectItem(sku: string) {
    const selectedItem = this.inventoryService.getItemById(sku);
    if (!selectedItem) {
      return;
    }

    this.form.itemName = selectedItem.name;
    this.form.itemCode = selectedItem.sku;
    this.form.unit = selectedItem.unit;
    this.form.category = selectedItem.category || '';
    this.form.minThreshold = String(selectedItem.minThreshold || 50);
    this.form.mediumThreshold = String(selectedItem.mediumThreshold || 150);
    this.form.expirationDate = selectedItem.expirationDate || '';
    this.form.destLocation = selectedItem.location;
    this.form.notes = selectedItem.notes || '';
    this.previewImage = selectedItem.imageData || '';
    this.selectedFileName = selectedItem.imageData ? 'Foto produk tersimpan' : '';
  }

  get destLocationOptions() {
    const savedLocations = this.inventoryItems.reduce<string[]>((locations, item) => {
      if (item.locations?.length) {
        return [...locations, ...item.locations.map(location => location.name)];
      }

      return [...locations, item.location];
    }, []);

    return Array.from(new Set([...this.defaultDestLocations, ...savedLocations].filter(Boolean)));
  }

  async openDatePicker(input: HTMLInputElement) {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  generateItemCode() {
    this.form.itemCode = this.createRandomItemCode();
  }

  async openBarcodeScanner() {
    const allowed = window.confirm('izinkan kamera atau tidak');

    if (!allowed) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Perangkat ini belum mendukung akses kamera.');
      return;
    }

    this.isScannerOpen = true;
    this.scanMessage = 'Membuka kamera...';

    try {
      this.barcodeStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });

      const video = this.scannerVideo?.nativeElement;
      if (!video) {
        throw new Error('Elemen video tidak ditemukan.');
      }

      video.srcObject = this.barcodeStream;
      await video.play();
      this.scanMessage = 'Arahkan kamera ke barcode produk.';
      this.startDetectingBarcode();
    } catch {
      this.scanMessage = 'Kamera tidak bisa dibuka.';
      this.stopScanner();
      window.alert('Izin kamera ditolak atau kamera tidak tersedia.');
    }
  }

  stopScanner() {
    if (this.scanFrameId) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = undefined;
    }

    this.barcodeStream?.getTracks().forEach(track => track.stop());
    this.barcodeStream = undefined;
    this.isScannerOpen = false;
    this.codeReader.reset();
  }

  private startDetectingBarcode() {
    const video = this.scannerVideo?.nativeElement;

    if (!video || !this.barcodeStream) {
      this.scanMessage = 'Kamera tidak ditemukan.';
      return;
    }

    this.codeReader.decodeFromStream(this.barcodeStream, video, (result, error) => {
      if (!this.isScannerOpen) {
        return;
      }

      const value = result?.getText();
      if (value) {
        this.form.itemCode = value;
        this.stopScanner();
        return;
      }

      if (error && !(error instanceof NotFoundException)) {
        this.scanMessage = 'Scan barcode belum berhasil. Coba arahkan ulang kamera.';
      }
    }).catch(() => {
      this.scanMessage = 'Kamera tidak bisa memulai scanner.';
      this.stopScanner();
      window.alert('Scanner barcode tidak bisa dijalankan.');
    });
  }

  onBarcodeFotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = typeof reader.result === 'string' ? reader.result : '';
      if (!imageData) {
        window.alert('Gagal membaca file foto.');
        return;
      }

      await this.detectBarcodeFromImage(imageData);
      // Reset input value so the same file can be selected again
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  private async detectBarcodeFromImage(imageData: string) {
    const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      window.alert('Browser belum mendukung deteksi barcode otomatis.');
      return;
    }

    try {
      const img = new Image();
      img.onload = async () => {
        try {
          const detector = new BarcodeDetectorCtor({
            formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'],
          });

          const barcodes = await detector.detect(img);
          
          if (barcodes.length > 0) {
            this.form.itemCode = barcodes[0].rawValue || '';
            window.alert(`Barcode terdeteksi: ${this.form.itemCode}`);
          } else {
            window.alert('Tidak ada barcode yang terdeteksi di foto ini.');
          }
        } catch (error) {
          window.alert('Gagal melakukan scan barcode dari foto.');
          console.error('Barcode detection error:', error);
        }
      };
      img.onerror = () => {
        window.alert('Gagal memuat file foto.');
      };
      img.src = imageData;
    } catch (error) {
      window.alert('Terjadi kesalahan saat memproses foto.');
      console.error('Image processing error:', error);
    }
  }

  submit() {
    const quantity = Number(this.form.quantity);
    const minThreshold = Number(this.form.minThreshold);
    const mediumThreshold = Number(this.form.mediumThreshold);

    if (!this.form.itemName || !this.form.itemCode || !this.form.unit || !this.form.destLocation || !quantity) {
      window.alert('Lengkapi Item Name, Item Code, Unit, Dest Location, dan Quantity terlebih dahulu.');
      return;
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      window.alert('Quantity harus berupa angka yang valid.');
      return;
    }

    if (Number.isNaN(minThreshold) || Number.isNaN(mediumThreshold) || minThreshold < 0 || mediumThreshold < 0) {
      window.alert('Batas stok harus berupa angka yang valid.');
      return;
    }

    if (mediumThreshold <= minThreshold) {
      window.alert('Batas stok sedang harus lebih besar dari batas minimum stok.');
      return;
    }

    const existingItem = this.form.selectedItem
      ? this.inventoryService.getItemById(this.form.selectedItem)
      : undefined;
    const itemId = existingItem?.id || `inv-${Date.now()}`;
    const nextQuantity = (existingItem?.quantity || 0) + quantity;
    const locationName = this.form.destLocation.trim();
    const displayLocation = locationName;
    const nextLocations = this.addStockToLocation(existingItem?.locations, locationName, quantity);

    this.inventoryService.upsertItem({
      id: itemId,
      name: this.form.itemName,
      sku: this.form.itemCode,
      location: locationName,
      quantity: nextQuantity,
      unit: this.form.unit,
      category: this.form.category.trim() || 'Umum',
      expirationDate: this.form.expirationDate,
      notes: this.form.notes,
      imageData: this.previewImage || existingItem?.imageData,
      minThreshold,
      mediumThreshold,
      locations: nextLocations,
      updatedAt: new Date().toISOString(),
      icon: existingItem?.icon || 'cube-outline',
      badgeClass: nextQuantity < minThreshold ? 'badge-red' : nextQuantity < mediumThreshold ? 'badge-yellow' : 'badge-green',
      quantityClass: nextQuantity < minThreshold ? 'qty-low' : nextQuantity < mediumThreshold ? 'qty-medium' : 'qty-high',
    });

    const createdAt = new Date();
    this.transactionService.addTransaction({
      type: 'in',
      name: this.form.itemName,
      productId: itemId,
      sku: this.form.itemCode,
      time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator: 'John Operator',
      route: displayLocation,
      amount: `+${quantity}`,
      note: this.form.notes,
      createdAt: createdAt.toISOString(),
    });

    this.router.navigate(['/inventory']);
  }

  private resetForm() {
    this.form = {
      selectedItem: '',
      itemName: '',
      itemCode: this.createRandomItemCode(),
      category: '',
      unit: 'pcs',
      minThreshold: '50',
      mediumThreshold: '150',
      expirationDate: '',
      destLocation: '',
      quantity: '',
      notes: '',
    };
    this.selectedFileName = '';
    this.previewImage = '';
  }

  private createRandomItemCode() {
    const datePart = new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

    return `GIN-${datePart}-${randomPart}`;
  }

  private addStockToLocation(locations: InventoryLocation[] = [], locationName: string, quantity: number) {
    const normalizedName = locationName.trim();
    const nextLocations = [...locations];
    const existingLocation = nextLocations.find(location => location.name.toLowerCase() === normalizedName.toLowerCase());

    if (existingLocation) {
      existingLocation.quantity += quantity;
      return nextLocations;
    }

    nextLocations.push({ name: normalizedName, quantity });
    return nextLocations;
  }
}
