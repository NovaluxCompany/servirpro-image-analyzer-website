export interface PaymentDestinationOption {
  id: number;
  code: string;
  name: string;
}

/**
 * Forma de pago con los destinos que se ofrecen para ella. Llegan anidados en
 * una sola respuesta (GET /payment-methods/dropdown) para poder cambiar la
 * lista de destinos al cambiar de forma de pago sin volver a pedirle al
 * servidor.
 */
export interface PaymentMethodOption {
  id: number;
  code: string;
  name: string;
  destinations: PaymentDestinationOption[];
}
