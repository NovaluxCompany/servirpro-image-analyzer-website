import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TransactionFilters } from '../../interfaces/transaction-filters.interface';

@Component({
  selector: 'app-transaction-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transaction-filters.html'
})
export class TransactionFiltersComponent {
  filterApplied = output<TransactionFilters>();

  private _fb = new FormBuilder();

  form = this._fb.group({
    dateFrom: [''],
    dateTo: [''],
    reference: [''],
    affiliate: [''],
    idNumber: [''],
    uploadedBy: [''],
    status: [''],
  });

  onSearch(): void {
    const filters: TransactionFilters = {};
    const values = this.form.value;

    if (values.dateFrom) filters.dateFrom = new Date(values.dateFrom).toISOString();
    if (values.dateTo) filters.dateTo = new Date(values.dateTo).toISOString();
    if (values.reference) filters.reference = values.reference;
    if (values.affiliate) filters.affiliate = values.affiliate;
    if (values.idNumber) filters.idNumber = values.idNumber;
    if (values.uploadedBy) filters.uploadedBy = values.uploadedBy;
    if (values.status) filters.status = values.status;

    this.filterApplied.emit(filters);
  }

  onClear(): void {
    this.form.reset();
    this.filterApplied.emit({});
  }
}
