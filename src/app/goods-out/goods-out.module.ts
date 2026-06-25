import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GoodsOutPageRoutingModule } from './goods-out-routing.module';
import { GoodsOutPage } from './goods-out.page';
import { SearchableSelectModule } from '../shared/searchable-select/searchable-select.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoodsOutPageRoutingModule,
    SearchableSelectModule,
  ],
  declarations: [GoodsOutPage],
})
export class GoodsOutPageModule {}
