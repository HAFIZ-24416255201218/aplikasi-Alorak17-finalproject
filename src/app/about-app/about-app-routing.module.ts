import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AboutAppPage } from './about-app.page';

const routes: Routes = [
  {
    path: '',
    component: AboutAppPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AboutAppPageRoutingModule {}
