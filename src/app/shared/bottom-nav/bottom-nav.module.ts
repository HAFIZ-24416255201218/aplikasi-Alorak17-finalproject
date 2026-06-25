import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { BottomNavComponent } from './bottom-nav.component';

@NgModule({
  declarations: [BottomNavComponent],
  imports: [CommonModule, IonicModule],
  exports: [BottomNavComponent],
})
export class BottomNavModule {}
