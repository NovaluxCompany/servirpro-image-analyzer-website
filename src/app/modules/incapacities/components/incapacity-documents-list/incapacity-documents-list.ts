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

  /**
   * Etiqueta corta para el chip. La larga se conserva en el `title`, que es
   * donde no cuesta nada.
   *
   * Con cinco soportes, las etiquetas completas hacían que la celda ocupara
   * más alto que el resto de la fila — "Autorización de pago a terceros"
   * sola mide casi lo mismo que la columna entera.
   */
  private readonly shortLabels: Record<string, string> = {
    CERT_BANCARIO: 'Cert. bancario',
    INCAPACIDAD: 'Incapacidad',
    HISTORIA_CLINICA: 'H. clínica',
    AUTORIZACION_PAGO_TERCERO: 'Autorización',
    RIPS: 'RIPS',
  };

  label(type: string): string {
    return this.labels[type] ?? type;
  }

  shortLabel(type: string): string {
    return this.shortLabels[type] ?? this.label(type);
  }

  /** Texto del tooltip: nombre completo + qué implica abrirlo. */
  tooltip(document: IncapacityDocument): string {
    const name = this.label(document.documentType);
    return document.isSensitive
      ? `${name} — dato sensible: requiere permiso y queda registrada la consulta`
      : `${name} — se abre en una pestaña nueva`;
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
