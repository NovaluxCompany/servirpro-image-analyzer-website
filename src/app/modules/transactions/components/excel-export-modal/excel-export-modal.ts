import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

const MAX_RANGE_DAYS = 31;

@Component({
  selector: 'app-excel-export-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './excel-export-modal.html',
})
export class ExcelExportModalComponent {
  isVisible = input<boolean>(false);
  isLoading = input<boolean>(false);

  confirmed = output<{ dateFrom: string; dateTo: string }>();
  cancelled = output<void>();

  errorMessage = signal<string | null>(null);

  private _fb = new FormBuilder();

  form = this._fb.group({
    dateFrom: ['', Validators.required],
    dateTo: ['', Validators.required],
  });

  onCancel(): void {
    this.form.reset();
    this.errorMessage.set(null);
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Debes seleccionar la fecha inicial y la fecha final.');
      return;
    }

    const { dateFrom, dateTo } = this.form.value;
    const from = new Date(dateFrom as string);
    const to = new Date(dateTo as string);

    if (to < from) {
      this.errorMessage.set('La fecha final no puede ser anterior a la fecha inicial.');
      return;
    }

    const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_RANGE_DAYS) {
      this.errorMessage.set('El rango de fechas no puede ser mayor a un mes.');
      return;
    }

    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);

    this.confirmed.emit({
      dateFrom: from.toISOString(),
      dateTo: endOfDay.toISOString(),
    });
  }
}
