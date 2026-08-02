import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { BillingPeriodsPage } from '../pages/billing-periods.page';

test.use({ storageState: authStateFile('Administrador') });

test.describe('Periodos de Facturación', () => {
  test('la página carga con los filtros y el estado inicial "sin búsqueda"', async ({ page }) => {
    const billingPeriodsPage = new BillingPeriodsPage(page);
    await billingPeriodsPage.goto();
    await billingPeriodsPage.expectPromptToSearch();
  });

  test('buscar sin fechas muestra los errores de validación requeridos', async ({ page }) => {
    const billingPeriodsPage = new BillingPeriodsPage(page);
    await billingPeriodsPage.goto();

    await page.getByRole('button', { name: 'Buscar' }).click();

    await billingPeriodsPage.expectDateFromRequiredError();
    await billingPeriodsPage.expectDateToRequiredError();
  });

  test('buscar con un rango de fechas carga la tabla (con datos o vacía)', async ({ page }) => {
    const billingPeriodsPage = new BillingPeriodsPage(page);
    await billingPeriodsPage.goto();
    await billingPeriodsPage.searchWideRange();
    await billingPeriodsPage.waitForTableLoaded(20_000);

    // No se asume que existan datos reales en el ambiente: solo se verifica
    // que, tras buscar, la tabla queda en un estado resuelto (con filas o
    // con el mensaje de "no se encontraron periodos"), nunca en el prompt inicial.
    const rowCount = await billingPeriodsPage.rows().count();
    if (rowCount === 0) {
      await billingPeriodsPage.expectEmptyState();
    } else {
      await expect(billingPeriodsPage.table()).toBeVisible();
    }
  });

  test('filtrar por estado "Enviado" y buscar aplica el filtro sin errores', async ({ page }) => {
    const billingPeriodsPage = new BillingPeriodsPage(page);
    await billingPeriodsPage.goto();
    await billingPeriodsPage.searchWideRange('INVOICED');
    await billingPeriodsPage.waitForTableLoaded(20_000);
    await expect(page.getByText('Error:')).not.toBeVisible();
  });

  test.describe('Modal "Enviar a Siigo"', () => {
    /**
     * Requiere al menos un periodo con hasSiigoMatch=true (botón "Enviar a
     * Siigo" visible) en el ambiente de pruebas dentro del rango buscado.
     * Si no hay ninguno, el test se salta en vez de fallar: es un dato del
     * ambiente fuera de nuestro control, no un defecto del flujo.
     */
    async function openModalOnFirstEligibleRow(page: import('@playwright/test').Page) {
      const billingPeriodsPage = new BillingPeriodsPage(page);
      await billingPeriodsPage.goto();
      await billingPeriodsPage.searchWideRange();
      await billingPeriodsPage.waitForTableLoaded(20_000);

      const row = billingPeriodsPage.rowWithSendToSiigoButton();
      const hasEligibleRow = await row
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!hasEligibleRow, 'No hay ningún periodo con match de pricing Siigo en el rango buscado.');

      await billingPeriodsPage.clickSendToSiigo(row);
      return billingPeriodsPage;
    }

    test('abre la información de precios a enviar a Siigo', async ({ page }) => {
      const billingPeriodsPage = await openModalOnFirstEligibleRow(page);
      await billingPeriodsPage.expectModalVisible();
      await billingPeriodsPage.expectPricingBreakdownVisible();

      // La mora arranca en 0 cada vez que se abre la modal para un periodo nuevo.
      await expect(billingPeriodsPage.moraInput()).toHaveValue('0');
    });

    test('editar la mora recalcula el total a enviar', async ({ page }) => {
      const billingPeriodsPage = await openModalOnFirstEligibleRow(page);
      await billingPeriodsPage.expectModalVisible();
      await billingPeriodsPage.expectPricingBreakdownVisible();

      const totalBefore = await billingPeriodsPage.totalRow().innerText();

      await billingPeriodsPage.setMora(1000);

      // El cambio de mora tiene debounce (400ms) antes de recalcular contra el backend.
      await expect(async () => {
        const totalAfter = await billingPeriodsPage.totalRow().innerText();
        expect(totalAfter).not.toBe(totalBefore);
      }).toPass({ timeout: 10_000 });
    });

    test('cancelar cierra la modal sin enviar ni mostrar el toast de éxito', async ({ page }) => {
      const billingPeriodsPage = await openModalOnFirstEligibleRow(page);
      await billingPeriodsPage.expectModalVisible();
      await billingPeriodsPage.expectPricingBreakdownVisible();

      await billingPeriodsPage.cancelSend();

      await billingPeriodsPage.expectModalHidden();
      await expect(page.getByText('Información enviada a Siigo correctamente')).not.toBeVisible();
    });

    test('confirmar el envío muestra el toast de éxito y cierra la modal (envío simulado, no llama a Siigo)', async ({ page }) => {
      const billingPeriodsPage = await openModalOnFirstEligibleRow(page);
      await billingPeriodsPage.expectModalVisible();
      await billingPeriodsPage.expectPricingBreakdownVisible();

      await expect(billingPeriodsPage.confirmButton()).toBeEnabled();
      await billingPeriodsPage.confirmSend();

      await billingPeriodsPage.expectSendSuccessToast();
      await billingPeriodsPage.expectModalHidden();
    });
  });
});
