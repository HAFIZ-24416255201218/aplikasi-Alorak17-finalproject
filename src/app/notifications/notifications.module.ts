import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { NotificationsPageRoutingModule } from './notifications-routing.module';
import { NotificationsPage } from './notifications.page';
import { InventoryService } from '../inventory/inventory.service';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    NotificationsPageRoutingModule,
  ],
  declarations: [NotificationsPage],
  providers: [InventoryService],
})
export class NotificationsPageModule {}
