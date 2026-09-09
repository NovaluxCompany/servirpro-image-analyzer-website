import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncapacitiesService } from '../../services/incapacities.service';
import { CatalogItem, Incapacity, IncapacityRoute, PaymentType } from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';

export type StatusScope = 'SERVIRPRO' | 'TERCERO';

/** Códigos que un humano puede elegir a mano por scope — PENDIENTE es solo el punto de partida. */
const SELECTABLE_SERVIRPRO_CODES = ['APROBADO', 'RECHAZADO', 'PAGADO'];
const SELECTABLE_THIRD_PARTY_CODES = ['PENDIENTE', 'EN_PROCESO', 'APROBADO', 'RECHAZADO', 'TUTELA', 'ENVIADO_A_CYA'];

/**
 * Cambio de estado, para los dos lados.
 *
 * Un solo modal con `scope` en vez de dos componentes casi idénticos: lo
 * único que cambia son las opciones disponibles y el endpoint.
 *
 * Las opciones salen de IncapacitiesService.getCatalogs() (tabla en BD),
 * no de una lista quemada acá: lo que se manda al backend es el `id` de la
 * fila elegida, no el texto — ver UpdateServirproStatusDto/UpdateThirdPartyStatusDto.
 *
 * La observación es obligatoria al rechazar; el backend la exige también,
 * esta validación es para no gastar un viaje al servidor.
 */
@Component({
  selector: 'app-incapacity-status-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incapacity-status-modal.html',
})
export class IncapacityStatusModalComponent {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  incapacity = input<Incapacity | null>(null);
  scope = input<StatusScope>('SERVIRPRO');
  /**
   * CYA/Gestión resuelto por el padre (agrupadora del afiliado), porque
   * `incapacity.routedTo` queda null hasta que se aprueba — ver
   * IncapacitiesListComponent.resolveThirdPartyRoute.
   */
  resolvedThirdPartyRoute = input<IncapacityRoute | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  servirproStatuses = signal<CatalogItem[]>([]);
  thirdPartyStatuses = signal<CatalogItem[]>([]);
  private catalogsLoaded = false;

  selectedStatusId = signal<number | ''>('');
  observation = signal<string>('');
  paymentType = signal<PaymentType | ''>('');
  isSaving = signal(false);

  title = computed(() => {
    if (this.scope() === 'SERVIRPRO') return 'Estado Servirpro';
    const route = this.resolvedThirdPartyRoute() ?? this.incapacity()?.routedTo;
    return route === 'CYA' ? 'Estado CYA' : 'Estado Gestión';
  });

  /**
   * PAGADO solo tiene sentido si ya está APROBADO (el backend también lo
   * exige). ENVIADO_A_CYA solo se ofrece si la incapacidad está enrutada a
   * CYA — es sobre todo informativo, porque ya se marca sola al aprobar
   * (ver IncapacityWorkflowService.markSentToCya); este modal permite
   * corregirlo a mano si hiciera falta.
   */
  options = computed<CatalogItem[]>(() => {
    if (this.scope() === 'SERVIRPRO') {
      const alreadyApproved = this.incapacity()?.servirproStatus?.code === 'APROBADO';
      return this.servirproStatuses().filter(
        (s) => SELECTABLE_SERVIRPRO_CODES.includes(s.code) && (s.code !== 'PAGADO' || alreadyApproved),
      );
    }

    const routedToCya = this.incapacity()?.routedTo === 'CYA';
    return this.thirdPartyStatuses().filter(
      (s) => SELECTABLE_THIRD_PARTY_CODES.includes(s.code) && (s.code !== 'ENVIADO_A_CYA' || routedToCya),
    );
  });

  private selectedOption = computed(() => this.options().find((o) => o.id === this.selectedStatusId()));

  /** Aviso de lo que dispara aprobar del lado de Servirpro. */
  showApprovalNotice = computed(
    () => this.scope() === 'SERVIRPRO' && this.selectedOption()?.code === 'APROBADO',
  );

  showPaymentTypeField = computed(
    () => this.scope() === 'SERVIRPRO' && this.selectedOption()?.code === 'PAGADO',
  );

  requiresObservation = computed(() => this.selectedOption()?.code === 'RECHAZADO');

  constructor() {
    effect(() => {
      if (this.isVisible()) this.loadCatalogs();
    });
  }

  private loadCatalogs(): void {
    if (this.catalogsLoaded) return;
    this._service.getCatalogs().subscribe({
      next: ({ servirproStatuses, thirdPartyStatuses }) => {
        this.servirproStatuses.set(servirproStatuses);
        this.thirdPartyStatuses.set(thirdPartyStatuses);
        this.catalogsLoaded = true;
      },
      error: (error: Error) => this._toast.showError(`No se pudieron cargar los estados: ${error.message}`),
    });
  }

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.selectedStatusId.set('');
    this.observation.set('');
    this.paymentType.set('');
  }

  confirm(): void {
    const incapacity = this.incapacity();
    const option = this.selectedOption();
    if (!incapacity || !option) {
      this._toast.showError('Elige un estado.');
      return;
    }
    if (this.requiresObservation() && !this.observation().trim()) {
      this._toast.showError('Escribe el motivo del rechazo en la observación.');
      return;
    }
    if (this.showPaymentTypeField() && !this.paymentType()) {
      this._toast.showError('Selecciona el tipo de pago.');
      return;
    }

    this.isSaving.set(true);
    const observation = this.observation().trim() || undefined;

    const request$ =
      this.scope() === 'SERVIRPRO'
        ? this._service.updateServirproStatus(incapacity.id, {
            statusId: option.id,
            observation,
            paymentType: this.showPaymentTypeField() ? (this.paymentType() as PaymentType) : undefined,
          })
        : this._service.updateThirdPartyStatus(incapacity.id, {
            statusId: option.id,
            observation,
          });

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this._toast.showSuccess('Estado actualizado.');
        this.reset();
        this.confirmed.emit();
      },
      error: (error: Error) => {
        this.isSaving.set(false);
        this._toast.showError(error.message);
      },
    });
  }
}
