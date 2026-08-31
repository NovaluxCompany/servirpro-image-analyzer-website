import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateDocument, AffiliateMember } from '../../interfaces/affiliate-member.interface';

@Component({
  selector: 'app-affiliate-documents-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './affiliate-documents-modal.html',
})
export class AffiliateDocumentsModalComponent {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  closed = output<void>();

  downloadingId = signal<number | null>(null);
  downloadAllProgress = signal<{ done: number; total: number } | null>(null);

  onClose(): void {
    this.closed.emit();
  }

  fileLabel(doc: AffiliateDocument, index: number): string {
    // El nombre real en Supabase es un timestamp poco legible; se muestra un
    // rótulo compacto y consistente con la numeración usada en el resto de la UI.
    return `Documento ${index + 1}`;
  }

  private downloadName(affiliate: AffiliateMember, doc: AffiliateDocument, index: number): string {
    const ext = doc.fileName.includes('.') ? doc.fileName.split('.').pop() : '';
    const suffix = (affiliate.documents?.length ?? 0) > 1 ? `_${index + 1}` : '';
    return ext ? `${affiliate.documentNumber}${suffix}.${ext}` : `${affiliate.documentNumber}${suffix}`;
  }

  private triggerDownload(blob: Blob, downloadName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }

  download(doc: AffiliateDocument, index: number): void {
    const affiliate = this.affiliate();
    if (!affiliate?.id) return;

    this.downloadingId.set(doc.id);
    this._service.downloadBlob(affiliate.id, doc.id).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, this.downloadName(affiliate, doc, index));
        this.downloadingId.set(null);
      },
      error: () => {
        this._toast.showError('No se pudo descargar el archivo');
        this.downloadingId.set(null);
      },
    });
  }

  // Descarga secuencial (no todas a la vez): así el navegador no bloquea/pregunta
  // por "múltiples descargas" y se puede ver el progreso mientras corre.
  async downloadAll(): Promise<void> {
    const affiliate = this.affiliate();
    const docs = affiliate?.documents ?? [];
    if (!affiliate?.id || docs.length === 0 || this.downloadAllProgress()) return;

    this.downloadAllProgress.set({ done: 0, total: docs.length });
    let failures = 0;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      try {
        const blob = await firstValueFrom(this._service.downloadBlob(affiliate.id, doc.id));
        this.triggerDownload(blob, this.downloadName(affiliate, doc, i));
      } catch {
        failures++;
      }
      this.downloadAllProgress.set({ done: i + 1, total: docs.length });
      // Pequeña pausa entre descargas para que el navegador no las agrupe/bloquee.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    this.downloadAllProgress.set(null);
    if (failures > 0) {
      this._toast.showError(`${failures} de ${docs.length} archivo(s) no se pudieron descargar.`);
    } else {
      this._toast.showSuccess('Todos los archivos fueron descargados.');
    }
  }
}
