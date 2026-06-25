import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { InventoryEditPageRoutingModule } from './inventory-edit-routing.module';
import { InventoryEditPage } from './inventory-edit.page';
import { BottomNavModule } from '../shared/bottom-nav/bottom-nav.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InventoryEditPageRoutingModule,
    BottomNavModule,
  ],
  declarations: [InventoryEditPage],
})
export class InventoryEditPageModule {}
