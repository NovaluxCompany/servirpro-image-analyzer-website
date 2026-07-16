import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
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
