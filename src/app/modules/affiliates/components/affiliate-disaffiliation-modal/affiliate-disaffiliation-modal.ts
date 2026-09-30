import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';
import { Company } from '../../interfaces/catalog.interface';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';

@Component({
  selector: 'app-affiliate-disaffiliation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './affiliate-disaffiliation-modal.html',
})
export class AffiliateDisaffiliationModalComponent implements OnInit {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  isLoading = signal(false);
  observation = '';
  reasonId: number | null = null;
  showReasonError = false;
  companyId: string | null = null;
  companies: Company[] = [];

  // Viene de disaffiliation_reasons (Retiro x 1 días / Retiro x 30 días):
  // agregar un motivo nuevo es un INSERT en esa tabla, no un deploy de este archivo.
  reasonOptions: { value: number; label: string }[] = [];

  ngOnInit(): void {
    this._service.getDisaffiliationReasons().subscribe((reasons) => {
      this.reasonOptions = reasons.map((r) => ({ value: r.id, label: r.label }));
    });
    this._service.getCompanies().subscribe((companies) => (this.companies = companies));
  }

  get companyOptions(): SelectOption[] {
    return this.companies.map((c) => ({ value: String(c.id), label: c.name }));
  }

  get confirmMessage(): string {
    const a = this.affiliate();
    if (!a) return '';
    return `¿Está seguro de desafiliar al usuario <strong>${a.fullName}</strong> identificado con número de documento <strong>${a.documentNumber}</strong>?`;
  }

  onConfirm(): void {
    const a = this.affiliate();
    if (!a?.id) return;

    if (!this.reasonId) {
      this.showReasonError = true;
      this._toast.showError('Selecciona el motivo de la desafiliación antes de continuar.');
      return;
    }

    this.isLoading.set(true);
    this._service
      .createDisaffiliationRequest(
        Number(a.id),
        this.companyId ? Number(this.companyId) : undefined,
        this.reasonId,
        this.observation,
      )
      .subscribe({
        next: () => {
          this._toast.showSuccess('Desafiliación registrada correctamente y enviada a validar.');
          this.isLoading.set(false);
          this.resetForm();
          this.confirmed.emit();
        },
        error: (err) => {
          this._toast.showError(err.message);
          this.isLoading.set(false);
        },
      });
  }

  onCancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private resetForm(): void {
    this.observation = '';
    this.reasonId = null;
    this.companyId = null;
    this.showReasonError = false;
  }
}
