import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { GoodsInPage } from './goods-in.page';

const routes: Routes = [
  {
    path: '',
    component: GoodsInPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GoodsInPageRoutingModule {}
