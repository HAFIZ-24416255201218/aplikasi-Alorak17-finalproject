import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { InventoryEditPageRoutingModule } from './inventory-edit-routing.module';
import { InventoryEditPage } from './inventory-edit.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InventoryEditPageRoutingModule,
  ],
  declarations: [InventoryEditPage],
})
export class InventoryEditPageModule {}
