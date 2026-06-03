import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { GoodsOutPage } from './goods-out.page';

const routes: Routes = [
  {
    path: '',
    component: GoodsOutPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GoodsOutPageRoutingModule {}
