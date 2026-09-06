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
 * GUARDARRAÍL DE CORREOS: aprobar una incapacidad enrutada a Gestión dispara
 * un correo real por n8n. El afiliado del flujo de aprobación se elige
 * explícitamente entre los que NO enrutan a Gestión
 * (IncapacitiesPage.findAffiliateSafeToApprove, fail-closed). Si el ambiente
 * solo tiene afiliados de Gestión, el test se salta en vez de enviar.
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

    // Los otros cuatro soportes son opcionales: adjuntar uno de ellos NO
    // reemplaza al documento de la incapacidad.
    await incapacitiesPage.attach('CERT_BANCARIO', SAMPLE_PDF);

    let posted = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/incapacities')) posted = true;
    });

    await incapacitiesPage.submitFormButton.click();
    await expect(incapacitiesPage.toast('Adjunta el documento de la incapacidad.')).toBeVisible();
    expect(posted, 'no debe enviarse el POST sin el documento de la incapacidad').toBe(false);
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
    await expect(incapacitiesPage.formModal.getByText('1 de 5 adjuntos')).toBeVisible();

    await slot.getByRole('button', { name: 'Quitar Incapacidad' }).click();
    await expect(slot.getByText(SAMPLE_PDF.name)).toHaveCount(0);
    await expect(
      incapacitiesPage.formModal.getByText('Falta el documento de la incapacidad'),
    ).toBeVisible();
  });

  test('CU-01/03/04/36: registra la incapacidad desde la ficha y aparece en el listado', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    const startDate = isoDaysAgo(5);
    const endDate = isoDaysAgo(1);

    await openIncapacityModal(page, affiliate!);
    await incapacitiesPage.fillDates(startDate, endDate);
    // El diagnóstico ya no es texto libre: se busca contra la CIE-10 y se
    // guarda el id. Si el ambiente no tiene la tabla cargada, se radica sin él
    // (es opcional) en vez de fallar el flujo completo de registro.
    await incapacitiesPage.pickDiagnosis('J00');
    // Origen y entidad salen de incapacity_origins / incapacity_entity_types:
    // se elige por posición porque los ids dependen del seed del ambiente.
    await incapacitiesPage.selectFirstCatalogOption('originId');
    await incapacitiesPage.selectFirstCatalogOption('entityTypeId');
    await incapacitiesPage.attach('INCAPACIDAD', SAMPLE_PDF);

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

    // CU-04: el soporte queda tipificado, no suelto.
    await expect(row.getByRole('button', { name: 'Incapacidad' })).toBeVisible();
  });

  // ── C. Estados ──────────────────────────────────────────────────────

  test('CU-18: rechazar exige observación', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    test.skip(!createdIncapacityId, 'Depende de la incapacidad registrada en el test anterior.');

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, isoDaysAgo(5));
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

  test('CU-17/19/21/22/23: aprobar del lado Servirpro enruta según la agrupadora y pasa al tercero a "En proceso"', async ({
    page,
  }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    test.skip(!createdIncapacityId, 'Depende de la incapacidad registrada en el test anterior.');

    const mapping = await incapacitiesPage.getRouteMapping();
    const expectedRoute =
      mapping.find((m) => m.active && Number(m.grouperId) === affiliate!.grouperId)?.route ?? null;

    await incapacitiesPage.goto();
    const row = await incapacitiesPage.findRowAcrossPages(affiliate!.documentNumber, isoDaysAgo(5));
    const updated = await incapacitiesPage.approveServirpro(row);

    // CU-17
    expect(updated.servirproStatus).toBe('APROBADO');

    // CU-21 / CU-23: el destino sale de la agrupadora. Si la agrupadora no
    // tiene ruta configurada (hoy, ORDINARIAS), se aprueba SIN destino y
    // sin fallar — ese es el comportamiento acordado, no un error.
    expect(updated.routedTo ?? null).toBe(expectedRoute);

    // CU-22: al enrutar, el estado del tercero pasa solo a "En proceso".
    // Sin destino no hay tercero a quien mandarlo, así que se queda pendiente.
    expect(updated.thirdPartyStatus).toBe(expectedRoute ? 'EN_PROCESO' : 'PENDIENTE');

    // CU-19: los dos estados se muestran por separado en el listado.
    const refreshed = incapacitiesPage.rowFor(affiliate!.documentNumber, isoDaysAgo(5));
    await expect(refreshed).toContainText('Aprobado');
    if (expectedRoute) {
      await expect(refreshed).toContainText('En proceso');
      await expect(refreshed).toContainText(expectedRoute);
    }
  });

  // ── E/F. Listado ────────────────────────────────────────────────────

  test('CU-33/34: el check de PILA solo aparece en las incapacidades de CYA', async ({ page }) => {
    const incapacitiesPage = new IncapacitiesPage(page);
    await incapacitiesPage.goto();

    // CU-34: el filtro por destino existe y viaja al backend.
    const cyaUrl = await incapacitiesPage.applyFilter('routeFilter', 'CYA');
    expect(cyaUrl).toContain('routedTo=CYA');

    const cyaRows = await incapacitiesPage.rows().count();
    if (cyaRows > 0 && (await incapacitiesPage.rows().first().locator('td').count()) > 1) {
      await expect(
        incapacitiesPage.rows().first().getByRole('button', { name: /PILA/ }),
      ).toBeVisible();
    }

    // En Gestión, la columna PILA dice "No aplica" y no hay botón.
    const gestionUrl = await incapacitiesPage.applyFilter('routeFilter', 'GESTION');
    expect(gestionUrl).toContain('routedTo=GESTION');

    const gestionRows = await incapacitiesPage.rows().count();
    if (gestionRows > 0 && (await incapacitiesPage.rows().first().locator('td').count()) > 1) {
      await expect(incapacitiesPage.rows().first().getByRole('button', { name: /PILA/ })).toHaveCount(0);
      await expect(incapacitiesPage.rows().first()).toContainText('No aplica');
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

    // El roleGuard saca al usuario de la ruta y le dice por qué.
    await expect(page.getByRole('heading', { name: 'Incapacidades' })).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'Tu rol no tiene acceso a esta sección.' })).toBeVisible();
    expect(new URL(page.url()).pathname).not.toBe('/incapacidades');

    await context.close();
  });
});
