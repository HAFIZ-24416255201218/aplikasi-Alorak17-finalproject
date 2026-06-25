import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';
import { ProfilePage } from './profile.page';
import { BottomNavModule } from '../shared/bottom-nav/bottom-nav.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ProfilePageRoutingModule,
    BottomNavModule,
  ],
  declarations: [ProfilePage],
})
export class ProfilePageModule {}
