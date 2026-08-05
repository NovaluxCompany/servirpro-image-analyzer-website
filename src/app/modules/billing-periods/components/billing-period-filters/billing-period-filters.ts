import { Component, inject, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BillingPeriodFilters } from '../../interfaces/billing-period-filters.interface';
import { AffiliateMembersService } from '../../../affiliates/services/affiliate-members.service';
import { Plan } from '../../../affiliates/interfaces/catalog.interface';

@Component({
  selector: 'app-billing-period-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './billing-period-filters.html'
})
export class BillingPeriodFiltersComponent implements OnInit {
  filterApplied = output<BillingPeriodFilters>();
  cleared = output<void>();

  private _fb = new FormBuilder();
  private _affiliateMembersService = inject(AffiliateMembersService);

  plans = signal<Plan[]>([]);

  form = this._fb.group({
    dateFrom: ['', Validators.required],
    dateTo: ['', Validators.required],
    status: [''],
    affiliateName: [''],
    documentNumber: [''],
    planId: [''],
  });

  ngOnInit(): void {
    this._affiliateMembersService.getPlans().subscribe((plans) => this.plans.set(plans));
  }

  onSearch(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.value;

    // values.dateFrom/dateTo are "YYYY-MM-DD" (input type="date"). They used
    // to be built with `new Date("YYYY-MM-DD")` (which is ALWAYS interpreted
    // as UTC midnight, regardless of the browser's timezone) and then
    // `.setHours(23,59,59,999)` (which does use LOCAL time) — the
    // combination shifted the range a full day back in Colombia (UTC-5): a
    // record created "today" was left out until searching with "tomorrow".
    // The ISO string is now built directly with Colombia's fixed offset
    // (-05:00, no daylight saving) so it doesn't depend on the browser's timezone.
    const filters: BillingPeriodFilters = {
      dateFrom: `${values.dateFrom}T00:00:00.000-05:00`,
      dateTo: `${values.dateTo}T23:59:59.999-05:00`,
    };
    if (values.status) filters.status = values.status;
    if (values.affiliateName) filters.affiliateName = values.affiliateName;
    if (values.documentNumber) filters.documentNumber = values.documentNumber;
    if (values.planId) filters.planId = Number(values.planId);

    this.filterApplied.emit(filters);
  }

  onClear(): void {
    this.form.reset();
    this.cleared.emit();
  }
}
