import { test, expect, Page } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import {
  IncapacitiesPage,
  SafeAffiliate,
  isoDaysAgo,
  toDisplayDate,
} from '../pages/incapacities.page';
import { AffiliatesPage } from '../pages/affiliates.page';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Módulo de Incapacidades. Cada test dice qué caso de uso cubre (CU-xx de
 * docs/casos-de-uso-incapacidades).
 *
 * GUARDARRAÍL DE CORREOS: aprobar una incapacidad de una agrupadora
 * gestionada por Gestión dispara un correo real por n8n. El afiliado del
 * flujo de aprobación se elige explícitamente entre los que se gestionan por
 * CYA (IncapacitiesPage.findAffiliateSafeToApprove, fail-closed contra
 * `incapacity_grouper_routes`). Si el ambiente no tiene ninguno, el test se
 * salta en vez de enviar. La única excepción, aislada y deliberada, es el
 * describe "Incapacidades — enviar correo a Gestión" del final.
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

/** id de la incapacidad creada por el flujo de registro, compartido por los tests en serie. */
let createdIncapacityId: number | null = null;

/**
 * El backend rechaza con 409 una segunda incapacidad del mismo afiliado con
 * las MISMAS fechas exactas (ver assertNotDuplicate en
 * incapacities.service.ts) — es una regla real anti-duplicados, no un bug.
 * CU-01 crea un registro persistente con fechas fijas; sin este desfase,
 * correr la suite dos veces el mismo día calendario choca con lo que dejó
 * la corrida anterior. Solo se usa en las fechas del registro que CU-01
 * crea y que CU-17/CU-18 reutilizan — el resto de tests de este archivo no
 * persisten nada, así que no lo necesitan.
 */
const RUN_OFFSET_DAYS = 30 + Math.floor(Math.random() * 300);

test.describe('Incapacidades', () => {
  // Los tests comparten datos reales del backend: se corren en serie y el
  // primero que falle no debe arrastrar a los siguientes con datos a medias.
  test.describe.configure({ mode: 'serial' });

  let affiliate: SafeAffiliate | null = null;

  test.beforeEach(async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();
    affiliate ??= await incapacitiesPage.findAffiliateSafeToApprove();
    test.skip(
      !affiliate,
      'No hay ningún afiliado activo cuya agrupadora enrute fuera de Gestión; aprobar dispararía un correo real.',
    );
  });

  // ── A. Registro ─────────────────────────────────────────────────────

  test('CU-02/03/07: el modal muestra el histórico antes del formulario, calcula los días en vivo y bloquea el rango invertido', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    // CU-02: el histórico va ARRIBA del formulario — es lo que permite ver un
    // trámite duplicado antes de radicar, y sirve de poco si hay que buscarlo
    // después de llenarlo.
    const modal = incapacitiesPage.formModal;
    await expect(modal.getByText('Histórico de incapacidades')).toBeVisible();
    // Con incapacidades previas sale la tabla; sin ellas no se pinta y queda
    // solo el aviso. Los dos son estados válidos del histórico cargado.
    await expect(incapacitiesPage.historyLoaded(modal)).toBeVisible();

    const historyBox = await modal.getByText('Histórico de incapacidades').boundingBox();
    const formBox = await modal.getByText('Datos de la incapacidad').boundingBox();
    expect(historyBox!.y, 'el histórico debe renderizarse antes del formulario').toBeLessThan(formBox!.y);

    // CU-03: los días se autocompletan con el rango, en vivo.
    await expect(incapacitiesPage.daysInput).toHaveValue('');
    await incapacitiesPage.fillDates(isoDaysAgo(5), isoDaysAgo(1));
    await expect(incapacitiesPage.daysInput).toHaveValue('5');

    // ...pero el campo es editable, y lo escrito gana sobre el calendario.
    await incapacitiesPage.daysInput.fill('3');
    await expect(
      modal.getByText('El rango de fechas son 5 días. Se guardará el valor que escribiste.'),
    ).toBeVisible();

    // Y cambiar una fecha ya NO pisa lo que el usuario escribió.
    await incapacitiesPage.fillDates(isoDaysAgo(10), isoDaysAgo(1));
    await expect(incapacitiesPage.daysInput).toHaveValue('3');

    // CU-07: la fecha de fin no puede ser anterior a la de inicio.
    await incapacitiesPage.fillDates(isoDaysAgo(1), isoDaysAgo(5));
    await expect(modal.getByText('La fecha de fin no puede ser anterior a la de inicio.')).toBeVisible();

    // Y no deja radicar: el POST ni siquiera sale.
    let posted = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/incapacities')) posted = true;
    });
    await incapacitiesPage.submitFormButton.click();
    await expect(incapacitiesPage.toast('La fecha de fin no puede ser anterior a la de inicio.')).toBeVisible();
    expect(posted, 'no debe enviarse el POST con el rango de fechas invertido').toBe(false);
  });

  test('Origen y entidad que responde se llenan desde la base de datos, no desde el código', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);

    // Si las opciones vinieran quemadas en el componente, este GET no existiría.
    const catalogsRequest = page.waitForResponse(
      (res) => res.url().includes('/incapacities/catalogs') && res.request().method() === 'GET',
    );

    await openIncapacityModal(page, affiliate!);
    const response = await catalogsRequest;
    expect(response.ok(), `GET /incapacities/catalogs falló: ${await response.text()}`).toBe(true);

    const { origins, entityTypes } = await response.json();
    expect(origins.length, 'incapacity_origins no puede estar vacío').toBeGreaterThan(0);
    expect(entityTypes.length, 'incapacity_entity_types no puede estar vacío').toBeGreaterThan(0);

    // Cada <option> del select corresponde a una fila del catálogo (+1 por el placeholder).
    await expect(incapacitiesPage.formModal.locator('#originId option')).toHaveCount(origins.length + 1);
    await expect(incapacitiesPage.formModal.locator('#entityTypeId option')).toHaveCount(
      entityTypes.length + 1,
    );

    // El value es el id de la tabla, no un code de texto: es lo que hace que
    // renombrar una etiqueta no rompa las incapacidades ya guardadas.
    const firstValue = await incapacitiesPage.formModal
      .locator('#originId option')
      .nth(1)
      .getAttribute('value');
    expect(Number(firstValue), 'el value del select debe ser el id de la fila').toBe(origins[0].id);
  });

  test('CU-05: sin el documento de la incapacidad no se puede radicar', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    await incapacitiesPage.fillDates(isoDaysAgo(5), isoDaysAgo(1));

    // Solo AUTORIZACION_PAGO_TERCERO es opcional; los otros tres soportes
    // obligatorios (Historia clínica, Autorización bancaria, Incapacidad)
    // siguen faltando aunque se adjunte el certificado bancario.
    await incapacitiesPage.attach('CERT_BANCARIO', SAMPLE_PDF);

    let posted = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/incapacities')) posted = true;
    });

    await incapacitiesPage.submitFormButton.click();
    await expect(incapacitiesPage.toast('Adjunta los documentos obligatorios antes de guardar.')).toBeVisible();
    expect(posted, 'no debe enviarse el POST sin todos los documentos obligatorios').toBe(false);
  });

  test('CU-06: el front rechaza formato y tamaño antes de subir el archivo', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await openIncapacityModal(page, affiliate!);

    const slot = incapacitiesPage.documentSlot('INCAPACIDAD');

    // Formato no permitido: el backend también lo rechaza, pero enterarse
    // después de subir el archivo entero es la diferencia que importa.
    await incapacitiesPage.attach('INCAPACIDAD', {
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('esto no es un soporte'),
    });
    await expect(slot.getByText('Formato no permitido. Solo PDF, JPG o PNG.')).toBeVisible();

    // Más de 10 MB: se rechaza sin gastar la subida.
    await incapacitiesPage.attach('INCAPACIDAD', {
      name: 'gigante.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(11 * 1024 * 1024, 1),
    });
    await expect(slot.getByText(/El máximo es 10 MB/)).toBeVisible();

    // Uno válido limpia el error y muestra nombre, tamaño y opción de quitarlo.
    await incapacitiesPage.attach('INCAPACIDAD', SAMPLE_PDF);
    await expect(slot.getByText('Formato no permitido. Solo PDF, JPG o PNG.')).toHaveCount(0);
    await expect(slot.getByText(SAMPLE_PDF.name)).toBeVisible();
    // Con solo este soporte todavía faltan los otros tres obligatorios
    // (Historia clínica, Certificado bancario, Autorización bancaria).
    await expect(incapacitiesPage.formModal.getByText('Faltan documentos obligatorios')).toBeVisible();

    await slot.getByRole('button', { name: 'Quitar Incapacidad' }).click();
    await expect(slot.getByText(SAMPLE_PDF.name)).toHaveCount(0);
    await expect(incapacitiesPage.formModal.getByText('Faltan documentos obligatorios')).toBeVisible();
  });

  test('CU-01/03/04/36: registra la incapacidad desde la ficha y aparece en el listado', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const startDate = isoDaysAgo(5 + RUN_OFFSET_DAYS);
    const endDate = isoDaysAgo(1 + RUN_OFFSET_DAYS);

    await openIncapacityModal(page, affiliate!);
    await incapacitiesPage.fillDates(startDate, endDate);
    // El diagnóstico ya no es texto libre: se busca contra la CIE-10 y se
    // guarda el id. Si el ambiente no tiene la tabla cargada, se radica sin él
    // (es opcional) en vez de fallar el flujo completo de registro.
    // Se busca por el código (A001), no por texto libre: la CIE-10 tiene
    // ~14.000 filas y buscar por descripción es ambiguo entre ambientes.
    await incapacitiesPage.pickDiagnosis('A001');
    // Origen y entidad salen de incapacity_origins / incapacity_entity_types:
    // se elige por posición porque los ids dependen del seed del ambiente.
    await incapacitiesPage.selectFirstCatalogOption('originId');
    await incapacitiesPage.selectFirstCatalogOption('entityTypeId');
    // Los cuatro soportes que hoy son obligatorios (ver BASE_SLOTS en
    // incapacity-form-modal.ts) — solo AUTORIZACION_PAGO_TERCERO es opcional.
    await incapacitiesPage.attach('INCAPACIDAD', SAMPLE_PDF);
    await incapacitiesPage.attach('HISTORIA_CLINICA', SAMPLE_PDF);
    await incapacitiesPage.attach('CERT_BANCARIO', SAMPLE_PDF);
    await incapacitiesPage.attach('AUTORIZACION_BANCARIA', SAMPLE_PDF);

    const created = await incapacitiesPage.submitForm();
    createdIncapacityId = created.id;

    // Al guardar, el modal se cierra: el trámite terminó.
    await expect(incapacitiesPage.toast('Incapacidad registrada.')).toBeVisible();
    await expect(incapacitiesPage.formModal).toBeHidden();

    // CU-36: el listado la trae con afiliado, documento, fechas, días y los dos estados.
    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, startDate);
    await expect(row).toContainText(affiliate!.fullName);
    await expect(row).toContainText(toDisplayDate(startDate));
    await expect(row).toContainText(toDisplayDate(endDate));
    await expect(row).toContainText('Pendiente');

    // CU-04: el soporte queda tipificado, no suelto — se ve en el
    // desplegable "..." de soportes, no como chips sueltos en la fila.
    const soportesButton = incapacitiesPage.soportesButton(row);
    await expect(soportesButton).toContainText('4');
    await soportesButton.click();
    await expect(incapacitiesPage.soportesPanel.getByText('Incapacidad', { exact: true })).toBeVisible();
  });

  // ── C. Estados ──────────────────────────────────────────────────────

  test('CU-18: rechazar exige observación', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    test.skip(!createdIncapacityId, 'Depende de la incapacidad registrada en el test anterior.');

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, isoDaysAgo(5 + RUN_OFFSET_DAYS));
    const modal = await incapacitiesPage.openStatusModal(row, 'SERVIRPRO');

    let patched = false;
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes('/servirpro-status')) patched = true;
    });

    await modal.getByRole('radio', { name: 'Rechazado' }).check();
    await expect(modal.getByText(/Observación\s*\*/)).toBeVisible();
    await modal.getByRole('button', { name: 'Guardar' }).click();

    await expect(incapacitiesPage.toast('Escribe el motivo del rechazo en la observación.')).toBeVisible();
    expect(patched, 'no debe enviarse el PATCH sin observación en un rechazo').toBe(false);
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
  });

  test('CU-17/19/21/22/23: aprobar del lado Servirpro enruta según la agrupadora sin mover solo el estado del tercero', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    test.skip(!createdIncapacityId, 'Depende de la incapacidad registrada en el test anterior.');

    // La gestión sale de `incapacity_grouper_routes`, una fila por
    // agrupadora (IncapacityWorkflowService.resolveRoute) — no de una regla
    // derivada del nombre. `affiliate` lo eligió findAffiliateSafeToApprove(),
    // que garantiza que esto da 'CYA' (si no, este test no debería correr).
    const mapping = await incapacitiesPage.getRouteMapping();
    const expectedRoute = IncapacitiesPage.resolveRouteFor(mapping, affiliate!.grouperId);
    expect(expectedRoute, 'el afiliado elegido para este test debe enrutar a CYA, nunca a Gestión').toBe(
      'CYA',
    );

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, isoDaysAgo(5 + RUN_OFFSET_DAYS));
    const updated = await incapacitiesPage.approveServirpro(row);

    // CU-17 — servirproStatus/thirdPartyStatus vienen como el objeto
    // completo del catálogo (id/code/label/...), no como un string suelto.
    expect(updated.servirproStatus.code).toBe('APROBADO');

    // CU-21 / CU-23: el destino sale de la agrupadora, siempre (ya no hay
    // agrupadora "sin ruta configurada": toda agrupadora con nombre resuelve
    // a CYA o a Gestión).
    expect(updated.routedTo ?? null).toBe(expectedRoute);

    // CU-22: aprobar ya NO mueve solo el estado del tercero. Para CYA sigue
    // quedando en "Enviado a CYA" (markSentToCya: la gestión de CYA es
    // justamente cambiar ese estado, no hay tercero externo al que esperar).
    // Para Gestión se queda como estaba: "En proceso" solo llega cuando el
    // correo se entrega, por el botón "Enviar correo". Este test usa siempre
    // un afiliado de ruta CYA (ver expectedRoute arriba).
    const expectedThirdPartyCode = expectedRoute === 'CYA' ? 'ENVIADO_A_CYA' : 'PENDIENTE';
    expect(updated.thirdPartyStatus.code).toBe(expectedThirdPartyCode);

    // CU-19: los dos estados se muestran por separado en el listado.
    const refreshed = incapacitiesPage.rowFor(affiliate!.documentNumber, isoDaysAgo(5 + RUN_OFFSET_DAYS));
    await expect(refreshed).toContainText('Aprobado');
    await expect(refreshed).toContainText(expectedRoute === 'CYA' ? 'Enviado a CYA' : 'Pendiente');
    await expect(refreshed).toContainText(expectedRoute);
  });

  // ── E/F. Listado ────────────────────────────────────────────────────

  test('CU-33/34: el check de PILA solo aparece en las incapacidades gestionadas por CYA', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();

    // El filtro del listado es por AGRUPADORA, no por un "destino": la
    // gestión (CYA / Gestión) se resuelve de la agrupadora, no al revés.
    const mapping = await incapacitiesPage.getRouteMapping();
    const cyaGrouper = mapping.find((m) => m.active && m.route === 'CYA');
    const gestionGrouper = mapping.find((m) => m.active && m.route === 'GESTION');
    test.skip(
      !cyaGrouper || !gestionGrouper,
      'El ambiente no tiene agrupadoras mapeadas a CYA y a Gestión para comparar.',
    );

    // CU-34: el filtro por agrupadora existe y viaja al backend.
    const cyaUrl = await incapacitiesPage.applyFilter('grouperFilter', String(cyaGrouper!.grouperId));
    expect(cyaUrl).toContain(`grouperId=${cyaGrouper!.grouperId}`);

    const cyaRows = await incapacitiesPage.rows().count();
    if (cyaRows > 0 && (await incapacitiesPage.rows().first().locator('td').count()) > 1) {
      const row = incapacitiesPage.rows().first();
      await incapacitiesPage.openDropdown(row);
      await expect(row.getByRole('button', { name: /PILA/ })).toBeVisible();
      await page.keyboard.press('Escape').catch(() => {});
    }

    // En las de Gestión, la columna PILA dice "No aplica" y no hay botón.
    const gestionUrl = await incapacitiesPage.applyFilter(
      'grouperFilter',
      String(gestionGrouper!.grouperId),
    );
    expect(gestionUrl).toContain(`grouperId=${gestionGrouper!.grouperId}`);

    const gestionRows = await incapacitiesPage.rows().count();
    if (gestionRows > 0 && (await incapacitiesPage.rows().first().locator('td').count()) > 1) {
      const row = incapacitiesPage.rows().first();
      await expect(row).toContainText('No aplica');
      await incapacitiesPage.openDropdown(row);
      await expect(row.getByRole('button', { name: /PILA/ })).toHaveCount(0);
    }
  });

  test('CU-37: los filtros de estado y de PILA viajan al backend', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();

    expect(await incapacitiesPage.applyFilter('servirproStatus', 'APROBADO')).toContain(
      'servirproStatus=APROBADO',
    );
    expect(await incapacitiesPage.applyFilter('thirdPartyStatus', 'EN_PROCESO')).toContain(
      'thirdPartyStatus=EN_PROCESO',
    );
    expect(await incapacitiesPage.applyFilter('pilaFilter', 'true')).toContain('registeredInPila=true');
  });

  test('CU-38: la ficha del afiliado abre en "Datos básicos" y no pide el histórico hasta abrir la pestaña', async ({
    page,
  }) => {
    const affiliatesPage = new AffiliatesPage(page);

    const historyRequests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'GET' && /\/incapacities\?.*affiliationId=/.test(req.url())) {
        historyRequests.push(req.url());
      }
    });

    await affiliatesPage.goto();
    await affiliatesPage.searchByName(affiliate!.fullName);
    await affiliatesPage.openRowAction(affiliate!.fullName, 'Ver información');

    const datos = page.getByRole('tab', { name: 'Datos básicos' });
    const incapacidades = page.getByRole('tab', { name: 'Incapacidades' });
    await expect(datos).toHaveAttribute('aria-selected', 'true');
    await expect(incapacidades).toHaveAttribute('aria-selected', 'false');

    // Carga diferida: estando en "Datos básicos" no se pide el histórico.
    await page.waitForTimeout(1_000);
    expect(historyRequests, 'no debe pedirse el histórico mientras la pestaña está cerrada').toHaveLength(0);

    await incapacidades.click();
    await expect(incapacidades).toHaveAttribute('aria-selected', 'true');
    await expect
      .poll(() => historyRequests.length, { message: 'al abrir la pestaña sí debe pedirse el histórico' })
      .toBeGreaterThan(0);

    const infoModal = page.locator('.fixed.inset-0.z-50').filter({ hasText: 'Información del afiliado' });
    await expect(new IncapacitiesPage(page).historyLoaded(infoModal)).toBeVisible();
  });
});

// ── D. Enviar correo a Gestión ──────────────────────────────────────
//
// A diferencia del resto del suite (que a propósito solo usa afiliados de
// agrupadoras gestionadas por CYA, ver el guardarraíl al inicio del
// archivo), este describe SÍ necesita una agrupadora gestionada por Gestión:
// "Enviar correo" solo aplica ahí y, al confirmarlo, dispara un correo real
// por n8n. Se aísla en su propio bloque serial para no mezclar ese envío
// real con el resto de los casos.
test.describe('Incapacidades — enviar correo a Gestión', () => {
  test.describe.configure({ mode: 'serial' });

  let gestionAffiliate: SafeAffiliate | null = null;

  test.beforeEach(async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();
    gestionAffiliate ??= await incapacitiesPage.findAffiliateRoutedToGestion();
    test.skip(
      !gestionAffiliate,
      'No hay ningún afiliado activo cuya agrupadora se gestione por Gestión en este ambiente.',
    );
  });

  test('CU-24: "Enviar correo" envía y, solo si se entrega, aprueba la incapacidad y marca el correo como enviado', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const startDate = isoDaysAgo(3);
    const endDate = isoDaysAgo(1);

    // Radica una incapacidad nueva para el afiliado de Gestión: el botón
    // exige que el correo no se haya enviado todavía (!incapacity.emailSent).
    // Los cuatro soportes obligatorios (ver BASE_SLOTS en
    // incapacity-form-modal.ts) — solo AUTORIZACION_PAGO_TERCERO es opcional.
    await openIncapacityModal(page, gestionAffiliate!);
    await incapacitiesPage.fillDates(startDate, endDate);
    await incapacitiesPage.selectFirstCatalogOption('originId');
    await incapacitiesPage.selectFirstCatalogOption('entityTypeId');
    await incapacitiesPage.attach('INCAPACIDAD', SAMPLE_PDF);
    await incapacitiesPage.attach('HISTORIA_CLINICA', SAMPLE_PDF);
    await incapacitiesPage.attach('CERT_BANCARIO', SAMPLE_PDF);
    await incapacitiesPage.attach('AUTORIZACION_BANCARIA', SAMPLE_PDF);
    await incapacitiesPage.submitForm();
    await expect(incapacitiesPage.toast('Incapacidad registrada.')).toBeVisible();

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(gestionAffiliate!.documentNumber, startDate);

    const updated = await incapacitiesPage.sendEmailAndApprove(row);

    // La aprobación y el emailSent solo llegan si el POST fue exitoso: es la
    // misma llamada atómica, no dos pasos encadenados desde el front.
    // servirproStatus viene como el objeto completo del catálogo (id/code/label/...).
    expect(updated.servirproStatus.code).toBe('APROBADO');
    expect(updated.emailSent).toBe(true);

    // El envío del correo es el ÚNICO punto donde el estado del tercero se
    // mueve solo: aprobar por el modal ya no lo toca (ver applyRouting).
    expect(updated.thirdPartyStatus.code).toBe('EN_PROCESO');
    await expect(incapacitiesPage.toast('Correo enviado y incapacidad aprobada.')).toBeVisible();

    const refreshed = incapacitiesPage.rowFor(gestionAffiliate!.documentNumber, startDate);
    await expect(refreshed).toContainText('Aprobado');
    await expect(refreshed).toContainText('Enviado');

    // Ya enviado, el botón desaparece: no se puede reenviar desde esta acción.
    await incapacitiesPage.openDropdown(refreshed);
    await expect(refreshed.getByRole('button', { name: 'Enviar correo' })).toHaveCount(0);
  });
});

// ── G. Seguridad ──────────────────────────────────────────────────────

test.describe('Incapacidades — seguridad', () => {
  test('CU-12: con permiso, abrir un soporte devuelve una URL firmada temporal', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();

    const target = await incapacitiesPage.findDocumentOfType('INCAPACIDAD');
    test.skip(!target, 'No hay ninguna incapacidad con soportes en este ambiente.');

    const response = await incapacitiesPage.requestDocumentUrl(target!.incapacityId, target!.documentId);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.url, 'la respuesta debe traer una URL firmada').toBeTruthy();
    // La URL firmada es temporal y corta: no es un enlace público permanente.
    expect(body.expiresInSeconds).toBeGreaterThan(0);
    expect(body.expiresInSeconds).toBeLessThanOrEqual(3600);
  });

  test('CU-13/43: un rol sin view_clinical_history no puede abrir la historia clínica', async ({
    browser,
    page,
  }) => {
    // Se ubica un documento real con el rol que sí tiene permiso, para que el
    // 403 sea del PERMISO y no de un id inventado que no existe.
    const admin = new IncapacitiesPage(page);
    await admin.goto();
    const target = await admin.findDocumentOfType('HISTORIA_CLINICA');
    test.skip(!target, 'No hay ninguna historia clínica cargada en este ambiente.');

    const context = await browser.newContext({ storageState: authStateFile('Asesor') });
    const restrictedPage = await context.newPage();
    await restrictedPage.goto('/');

    const restricted = new IncapacitiesPage(restrictedPage);
    const response = await restricted.requestDocumentUrl(target!.incapacityId, target!.documentId);

    expect(
      response.status(),
      `Un rol sin view_clinical_history obtuvo ${response.status()} al pedir la URL de una historia clínica.`,
    ).toBe(403);

    await context.close();
  });

  test('CU-42: un rol sin el menú /incapacidades no entra al módulo', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStateFile('Asesor') });
    const page = await context.newPage();

    await page.goto('/incapacidades');

    // El roleGuard saca al usuario de la ruta y le dice por qué. El
    // router.navigate() de salida es async y corre después del toast, así
    // que se espera explícitamente en vez de leer page.url() al toque.
    await expect(page.getByRole('heading', { name: 'Incapacidades' })).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'Tu rol no tiene acceso a esta sección.' })).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).pathname, {
        message: 'el roleGuard debe navegar fuera de /incapacidades',
        timeout: 10_000,
      })
      .not.toBe('/incapacidades');

    await context.close();
  });
});
