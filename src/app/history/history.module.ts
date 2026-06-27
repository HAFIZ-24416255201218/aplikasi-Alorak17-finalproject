import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { HistoryPageRoutingModule } from './history-routing.module';
import { HistoryPage } from './history.page';
import { BottomNavModule } from '../shared/bottom-nav/bottom-nav.module';
import { BarcodeScannerPopupModule } from '../shared/barcode-scanner-popup/barcode-scanner-popup.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HistoryPageRoutingModule,
    BottomNavModule,
    BarcodeScannerPopupModule,
  ],
  declarations: [HistoryPage],
})
export class HistoryPageModule {}
