import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ParamConfigGeneral {
  id: number;
  key: string;
  value: string;
  description: string;
  status: boolean;
  creationDate: string;
  updateDate: string;
}

@Component({
  selector: 'app-deactivate-affiliates-list',
  imports: [CommonModule],
  templateUrl: './deactivate-affiliates-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateAffiliatesList {
  protected readonly configs = signal<ParamConfigGeneral[]>([
    {
      id: 1,
      key: 'DIA_MINIMO_DESACTIVACION',
      value: '26',
      description: 'Día mínimo del mes para permitir el proceso de desactivación de afiliados.',
      status: true,
      creationDate: '2026-05-01T08:00:00',
      updateDate: '2026-05-10T14:30:00',
    },
    {
      id: 2,
      key: 'MAX_INTENTOS_DESACTIVACION',
      value: '3',
      description: 'Cantidad máxima de intentos permitidos para ejecutar la desactivación.',
      status: true,
      creationDate: '2026-05-01T08:10:00',
      updateDate: '2026-05-10T14:30:00',
    },
    {
      id: 3,
      key: 'NOTIFICAR_DESACTIVACION_AUTOMATICA',
      value: 'true',
      description: 'Indica si se debe enviar notificación automática al completar la desactivación.',
      status: false,
      creationDate: '2026-05-01T08:20:00',
      updateDate: '2026-05-10T14:30:00',
    },
  ]);

  protected readonly totalItems = computed(() => this.configs().length);

}
