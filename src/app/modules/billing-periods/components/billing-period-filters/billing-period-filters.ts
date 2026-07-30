import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BillingPeriodFilters } from '../../interfaces/billing-period-filters.interface';

@Component({
  selector: 'app-billing-period-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './billing-period-filters.html'
})
export class BillingPeriodFiltersComponent {
  filterApplied = output<BillingPeriodFilters>();

  private _fb = new FormBuilder();

  form = this._fb.group({
    dateFrom: ['', Validators.required],
    dateTo: ['', Validators.required],
    status: [''],
  });

  onSearch(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.value;
    const dateTo = new Date(values.dateTo!);
    dateTo.setHours(23, 59, 59, 999);

    const filters: BillingPeriodFilters = {
      dateFrom: new Date(values.dateFrom!).toISOString(),
      dateTo: dateTo.toISOString(),
    };
    if (values.status) filters.status = values.status;

    this.filterApplied.emit(filters);
  }
}
