import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { InventoryPageRoutingModule } from './inventory-routing.module';
import { InventoryPage } from './inventory.page';
import { BottomNavModule } from '../shared/bottom-nav/bottom-nav.module';
import { BarcodeScannerPopupModule } from '../shared/barcode-scanner-popup/barcode-scanner-popup.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InventoryPageRoutingModule,
    BottomNavModule,
    BarcodeScannerPopupModule,
  ],
  declarations: [InventoryPage],
})
export class InventoryPageModule {}
