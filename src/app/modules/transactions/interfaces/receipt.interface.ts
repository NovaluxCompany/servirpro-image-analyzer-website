export interface Receipt {
  amount?: number;
  veracityPercentage?: number;
  currency?: string;
  vendor?: string;
  reliabilityAlert?: 'confiable' | 'no_confiable';
  date: string;
}

/**
 * Un motivo por el que el backend rechazó los comprobantes al crear la
 * transacción (400, campo `errors`). `receipt` es la posición del comprobante
 * (1, 2, …) o null si aplica al conjunto (ej. la suma no cuadra); `message` ya
 * viene listo para mostrar.
 */
export interface ReceiptValidationIssue {
  code: string;
  receipt: number | null;
  message: string;
}
