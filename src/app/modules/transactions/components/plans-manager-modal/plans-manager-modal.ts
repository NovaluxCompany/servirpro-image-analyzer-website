import { Component, inject, input, output, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlansAdminService } from '../../services/plans-admin.service';
import { PlanAdmin } from '../../interfaces/plan-admin.interface';
import { ToastService } from '../../../../core/service/toast.service';

interface EditableRow {
  plan: PlanAdmin;
  salePrice: number;
  firstMonthPrice: number | null;
  savingId: number | null;
}

@Component({
  selector: 'app-plans-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plans-manager-modal.html',
})
export class PlansManagerModalComponent implements OnChanges {
  private _service = inject(PlansAdminService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  closed = output<void>();

  rows = signal<EditableRow[]>([]);
  isLoading = signal(false);
  savingId = signal<number | null>(null);

  newName = '';
  newSalePrice: number | null = null;
  newFirstMonthPrice: number | null = null;
  isCreating = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible()) {
      this.loadPlans();
    }
  }

  loadPlans(): void {
    this.isLoading.set(true);
    this._service.findAll().subscribe({
      next: (plans) => {
        this.rows.set(plans.map((plan) => ({
          plan,
          salePrice: Number(plan.salePrice),
          firstMonthPrice: plan.firstMonthPrice != null ? Number(plan.firstMonthPrice) : null,
          savingId: null,
        })));
        this.isLoading.set(false);
      },
      error: () => {
        this._toast.showError('No se pudieron cargar los planes.');
        this.isLoading.set(false);
      },
    });
  }

  saveRow(row: EditableRow): void {
    if (row.salePrice == null || row.salePrice < 0) {
      this._toast.showError('El precio de venta debe ser un número válido.');
      return;
    }
    if (row.firstMonthPrice != null && row.firstMonthPrice < 0) {
      this._toast.showError('El precio primer mes debe ser un número válido.');
      return;
    }

    this.savingId.set(row.plan.id);
    this._service.update(row.plan.id, {
      salePrice: row.salePrice,
      firstMonthPrice: row.firstMonthPrice,
    }).subscribe({
      next: (updated) => {
        row.plan = updated;
        this._toast.showSuccess(`Plan "${updated.name}" actualizado.`);
        this.savingId.set(null);
      },
      error: (err) => {
        this._toast.showError(err.message ?? 'No se pudo actualizar el plan.');
        this.savingId.set(null);
      },
    });
  }

  createPlan(): void {
    const name = this.newName.trim();
    if (!name) {
      this._toast.showError('El nombre del plan es requerido.');
      return;
    }
    if (this.newSalePrice == null || this.newSalePrice < 0) {
      this._toast.showError('El precio de venta debe ser un número válido.');
      return;
    }

    this.isCreating.set(true);
    this._service.create({
      name,
      salePrice: this.newSalePrice,
      firstMonthPrice: this.newFirstMonthPrice,
    }).subscribe({
      next: () => {
        this._toast.showSuccess('Plan creado correctamente.');
        this.newName = '';
        this.newSalePrice = null;
        this.newFirstMonthPrice = null;
        this.isCreating.set(false);
        this.loadPlans();
      },
      error: (err) => {
        this._toast.showError(err.message ?? 'No se pudo crear el plan.');
        this.isCreating.set(false);
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
