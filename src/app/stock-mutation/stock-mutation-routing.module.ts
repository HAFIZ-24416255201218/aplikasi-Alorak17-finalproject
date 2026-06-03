import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { StockMutationPage } from './stock-mutation.page';

const routes: Routes = [
  {
    path: '',
    component: StockMutationPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StockMutationPageRoutingModule {}
