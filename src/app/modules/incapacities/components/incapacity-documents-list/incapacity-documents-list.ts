import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncapacitiesService } from '../../services/incapacities.service';
import { IncapacityDocument } from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';

/**
 * Chips para abrir los soportes de una incapacidad.
 *
 * Componente aparte porque lo usan tres pantallas: el listado, el histórico
 * dentro del modal de registro y la pestaña de la ficha del afiliado.
 */
@Component({
  selector: 'app-incapacity-documents-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incapacity-documents-list.html',
})
export class IncapacityDocumentsListComponent {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);

  incapacityId = input.required<number>();
  documents = input<IncapacityDocument[]>([]);

  openingId = signal<number | null>(null);

  private readonly labels: Record<string, string> = {
    CERT_BANCARIO: 'Certificado bancario',
    INCAPACIDAD: 'Incapacidad',
    HISTORIA_CLINICA: 'Historia clínica',
    AUTORIZACION_PAGO_TERCERO: 'Autorización de pago a terceros',
    RIPS: 'RIPS',
  };

  label(type: string): string {
    return this.labels[type] ?? type;
  }

  /**
   * La pestaña se abre ANTES de pedir la URL: si se abriera dentro del
   * `subscribe`, el navegador la trataría como popup no iniciado por el
   * usuario y la bloquearía.
   */
  open(document: IncapacityDocument): void {
    const tab = window.open('', '_blank');
    this.openingId.set(document.id);

    this._service.getDocumentUrl(this.incapacityId(), document.id).subscribe({
      next: ({ url }) => {
        this.openingId.set(null);
        if (tab) {
          tab.location.href = url;
        } else {
          this._toast.showError('El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.');
        }
      },
      error: (error: Error) => {
        this.openingId.set(null);
        tab?.close();
        this._toast.showError(error.message);
      },
    });
  }
}
