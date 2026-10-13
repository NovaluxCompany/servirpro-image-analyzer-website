export interface BulkSendToSiigoItemResult {
  id: number;
  status: string;
  errorMessage: string | null;
}

export interface BulkSendToSiigoResult {
  total: number;
  succeeded: number;
  // Periodos incluidos en un lote que Siigo ya aceptó, pendientes de la
  // confirmación real (llega después por webhook; hay que refrescar la
  // tabla más tarde para ver el estado final).
  queued: number;
  failed: number;
  results: BulkSendToSiigoItemResult[];
}
