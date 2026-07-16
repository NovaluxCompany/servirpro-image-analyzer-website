import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { DeactivateAffiliatesPage } from '../pages/deactivate-affiliates.page';
import { loadCreatedAffiliateName } from '../utils/shared-state';

test.use({ storageState: authStateFile('Administrador') });

/**
 * IMPORTANTE: este spec nunca debe interactuar con el botón "Inhabilitar
 * todo". Solo prueba la desactivación de 1 registro puntual, para no
 * arriesgar una actualización masiva sobre afiliados reales.
 *
 * Prioridad para elegir el afiliado a desactivar:
 *   1) El nombre EXACTO que creó affiliates.spec.ts en esta misma corrida
 *      (ver utils/shared-state.ts) — se prueba sobre el registro que
 *      realmente se acaba de crear, no uno al azar.
 *   2) Si no hay estado guardado (spec corrido suelto, o la creación
 *      falló), cae de vuelta al PREFIJO en TEST_DEACTIVATE_AFFILIATE_NAME
 *      (test/e2e/.env) y toma la primera fila que matchea.
 *
 * OJO: la lectura va DENTRO del test, no a nivel de módulo — Playwright
 * importa (colecciona) todos los specs antes de ejecutar cualquiera, así
 * que leerla al cargar el archivo vería el estado de una corrida anterior.
 */
test.describe('Desactivar Afiliados', () => {
  test('desactiva el afiliado de prueba (creado en esta corrida o por prefijo)', async ({ page }) => {
    const exactName = loadCreatedAffiliateName();
    const fallbackPrefix = process.env.TEST_DEACTIVATE_AFFILIATE_NAME;
    const target = exactName ?? fallbackPrefix;

    test.skip(
      !target,
      'No hay un afiliado creado en esta corrida ni TEST_DEACTIVATE_AFFILIATE_NAME configurado en test/e2e/.env.'
    );

    const deactivatePage = new DeactivateAffiliatesPage(page);
    await deactivatePage.goto();
    await deactivatePage.searchByName(target!);

    // No es un fallo del test si el afiliado no aparece en "sin pago" del
    // mes actual (pudo quedar excluido por fecha, o ya estar inactivo):
    // se salta en vez de tronar, para no bloquear el resto del suite por
    // datos del ambiente que están fuera de nuestro control.
    const isVisible = await deactivatePage
      .firstRowMatching(target!)
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!isVisible, `No se encontró ningún afiliado "sin pago" que coincida con "${target}".`);

    await deactivatePage.selectFirstRowMatching(target!);
    await deactivatePage.confirmDeactivation();
    await deactivatePage.expectDeactivated(target!);
  });

  test('el botón "Inhabilitar todo" nunca se acciona en pruebas automatizadas', async ({ page }) => {
    // Test de guardarraíl: solo verifica que el botón existe para un admin,
    // pero jamás se hace click en él desde el suite de e2e.
    const deactivatePage = new DeactivateAffiliatesPage(page);
    await deactivatePage.goto();
    const bulkButton = page.getByRole('button', { name: 'Inhabilitar todo' });
    await expect(bulkButton).toBeVisible();
    // Sin .click() intencionalmente.
  });
});
