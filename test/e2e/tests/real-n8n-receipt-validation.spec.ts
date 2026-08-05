import { test, expect } from '@playwright/test';
import path from 'path';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { BillingPeriodsPage } from '../pages/billing-periods.page';
import { randomDocumentNumber, randomEmail } from '../utils/test-data';
import { createTransactionWithRealReceipt } from '../utils/create-transaction-real-n8n';

/** "$ 125.140" / "125.140" (formato es-CO de CurrencyPipe) -> 125140 */
function parseCopAmount(text: string): number {
  const digitsOnly = text.replace(/[^\d]/g, '');
  return Number(digitsOnly);
}

test.use({ storageState: authStateFile('Administrador') });

const API_URL = 'http://localhost:3000/api';
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/real-receipts');

/**
 * A diferencia de pricing-ejemplos.spec.ts / pricing-ejemplos-nuevos.spec.ts
 * (que simulan la respuesta de n8n llamando directo al webhook de callback,
 * ver create-reconciled-transaction.ts), este spec sube comprobantes de pago
 * REALES (fotos/capturas de transferencias reales, no un PNG dummy) y espera
 * a que el n8n REAL configurado en el backend (N8N_WEBHOOK_URL) los procese y
 * responda, sin ningún atajo. El objetivo no es re-validar el desglose de
 * precios (ya cubierto por esos specs) sino confirmar que el pipeline
 * real de n8n clasifica correctamente comprobantes reales: coincide cuando
 * el monto del comprobante coincide con lo declarado, y NO coincide cuando
 * no coincide.
 *
 * Requiere que el backend tenga N8N_WEBHOOK_URL apuntando a un n8n real y
 * alcanzable desde donde corre el test; si no, cada caso falla por timeout
 * (120s) con un mensaje explícito en vez de colgarse (ver
 * create-transaction-real-n8n.ts).
 */
interface MatchCase {
  caseName: string;
  agrupadoraText: 'RESOLUCION' | 'GESTION';
  planText: string;
  /** Monto real del comprobante (lo que n8n debe leer y comparar contra amountPaid). */
  amountPaid: number;
  receiptFile: string;
  // Valores esperados del bloque NUEVOS en siigo_pricing_rules (admin_new/
  // reserve_new/profit_new) para esta combinación agrupadora+categoría+plan,
  // y el precio real del plan en su primer mes (plans.first_month_price) —
  // NO tienen por qué coincidir con amountPaid (ver nota abajo).
  admin: number;
  reserve: number;
  ganancia: number;
  planPrice: number;
}

// El monto real de cada comprobante (columna Wompi/Redeban de la foto) no
// necesariamente es igual a plans.first_month_price: son dos cosas
// independientes en el sistema. amountPaid solo se usa para que n8n concilie
// la transacción (amountsMatch=true); "Valor del plan" en la modal sale de
// plan.firstMonthPrice según isNewTransaction, no de amountPaid.
const MATCH_CASES: MatchCase[] = [
  {
    caseName: 'RealN8nEps',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS',
    amountPaid: 152000,
    receiptFile: 'match-eps-152000.jpeg',
    admin: 10000,
    reserve: 7460,
    ganancia: 134540,
    planPrice: 152000,
  },
  {
    caseName: 'RealN8nEpsAfp',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+AFP',
    amountPaid: 421000,
    receiptFile: 'match-eps-afp-421000.jpeg',
    admin: 10000,
    reserve: 16860,
    ganancia: 125140,
    planPrice: 152000,
  },
  {
    caseName: 'RealN8nEpsCcfAfp',
    agrupadoraText: 'GESTION',
    planText: 'EPS+CCF+AFP',
    amountPaid: 489000,
    receiptFile: 'match-eps-ccf-afp-489000.jpeg',
    admin: 16200,
    reserve: 20960,
    ganancia: 174840,
    planPrice: 212000,
  },
  {
    caseName: 'RealN8nEpsArl2',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL2',
    amountPaid: 172000,
    receiptFile: 'match-eps-arl2-172000.jpeg',
    admin: 10000,
    reserve: 8360,
    ganancia: 153640,
    planPrice: 172000,
  },
  {
    caseName: 'RealN8nEpsArl4CcfAfp',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL4+CCF+AFP',
    amountPaid: 558000,
    receiptFile: 'match-eps-arl4-ccf-afp-558000.jpeg',
    admin: 16200,
    reserve: 25335,
    ganancia: 242965,
    planPrice: 284500,
  },
];

interface MismatchCase {
  caseName: string;
  /** Monto declarado en la transacción — a propósito distinto al monto real del comprobante. */
  declaredAmountPaid: number;
  receiptFile: string;
}

// Todos usan el mismo plan (EPS, RESOLUCION/ORDINARIO) porque para un caso de
// mismatch el plan es irrelevante: lo único que importa es que el monto real
// del comprobante (leído por n8n) no coincida con declaredAmountPaid.
const MISMATCH_CASES: MismatchCase[] = [
  { caseName: 'RealN8nMismatch150k', declaredAmountPaid: 152000, receiptFile: 'mismatch-150000.jpeg' },
  { caseName: 'RealN8nMismatch448k', declaredAmountPaid: 152000, receiptFile: 'mismatch-448000.jpeg' },
  { caseName: 'RealN8nMismatch681k', declaredAmountPaid: 152000, receiptFile: 'mismatch-681000.jpeg' },
];

async function createTestAffiliate(
  page: import('@playwright/test').Page,
  caseName: string,
  planText: string,
  agrupadoraText: 'RESOLUCION' | 'GESTION',
): Promise<{ affiliationId: number; documentType: string; documentNumber: string; fullName: string; birthDate: string }> {
  const affiliatesPage = new AffiliatesPage(page);
  const suffix = Date.now().toString().slice(-6);
  const firstName = `Prueba-${caseName}`;
  const lastName = `E2E-${suffix}`;
  const documentNumber = randomDocumentNumber();
  const email = randomEmail(firstName);
  const documentType = 'CC';
  // 1965 -> ~60 años: por encima del límite de edad ORDINARIO para ambos
  // géneros (55 hombre / 50 mujer, ver AffiliateCategoryClassifierService),
  // así el afiliado clasifica ORDINARIO sin depender de si el plan incluye
  // "AFP" en el nombre. Con una edad menor, planes sin AFP (EPS, EPS+ARL2)
  // caían en NO ORDINARIO, categoría para la que RESOLUCION no tiene ninguna
  // regla sembrada en siigo_pricing_rules -> hasSiigoMatch quedaba en false
  // para siempre y el botón "Enviar a Siigo" nunca aparecía, sin importar el
  // timeout (esto, no n8n, era la causa real de los timeouts en EPS/EPS+ARL2).
  const birthDate = '1965-01-01';

  await affiliatesPage.goto();
  await affiliatesPage.openCreateModal();
  await affiliatesPage.fillPersonalData({
    documentNumber,
    firstName,
    lastName,
    email,
    documentType,
    birthDate,
    genderText: 'Hombre',
  });
  await affiliatesPage.openSectionAfiliacion();
  await affiliatesPage.fillAffiliationData({ planText, agrupadoraText });
  const { id: affiliationId } = await affiliatesPage.submitAndGetCreated();
  await affiliatesPage.expectCreatedToastOrModalClosed();

  return {
    affiliationId,
    documentType,
    documentNumber,
    fullName: `${firstName} ${lastName}`,
    birthDate: new Date(birthDate).toISOString(),
  };
}

// Este spec depende de un servicio externo real (n8n) no determinístico:
// el mismo comprobante puede tardar 25s o no responder en absoluto según la
// carga/latencia del momento, sin que eso signifique que algo esté mal (ver
// historial de corridas: la misma transacción que se colgó una vez, la
// siguiente vez resolvió bien en segundos). Se le dan 2 reintentos LOCALES
// (no solo en CI, a diferencia del resto de la suite en playwright.config.ts)
// para absorber esa variabilidad en vez de perseguir timeouts cada vez más
// largos, que no eliminan el problema, solo lo posponen.
test.describe.configure({ retries: 2 });

test.describe('Validación real de comprobantes vía n8n (sin bypass)', () => {
  for (const testCase of MATCH_CASES) {
    test(`${testCase.caseName}: comprobante real de $${testCase.amountPaid} coincide y n8n lo valida (amountsMatch=true)`, async ({ page }) => {
      test.setTimeout(300_000);

      const affiliate = await createTestAffiliate(page, testCase.caseName, testCase.planText, testCase.agrupadoraText);
      const receiptPath = path.join(FIXTURES_DIR, testCase.receiptFile);

      const { transactionId, amountsMatch } = await createTransactionWithRealReceipt(
        page,
        affiliate,
        testCase.amountPaid,
        receiptPath,
      );

      expect(amountsMatch, `Transacción ${transactionId}: n8n debía validar el comprobante real como coincidente`).toBe(true);

      // markLatestBillingPeriodsAsNew se dispara automáticamente cuando
      // amountsMatch pasa a true (ver transactions.service.ts) y crea el
      // periodo del mes actual con isNewTransaction=true.
      const token = await page.evaluate(() => localStorage.getItem('token'));
      const periodsRes = await page.request.get(`${API_URL}/affiliate-billing-periods/affiliation/${affiliate.affiliationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(periodsRes.ok()).toBe(true);
      const periods = await periodsRes.json();
      expect(periods.length, 'Debía crearse un periodo de facturación tras la reconciliación real').toBeGreaterThan(0);
      expect(periods[0].isNewTransaction).toBe(true);

      // Verificación del desglose de precios (Administración/Reserva/Valor
      // del plan/Total) contra el bloque NUEVOS de siigo_pricing_rules, en la
      // modal "Enviar a Siigo" — SIN confirmar el envío (se cancela a
      // propósito, este spec no debe crear facturas reales en Siigo).
      const billingPeriodsPage = new BillingPeriodsPage(page);
      await billingPeriodsPage.goto();
      await billingPeriodsPage.searchWideRange();
      await billingPeriodsPage.waitForTableLoaded(20_000);

      // 30s (no 15s): mismo margen que expectPricingBreakdownVisible() —
      // el backend puede responder más lento de lo normal cuando está
      // saturado por las llamadas de fondo a n8n que dispara cada
      // transacción de prueba.
      const row = await billingPeriodsPage.findRowByAffiliateNameAcrossPages(affiliate.fullName);
      await expect(row).toBeVisible({ timeout: 30_000 });
      await billingPeriodsPage.clickSendToSiigo(row);
      await billingPeriodsPage.expectModalVisible();
      await billingPeriodsPage.expectPricingBreakdownVisible();

      const adminText = await billingPeriodsPage.adminRow().innerText();
      const reserveText = await billingPeriodsPage.reserveRow().innerText();
      const planValueText = await billingPeriodsPage.planValueRow().innerText();
      const totalText = await billingPeriodsPage.totalRow().innerText();

      expect(parseCopAmount(adminText)).toBe(testCase.admin);
      expect(parseCopAmount(reserveText)).toBe(testCase.reserve);
      expect(parseCopAmount(planValueText)).toBe(testCase.planPrice);
      expect(parseCopAmount(totalText)).toBe(testCase.ganancia);

      await billingPeriodsPage.cancelSend();
    });
  }

  for (const testCase of MISMATCH_CASES) {
    test(`${testCase.caseName}: comprobante real no coincide y n8n lo detecta (amountsMatch=false)`, async ({ page }) => {
      test.setTimeout(300_000);

      const affiliate = await createTestAffiliate(page, testCase.caseName, 'EPS', 'RESOLUCION');
      const receiptPath = path.join(FIXTURES_DIR, testCase.receiptFile);

      const { transactionId, amountsMatch } = await createTransactionWithRealReceipt(
        page,
        affiliate,
        testCase.declaredAmountPaid,
        receiptPath,
      );

      expect(amountsMatch, `Transacción ${transactionId}: n8n debía detectar que el comprobante real NO coincide`).toBe(false);
    });
  }
});
