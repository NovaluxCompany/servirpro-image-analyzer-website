import { test, expect, Page } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { IncapacitiesPage, SafeAffiliate, isoDaysAgo } from '../pages/incapacities.page';
import { AffiliatesPage } from '../pages/affiliates.page';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Cubre los cambios de la sesión del 2026-09-09 sobre Incapacidades:
 * diagnóstico CIE-10 (restaurado), entidad que emite automática (EPS/ARL) o
 * abierta (AFP), soportes como desplegable "...", columna Estado
 * (Activa/Anulada), modales de confirmación de Eliminar/Anular, el rótulo
 * CYA/Gestión basado en la agrupadora, y prórroga como dato simple (sin
 * elegir incapacidad padre).
 *
 * GUARDARRAÍL DE CORREOS: aprobar una incapacidad de Gestión (o confirmar
 * "Enviar correo") dispara un correo real por n8n. Ningún test de este
 * archivo llega a eso — el flujo completo de "Enviar correo", con su
 * confirmación real, vive aislado en incapacities.spec.ts (describe
 * "Incapacidades — enviar correo a Gestión"). Ver
 * IncapacitiesPage.resolveRouteFor.
 */

/** PDF mínimo válido, generado en memoria: no depende de un archivo del repo. */
const SAMPLE_PDF = {
  name: 'incapacidad-e2e.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n',
    'utf-8',
  ),
};

/** Abre el modal "Enviar a incapacidades" desde el menú de acciones de la ficha. */
async function openIncapacityModal(page: Page, affiliate: SafeAffiliate): Promise<void> {
  const affiliatesPage = new AffiliatesPage(page);
  await affiliatesPage.goto();
  await affiliatesPage.searchByName(affiliate.fullName);
  await affiliatesPage.openRowAction(affiliate.fullName, 'Enviar a incapacidades');
  await expect(page.getByRole('heading', { name: 'Enviar a incapacidades' })).toBeVisible();
}

/**
 * Los cuatro soportes que BASE_SLOTS marca `required: true` en
 * incapacity-form-modal.ts (AUTORIZACION_PAGO_TERCERO es el único opcional).
 * Sin los cuatro, `missingRequired()` bloquea el guardado.
 */
const REQUIRED_DOCUMENT_TYPES = ['INCAPACIDAD', 'HISTORIA_CLINICA', 'CERT_BANCARIO', 'AUTORIZACION_BANCARIA'] as const;

/**
 * Registra una incapacidad mínima (fechas + origen + entidad + los cuatro
 * soportes obligatorios) y devuelve lo necesario para ubicarla en el
 * listado. Cada test que necesita una incapacidad propia llama esto con un
 * rango de fechas distinto, para no chocar con las de otros tests.
 */
/**
 * El backend rechaza con 409 una segunda incapacidad del mismo afiliado con
 * las MISMAS fechas exactas (ver assertNotDuplicate en incapacities.service.ts)
 * — es una regla real anti-duplicados, no un bug. Sin este desfase, correr
 * esta suite dos veces el mismo día calendario choca con lo que dejó la
 * corrida anterior. Es un solo número por ejecución del proceso de test,
 * así que las fechas entre los tests de esta corrida siguen sin superponerse
 * entre sí (cada test ya usa un rango de días distinto).
 */
const RUN_OFFSET_DAYS = 30 + Math.floor(Math.random() * 300);

async function registerMinimalIncapacity(
  page: Page,
  incapacitiesPage: IncapacitiesPage,
  affiliate: SafeAffiliate,
  daysAgoStart: number,
  daysAgoEnd: number,
): Promise<{ id: number; startDate: string; endDate: string }> {
  const startDate = isoDaysAgo(daysAgoStart + RUN_OFFSET_DAYS);
  const endDate = isoDaysAgo(daysAgoEnd + RUN_OFFSET_DAYS);

  await openIncapacityModal(page, affiliate);
  await incapacitiesPage.fillDates(startDate, endDate);
  await incapacitiesPage.selectFirstCatalogOption('originId');
  await incapacitiesPage.selectFirstCatalogOption('entityTypeId');
  for (const type of REQUIRED_DOCUMENT_TYPES) {
    await incapacitiesPage.attach(type, SAMPLE_PDF);
  }

  const created = await incapacitiesPage.submitForm();
  await expect(incapacitiesPage.toast('Incapacidad registrada.')).toBeVisible();

  return { id: created.id, startDate, endDate };
}

function waitForCancelResponse(page: Page) {
  return page.waitForResponse(
    (res) => /\/incapacities\/\d+\/cancel$/.test(res.url()) && res.request().method() === 'PATCH',
  );
}

test.describe('Incapacidades — cambios de esta sesión', () => {
  test.describe.configure({ mode: 'serial' });

  let affiliate: SafeAffiliate | null = null;

  test.beforeEach(async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();
    // El mismo afiliado "seguro" de incapacities.spec.ts: agrupadora
    // gestionada por CYA, que es la que no dispara ningún correo real.
    affiliate ??= await incapacitiesPage.findAffiliateSafeToApprove();
    test.skip(
      !affiliate,
      'No hay ningún afiliado activo cuya agrupadora se gestione por CYA en este ambiente.',
    );
  });

  // ── Diagnóstico (restaurado) ─────────────────────────────────────────

  test('Diagnóstico CIE-10 se busca por código (A001) y sigue siendo opcional', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    await expect(incapacitiesPage.formModal.getByText('Diagnóstico (CIE-10)')).toBeVisible();

    const label = await incapacitiesPage.pickDiagnosis('A001');
    test.skip(!label, 'La tabla CIE-10 no está cargada en este ambiente.');
    expect(label, 'el resultado elegido debe corresponder al código buscado').toContain('A001');
  });

  // ── Entidad que emite ─────────────────────────────────────────────────

  test('Entidad que emite: automática para EPS/ARL (sin campo), abierta solo para AFP', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    await incapacitiesPage.selectEntityTypeByLabel('EPS');
    await expect(incapacitiesPage.issuingEntityInput).toHaveCount(0);

    await incapacitiesPage.selectEntityTypeByLabel('ARL');
    await expect(incapacitiesPage.issuingEntityInput).toHaveCount(0);

    await incapacitiesPage.selectEntityTypeByLabel('AFP');
    await expect(incapacitiesPage.issuingEntityInput).toBeVisible();
    await incapacitiesPage.issuingEntityInput.fill('Porvenir');
    await expect(incapacitiesPage.issuingEntityInput).toHaveValue('Porvenir');
  });

  // ── Prórroga simplificada ─────────────────────────────────────────────

  test('Prórroga es solo otro valor del tipo: no exige elegir una incapacidad para prorrogar', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    await incapacitiesPage.formModal.locator('#type').selectOption('PRORROGA');
    await expect(incapacitiesPage.formModal.getByText('Incapacidad que se prorroga')).toHaveCount(0);
    await expect(incapacitiesPage.formModal.locator('#parentIncapacityId')).toHaveCount(0);
  });

  // ── Soportes: "..." con contador, sin agrandar la fila ───────────────

  test('Soportes: el botón "..." muestra el contador y despliega la lista de documentos', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const { startDate } = await registerMinimalIncapacity(page, incapacitiesPage, affiliate!, 40, 36);

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);

    const button = incapacitiesPage.soportesButton(row);
    await expect(button).toBeVisible();
    // Los 4 soportes obligatorios que registerMinimalIncapacity adjunta.
    await expect(button).toContainText(String(REQUIRED_DOCUMENT_TYPES.length));

    await button.click();
    await expect(incapacitiesPage.soportesPanel).toBeVisible();
    await expect(incapacitiesPage.soportesPanel.getByText('Incapacidad', { exact: true })).toBeVisible();
    await expect(incapacitiesPage.soportesPanel.getByText('Historia clínica')).toBeVisible();
  });

  // ── Columna Estado (Activa/Anulada) + modal de Anular ────────────────

  test('Estado es una columna propia, y Anular pide el motivo en una modal (no un prompt nativo)', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const { startDate } = await registerMinimalIncapacity(page, incapacitiesPage, affiliate!, 35, 31);

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);
    await expect(incapacitiesPage.estadoCell(row)).toHaveText('Activa');

    // No debe usarse window.prompt/confirm nativo del navegador.
    let nativeDialogShown = false;
    page.on('dialog', (dialog) => {
      nativeDialogShown = true;
      dialog.dismiss().catch(() => {});
    });

    const modal = await incapacitiesPage.openCancelModal(row);
    await expect(modal).toContainText('Motivo de la anulación');

    // Sin motivo, no deja anular.
    await modal.getByRole('button', { name: 'Sí, anular' }).click();
    await expect(incapacitiesPage.toast('Escribe el motivo de la anulación.')).toBeVisible();
    await expect(modal).toBeVisible();

    await modal.locator('#cancelReason').fill('Anulada por prueba automatizada (E2E)');
    const [response] = await Promise.all([
      waitForCancelResponse(page),
      modal.getByRole('button', { name: 'Sí, anular' }).click(),
    ]);
    expect(response.ok(), `PATCH cancel falló: ${await response.text()}`).toBe(true);
    expect(nativeDialogShown, 'no debe abrirse ningún diálogo nativo del navegador').toBe(false);

    await expect(modal).toBeHidden();
    await expect(incapacitiesPage.toast('Incapacidad anulada.')).toBeVisible();
    await incapacitiesPage.waitForTableLoaded();

    const refreshed = incapacitiesPage.rowFor(affiliate!.documentNumber, startDate);
    await expect(incapacitiesPage.estadoCell(refreshed)).toHaveText('Anulada');
  });

  // ── Columna Pago ──────────────────────────────────────────────────────

  test('Pago es una columna propia: Pendiente hasta que Servirpro la marque Pagada', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const { startDate } = await registerMinimalIncapacity(page, incapacitiesPage, affiliate!, 30, 26);

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);
    await expect(incapacitiesPage.pagoCell(row)).toHaveText('Pendiente');
  });

  // ── Modal Eliminar ────────────────────────────────────────────────────

  test('Eliminar abre una modal de confirmación del sistema, no el diálogo nativo del navegador', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const { startDate } = await registerMinimalIncapacity(page, incapacitiesPage, affiliate!, 25, 21);

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);

    let nativeDialogShown = false;
    page.on('dialog', (dialog) => {
      nativeDialogShown = true;
      dialog.dismiss().catch(() => {});
    });

    const modal = await incapacitiesPage.openDeleteModal(row);
    await expect(modal).toContainText('Esta acción no se puede deshacer.');
    expect(nativeDialogShown).toBe(false);

    // Cancelar no borra nada.
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
    await expect(incapacitiesPage.rowFor(affiliate!.documentNumber, startDate)).toHaveCount(1);

    // Confirmar sí borra.
    const modal2 = await incapacitiesPage.openDeleteModal(row);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => /\/incapacities\/\d+$/.test(res.url().split('?')[0]) && res.request().method() === 'DELETE',
      ),
      modal2.getByRole('button', { name: 'Sí, eliminar' }).click(),
    ]);
    expect(response.ok(), `DELETE falló: ${await response.text()}`).toBe(true);
    expect(nativeDialogShown, 'no debe abrirse ningún diálogo nativo del navegador').toBe(false);

    await expect(modal2).toBeHidden();
    await expect(incapacitiesPage.toast('Incapacidad eliminada.')).toBeVisible();
    await incapacitiesPage.waitForTableLoaded();
    await expect(incapacitiesPage.rowFor(affiliate!.documentNumber, startDate)).toHaveCount(0);
  });

  // ── Estado CYA/Gestión: rótulo visual por agrupadora, no por routedTo ─

  test('El botón de estado del tercero dice CYA o Gestión según la agrupadora, incluso antes de aprobar', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const { startDate, id } = await registerMinimalIncapacity(page, incapacitiesPage, affiliate!, 20, 16);

    // Antes de aprobar, routedTo es null en el backend — si el rótulo
    // dependiera de routedTo, esto fallaría. Se confirma explícitamente.
    const incapacity = await incapacitiesPage.getIncapacity(id);
    expect(incapacity?.routedTo ?? null, 'esta incapacidad no debe estar enrutada todavía').toBeNull();

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);

    // `affiliate` lo eligió findAffiliateSafeToApprove(): su agrupadora se
    // gestiona por CYA, según incapacity_grouper_routes.
    const mapping = await incapacitiesPage.getRouteMapping();
    const expectedLabel =
      IncapacitiesPage.resolveRouteFor(mapping, affiliate!.grouperId) === 'CYA'
        ? 'Estado CYA'
        : 'Estado Gestión';

    await incapacitiesPage.openDropdown(row);
    await expect(row.getByRole('button', { name: expectedLabel })).toBeVisible();
  });

  // El flujo completo de "Enviar correo" (incluida la confirmación real) vive
  // en incapacities.spec.ts, describe "Incapacidades — enviar correo a
  // Gestión" — ese SÍ dispara un correo real por n8n a propósito, así que se
  // mantiene aislado en su propio describe en vez de duplicarse aquí.
});
