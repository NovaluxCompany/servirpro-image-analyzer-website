import { test, expect } from '@playwright/test';
import fs from 'fs';
import { authStateFile } from '../fixtures/credentials';
import { UpdateCompanyPage } from '../pages/update-company.page';
import { fillUpdateCompanyTemplate, generatedFilePath } from '../utils/build-update-company-fixture';

test.use({ storageState: authStateFile('Administrador') });

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

test.describe('Actualizar Empresa', () => {
  test.skip(
    documents.length === 0,
    'Define UPDATE_COMPANY_TEST_DOCUMENTS en test/e2e/.env (1-2 documentos existentes) para correr este spec.'
  );

  let filePath: string;

  test.afterEach(() => {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('actualiza empresa de 1-2 afiliados puntuales (no masivo)', async ({ page }) => {
    const updateCompanyPage = new UpdateCompanyPage(page);
    await updateCompanyPage.goto();

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
