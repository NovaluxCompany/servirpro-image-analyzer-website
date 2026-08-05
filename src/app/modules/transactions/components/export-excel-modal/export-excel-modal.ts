import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const MAX_RANGE_DAYS = 31;

@Component({
  selector: 'app-export-excel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-excel-modal.html',
})
export class ExportExcelModalComponent {
  isVisible = input<boolean>(false);
  isDownloading = input<boolean>(false);

  confirmed = output<{ dateFrom: string; dateTo: string }>();
  cancelled = output<void>();

  dateFrom = '';
  dateTo = '';
  errorMessage = signal<string | null>(null);

  onConfirm(): void {
    if (!this.dateFrom || !this.dateTo) {
      this.errorMessage.set('Debes seleccionar la fecha inicial y final.');
      return;
    }

    const from = new Date(this.dateFrom);
    const to = new Date(this.dateTo);

    if (from > to) {
      this.errorMessage.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }

    const rangeDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      this.errorMessage.set(`El rango de fechas no puede ser mayor a ${MAX_RANGE_DAYS} días (1 mes).`);
      return;
    }

    this.errorMessage.set(null);
    this.confirmed.emit({ dateFrom: this.dateFrom, dateTo: this.dateTo });
  }

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  reset(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.errorMessage.set(null);
  }
}
