import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { BillingPeriodsPage } from '../pages/billing-periods.page';
import { randomDocumentNumber, randomEmail } from '../utils/test-data';
import { createReconciledTransactionForAffiliate } from '../utils/create-reconciled-transaction';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Igual que pricing-ejemplos.spec.ts, pero para el bloque NUEVOS
 * (profit_new/admin_new/reserve_new, isNewTransaction=true) — el que
 * pricing-ejemplos.spec.ts NO cubre porque isNewTransaction no se puede
 * forzar directamente, siempre se resuelve del historial real de
 * transacciones del cliente.
 *
 * Para lograr isNewTransaction=true de verdad (no solo a nivel unitario) hay
 * que simular un pago conciliado: crear una transacción real
 * (POST /transactions) y adjuntarle un recibo con el mismo monto y
 * reliabilityAlert="confiable" (POST /transactions/:id/receipts, el webhook
 * que usa n8n) — eso hace que `transaction.amountsMatch` quede en true, lo
 * que dispara automáticamente `TransactionsService.markLatestBillingPeriodsAsNew`,
 * que crea el periodo de facturación del mes actual con
 * isNewTransaction=true (ver create-reconciled-transaction.ts). Por eso NO
 * se llama BillingPeriodsPage.createBillingPeriodForAffiliation aquí: el
 * periodo ya queda creado como parte de este flujo, igual que pasaría con
 * un pago real.
 *
 * COBERTURA: las 14 filas de la sección NUEVOS de EJEMPLOS (personas de
 * ejemplo distintas a las de MENSUALIDADES) — 5 CYA/ORDINARIO, 1
 * CYA/RESOLUCION, 6 GESTION/ORDINARIO, 2 GESTION/NO ORDINARIO. Igual que en
 * pricing-ejemplos.spec.ts (fila 41), una de las GESTION/ORDINARIO (fila 32,
 * "Camilo Andrés Giraldo Ramírez", plan ARL4 puro) usa edad 17 + documento CE
 * en vez de los datos reales de la fila, para esquivar el atajo de
 * RESOLUCION del clasificador y sí poder validar la regla
 * GESTION+ORDINARIO+ARL4 (profit_new=118380 en el seed).
 */
interface PricingEjemploNuevoCase {
  sourceRow: string;
  caseName: string;
  agrupadoraText: 'RESOLUCION' | 'GESTION';
  planText: string;
  documentType: string;
  ageYears: number;
  genderText: 'Hombre' | 'Mujer';
  expectedCategory: 'ORDINARIO' | 'RESOLUCION' | 'NO ORDINARIO';
  admin: number;
  reserve: number;
  ganancia: number;
  /** Precio real del plan primer mes (tabla plans, first_month_price) — lo que debe mostrar "Valor del plan". */
  planPrice: number;
}

const PRICING_CASES: PricingEjemploNuevoCase[] = [
  {
    // Fila 2: "Carlos Alberto Restrepo Gómez" — HOMBRE MAYOR 55 AÑOS, CC, 58 años
    sourceRow: 'EJEMPLOS!A2',
    caseName: 'CyaOrdinarioNuevos',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+AFP',
    documentType: 'CC',
    ageYears: 58,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 16860,
    ganancia: 125140,
    planPrice: 152000,
  },
  {
    // Fila 3: "María Fernanda Gómez Vélez" — MUJER MAYOR 50 AÑOS, CC, 52 años
    sourceRow: 'EJEMPLOS!A3',
    caseName: 'CyaOrdinarioNuevos2',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL2',
    documentType: 'CC',
    ageYears: 52,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 8360,
    ganancia: 153640,
    planPrice: 172000,
  },
  {
    // Fila 4: "José Gregorio Rodríguez Peña" — VENEZOLANO, PPT, 34 años
    sourceRow: 'EJEMPLOS!A4',
    caseName: 'CyaOrdinarioNuevos3',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL3',
    documentType: 'PPT',
    ageYears: 34,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 9775,
    ganancia: 172725,
    planPrice: 192500,
  },
  {
    // Fila 5: "Michael Anthony Johnson Smith" — EXTRANJERO, CE, 41 años
    sourceRow: 'EJEMPLOS!A5',
    caseName: 'CyaOrdinarioNuevos4',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL1+AFP',
    documentType: 'CE',
    ageYears: 41,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 17130,
    ganancia: 133870,
    planPrice: 161000,
  },
  {
    // Fila 6: "Luis Fernando Cardona Ospina" — PAGA PENSIÓN, CC, 60 años
    sourceRow: 'EJEMPLOS!A6',
    caseName: 'CyaOrdinarioNuevos5',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL4+AFP',
    documentType: 'CC',
    ageYears: 60,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 21250,
    ganancia: 193750,
    planPrice: 225000,
  },
  {
    // Fila 19: "Jorge Iván Muñoz Castaño" — SOLO ARL, CC, 30 años
    sourceRow: 'EJEMPLOS!A19',
    caseName: 'CyaResolucionNuevos',
    agrupadoraText: 'RESOLUCION',
    planText: 'ARL3',
    documentType: 'CC',
    ageYears: 30,
    genderText: 'Hombre',
    expectedCategory: 'RESOLUCION',
    admin: 12000,
    reserve: 7450,
    ganancia: 95550,
    planPrice: 115000,
  },
  {
    // Fila 27: "Fabián Ricardo Ortiz Palacio" — HOMBRE MAYOR 55 AÑOS, CC, 56 años
    sourceRow: 'EJEMPLOS!A27',
    caseName: 'GestionOrdinarioNuevos',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL1+CCF',
    documentType: 'CC',
    ageYears: 56,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 11815,
    ganancia: 192485,
    planPrice: 220500,
  },
  {
    // Fila 28: "Luz Adriana Castaño Rúa" — MUJER MAYOR 50 AÑOS, CC, 51 años
    sourceRow: 'EJEMPLOS!A28',
    caseName: 'GestionOrdinarioNuevos2',
    agrupadoraText: 'GESTION',
    planText: 'EPS+CCF',
    documentType: 'CC',
    ageYears: 51,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 11560,
    ganancia: 184240,
    planPrice: 212000,
  },
  {
    // Fila 29: "Ronald Alejandro Contreras Mora" — VENEZOLANO, PPT, 33 años
    sourceRow: 'EJEMPLOS!A29',
    caseName: 'GestionOrdinarioNuevos3',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL3+CCF',
    documentType: 'PPT',
    ageYears: 33,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 13860,
    ganancia: 221940,
    planPrice: 252000,
  },
  {
    // Fila 30: "Antoine Pierre Dubois" — EXTRANJERO, CE, 47 años
    sourceRow: 'EJEMPLOS!A30',
    caseName: 'GestionOrdinarioNuevos4',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL2+CCF+AFP',
    documentType: 'CE',
    ageYears: 47,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 21725,
    ganancia: 189575,
    planPrice: 227500,
  },
  {
    // Fila 31: "Nelson Iván Marulanda Osorio" — PAGA PENSIÓN, CC, 59 años
    sourceRow: 'EJEMPLOS!A31',
    caseName: 'GestionOrdinarioNuevos5',
    agrupadoraText: 'GESTION',
    planText: 'EPS+CCF+AFP',
    documentType: 'CC',
    ageYears: 59,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 20960,
    ganancia: 174840,
    planPrice: 212000,
  },
  {
    // Fila 32: "Camilo Andrés Giraldo Ramírez" — SOLO ARL, CC, 36 años (real).
    // Edad/documento se cambian a 17 + CE (igual que la fila 41 en
    // pricing-ejemplos.spec.ts) para esquivar el atajo de RESOLUCION del
    // clasificador y sí llegar a ORDINARIO, validando GESTION+ORDINARIO+ARL4.
    sourceRow: 'EJEMPLOS!A32',
    caseName: 'GestionOrdinarioArl4PuroNuevos',
    agrupadoraText: 'GESTION',
    planText: 'ARL4',
    documentType: 'CE',
    ageYears: 17,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 16200,
    reserve: 9420,
    ganancia: 118380,
    planPrice: 144000,
  },
  {
    // Fila 45: "Andrés Felipe Zapata Londoño" — HOMBRE MENOR 55 AÑOS, CC, 28 años
    sourceRow: 'EJEMPLOS!A45',
    caseName: 'GestionNoOrdinarioNuevos',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL3',
    documentType: 'CC',
    ageYears: 28,
    genderText: 'Hombre',
    expectedCategory: 'NO ORDINARIO',
    admin: 16200,
    reserve: 19175,
    ganancia: 157125,
    planPrice: 192500,
  },
  {
    // Fila 46: "Yenny Paola Hincapié Toro" — MUJER MENOR 50 AÑOS, CC, 35 años
    sourceRow: 'EJEMPLOS!A46',
    caseName: 'GestionNoOrdinarioNuevos2',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL2',
    documentType: 'CC',
    ageYears: 35,
    genderText: 'Mujer',
    expectedCategory: 'NO ORDINARIO',
    admin: 16200,
    reserve: 17760,
    ganancia: 138040,
    planPrice: 172000,
  },
];

/** "$ 125.140" / "125.140" (formato es-CO de CurrencyPipe) -> 125140 */
function parseCopAmount(text: string): number {
  const digitsOnly = text.replace(/[^\d]/g, '');
  return Number(digitsOnly);
}

/** Edad -> fecha de nacimiento (1 de enero de ese año, ya cumplidos los años a la fecha de hoy). */
function birthDateForAge(ageYears: number): string {
  const year = new Date().getFullYear() - ageYears;
  return `${year}-01-01`;
}

test.describe('Precios EJEMPLOS NUEVOS (Planes y Precios ServirPRO.xlsx) — validación end-to-end', () => {
  for (const testCase of PRICING_CASES) {
    test(`${testCase.caseName} (${testCase.sourceRow}): Administración/Reserva/Total coinciden con la hoja EJEMPLOS (bloque Nuevos)`, async ({ page }) => {
      test.setTimeout(150_000);

      // 1) Afiliado de prueba con los datos reales de la fila.
      const affiliatesPage = new AffiliatesPage(page);
      const suffix = Date.now().toString().slice(-6);
      const firstName = `Prueba-${testCase.caseName}`;
      const lastName = `E2E-${suffix}`;
      const documentNumber = randomDocumentNumber();
      const email = randomEmail(firstName);
      const birthDate = birthDateForAge(testCase.ageYears);

      await affiliatesPage.goto();
      await affiliatesPage.openCreateModal();
      await affiliatesPage.fillPersonalData({
        documentNumber,
        firstName,
        lastName,
        email,
        documentType: testCase.documentType,
        birthDate,
        genderText: testCase.genderText,
      });
      await affiliatesPage.openSectionAfiliacion();
      await affiliatesPage.fillAffiliationData({
        planText: testCase.planText,
        agrupadoraText: testCase.agrupadoraText,
      });
      const { id: affiliationId, categoryId } = await affiliatesPage.submitAndGetCreated();
      await affiliatesPage.expectCreatedToastOrModalClosed();

      expect(
        categoryId,
        `El afiliado (edad ${testCase.ageYears}, doc ${testCase.documentType}, plan ${testCase.planText}) debía clasificar en una categoría (esperada: ${testCase.expectedCategory})`,
      ).not.toBeNull();

      // 2) Pago conciliado real (transacción + recibo con amountsMatch=true):
      // esto crea el periodo de facturación del mes actual con
      // isNewTransaction=true automáticamente (ver create-reconciled-transaction.ts).
      const fullName = `${firstName} ${lastName}`;
      await createReconciledTransactionForAffiliate(
        page,
        {
          affiliationId,
          documentType: testCase.documentType,
          documentNumber,
          fullName,
          birthDate: new Date(birthDate).toISOString(),
          plan: testCase.planText,
        },
        testCase.ganancia,
      );

      // 3) Abrir la modal "Enviar a Siigo" para el periodo recién creado y
      // comparar el desglose de precios (bloque Nuevos) contra EJEMPLOS.
      const billingPeriodsPage = new BillingPeriodsPage(page);
      await billingPeriodsPage.goto();
      await billingPeriodsPage.searchWideRange();
      await billingPeriodsPage.waitForTableLoaded(20_000);

      const row = await billingPeriodsPage.findRowByAffiliateNameAcrossPages(fullName);
      await expect(row).toBeVisible({ timeout: 15_000 });
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

      // No se confirma el envío a propósito: este spec solo crea y valida,
      // nunca crea facturas reales en Siigo (igual que pricing-ejemplos.spec.ts).
      await billingPeriodsPage.cancelSend();

      // Pausa entre casos: cada transacción de prueba dispara en el backend
      // un envío a n8n en segundo plano (fire-and-forget, hasta 60s de
      // timeout + reintento) que no se espera desde el test. Si los casos se
      // corren pegados uno tras otro, esas llamadas se acumulan y pueden
      // saturar el servidor (visto en una corrida real: a partir del 8vo caso
      // el backend empezó a fallar/colgarse). Esta espera le da tiempo al
      // backend para ir liberando esas llamadas antes de recibir el siguiente caso.
      await page.waitForTimeout(8_000);
    });
  }
});
