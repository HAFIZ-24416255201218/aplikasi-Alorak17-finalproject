import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GoodsInPageRoutingModule } from './goods-in-routing.module';
import { GoodsInPage } from './goods-in.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoodsInPageRoutingModule,
  ],
  declarations: [GoodsInPage],
})
export class GoodsInPageModule {}
