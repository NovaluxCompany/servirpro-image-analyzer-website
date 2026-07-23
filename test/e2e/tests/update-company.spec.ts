import { test, expect } from '@playwright/test';
import fs from 'fs';
import { authStateFile } from '../fixtures/credentials';
import { UpdateCompanyPage } from '../pages/update-company.page';
import {
  fillUpdateCompanyTemplate,
  buildFixtureWithBadColumnName,
  generatedFilePath,
} from '../utils/build-update-company-fixture';
import { buildDummyPdf } from '../utils/build-dummy-pdf';
import { randomDocumentNumber } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

/**
 * No necesita datos reales configurados (UPDATE_COMPANY_TEST_DOCUMENTS):
 * por eso vive en su propio describe, fuera del test.skip() del bloque de
 * abajo (que sí depende de esa variable).
 */
test.describe('Actualizar Empresa — validación de archivo', () => {
  test('rechaza un archivo que no es .xlsx (ej. PDF)', async ({ page }) => {
    const updateCompanyPage = new UpdateCompanyPage(page);
    await updateCompanyPage.goto();

    if (!(await updateCompanyPage.isWithinAllowedWindow())) {
      // Regla de negocio real: fuera del día minDay-maxDay el módulo se
      // bloquea por completo. En vez de saltar el test, validamos ESE
      // comportamiento (el único válido hoy) en vez de subir un archivo.
      await updateCompanyPage.expectBlockedByDateWindow();
      return;
    }

    const pdfPath = buildDummyPdf();
    await updateCompanyPage.uploadFile(pdfPath);

    await expect(
      page.getByText('Formato de archivo inválido. Solo se admiten archivos .xlsx')
    ).toBeVisible({ timeout: 10_000 });

    // No debe haber avanzado a la validación/carga real del archivo.
    await expect(page.getByRole('button', { name: 'Procesar actualización' })).toHaveCount(0);
  });

  test('rechaza un .xlsx válido en formato pero con una columna mal nombrada', async ({ page }) => {
    const updateCompanyPage = new UpdateCompanyPage(page);
    await updateCompanyPage.goto();

    if (!(await updateCompanyPage.isWithinAllowedWindow())) {
      await updateCompanyPage.expectBlockedByDateWindow();
      return;
    }

    // Parte de la plantilla REAL (para que solo falle la columna que
    // corrompemos a propósito, no las demás) y le cambia el nombre a la
    // columna "Empresa" por uno inválido (ej. "Compañia").
    const templatePath = await updateCompanyPage.downloadTemplate(
      generatedFilePath(`template-badcol-${Date.now()}.xlsx`)
    );
    const filePath = await buildFixtureWithBadColumnName(
      templatePath,
      [randomDocumentNumber()],
      'EMPRESA DE PRUEBAS QA',
      'Compañia'
    );
    fs.unlinkSync(templatePath);

    try {
      await updateCompanyPage.uploadFile(filePath);
      // El backend ya no reconoce la columna "Empresa" (ahora se llama
      // "Compañia") y la reporta como faltante.
      await updateCompanyPage.expectInvalidFile(/Columna faltante.*Empresa/i);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

});

/**
 * IMPORTANTE: por regla de negocio nunca se sube un archivo con un listado
 * masivo real de afiliados. El .xlsx se arma a partir de la plantilla REAL
 * descargada del módulo (para que los headers coincidan exactamente con lo
 * que valida el backend) con máx. 2 documentos configurados en
 * UPDATE_COMPANY_TEST_DOCUMENTS (test/e2e/.env).
 */
const rawDocuments = process.env.UPDATE_COMPANY_TEST_DOCUMENTS;
const targetCompanyName = process.env.UPDATE_COMPANY_TARGET_NAME ?? 'EMPRESA DE PRUEBAS QA';
const documents = rawDocuments?.split(',').map((d) => d.trim()).filter(Boolean) ?? [];

if (documents.length === 0) {
  throw new Error(
    'Define UPDATE_COMPANY_TEST_DOCUMENTS en test/e2e/.env (1-2 documentos "No Ordinario" existentes) para correr update-company.spec.ts.'
  );
}

test.describe('Actualizar Empresa', () => {
  let filePath: string;

  test.afterEach(() => {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('actualiza empresa de 1-2 afiliados puntuales (no masivo)', async ({ page }) => {
    const updateCompanyPage = new UpdateCompanyPage(page);
    await updateCompanyPage.goto();

    if (!(await updateCompanyPage.isWithinAllowedWindow())) {
      await updateCompanyPage.expectBlockedByDateWindow();
      return;
    }

    const templatePath = await updateCompanyPage.downloadTemplate(
      generatedFilePath(`template-${Date.now()}.xlsx`)
    );
    const rows = documents.slice(0, 2);
    filePath = await fillUpdateCompanyTemplate(templatePath, rows, targetCompanyName);
    fs.unlinkSync(templatePath);

    await updateCompanyPage.uploadFile(filePath);
    await updateCompanyPage.expectValidFile(rows.length);
    await updateCompanyPage.processUpdate();
    await updateCompanyPage.expectExecutionResult();
  });
});
