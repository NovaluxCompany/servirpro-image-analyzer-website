import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { testAffiliateName, randomDocumentNumber, randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Cobertura de 5 mejoras pedidas para el módulo de Afiliados:
 *   1) Cabecera "congelada" de la tabla con scroll.
 *   2) Filtro/orden por fecha de ingreso.
 *   3) Desplegable de motivo + observación al deshabilitar.
 *   4) Origen del afiliado (Meta/Web) + fecha de origen.
 *   5) Solo una sección abierta a la vez en crear/editar afiliación.
 *
 * El punto 4 YA está cubierto por affiliates.spec.ts (describe "Afiliados —
 * origen Meta/Web exige fecha de origen"), así que no se duplica aquí.
 *
 * El punto 2 se pidió como "ordenar por fecha de ingreso", pero en el
 * frontend actual no existe un sort real (no hay encabezado clicable ni
 * lógica de ASC/DESC) — lo único implementado es un filtro de rango
 * ("Ingreso desde"/"Ingreso hasta"). Por decisión del usuario, este test
 * cubre ese filtro (que sí existe), no un sort inexistente.
 */
test.describe('Afiliados — cabecera congelada de la tabla', () => {
  test('el encabezado clonado aparece al hacer scroll y desaparece al volver arriba', async ({ page }) => {
    // Viewport reducido a propósito: fuerza que la tabla real necesite
    // scroll de página para salir de vista, sin depender de cuántas filas
    // reales existan en el ambiente.
    await page.setViewportSize({ width: 1280, height: 600 });

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.waitForTableLoaded(20_000);
    // waitForTableLoaded solo espera a que desaparezcan las filas skeleton;
    // las 50 filas reales de la página siguen poblándose un momento después
    // (carga progresiva), así que se espera a que la página sea realmente
    // más alta que el viewport antes de intentar el scroll.
    await expect.poll(() => page.locator('tbody tr').count(), { timeout: 15_000 }).toBeGreaterThan(10);

    expect(await affiliatesPage.isFrozenHeaderVisible()).toBe(false);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // El listener de scroll es pasivo; se espera a que aplique el cambio de estilo.
    await expect.poll(() => affiliatesPage.isFrozenHeaderVisible()).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => affiliatesPage.isFrozenHeaderVisible()).toBe(false);
  });
});

test.describe('Afiliados — filtro por fecha de ingreso', () => {
  test('el rango de fecha de ingreso solo deja filas dentro del rango elegido', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.waitForTableLoaded(20_000);

    const from = '2020-01-01';
    const to = new Date().toISOString().slice(0, 10);

    await affiliatesPage.filterByEntryDateRange(from, to);

    const dates = await affiliatesPage.getVisibleEntryDates();
    // "from"/"to" son YYYY-MM-DD (input type=date); se parsean como fecha
    // LOCAL igual que las filas (new Date('YYYY-MM-DD') las interpreta como
    // medianoche UTC, lo que desfasa la comparación por el huso horario
    // local y produce falsos negativos cerca del límite superior del rango).
    const parseLocalDate = (iso: string): Date => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);

    // El ambiente de pruebas puede no tener afiliados en el rango; si los
    // hay, cada uno debe caer dentro de [from, to] (parseo dd/MM/yyyy -> Date).
    for (const raw of dates) {
      const [day, month, year] = raw.split('/').map(Number);
      const entryDate = new Date(year, month - 1, day);
      expect(entryDate.getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
      expect(entryDate.getTime()).toBeLessThanOrEqual(toDate.getTime());
    }

    await affiliatesPage.clearEntryDateRangeFilter();
  });
});

test.describe('Afiliados — desactivación exige motivo (desplegable) y permite observación', () => {
  let fullName: string | undefined;

  test('crea un afiliado de prueba para desactivar', async ({ page }) => {
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('Desactivar');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({ documentNumber, firstName, lastName, email });
    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData();
    await affiliatesPage.submit();
    await affiliatesPage.expectCreatedToastOrModalClosed();

    fullName = `${firstName} ${lastName}`;
    await affiliatesPage.searchByName(fullName);
    await expect(affiliatesPage.rowByName(fullName)).toBeVisible({ timeout: 15_000 });
  });

  test('sin elegir motivo, la observación queda deshabilitada y no se puede confirmar', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    const modal = await affiliatesPage.openDeactivateModal(fullName!);

    // El desplegable de motivo es obligatorio; la observación (textarea)
    // arranca deshabilitada hasta que se elige un motivo.
    await expect(modal.locator('textarea')).toBeDisabled();

    await modal.getByRole('button', { name: /Sí, deshabilitar/ }).click();
    await expect(modal.getByText('Debes seleccionar un motivo.')).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Desactivar Afiliado' })).toBeVisible(); // el modal no se cerró

    // El select manda el id del catálogo (FK real), no el code: se elige
    // por el label visible ("No pagó"), no por value.
    await modal.locator('select').selectOption({ label: 'No pagó' });
    await expect(modal.locator('textarea')).toBeEnabled();

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('eligiendo motivo y observación, la desactivación se confirma', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    const body = await affiliatesPage.deactivateRowWithReason(
      fullName!,
      'Prueba automatizada: observación al deshabilitar (Playwright).',
      'PLAN_CHANGE'
    );
    // El motivo ahora viaja como reasonTypeId (el id del catálogo
    // deactivation_reasons), no como el code de texto 'PLAN_CHANGE'. El
    // <select> nativo con [(ngModel)] lo manda como string (no number) — el
    // backend lo acepta igual (ver DTOs/inline body de toggleStatus), así
    // que se verifica el valor, no el tipo exacto.
    expect(String(body.reasonTypeId)).toMatch(/^\d+$/);
    expect(body.reason).toBe('Prueba automatizada: observación al deshabilitar (Playwright).');
    await affiliatesPage.expectRowDisabled(fullName!);
  });
});

test.describe('Afiliados — el formulario de crear/editar solo permite una sección abierta', () => {
  test('abrir la Sección de Afiliación cierra la de Datos Personales, y viceversa', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();

    // Al abrir el modal, la Sección 1 (Datos Personales) arranca abierta.
    // Se usa expect.poll (no expect directo) porque el cambio de clase del
    // chevron llega un tick después del click (ciclo de change detection de
    // Angular), y leerla en el mismo instante del click es una carrera real.
    await expect.poll(() => affiliatesPage.isSection1Open()).toBe(true);
    await expect.poll(() => affiliatesPage.isSection2Open()).toBe(false);

    await affiliatesPage.toggleSection2();
    await expect.poll(() => affiliatesPage.isSection2Open()).toBe(true);
    await expect.poll(() => affiliatesPage.isSection1Open()).toBe(false);

    await affiliatesPage.toggleSection1();
    await expect.poll(() => affiliatesPage.isSection1Open()).toBe(true);
    await expect.poll(() => affiliatesPage.isSection2Open()).toBe(false);

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });
});
