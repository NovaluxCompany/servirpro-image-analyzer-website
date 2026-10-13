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

  /**
   * Salario que se adjunta en el correo. Se precarga con el que viajaría hoy
   * (el del afiliado o, si no tiene, el mínimo configurado en el backend) y se
   * puede cambiar antes de enviar. Solo existe en este modal: cambiarlo aplica
   * únicamente a los afiliados Independiente.
   */
  salary = signal<number | null>(null);
  salaryError = signal<string | null>(null);
  isLoadingSalary = signal(false);
  private loadedSalaryForId: number | null = null;

  constructor() {
    // Este modal es exclusivo del flujo Independiente (varios correos a elección).
    // El caso Dependiente/Gestión usa AffiliateSendEmailObservationModalComponent,
    // que envía solo al correo registrado y no permite elegir destinatarios.
    // Pre-cargar la observación previamente guardada para este afiliado, si existe.
    effect(() => {
      const a = this.affiliate();
      this.observation = (this.isVisible() && a?.emailObservation) || '';
    });

    // El salario se pide al abrir, no al construir el modal: el componente vive
    // en el listado y se reusa para cada afiliado.
    effect(() => {
      const a = this.affiliate();
      if (!this.isVisible() || !a?.id) return;
      this.loadSalary(Number(a.id));
    });
  }

  private loadSalary(affiliationId: number): void {
    if (this.loadedSalaryForId === affiliationId) return;
    this.loadedSalaryForId = affiliationId;

    this.isLoadingSalary.set(true);
    this._service.getEmailSalary(affiliationId).subscribe({
      next: (res) => {
        this.salary.set(res.salary);
        this.isLoadingSalary.set(false);
      },
      // Si no se pudo consultar, el campo queda vacío y el correo viaja con el
      // salario de siempre: el backend usa ese valor cuando no le mandan uno.
      error: () => {
        this.salary.set(null);
        this.loadedSalaryForId = null;
        this.isLoadingSalary.set(false);
      },
    });
  }

  onSalaryChange(value: string): void {
    this.salaryError.set(null);
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      this.salary.set(null);
      return;
    }
    this.salary.set(Number(trimmed));
  }

  /** Formato solo para mostrar debajo del campo; lo que se envía es el número. */
  formatSalary(value: number | null): string {
    if (value == null) return '';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
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

    const salary = this.salary();
    if (salary !== null && (!Number.isInteger(salary) || salary <= 0)) {
      this.salaryError.set('El salario debe ser un número entero de pesos, mayor a cero.');
      return;
    }

    this.isLoading.set(true);
    // Se manda el string tal cual (incluso '') para que dejar el campo en blanco
    // borre una observación guardada previamente, en vez de conservarla.
    // El salario, en cambio, se omite si quedó vacío: así el correo viaja con
    // el de siempre en vez de con un cero.
    this._service.sendEmail(Number(a.id), this.emails(), this.observation, salary ?? undefined).subscribe({
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
    this.salary.set(null);
    this.salaryError.set(null);
    // Se olvida cuál se cargó para que al reabrir vuelva a consultarlo: el
    // afiliado puede ser otro, o el suyo haber cambiado.
    this.loadedSalaryForId = null;
  }
}
