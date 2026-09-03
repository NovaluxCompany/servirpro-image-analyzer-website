import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

@Component({
  selector: 'app-affiliate-status-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-status-modal.html',
})
export class AffiliateStatusModalComponent implements OnInit {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  isLoading = signal(false);
  deactivationReason = '';
  // Es el id de deactivation_reasons (FK real) que se manda al backend.
  reasonTypeId: number | null = null;
  showReasonTypeError = false;

  // Viene de deactivation_reasons (ver AffiliateMembersService.getDeactivationReasons):
  // agregar un motivo nuevo es un INSERT en esa tabla, no un deploy de este archivo.
  reasonTypeOptions: { value: number; label: string }[] = [];

  ngOnInit(): void {
    this._service.getDeactivationReasons().subscribe((reasons) => {
      this.reasonTypeOptions = reasons.map((r) => ({ value: r.id, label: r.label }));
    });
  }

  get isActivating(): boolean {
    return !(this.affiliate()?.isActive ?? true);
  }

  get actionLabel(): string {
    return this.isActivating ? 'habilitar' : 'deshabilitar';
  }

  get title(): string {
    return this.isActivating ? 'Activar Afiliado' : 'Desactivar Afiliado';
  }

  get confirmMessage(): string {
    const a = this.affiliate();
    if (!a) return '';
    const action = this.isActivating ? 'habilitar' : 'deshabilitar';
    return `¿Está seguro de ${action} el usuario <strong>${a.fullName}</strong> identificado con número de documento <strong>${a.documentNumber}</strong>?`;
  }

  get successMessage(): string {
    const a = this.affiliate();
    if (!a) return '';
    const firstName = a.fullName?.split(' ')[0] ?? a.fullName;
    return this.isActivating
      ? `El usuario ${firstName} ha sido activado exitosamente`
      : `El usuario ${firstName} ha sido desactivado exitosamente`;
  }

  onConfirm(): void {
    const a = this.affiliate();
    if (!a?.id) return;

    if (!this.isActivating && !this.reasonTypeId) {
      this.showReasonTypeError = true;
      this._toast.showError('Selecciona el motivo de la deshabilitación antes de continuar.');
      return;
    }

    this.isLoading.set(true);
    this._service
      .toggleStatus(
        a.id,
        this.isActivating ? undefined : this.deactivationReason,
        this.isActivating ? undefined : (this.reasonTypeId ?? undefined),
      )
      .subscribe({
        next: () => {
          this._toast.showSuccess(this.successMessage);
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
    this.deactivationReason = '';
    this.reasonTypeId = null;
    this.showReasonTypeError = false;
  }
}
