import { Component, inject, input, output, signal } from '@angular/core';
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
export class AffiliateStatusModalComponent {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  isLoading = signal(false);
  deactivationReason = '';

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
    this.isLoading.set(true);
    this._service.toggleStatus(a.id, this.isActivating ? undefined : this.deactivationReason).subscribe({
      next: () => {
        this._toast.showSuccess(this.successMessage);
        this.isLoading.set(false);
        this.deactivationReason = '';
        this.confirmed.emit();
      },
      error: (err) => {
        this._toast.showError(err.message);
        this.isLoading.set(false);
      },
    });
  }

  onCancel(): void {
    this.deactivationReason = '';
    this.cancelled.emit();
  }
}
