import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

interface CertSlot {
  key: 'EPS' | 'ARL' | 'CCF' | 'AFP';
  label: string;
  file: File | null;
  /** true si affiliate.certXxx ya está marcado (se envió previamente por WhatsApp
   *  o se marcó manualmente desde el menú de 3 puntos). */
  alreadySent: boolean;
}

const ALLOWED_FILE_TYPE = 'application/pdf';
const MAX_FILE_SIZE_MB = 10;

@Component({
  selector: 'app-affiliate-send-whatsapp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-send-whatsapp-modal.html',
})
export class AffiliateSendWhatsappModalComponent {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  sent = output<void>();
  cancelled = output<void>();

  sourceNumbers = signal<{ id: number; ownerName: string }[]>([]);
  selectedSourceNumberId: number | '' = '';
  destinationPhone = '';
  isLoading = signal(false);
  fileError = signal<string | null>(null);

  // Un placeholder por cada certificado que aplica al plan del afiliado (EPS/ARL/CCF/AFP),
  // igual a la detección por nombre de plan ya usada en la lista de afiliados.
  certSlots = signal<CertSlot[]>([]);

  constructor() {
    effect(() => {
      const a = this.affiliate();
      if (!this.isVisible() || !a) return;
      this.reset();
      // Precarga el número del afiliado para evitar tener que escribirlo de nuevo;
      // el usuario puede editarlo o borrarlo libremente.
      this.destinationPhone = a.phone ?? '';
      this.certSlots.set(this.buildCertSlots(a));
      this._service.getWhatsappSourceNumbers().subscribe((numbers) => this.sourceNumbers.set(numbers));
    });
  }

  private planIncludes(a: AffiliateMember, token: string): boolean {
    return (a.planName || '').toUpperCase().includes(token);
  }

  private buildCertSlots(a: AffiliateMember): CertSlot[] {
    const slots: CertSlot[] = [];
    if (this.planIncludes(a, 'EPS')) slots.push({ key: 'EPS', label: 'Certificado EPS', file: null, alreadySent: !!a.certEps });
    if (this.planIncludes(a, 'ARL')) slots.push({ key: 'ARL', label: 'Certificado ARL', file: null, alreadySent: !!a.certArl });
    if (this.planIncludes(a, 'CCF')) slots.push({ key: 'CCF', label: 'Certificado CCF', file: null, alreadySent: !!a.certCcf });
    if (this.planIncludes(a, 'AFP')) slots.push({ key: 'AFP', label: 'Certificado Pensión', file: null, alreadySent: !!a.certPension });
    return slots;
  }

  /** Bloquea el envío solo cuando TODOS los certificados que aplican al plan ya están marcados. */
  get allAlreadySent(): boolean {
    const slots = this.certSlots();
    return slots.length > 0 && slots.every((s) => s.alreadySent);
  }

  onFileSelected(event: Event, slotKey: CertSlot['key']): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    input.value = '';
    if (!file) return;

    if (file.type !== ALLOWED_FILE_TYPE) {
      this.fileError.set(`El archivo de ${slotKey} debe ser un PDF. Selecciona un archivo con esa extensión.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.fileError.set(`El archivo de ${slotKey} supera el máximo permitido de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    this.certSlots.set(this.certSlots().map((s) => (s.key === slotKey ? { ...s, file } : s)));
  }

  removeFile(slotKey: CertSlot['key']): void {
    this.certSlots.set(this.certSlots().map((s) => (s.key === slotKey ? { ...s, file: null } : s)));
  }

  get missingFilesLabels(): string[] {
    return this.certSlots()
      .filter((s) => !s.alreadySent && !s.file)
      .map((s) => s.label);
  }

  onConfirm(): void {
    const a = this.affiliate();
    if (!a?.id) return;

    if (this.allAlreadySent) {
      this._toast.showError('Ya se enviaron todos los documentos por WhatsApp a este afiliado.');
      return;
    }
    const missing = this.missingFilesLabels;
    if (missing.length > 0) {
      this._toast.showError(`Adjunta el archivo faltante antes de enviar: ${missing.join(', ')}.`);
      return;
    }
    if (!this.selectedSourceNumberId) {
      this._toast.showError('Selecciona el número de origen desde el cual se enviará.');
      return;
    }
    if (!this.destinationPhone.trim()) {
      this._toast.showError('Escribe el número de WhatsApp de destino.');
      return;
    }

    const files = this.certSlots()
      .filter((s): s is CertSlot & { file: File } => !s.alreadySent && !!s.file)
      .map((s) => ({ file: s.file, certType: s.key }));

    this.isLoading.set(true);
    this._service
      .sendWhatsapp(Number(a.id), Number(this.selectedSourceNumberId), this.destinationPhone.trim(), files)
      .subscribe({
        next: () => {
          this._toast.showSuccess('Documentos enviados por WhatsApp correctamente.');
          this.isLoading.set(false);
          this.reset();
          this.sent.emit();
        },
        error: (err) => {
          this._toast.showError(err.message ?? 'No se pudo enviar el mensaje por WhatsApp.');
          this.isLoading.set(false);
        },
      });
  }

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.selectedSourceNumberId = '';
    this.destinationPhone = '';
    this.fileError.set(null);
    this.isLoading.set(false);
    this.certSlots.set([]);
  }
}
