import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GoodsInPageRoutingModule } from './goods-in-routing.module';
import { GoodsInPage } from './goods-in.page';
import { SearchableSelectModule } from '../shared/searchable-select/searchable-select.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoodsInPageRoutingModule,
    SearchableSelectModule,
  ],
  declarations: [GoodsInPage],
})
export class GoodsInPageModule {}
