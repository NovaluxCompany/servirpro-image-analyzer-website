import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

@Component({
  selector: 'app-affiliate-send-email-observation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-send-email-observation-modal.html',
})
export class AffiliateSendEmailObservationModalComponent {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  sent = output<void>();
  cancelled = output<void>();

  observation = '';
  isLoading = signal(false);

  constructor() {
    // Pre-cargar la observación previamente guardada para este afiliado, si existe.
    effect(() => {
      const a = this.affiliate();
      this.observation = (this.isVisible() && a?.emailObservation) || '';
    });
  }

  onConfirm(): void {
    const a = this.affiliate();
    if (!a?.id) return;

    this.isLoading.set(true);
    // Sin lista de correos: el backend usa el correo registrado del afiliado.
    // El envío a varios correos es exclusivo del flujo Independiente.
    // Se manda el string tal cual (incluso '') para que dejar el campo en blanco
    // borre una observación guardada previamente, en vez de conservarla.
    this._service.sendEmail(Number(a.id), undefined, this.observation).subscribe({
      next: () => {
        this._toast.showSuccess('Correo enviado correctamente');
        this.isLoading.set(false);
        this.reset();
        this.sent.emit();
      },
      error: (err) => {
        this._toast.showError(err.message ?? 'No se pudo enviar el correo');
        this.isLoading.set(false);
      },
    });
  }

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.observation = '';
  }
}
