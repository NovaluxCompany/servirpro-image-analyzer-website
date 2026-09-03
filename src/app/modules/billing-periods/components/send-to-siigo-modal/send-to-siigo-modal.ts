import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiigoInvoicePayload, SiigoInvoicePricingBreakdown } from '../../interfaces/siigo-invoice-payload.interface';

const LATE_FEE_DEBOUNCE_MS = 2000;

@Component({
  selector: 'app-send-to-siigo-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './send-to-siigo-modal.html',
})
export class SendToSiigoModalComponent {
  isVisible = input<boolean>(false);
  isLoading = input<boolean>(false);
  payload = input<SiigoInvoicePayload | null>(null);
  pricingBreakdown = input<SiigoInvoicePricingBreakdown | null>(null);
  // true cuando el intento anterior quedó UNCERTAIN (Siigo no confirmó ni
  // rechazó la factura: timeout o caída de su servicio). El envío sigue
  // siendo seguro (reutiliza la misma Idempotency-Key), pero se avisa para
  // que no se interprete como un envío nuevo sin más.
  isUncertain = input<boolean>(false);
  // Mora ya guardada de antemano para este periodo (botón "Guardar Mora"),
  // usada para precargar el input y para detectar si hay que confirmar un
  // reemplazo antes de guardar una nueva.
  currentLateFee = input<number>(0);
  isSavingLateFee = input<boolean>(false);

  confirmed = output<{ lateFee: number; observations: string }>();
  cancelled = output<void>();
  lateFeeChanged = output<number>();
  lateFeeSaved = output<number>();

  lateFee = signal<number>(0);
  lateFeeError = signal<string | null>(null);
  observations = signal<string>('');
  private lateFeeDebounceHandle?: ReturnType<typeof setTimeout>;

  constructor() {
    // Every time the modal opens for a new period, observations start empty.
    effect(() => {
      if (this.isVisible()) {
        this.observations.set('');
      }
    });

    // Kept in sync with currentLateFee whenever it changes (e.g. after
    // "Guardar Mora" persists a new value, or when the modal is reopened
    // and the parent prefills it with the value already saved for the
    // period), independent of the observations reset above.
    effect(() => {
      this.lateFee.set(this.currentLateFee());
      this.lateFeeError.set(null);
    });

    // When the suggested payload arrives, it's used as the initial editable value for observations.
    effect(() => {
      const suggested = this.payload()?.observations;
      if (suggested && !this.observations()) {
        this.observations.set(suggested);
      }
    });
  }

  onLateFeeInput(rawValue: string): void {
    if (rawValue.trim() === '') {
      this.lateFee.set(0);
      this.lateFeeError.set(null);
    } else {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        this.lateFeeError.set('La mora debe ser un número mayor o igual a 0.');
        return;
      }
      this.lateFee.set(parsed);
      this.lateFeeError.set(null);
    }

    clearTimeout(this.lateFeeDebounceHandle);
    this.lateFeeDebounceHandle = setTimeout(() => this.lateFeeChanged.emit(this.lateFee()), LATE_FEE_DEBOUNCE_MS);
  }

  onObservationsInput(rawValue: string): void {
    this.observations.set(rawValue);
  }

  onSaveLateFee(): void {
    if (this.lateFeeError()) {
      return;
    }
    const previous = this.currentLateFee();
    const next = this.lateFee();
    if (previous > 0 && previous !== next) {
      const confirmed = window.confirm(
        `Ya existe una mora de ${previous} asignada a esta factura. ¿Deseas reemplazarla por ${next}?`,
      );
      if (!confirmed) {
        return;
      }
    }
    this.lateFeeSaved.emit(next);
  }

  onConfirm(): void {
    if (this.lateFeeError()) {
      return;
    }
    this.confirmed.emit({ lateFee: this.lateFee(), observations: this.observations() });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
