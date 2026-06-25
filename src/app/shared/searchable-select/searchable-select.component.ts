import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() options: SearchableSelectOption[] = [];
  @Input() placeholder = 'Pilih data';
  @Input() searchPlaceholder = 'Cari';
  @Input() emptyText = 'Data tidak ditemukan';
  @Input() disabled = false;
  @Output() selectionChange = new EventEmitter<string>();

  value = '';
  searchTerm = '';
  isOpen = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    return this.options.find(option => option.value === this.value)?.label || '';
  }

  get filteredOptions(): SearchableSelectOption[] {
    const keyword = this.searchTerm.trim().toLowerCase();

    if (!keyword) {
      return this.options;
    }

    return this.options.filter(option => option.label.toLowerCase().includes(keyword));
  }

  @HostListener('document:mousedown', ['$event'])
  closeOnOutsideClick(event: MouseEvent) {
    if (!this.isOpen || this.elementRef.nativeElement.contains(event.target as Node)) {
      return;
    }

    this.close();
  }

  writeValue(value: string | number | null | undefined): void {
    this.value = value === null || value === undefined ? '' : String(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle() {
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
    } else {
      this.onTouched();
    }
  }

  choose(option: SearchableSelectOption) {
    if (option.disabled) {
      return;
    }

    this.value = option.value;
    this.onChange(option.value);
    this.selectionChange.emit(option.value);
    this.close();
  }

  close() {
    this.isOpen = false;
    this.onTouched();
  }

  trackByValue(_: number, option: SearchableSelectOption) {
    return option.value;
  }
}
