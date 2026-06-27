import { AfterViewInit, Component, ElementRef, EventEmitter, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType, NotFoundException } from '@zxing/library';

const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const BARCODE_FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'qr_code', 'upc_a', 'upc_e', 'codabar'];

@Component({
  selector: 'app-barcode-scanner-popup',
  templateUrl: './barcode-scanner-popup.component.html',
  styleUrls: ['./barcode-scanner-popup.component.scss'],
  standalone: false,
})
export class BarcodeScannerPopupComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scannerVideo') scannerVideo?: ElementRef<HTMLVideoElement>;
  @Output() scanned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  scanMessage = 'Membuka kamera...';

  private barcodeStream?: MediaStream;
  private codeReader = new BrowserMultiFormatReader(BARCODE_HINTS, 100);
  private nativeScanTimer?: number;
  private isActive = true;
  private hasScanned = false;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    this.openScanner();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  close() {
    this.stopCamera();
    this.closed.emit();
  }

  private async openScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.scanMessage = 'Perangkat ini belum mendukung akses kamera.';
      return;
    }

    try {
      const video = await this.waitForScannerVideo();
      this.barcodeStream = await navigator.mediaDevices.getUserMedia(this.getScannerConstraints());
      await this.optimizeCameraTrack(this.barcodeStream);

      video.srcObject = this.barcodeStream;
      await video.play();

      this.scanMessage = 'Dekatkan barcode ke bingkai sampai garisnya terlihat tajam.';
      await this.startDetectingBarcode(video, this.barcodeStream);
    } catch (error) {
      console.error('Kesalahan membuka scanner barcode:', error);
      this.scanMessage = 'Kamera tidak bisa dibuka. Periksa izin kamera lalu coba lagi.';
      this.stopCamera();
    }
  }

  private stopCamera() {
    this.isActive = false;

    if (this.nativeScanTimer) {
      window.clearInterval(this.nativeScanTimer);
      this.nativeScanTimer = undefined;
    }

    this.codeReader.reset();
    this.barcodeStream?.getTracks().forEach(track => track.stop());
    this.barcodeStream = undefined;
  }

  private async startDetectingBarcode(video: HTMLVideoElement, stream: MediaStream) {
    if (this.startNativeBarcodeDetector(video, stream)) {
      return;
    }

    this.scanMessage = 'Arahkan kamera ke barcode. Tahan sebentar saat barcode masuk bingkai.';
    await this.startZxingScanner(stream, video);
  }

  private async startZxingScanner(stream: MediaStream, video: HTMLVideoElement) {
    await this.codeReader.decodeFromStream(stream, video, (result, error) => {
      if (!this.isActive) {
        return;
      }

      const value = result?.getText();
      if (value) {
        this.ngZone.run(() => this.completeScan(value));
        return;
      }

      if (error && !(error instanceof NotFoundException)) {
        this.scanMessage = 'Belum terbaca. Jaga barcode tetap rata, terang, dan masuk penuh di bingkai.';
      }
    }).catch(error => {
      console.error('Kesalahan menjalankan scanner barcode:', error);
      this.ngZone.run(() => {
        this.scanMessage = 'Scanner barcode tidak bisa dijalankan di perangkat ini.';
        this.stopCamera();
      });
    });
  }

  private startNativeBarcodeDetector(video: HTMLVideoElement, stream: MediaStream) {
    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      return false;
    }

    const detector = new BarcodeDetectorCtor({
      formats: BARCODE_FORMATS,
    });

    this.nativeScanTimer = window.setInterval(async () => {
      if (!this.isActive || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        const barcode = barcodes[0]?.rawValue?.trim();

        if (barcode) {
          this.ngZone.run(() => this.completeScan(barcode));
        }
      } catch {
        window.clearInterval(this.nativeScanTimer);
        this.nativeScanTimer = undefined;
        this.ngZone.run(() => {
          this.scanMessage = 'Mencoba mode scanner cadangan...';
          this.startZxingScanner(stream, video);
        });
      }
    }, 120);

    return true;
  }

  private completeScan(rawBarcode: string) {
    const barcode = rawBarcode.trim();

    if (!barcode || this.hasScanned) {
      return;
    }

    this.hasScanned = true;
    this.stopCamera();
    this.scanned.emit(barcode);
  }

  private async waitForScannerVideo(): Promise<HTMLVideoElement> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const video = this.scannerVideo?.nativeElement;

      if (video) {
        return video;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('Elemen video scanner belum siap.');
  }

  private getScannerConstraints(): MediaStreamConstraints {
    return {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, min: 15 },
      },
      audio: false,
    };
  }

  private async optimizeCameraTrack(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];

    if (!track?.getCapabilities || !track.applyConstraints) {
      return;
    }

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[];
      zoom?: { min?: number; max?: number; step?: number };
    };
    const advanced: Array<Record<string, unknown>> = [];

    if (capabilities.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }

    if (capabilities.zoom?.max && capabilities.zoom.max > 1) {
      const zoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min || 1, 1.5));
      advanced.push({ zoom });
    }

    if (!advanced.length) {
      return;
    }

    try {
      await track.applyConstraints({ advanced } as MediaTrackConstraints);
    } catch (error) {
      console.warn('Optimasi kamera barcode tidak didukung perangkat ini:', error);
    }
  }
}
