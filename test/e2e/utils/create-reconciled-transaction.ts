import { Page, expect } from '@playwright/test';
import fs from 'fs';
import { buildDummyImage } from './build-dummy-image';

const API_URL = 'http://localhost:3000/api'; // coincide con environment.ts (urlBD)

export interface ReconciledTransactionAffiliateData {
  affiliationId: number;
  documentType: string;
  documentNumber: string;
  fullName: string;
  /** ISO string, ej. new Date('1990-01-01').toISOString() */
  birthDate: string;
  plan: string;
}

/**
 * Crea una transacción real (POST /transactions) para el afiliado dado y le
 * adjunta un recibo (POST /transactions/:id/receipts, endpoint del webhook de
 * n8n, sin guard) cuyo monto coincide EXACTO con lo pagado y
 * reliabilityAlert="confiable" — es la única forma real de que
 * transaction.amountsMatch quede en true.
 *
 * Por qué esto hace falta: `AffiliateBillingPeriodsService.resolveIsNewTransaction`
 * (usado por el endpoint genérico POST /affiliate-billing-periods) y, sobre
 * todo, `TransactionsService.markLatestBillingPeriodsAsNew` (que este flujo
 * SÍ dispara automáticamente en cuanto amountsMatch pasa a true) son el único
 * camino real para que un periodo de facturación quede con
 * isNewTransaction=true — no existe ningún parámetro para forzarlo
 * directamente. markLatestBillingPeriodsAsNew además crea el periodo del mes
 * actual por su cuenta (con categoryId/planId reales de la afiliación), así
 * que después de llamar a esta función ya no hace falta llamar
 * BillingPeriodsPage.createBillingPeriodForAffiliation.
 */
export async function createReconciledTransactionForAffiliate(
  page: Page,
  affiliate: ReconciledTransactionAffiliateData,
  amountPaid: number,
): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const imagePath = buildDummyImage();

  const createRes = await page.request.post(`${API_URL}/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      reference: `E2E-NUEVOS-${Date.now()}`,
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
        name: 'dummy-receipt.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(imagePath),
      },
    },
  });
  expect(createRes.ok(), `No se pudo crear la transacción de prueba: ${await createRes.text()}`).toBe(true);
  const transaction = await createRes.json();

  const receiptsRes = await page.request.post(`${API_URL}/transactions/${transaction.id}/receipts`, {
    data: {
      receipts: [
        {
          amount: amountPaid,
          reliabilityAlert: 'confiable',
        },
      ],
    },
  });
  expect(receiptsRes.ok(), `No se pudo conciliar la transacción de prueba: ${await receiptsRes.text()}`).toBe(true);

  return transaction.id;
}
