import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { HelpSupportPageRoutingModule } from './help-support-routing.module';
import { HelpSupportPage } from './help-support.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    HelpSupportPageRoutingModule,
  ],
  declarations: [HelpSupportPage],
})
export class HelpSupportPageModule {}
