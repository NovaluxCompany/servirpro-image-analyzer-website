import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncapacitiesService } from '../../services/incapacities.service';
import { IncapacityDocument } from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';

/**
 * Botón de "..." que despliega los soportes de una incapacidad.
 *
 * Antes se pintaban como chips en la celda: con muchos soportes la fila de
 * la tabla crecía de alto. Ahora es un desplegable de posición fija (igual
 * que el menú de Acciones), así la celda siempre ocupa lo mismo.
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
  private _elementRef = inject(ElementRef<HTMLElement>);

  incapacityId = input.required<number>();
  documents = input<IncapacityDocument[]>([]);

  openingId = signal<number | null>(null);
  isOpen = signal(false);
  dropdownPos = signal<{ top: number | null; bottom: number | null; left: number; maxHeight: number }>({
    top: 0,
    bottom: null,
    left: 0,
    maxHeight: 320,
  });

  private readonly labels: Record<string, string> = {
    CERT_BANCARIO: 'Certificado bancario',
    INCAPACIDAD: 'Incapacidad',
    HISTORIA_CLINICA: 'Historia clínica',
    AUTORIZACION_PAGO_TERCERO: 'Autorización de pago a terceros',
    RIPS: 'RIPS',
    AUTORIZACION_BANCARIA: 'Autorización bancaria',
    RUAF: 'RUAF',
    CERTIFICADO_NACIDO_VIVO: 'Certificado de nacido vivo',
    REGISTRO_CIVIL: 'Registro civil',
    SOAT: 'SOAT',
    LICENCIA_CONDUCCION: 'Licencia de conducción',
    FURIPS: 'FURIPS',
  };

  label(type: string): string {
    return this.labels[type] ?? type;
  }

  /** Texto del tooltip: nombre completo + qué implica abrirlo. */
  tooltip(document: IncapacityDocument): string {
    const name = this.label(document.documentType);
    return document.isSensitive
      ? `${name} — dato sensible: requiere permiso y queda registrada la consulta`
      : `${name} — se abre en una pestaña nueva`;
  }

  toggle(event: MouseEvent, buttonEl: HTMLElement): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }

    const rect = buttonEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const opensUpward = spaceBelow < 240 && spaceAbove > spaceBelow;

    this.dropdownPos.set({
      top: opensUpward ? null : rect.bottom + 4,
      bottom: opensUpward ? window.innerHeight - rect.top + 4 : null,
      left: rect.left,
      maxHeight: Math.max(160, (opensUpward ? spaceAbove : spaceBelow) - 12),
    });
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this._elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
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
