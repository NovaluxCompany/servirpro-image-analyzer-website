import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BulkSendRow {
  periodId: number;
  affiliateName: string;
  lateFee: number;
  valueToSend: number | null;
  status: string;
}

export const BULK_STATUS_WAITING_USER = 'Esperando respuesta del usuario';
export const BULK_STATUS_WAITING_SEND = 'Esperando Enviar a Siigo';

@Component({
  selector: 'app-bulk-send-to-siigo-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bulk-send-to-siigo-modal.html',
})
export class BulkSendToSiigoModalComponent {
  isVisible = input<boolean>(false);
  isLoadingRows = input<boolean>(false);
  isSending = input<boolean>(false);
  rows = input<BulkSendRow[]>([]);

  confirmed = output<number[]>();
  cancelled = output<void>();

  onConfirm(): void {
    const ids = this.rows().map((r) => r.periodId);
    if (ids.length === 0) return;
    this.confirmed.emit(ids);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
