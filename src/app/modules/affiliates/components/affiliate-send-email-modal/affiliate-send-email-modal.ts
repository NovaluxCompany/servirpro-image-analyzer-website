import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-affiliate-send-email-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-send-email-modal.html',
})
export class AffiliateSendEmailModalComponent {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  sent = output<void>();
  cancelled = output<void>();

  emails = signal<string[]>([]);
  emailInput = '';
  observation = '';
  isLoading = signal(false);
  emailError = signal<string | null>(null);

  constructor() {
    // Este modal es exclusivo del flujo Independiente (varios correos a elección).
    // El caso Dependiente/Gestión usa AffiliateSendEmailObservationModalComponent,
    // que envía solo al correo registrado y no permite elegir destinatarios.
    // Pre-cargar la observación previamente guardada para este afiliado, si existe.
    effect(() => {
      const a = this.affiliate();
      this.observation = (this.isVisible() && a?.emailObservation) || '';
    });
  }

  addEmail(): void {
    const value = this.emailInput.trim().toLowerCase();
    this.emailInput = '';
    this.emailError.set(null);
    if (!value) return;

    if (!EMAIL_REGEX.test(value)) {
      this.emailError.set('Ingresa un correo electrónico válido (ej: nombre@dominio.com), no una palabra suelta.');
      return;
    }
    if (this.emails().includes(value)) {
      this.emailError.set('Ese correo ya fue agregado.');
      return;
    }
    this.emails.set([...this.emails(), value]);
  }

  removeEmail(email: string): void {
    this.emails.set(this.emails().filter((e) => e !== email));
  }

  onConfirm(): void {
    const a = this.affiliate();
    if (!a?.id) return;

    if (this.emails().length === 0) {
      this._toast.showError('Agrega al menos un correo electrónico.');
      return;
    }

    this.isLoading.set(true);
    // Se manda el string tal cual (incluso '') para que dejar el campo en blanco
    // borre una observación guardada previamente, en vez de conservarla.
    this._service.sendEmail(Number(a.id), this.emails(), this.observation).subscribe({
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
    this.emails.set([]);
    this.emailInput = '';
    this.observation = '';
    this.emailError.set(null);
  }
}
