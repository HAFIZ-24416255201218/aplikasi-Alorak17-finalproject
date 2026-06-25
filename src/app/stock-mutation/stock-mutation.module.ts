import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { StockMutationPageRoutingModule } from './stock-mutation-routing.module';
import { StockMutationPage } from './stock-mutation.page';
import { SearchableSelectModule } from '../shared/searchable-select/searchable-select.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StockMutationPageRoutingModule,
    SearchableSelectModule,
  ],
  declarations: [StockMutationPage],
})
export class StockMutationPageModule {}
