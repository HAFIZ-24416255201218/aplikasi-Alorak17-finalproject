import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GoodsInPageRoutingModule } from './goods-in-routing.module';
import { GoodsInPage } from './goods-in.page';
import { SearchableSelectModule } from '../shared/searchable-select/searchable-select.module';
import { BarcodeScannerPopupModule } from '../shared/barcode-scanner-popup/barcode-scanner-popup.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoodsInPageRoutingModule,
    SearchableSelectModule,
    BarcodeScannerPopupModule,
  ],
  declarations: [GoodsInPage],
})
export class GoodsInPageModule {}
