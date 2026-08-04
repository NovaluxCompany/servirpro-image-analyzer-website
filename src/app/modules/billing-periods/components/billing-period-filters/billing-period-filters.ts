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
  cleared = output<void>();

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

    // values.dateFrom/dateTo son "YYYY-MM-DD" (input type="date"). Antes se
    // armaban con `new Date("YYYY-MM-DD")` (que SIEMPRE se interpreta como
    // medianoche UTC, sin importar la zona horaria del navegador) y luego
    // `.setHours(23,59,59,999)` (que sí usa hora LOCAL) — la combinación
    // corría el rango un día completo hacia atrás en Colombia (UTC-5): un
    // registro creado "hoy" quedaba fuera hasta buscar con "mañana". Se
    // arma el ISO directo con el offset fijo de Colombia (-05:00, sin
    // horario de verano) para no depender de la zona horaria del navegador.
    const filters: BillingPeriodFilters = {
      dateFrom: `${values.dateFrom}T00:00:00.000-05:00`,
      dateTo: `${values.dateTo}T23:59:59.999-05:00`,
    };
    if (values.status) filters.status = values.status;

    this.filterApplied.emit(filters);
  }

  onClear(): void {
    this.form.reset();
    this.cleared.emit();
  }
}
