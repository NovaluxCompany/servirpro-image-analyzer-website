import { Affiliate } from './affiliate.interface';
import { Receipt } from './receipt.interface';
import { PaymentDestinationOption, PaymentMethodOption } from './payment-method.interface';

/**
 * Novedad que deja el backend al validar el comprobante que procesa n8n. Es solo
 * un aviso: la transacción sigue activa y la decisión final la toma el usuario.
 */
export type TransactionDeactivationReason = 'unauthorized_account' | 'receipt_year_mismatch';

export const DEACTIVATION_REASON_LABELS: Record<TransactionDeactivationReason, string> = {
  unauthorized_account: 'Cuenta no autorizada',
  receipt_year_mismatch: 'Año de comprobante no válido',
};

/** Explicación para la alerta del detalle. */
export const DEACTIVATION_REASON_MESSAGES: Record<TransactionDeactivationReason, string> = {
  unauthorized_account:
    'El comprobante muestra una cuenta o un titular de destino que no está entre las cuentas autorizadas de la empresa. Verifica a dónde se giró el dinero.',
  receipt_year_mismatch:
    'La fecha del comprobante no corresponde al año en curso. Puede ser un comprobante viejo o adjuntado por error.',
};

export interface Transaction {
  _id: string;
  id?: number;
  reference: string;
  totalValue: number;
  amountPaid: number;
  discountedValue?: number;
  amountGeneratedAI?: number;
  amountsMatch?: boolean;
  isApproved?: boolean | null;
  status: 'pending' | 'processed';
  affiliates: Affiliate[];
  images: string[];
  receipts: Receipt[];
  observation?: string;
  // null en las transacciones creadas antes de que existiera el campo.
  paymentMethod?: Omit<PaymentMethodOption, 'destinations'> | null;
  paymentDestination?: PaymentDestinationOption | null;
  isActive?: boolean;
  deactivationReason?: TransactionDeactivationReason | null;
  createdByUser?: { id: number; name: string; roles: string[] } | null;
  createdAt: string;
  updatedAt: string;
}
