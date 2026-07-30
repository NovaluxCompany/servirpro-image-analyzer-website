import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiigoInvoicePayload } from '../../interfaces/siigo-invoice-payload.interface';

const MORA_DEBOUNCE_MS = 400;

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

  confirmed = output<void>();
  cancelled = output<void>();
  moraChanged = output<number>();

  mora = signal<number>(0);
  private moraDebounceHandle?: ReturnType<typeof setTimeout>;

  constructor() {
    // Cada vez que la modal se abre para un nuevo periodo, la mora arranca en 0.
    effect(() => {
      if (this.isVisible()) {
        this.mora.set(0);
      }
    });
  }

  get payloadJson(): string {
    return this.payload() ? JSON.stringify(this.payload(), null, 2) : '';
  }

  get observations(): string {
    return this.payload()?.observations ?? '';
  }

  onMoraInput(rawValue: string): void {
    const parsed = Number(rawValue);
    this.mora.set(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);

    clearTimeout(this.moraDebounceHandle);
    this.moraDebounceHandle = setTimeout(() => this.moraChanged.emit(this.mora()), MORA_DEBOUNCE_MS);
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
