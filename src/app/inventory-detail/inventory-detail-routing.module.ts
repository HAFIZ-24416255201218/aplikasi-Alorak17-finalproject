import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InventoryDetailPage } from './inventory-detail.page';

const routes: Routes = [
  {
    path: '',
    component: InventoryDetailPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryDetailPageRoutingModule {}
