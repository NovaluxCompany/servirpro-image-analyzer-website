import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { BillingPeriodsPage } from '../pages/billing-periods.page';
import { testAffiliateName, randomDocumentNumber, randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Este spec, a diferencia de billing-periods.spec.ts, SÍ le da click a
 * "Confirmar envío" y crea una factura real en la cuenta de Siigo conectada
 * al backend de pruebas. Corre siempre, como cualquier otro test de la
 * suite (sin flag de opt-in) — cada `npm run test:e2e` va a crear una
 * factura real en Siigo con el afiliado de prueba "Prueba-EnvioSiigoReal...".
 *
 * Requiere:
 * - Plan "EPS" + Agrupadora "RESOLUCION" con regla sembrada en
 *   siigo_pricing_rules (ver 001_seed_siigo_pricing_rules.sql), que es la
 *   combinación que este test fuerza al crear el afiliado.
 * - siigo_parameters ya sembrado con ids reales de la cuenta de Siigo
 *   (002_seed_siigo_parameters.sql), o el envío fallará igual que le pasó
 *   al equipo mientras se resolvían esos ids uno por uno.
 */
test.describe('Periodos de Facturación — envío real a Siigo', () => {
  test('crea un afiliado "Prueba-", genera su periodo de facturación y lo envía de verdad a Siigo', async ({ page }) => {
    test.setTimeout(180_000);

    // 1) Afiliado de prueba, nombre prefijado "Prueba-" (regla de negocio del
    // equipo para distinguir datos de prueba de datos reales en Siigo).
    // Plan/Agrupadora se fuerzan (no al azar) para garantizar match con
    // siigo_pricing_rules: RESOLUCION + ORDINARIO + EPS + DEPENDIENTE.
    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('EnvioSiigoReal');
    const documentNumber = randomDocumentNumber();
    const email = randomEmail(firstName);

    expect(firstName.startsWith('Prueba-')).toBe(true);

    // EPS + RESOLUCION + edad >= 55 (o AFP) garantiza categoría ORDINARIO, que
    // es la que tiene la regla sembrada en siigo_pricing_rules para este combo.
    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({
      documentNumber,
      firstName,
      lastName,
      email,
      documentType: 'CC',
      birthDate: '1965-01-01',
      genderText: 'Hombre',
    });
    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData({ planText: 'EPS', agrupadoraText: 'RESOLUCION' });
    const { id: affiliationId, categoryId } = await affiliatesPage.submitAndGetCreated();
    await affiliatesPage.expectCreatedToastOrModalClosed();
    expect(categoryId, 'El afiliado de prueba debía clasificar en una categoría real (ORDINARIO) para poder facturarlo').not.toBeNull();

    // 2) Periodo de facturación por API: no existe hoy un botón de UI para
    // aprobar/conciliar un pago y disparar esa creación automáticamente
    // (ver comentario en BillingPeriodsPage.createBillingPeriodForAffiliation).
    const billingPeriodsPage = new BillingPeriodsPage(page);
    await billingPeriodsPage.createBillingPeriodForAffiliation(affiliationId, categoryId as number, 64340);

    // 3) Ubicar el periodo recién creado y enviarlo de verdad a Siigo.
    const fullName = `${firstName} ${lastName}`;
    await billingPeriodsPage.goto();
    await billingPeriodsPage.searchWideRange();
    await billingPeriodsPage.waitForTableLoaded(20_000);

    const row = await billingPeriodsPage.findRowByAffiliateNameAcrossPages(fullName);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await billingPeriodsPage.clickSendToSiigo(row);
    await billingPeriodsPage.expectModalVisible();
    await billingPeriodsPage.expectPricingBreakdownVisible();

    await billingPeriodsPage
      .modal()
      .locator('#observations-input')
      .fill(`Factura de prueba automatizada e2e - ${fullName}`);

    await expect(billingPeriodsPage.confirmButton()).toBeEnabled();
    await billingPeriodsPage.confirmButton().click();

    await expect(page.getByText('Factura creada en Siigo correctamente')).toBeVisible({ timeout: 30_000 });
    await billingPeriodsPage.expectModalHidden();

    // 4) El botón desaparece porque el periodo quedó en estado INVOICED.
    await expect(row.getByRole('button', { name: 'Enviar a Siigo' })).toHaveCount(0);
  });
});
