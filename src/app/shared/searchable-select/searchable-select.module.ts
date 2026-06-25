import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SearchableSelectComponent } from './searchable-select.component';

@NgModule({
  declarations: [SearchableSelectComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [SearchableSelectComponent],
})
export class SearchableSelectModule {}
