import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { InventoryDetailPageRoutingModule } from './inventory-detail-routing.module';
import { InventoryDetailPage } from './inventory-detail.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    InventoryDetailPageRoutingModule,
  ],
  declarations: [InventoryDetailPage],
})
export class InventoryDetailPageModule {}
