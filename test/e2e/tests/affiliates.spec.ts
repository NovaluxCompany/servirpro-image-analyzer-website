import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage, AFFILIATE_DOCUMENT_FIXTURES_MULTIPLE } from '../pages/affiliates.page';
import { testAffiliateName, randomDocumentNumber, randomEmail } from '../utils/test-data';
import { saveCreatedAffiliateName, loadCreatedAffiliateName } from '../utils/shared-state';

test.use({ storageState: authStateFile('Administrador') });

test.describe('Afiliados', () => {
  test('crear afiliado de prueba con nombre prefijado "Prueba-"', async ({ page }) => {
    // El catálogo de Departamento/Municipio puede tardar hasta 45s en
    // cargar; se amplía el timeout del test para que le entre ese margen.
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('CrearAfiliado');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    // Regla de negocio: el nombre SIEMPRE debe llevar "Prueba-{nombrePrueba}"
    // para que la sincronización con Siigo distinga estos registros de los reales.
    expect(firstName.startsWith('Prueba-')).toBe(true);

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({ documentNumber, firstName, lastName, email });
    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData();
    await affiliatesPage.submit();
    await affiliatesPage.expectCreatedToastOrModalClosed();

    const fullName = `${firstName} ${lastName}`;
    await affiliatesPage.searchByName(fullName);
    await expect(affiliatesPage.rowByName(fullName)).toBeVisible({ timeout: 15_000 });

    // Si la creación salió bien, deja el nombre exacto disponible para que
    // deactivate-affiliates.spec.ts desactive ESE mismo afiliado.
    saveCreatedAffiliateName(fullName);
  });

  test('buscar afiliado por nombre filtra la tabla', async ({ page }) => {
    // Busca por un nombre que SÍ existe (el que creó el test anterior en
    // esta misma corrida) en vez de uno inventado: así la aserción es sobre
    // "aparece la fila esperada", que es una señal reactiva y confiable, en
    // vez de "no aparece nada" — eso último depende de que el filtro server-side
    // termine de responder antes del assert, lo cual es más frágil de esperar.
    const knownName = loadCreatedAffiliateName();
    test.skip(!knownName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.waitForTableLoaded(20_000);

    await affiliatesPage.searchByName(knownName!);
    await expect(affiliatesPage.rowByName(knownName!)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Afiliados — filtros nuevos (fecha de ingreso / estado de pago)', () => {
  test('filtro por rango de fecha de ingreso muestra estado vacío para un rango sin datos', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.waitForTableLoaded(20_000);

    // Rango angosto y muy futuro: ningún afiliado real debería tener fecha
    // de ingreso ahí, así que el resultado esperado y estable es "sin datos".
    await affiliatesPage.filterByEntryDateRange('2099-01-01', '2099-01-02');
    await expect(affiliatesPage.emptyStateMessage).toBeVisible({ timeout: 15_000 });

    await affiliatesPage.clearEntryDateRangeFilter();
  });

  test('filtro por estado de pago del mes no rompe el listado', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.waitForTableLoaded(20_000);

    await affiliatesPage.filterByPaymentStatus('paid');
    await affiliatesPage.waitForTableLoaded(15_000);

    await affiliatesPage.filterByPaymentStatus('unpaid');
    await affiliatesPage.waitForTableLoaded(15_000);

    await affiliatesPage.filterByPaymentStatus('');
  });
});

/**
 * Flujo encadenado sobre UN mismo afiliado de prueba (creado en el primer
 * test de este describe): Origen del afiliado + documentos múltiples +
 * correo con observación + desactivación con motivo. Se encadena en vez de
 * crear un afiliado por test para que "enviar correo" corra ANTES de
 * "desactivar" (un afiliado inactivo ya no permite enviar correo) y para no
 * pagar 3-4 veces el costo de crear un afiliado completo (catálogos con
 * hasta 45s de carga).
 */
test.describe('Afiliados — flujo: origen, documentos múltiples, correo con observación y desactivación con motivo', () => {
  test.describe.configure({ mode: 'serial' });
  let fullName: string | undefined;

  test('crea un afiliado con Origen "Referido" y varios documentos adjuntos', async ({ page }) => {
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('FlujoNuevo');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({ documentNumber, firstName, lastName, email });
    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData({
      referralType: 'REFERIDO',
      documentFiles: AFFILIATE_DOCUMENT_FIXTURES_MULTIPLE,
    });
    await affiliatesPage.submit();
    await affiliatesPage.expectCreatedToastOrModalClosed();

    fullName = `${firstName} ${lastName}`;
    await affiliatesPage.searchByName(fullName);
    await expect(affiliatesPage.rowByName(fullName)).toBeVisible({ timeout: 15_000 });
  });

  test('el "Origen del afiliado" queda guardado y se refleja al reabrir en edición', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    await affiliatesPage.openEditForRow(fullName!);
    await expect(page.getByRole('heading', { name: 'Editar Afiliado', level: 2 })).toBeVisible();
    // El modal de edición también arranca con solo la Sección 1 abierta
    // (acordeón: una sola sección visible a la vez), así que hay que abrir
    // la Sección 2 para que el campo "Origen del afiliado" exista en el DOM.
    await affiliatesPage.openSectionAfiliacion();
    await expect.poll(() => affiliatesPage.getReferralTypeValue()).toBe('REFERIDO');
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('los varios documentos adjuntados quedan disponibles en "Ver documentos"', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    await affiliatesPage.openDocumentsForRow(fullName!);
    await expect(affiliatesPage.documentRows()).toHaveCount(2);
  });

  test('desactivar con motivo deja al afiliado como Deshabilitado', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    await affiliatesPage.deactivateRowWithReason(
      fullName!,
      'Prueba automatizada: motivo de desactivación (Playwright).'
    );
    await affiliatesPage.expectRowDisabled(fullName!);
  });
});

/**
 * Flujo del origen "Meta"/"Web": la fecha de origen es obligatoria solo para
 * esos dos orígenes, y (igual que el propio origen) solo se puede editar
 * mientras el afiliado está desactivado. Se encadena sobre un mismo afiliado
 * por el mismo motivo que el describe anterior: evitar pagar 2-3 veces el
 * costo de crear un afiliado completo.
 */
test.describe('Afiliados — origen Meta/Web exige fecha de origen', () => {
  test.describe.configure({ mode: 'serial' });
  let fullName: string | undefined;
  const originDate = '2026-01-15';

  test('el botón de guardar queda deshabilitado si el origen es Meta y falta la fecha de origen', async ({ page }) => {
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('OrigenMeta');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({ documentNumber, firstName, lastName, email });
    await affiliatesPage.openSectionAfiliacion();
    // No se pasa originDate a propósito: fillAffiliationData solo selecciona
    // el origen "META" y deja la fecha de origen vacía.
    const form = page.locator('form');
    await affiliatesPage.fillAffiliationData();
    await form.locator('select[formcontrolname="referralType"]').selectOption('META');
    await expect(form.locator('input[formcontrolname="originDate"]')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Crear afiliado' })).toBeDisabled();
  });

  test('crea un afiliado con Origen "Meta" y fecha de origen', async ({ page }) => {
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('OrigenMeta');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({ documentNumber, firstName, lastName, email });
    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData({ referralType: 'META', originDate });
    await affiliatesPage.submit();
    await affiliatesPage.expectCreatedToastOrModalClosed();

    fullName = `${firstName} ${lastName}`;
    await affiliatesPage.searchByName(fullName);
    await expect(affiliatesPage.rowByName(fullName)).toBeVisible({ timeout: 15_000 });
  });

  test('la fecha de origen queda guardada pero NO editable mientras el afiliado está activo', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    await affiliatesPage.openEditForRow(fullName!);
    await expect(page.getByRole('heading', { name: 'Editar Afiliado', level: 2 })).toBeVisible();
    // Ver comentario en el test anterior: la Sección 2 arranca cerrada en edición.
    await affiliatesPage.openSectionAfiliacion();

    await expect.poll(() => affiliatesPage.getReferralTypeValue()).toBe('META');
    await expect.poll(() => affiliatesPage.getOriginDateValue()).toBe(originDate);
    await expect(page.locator('form').locator('input[formcontrolname="originDate"]')).toBeDisabled();

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('desactivar el afiliado habilita de nuevo la edición de la fecha de origen', async ({ page }) => {
    test.skip(!fullName, 'Corre primero el test de creación en esta misma corrida.');

    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.searchByName(fullName!);
    await affiliatesPage.deactivateRowWithReason(
      fullName!,
      'Prueba automatizada: motivo de desactivación (Playwright).'
    );
    await affiliatesPage.expectRowDisabled(fullName!);

    await affiliatesPage.openEditForRow(fullName!);
    await expect(page.getByRole('heading', { name: 'Editar Afiliado', level: 2 })).toBeVisible();
    await affiliatesPage.openSectionAfiliacion();
    const originDateInput = page.locator('form').locator('input[formcontrolname="originDate"]');
    await expect(originDateInput).toBeEnabled();

    const newOriginDate = '2026-02-20';
    await originDateInput.fill(newOriginDate);

    const [response] = await Promise.all([
      page.waitForResponse((res) => /\/affiliates\/\d+(\?.*)?$/.test(res.url()) && res.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Guardar cambios' }).click(),
    ]);
    expect(response.ok()).toBe(true);
  });
});
