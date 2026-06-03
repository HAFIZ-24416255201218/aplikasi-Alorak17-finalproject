import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { StockMutationPageRoutingModule } from './stock-mutation-routing.module';
import { StockMutationPage } from './stock-mutation.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StockMutationPageRoutingModule,
  ],
  declarations: [StockMutationPage],
})
export class StockMutationPageModule {}
