import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingPeriodsService } from '../../services/billing-periods.service';
import { BillingPeriod } from '../../interfaces/billing-period.interface';

@Component({
  selector: 'app-billing-periods-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing-periods-list.html',
})
export class BillingPeriodsListComponent implements OnInit {
  private _service = inject(BillingPeriodsService);

  billingPeriods = signal<BillingPeriod[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  private readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  ngOnInit(): void {
    this.loadBillingPeriods();
  }

  loadBillingPeriods(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getBillingPeriods().subscribe({
      next: (periods) => {
        this.billingPeriods.set(periods);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.message ?? 'No fue posible cargar los periodos de facturación');
        this.isLoading.set(false);
      },
    });
  }

  monthLabel(month: number): string {
    return this.monthNames[month - 1] ?? String(month);
  }

  clientLabel(period: BillingPeriod): string {
    const client = period.affiliation?.client;
    return client ? `${client.fullName} (${client.documentNumber})` : `Afiliación #${period.affiliationId}`;
  }
}
