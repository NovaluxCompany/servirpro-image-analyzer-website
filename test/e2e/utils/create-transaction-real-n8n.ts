import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000/api'; // coincide con environment.ts (urlBD)
const N8N_POLL_TIMEOUT_MS = 120_000;
const N8N_POLL_INTERVAL_MS = 2_000;

export interface RealReceiptAffiliateData {
  affiliationId: number;
  documentType: string;
  documentNumber: string;
  fullName: string;
  /** ISO string, ej. new Date('1990-01-01').toISOString() */
  birthDate: string;
  plan: string;
}

function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  return 'image/jpeg';
}

/**
 * Igual que createReconciledTransactionForAffiliate (create-reconciled-transaction.ts),
 * pero SIN el atajo sintético: en vez de simular la respuesta de n8n llamando
 * directo a POST /transactions/:id/receipts, sube la imagen REAL de un
 * comprobante (recibo/transferencia real) y espera a que el n8n real (el
 * configurado en N8N_WEBHOOK_URL del backend) responda de verdad al webhook
 * de callback, haciendo polling sobre GET /transactions/:id hasta que
 * amountsMatch deje de ser null (o hasta N8N_POLL_TIMEOUT_MS).
 *
 * Requiere que el backend tenga N8N_WEBHOOK_URL configurado apuntando a un
 * n8n real y alcanzable — si no, amountsMatch se queda en null para siempre
 * y este helper falla por timeout con un mensaje explícito, en vez de
 * colgarse indefinidamente.
 */
export async function createTransactionWithRealReceipt(
  page: Page,
  affiliate: RealReceiptAffiliateData,
  amountPaid: number,
  receiptImagePath: string,
): Promise<{ transactionId: number; amountsMatch: boolean | null }> {
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const createRes = await page.request.post(`${API_URL}/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      reference: `E2E-REAL-N8N-${Date.now()}`,
      amountPaid: String(amountPaid),
      affiliates: JSON.stringify([
        {
          affiliationId: affiliate.affiliationId,
          type: affiliate.documentType,
          idNumber: affiliate.documentNumber,
          fullName: affiliate.fullName,
          birthDate: affiliate.birthDate,
          plan: affiliate.plan,
          price: amountPaid,
        },
      ]),
      images: {
        name: path.basename(receiptImagePath),
        mimeType: mimeTypeFor(receiptImagePath),
        buffer: fs.readFileSync(receiptImagePath),
      },
    },
  });
  expect(createRes.ok(), `No se pudo crear la transacción de prueba: ${await createRes.text()}`).toBe(true);
  const transaction = await createRes.json();

  const deadline = Date.now() + N8N_POLL_TIMEOUT_MS;
  let amountsMatch: boolean | null = null;

  while (Date.now() < deadline) {
    const getRes = await page.request.get(`${API_URL}/transactions/${transaction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok(), `No se pudo consultar la transacción de prueba: ${await getRes.text()}`).toBe(true);
    const current = await getRes.json();

    if (current.amountsMatch !== null) {
      amountsMatch = current.amountsMatch;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, N8N_POLL_INTERVAL_MS));
  }

  expect(
    amountsMatch,
    `n8n no validó la factura (amountsMatch sigue en null) después de ${N8N_POLL_TIMEOUT_MS / 1000}s. ` +
      'Verifica que N8N_WEBHOOK_URL esté configurado en el backend y que el n8n real esté corriendo y alcanzable.',
  ).not.toBeNull();

  return { transactionId: transaction.id, amountsMatch };
}
