import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { BillingPeriodsPage } from '../pages/billing-periods.page';
import { randomDocumentNumber, randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Casos de precio tomados directamente de "Planes y Precios ServirPRO.xlsx",
 * hoja "EJEMPLOS" — usando las MISMAS variables que trae cada fila (edad,
 * tipo de documento, género, plan) en vez de forzar una categoría a mano.
 * Con esos datos reales, el afiliado de prueba se clasifica solo (mismo
 * camino que un afiliado real) vía AffiliateCategoryClassifierService, y esa
 * categoría real es la que se usa para crear el periodo de facturación — así
 * el test valida el mismo camino que recorre un caso real de principio a fin,
 * no solo el cálculo de precios de forma aislada.
 *
 * Se usan como oráculo de verdad los valores literales de la hoja (columnas
 * ADMIN, RESERVA, GANANCIA) para validar que el desglose de precios que
 * muestra la modal "Enviar a Siigo" (Administración, Reserva, Total a
 * enviar) coincide con lo que el negocio espera para esa combinación real de
 * agrupadora + categoría + plan + edad + tipo de documento.
 *
 * Solo se cubre el bloque MENSUALIDADES (isNewTransaction=false): el periodo
 * de facturación se crea por API (BillingPeriodsPage.createBillingPeriodForAffiliation)
 * y el backend siempre resuelve isNewTransaction automáticamente a partir del
 * historial real de transacciones del cliente (AffiliateBillingPeriodsService.
 * resolveIsNewTransaction) — un afiliado de prueba recién creado no tiene
 * transacciones, así que ese cálculo siempre da isNewTransaction=false. El
 * bloque NUEVOS (profit_new/admin_new/reserve_new) ya está cubierto a nivel
 * unitario en siigo-invoice-payload.builder.spec.ts.
 *
 * "GESTOR" de la hoja (CYA/GESTION) es el nombre histórico de la agrupadora
 * en el Excel; en el sistema las filas "CYA" quedaron reclasificadas bajo la
 * agrupadora "RESOLUCION" (ver memoria del proyecto sobre el seed de
 * siigo_pricing_rules) conservando su "MODELO" original (ORDINARIO o
 * RESOLUCION) — por eso agrupadoraText usa 'RESOLUCION' para los casos "CYA".
 *
 * COBERTURA: las 13 filas MENSUALIDADES "normales" de EJEMPLOS (ver bloque
 * OTHER_VALIDATED_CASES más abajo, comentado) + la fila 41 (GESTION /
 * ORDINARIO / plan "ARL2", caso especial). Las 13 primeras ya se corrieron y
 * pasaron en una ejecución anterior; quedan comentadas (no se ejecutan en
 * cada corrida, para no alargar la suite) pero se dejan en el código como
 * evidencia de que ya se hizo y se validó ese trabajo. Si se necesita
 * volver a correrlas, basta con descomentar el bloque y agregarlo a
 * PRICING_CASES (con spread: `...OTHER_VALIDATED_CASES`).
 *
 * Sobre la fila 41: AffiliateCategoryClassifierService clasifica CUALQUIER
 * afiliado adulto (edad >= 18) con un plan 100% ARL (sin EPS) como
 * RESOLUCION, sin mirar la agrupadora — así que un afiliado GESTION+ARL2 con
 * la edad real de la hoja (27 años) terminaría clasificado RESOLUCION, no
 * ORDINARIO, y sin ninguna regla de pricing GESTION+RESOLUCION+ARL2 que le
 * haga match (solo existe RESOLUCION-grouper+RESOLUCION+ARL2). Para no
 * chocar con esa inconsistencia (que es del clasificador, no del cálculo de
 * precios que este spec quiere validar), este caso usa edad 17 (< 18, esquiva
 * el atajo de RESOLUCION) + documento extranjero CE (dispara ORDINARIO por
 * isOrdinarioByForeignDoc) en vez de la edad/documento reales de la fila —
 * así el afiliado sí llega a categoría ORDINARIO y puede validar la regla
 * GESTION+ORDINARIO+ARL2 que de otra forma sería inalcanzable desde el flujo
 * normal de creación de afiliados.
 */
interface PricingEjemploCase {
  /** Fila de EJEMPLOS y persona ficticia de referencia, solo para trazabilidad. */
  sourceRow: string;
  caseName: string;
  agrupadoraText: 'RESOLUCION' | 'GESTION';
  planText: string;
  documentType: string;
  /** Edad de la columna EDAD de EJEMPLOS -> se traduce a birthDate (1 de enero de ese año). */
  ageYears: number;
  genderText: 'Hombre' | 'Mujer';
  /** Categoría esperada (columna MODELO/CATEGORIA de EJEMPLOS), solo para verificar que el afiliado clasificó como el caso real. */
  expectedCategory: 'ORDINARIO' | 'RESOLUCION' | 'NO ORDINARIO';
  // Valores esperados, tomados literal de la hoja EJEMPLOS (columnas ADMIN, RESERVA, GANANCIA)
  admin: number;
  reserve: number;
  ganancia: number;
  /** Precio real del plan (tabla plans, sale_price ya que isNewTransaction=false en este flujo) — lo que debe mostrar "Valor del plan", NO la ganancia. */
  planPrice: number;
}

// Fila 41: "Julián Esteban Vélez Marín" — SOLO ARL, CC, 27 años (real).
// Edad/documento se cambian a 17 + CE para esquivar el atajo de RESOLUCION
// del clasificador (ver nota arriba) y sí llegar a ORDINARIO, validando la
// regla GESTION+ORDINARIO+ARL2 (id=25 en siigo_pricing_rules).
const ARL2_PURO_CASE: PricingEjemploCase = {
  sourceRow: 'EJEMPLOS!A41',
  caseName: 'GestionOrdinarioArl2Puro',
  agrupadoraText: 'GESTION',
  planText: 'ARL2',
  documentType: 'CE',
  ageYears: 17,
  genderText: 'Hombre',
  expectedCategory: 'ORDINARIO',
  admin: 14000,
  reserve: 6110,
  ganancia: 58590,
  planPrice: 97000,
};

/**
 * Las otras 13 filas MENSUALIDADES "normales" de EJEMPLOS — cubren las 4
 * combinaciones agrupadora+categoría: RESOLUCION/ORDINARIO,
 * RESOLUCION/RESOLUCION, GESTION/ORDINARIO, GESTION/NO ORDINARIO. Ya se
 * habían validado en una ejecución anterior; se reactivaron para correr
 * junto con la fila 41 en PRICING_CASES.
 */
const OTHER_VALIDATED_CASES: PricingEjemploCase[] = [
  {
    // Fila 11: "Édgar Hernán Ospina Duque" — HOMBRE MAYOR 55 AÑOS, CC, 61 años
    sourceRow: 'EJEMPLOS!A11',
    caseName: 'CyaOrdinarioMensualidad',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL5+AFP',
    documentType: 'CC',
    ageYears: 61,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 31990,
    ganancia: 18710,
    planPrice: 533000,
  },
  {
    // Fila 12: "Sandra Milena Ríos Cárdenas" — MUJER MAYOR 50 AÑOS, CC, 55 años
    sourceRow: 'EJEMPLOS!A12',
    caseName: 'CyaOrdinarioMensualidad2',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL2+AFP',
    documentType: 'CC',
    ageYears: 55,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 25695,
    ganancia: 32105,
    planPrice: 436500,
  },
  {
    // Fila 13: "Yeraldine Carolina Pérez Marcano" — VENEZOLANO, PPT, 29 años
    sourceRow: 'EJEMPLOS!A13',
    caseName: 'CyaOrdinarioMensualidad3',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL2',
    documentType: 'PPT',
    ageYears: 29,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 8360,
    ganancia: 65140,
    planPrice: 172000,
  },
  {
    // Fila 14: "Sun Li Chen" — EXTRANJERO, CE, 45 años
    sourceRow: 'EJEMPLOS!A14',
    caseName: 'CyaOrdinarioMensualidad4',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+ARL4',
    documentType: 'CE',
    ageYears: 45,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 11850,
    ganancia: 56750,
    planPrice: 225000,
  },
  {
    // Fila 15: "Mauricio Antonio Betancur Correa" — PAGA PENSIÓN, CC, 57 años
    sourceRow: 'EJEMPLOS!A15',
    caseName: 'CyaOrdinarioMensualidad5',
    agrupadoraText: 'RESOLUCION',
    planText: 'EPS+AFP',
    documentType: 'CC',
    ageYears: 57,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 10000,
    reserve: 24930,
    ganancia: 35670,
    planPrice: 421000,
  },
  {
    // Fila 23: "Wilmer Alexánder Quintero Vargas" — SOLO ARL, CC, 38 años
    sourceRow: 'EJEMPLOS!A23',
    caseName: 'CyaResolucionMensualidad',
    agrupadoraText: 'RESOLUCION',
    planText: 'ARL5',
    documentType: 'CC',
    ageYears: 38,
    genderText: 'Hombre',
    expectedCategory: 'RESOLUCION',
    admin: 10000,
    reserve: 12330,
    ganancia: 46770,
    planPrice: 191000,
  },
  {
    // Fila 36: "Diego Fernando Salazar Ríos" — HOMBRE MAYOR 55 AÑOS, CC, 63 años
    sourceRow: 'EJEMPLOS!A36',
    caseName: 'GestionOrdinarioMensualidad',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL5+CCF',
    documentType: 'CC',
    ageYears: 63,
    genderText: 'Hombre',
    expectedCategory: 'ORDINARIO',
    admin: 14000,
    reserve: 18710,
    ganancia: 32190,
    planPrice: 327000,
  },
  {
    // Fila 37: "Diana Carolina Zuluaga Henao" — MUJER MAYOR 50 AÑOS, CC, 54 años
    sourceRow: 'EJEMPLOS!A37',
    caseName: 'GestionOrdinarioMensualidad2',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL4+CCF+AFP',
    documentType: 'CC',
    ageYears: 54,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 14000,
    reserve: 33540,
    ganancia: 13860,
    planPrice: 558000,
  },
  {
    // Fila 38: "Génesis Valentina Delgado Ríos" — VENEZOLANO, PPT, 31 años
    sourceRow: 'EJEMPLOS!A38',
    caseName: 'GestionOrdinarioMensualidad3',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL1+CCF+AFP',
    documentType: 'PPT',
    ageYears: 31,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 14000,
    reserve: 29345,
    ganancia: 18555,
    planPrice: 491500,
  },
  {
    // Fila 39: "Fernanda Costa Silva" — EXTRANJERO, CE, 44 años
    sourceRow: 'EJEMPLOS!A39',
    caseName: 'GestionOrdinarioMensualidad4',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL3+CCF',
    documentType: 'CE',
    ageYears: 44,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 14000,
    reserve: 13860,
    ganancia: 41240,
    planPrice: 252000,
  },
  {
    // Fila 40: "Gloria Estela Pérez Muñoz" — PAGA PENSIÓN, CC, 58 años
    sourceRow: 'EJEMPLOS!A40',
    caseName: 'GestionOrdinarioMensualidad5',
    agrupadoraText: 'GESTION',
    planText: 'EPS+AFP',
    documentType: 'CC',
    ageYears: 58,
    genderText: 'Mujer',
    expectedCategory: 'ORDINARIO',
    admin: 14000,
    reserve: 24930,
    ganancia: 31670,
    planPrice: 421000,
  },
  {
    // Fila 50: "Sebastián David Arango Cuartas" — HOMBRE MENOR 55 AÑOS, CC, 42 años
    sourceRow: 'EJEMPLOS!A50',
    caseName: 'GestionNoOrdinarioMensualidad',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL4',
    documentType: 'CC',
    ageYears: 42,
    genderText: 'Hombre',
    expectedCategory: 'NO ORDINARIO',
    admin: 16200,
    reserve: 21250,
    ganancia: 173050,
    planPrice: 225000,
  },
  {
    // Fila 51: "Alejandra Marcela Correa Villa" — MUJER MENOR 50 AÑOS, CC, 24 años
    sourceRow: 'EJEMPLOS!A51',
    caseName: 'GestionNoOrdinarioMensualidad2',
    agrupadoraText: 'GESTION',
    planText: 'EPS+ARL1',
    documentType: 'CC',
    ageYears: 24,
    genderText: 'Mujer',
    expectedCategory: 'NO ORDINARIO',
    admin: 16200,
    reserve: 17130,
    ganancia: 115370,
    planPrice: 161000,
  },
];

const PRICING_CASES: PricingEjemploCase[] = [ARL2_PURO_CASE, ...OTHER_VALIDATED_CASES];

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

test.describe('Precios EJEMPLOS (Planes y Precios ServirPRO.xlsx) — validación end-to-end', () => {
  for (const testCase of PRICING_CASES) {
    test(`${testCase.caseName} (${testCase.sourceRow}): Administración/Reserva/Total coinciden con la hoja EJEMPLOS`, async ({ page }) => {
      test.setTimeout(120_000);

      // 1) Afiliado de prueba con los mismos datos de la fila EJEMPLOS: edad,
      // tipo de documento, género, plan y agrupadora — la categoría
      // (ORDINARIO/NO ORDINARIO/RESOLUCION) la decide el backend solo, igual
      // que con un afiliado real.
      const affiliatesPage = new AffiliatesPage(page);
      const suffix = Date.now().toString().slice(-6);
      const firstName = `Prueba-${testCase.caseName}`;
      const lastName = `E2E-${suffix}`;
      const documentNumber = randomDocumentNumber();
      const email = randomEmail(firstName);

      await affiliatesPage.goto();
      await affiliatesPage.openCreateModal();
      await affiliatesPage.fillPersonalData({
        documentNumber,
        firstName,
        lastName,
        email,
        documentType: testCase.documentType,
        birthDate: birthDateForAge(testCase.ageYears),
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

      // 2) Periodo de facturación por API, con la categoría REAL que el
      // backend le asignó al afiliado (no una forzada a mano) — ver nota de
      // la clase sobre por qué este flujo siempre resuelve isNewTransaction=false
      // para un afiliado nuevo.
      const billingPeriodsPage = new BillingPeriodsPage(page);
      const billingPeriodId = await billingPeriodsPage.createBillingPeriodForAffiliation(
        affiliationId,
        categoryId as number,
        testCase.ganancia,
      );

      // Verificación temprana: si la clasificación automática del afiliado no
      // dio la categoría esperada por la fila de EJEMPLOS, falla acá con un
      // mensaje claro en vez de un timeout genérico más adelante esperando el
      // desglose de precios (que nunca aparece si la categoría no coincide con
      // ninguna regla de pricing sembrada).
      const actualCategoryName = await billingPeriodsPage.getCategoryName(billingPeriodId);
      expect(
        actualCategoryName,
        `Categoría real del afiliado no coincide con la esperada por la fila ${testCase.sourceRow} de EJEMPLOS`,
      ).toBe(testCase.expectedCategory);

      // 3) Abrir la modal "Enviar a Siigo" para el periodo recién creado y
      // comparar el desglose de precios contra los valores de la hoja EJEMPLOS.
      const fullName = `${firstName} ${lastName}`;
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
      // "Valor del plan" es el precio real del plan (tabla plans), no la ganancia.
      expect(parseCopAmount(planValueText)).toBe(testCase.planPrice);
      // Total a enviar = GANANCIA (ya parametrizada en siigo_pricing_rules) - descuento afiliado (0, afiliado nuevo sin descuento) - mora (0 al abrir)
      expect(parseCopAmount(totalText)).toBe(testCase.ganancia);

      // No se confirma el envío a propósito (ver billing-periods.spec.ts):
      // este spec valida el cálculo mostrado en pantalla, no crea facturas reales en Siigo.
      await billingPeriodsPage.cancelSend();
    });
  }
});
