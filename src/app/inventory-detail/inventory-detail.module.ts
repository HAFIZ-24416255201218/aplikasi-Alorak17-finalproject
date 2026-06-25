import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { InventoryDetailPageRoutingModule } from './inventory-detail-routing.module';
import { InventoryDetailPage } from './inventory-detail.page';
import { BottomNavModule } from '../shared/bottom-nav/bottom-nav.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    InventoryDetailPageRoutingModule,
    BottomNavModule,
  ],
  declarations: [InventoryDetailPage],
})
export class InventoryDetailPageModule {}
