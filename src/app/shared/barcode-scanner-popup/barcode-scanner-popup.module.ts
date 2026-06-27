import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { BarcodeScannerPopupComponent } from './barcode-scanner-popup.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
  ],
  declarations: [BarcodeScannerPopupComponent],
  exports: [BarcodeScannerPopupComponent],
})
export class BarcodeScannerPopupModule {}
