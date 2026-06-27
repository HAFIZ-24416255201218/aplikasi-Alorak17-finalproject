import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { StockMutationPageRoutingModule } from './stock-mutation-routing.module';
import { StockMutationPage } from './stock-mutation.page';
import { SearchableSelectModule } from '../shared/searchable-select/searchable-select.module';
import { BarcodeScannerPopupModule } from '../shared/barcode-scanner-popup/barcode-scanner-popup.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StockMutationPageRoutingModule,
    SearchableSelectModule,
    BarcodeScannerPopupModule,
  ],
  declarations: [StockMutationPage],
})
export class StockMutationPageModule {}
