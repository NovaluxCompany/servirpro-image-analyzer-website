import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { testAffiliateName, randomDocumentNumber, randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Campo "WhatsApp certificados" (clients.whatsapp_number).
 *
 * Los certificados se cargan por cédula, pero el WhatsApp ya no sale al
 * celular personal del afiliado sino a este campo, que se alimenta de la
 * Referencia — texto libre que trae el número junto con nombres y otras
 * palabras, y que puede repetirse entre afiliados.
 *
 * Reglas que se prueban acá:
 *   1) Escribir la Referencia deja en el campo solo el número + indicativo.
 *   2) Un número escrito a mano manda: cambiar la Referencia ya no lo pisa.
 *   3) El número se guarda y se ve al volver a editar el afiliado.
 *
 * El caso 3 crea un afiliado real, así que necesita la API de esta rama
 * corriendo (con sql/new-seed/clients/00-migration-add-whatsapp-number-to-clients.sql
 * ya aplicado). Contra una API sin la columna, el backend rechaza el campo
 * `whatsappNumber` por forbidNonWhitelisted y la creación falla.
 */

/** Referencias tal como las escribe el negocio -> número que debe quedar. */
const REFERENCIAS: Array<{ referencia: string; esperado: string; porQue: string }> = [
  { referencia: 'MARIA GOMEZ 3001234567', esperado: '573001234567', porQue: 'nombre + celular' },
  { referencia: '573001234567 - JUAN', esperado: '573001234567', porQue: 'ya trae indicativo' },
  { referencia: '+57 300 123 4567', esperado: '573001234567', porQue: 'partido por espacios y +' },
  {
    referencia: 'GRUPO 2023 - 3001234567',
    esperado: '573001234567',
    porQue: 'otro número en la referencia no se mezcla con el celular',
  },
  { referencia: 'SIN NUMERO', esperado: '', porQue: 'sin celular no se inventa nada' },
];

test.describe('Afiliados — WhatsApp de certificados sale de la referencia', () => {
  test('la referencia deja en el campo solo el número, con indicativo', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();

    // El campo arranca vacío y nadie lo ha tocado, así que cada referencia
    // que se escribe vuelve a recalcularlo (por eso sirve el mismo modal
    // para todos los casos).
    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('');

    for (const { referencia, esperado, porQue } of REFERENCIAS) {
      await affiliatesPage.fillReference(referencia);
      await expect(affiliatesPage.whatsappNumberInput, `${referencia} (${porQue})`).toHaveValue(esperado);
    }

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('un número escrito a mano no lo pisa cambiar la referencia', async ({ page }) => {
    const affiliatesPage = new AffiliatesPage(page);
    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();

    await affiliatesPage.fillReference('MARIA GOMEZ 3001234567');
    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('573001234567');

    // Corrección manual: de acá en adelante el campo es del usuario.
    await affiliatesPage.whatsappNumberInput.fill('573009998877');
    await affiliatesPage.fillReference('PEDRO PEREZ 3105554433');

    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('573009998877');

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('el número se guarda y sigue ahí al volver a editar el afiliado', async ({ page }) => {
    test.setTimeout(120_000);

    const affiliatesPage = new AffiliatesPage(page);
    const { firstName, lastName } = testAffiliateName('WhatsAppCert');
    const fullName = `${firstName} ${lastName}`;

    await affiliatesPage.goto();
    await affiliatesPage.openCreateModal();
    await affiliatesPage.fillPersonalData({
      documentNumber: randomDocumentNumber(),
      firstName,
      lastName,
      email: randomEmail(firstName),
      reference: 'PRUEBA E2E 3001234567',
    });
    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('573001234567');

    await affiliatesPage.openSectionAfiliacion();
    await affiliatesPage.fillAffiliationData();
    await affiliatesPage.submit();
    await affiliatesPage.expectCreatedToastOrModalClosed();

    await affiliatesPage.searchByName(fullName);
    await expect(affiliatesPage.rowByName(fullName)).toBeVisible({ timeout: 15_000 });
    await affiliatesPage.openEditForRow(fullName);

    // Viene del backend ya normalizado (solo dígitos, con indicativo).
    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('573001234567', { timeout: 30_000 });

    // Un número ya guardado cuenta como puesto a mano: cambiar la referencia
    // en edición no lo reemplaza (decisión "solo si está vacío").
    await affiliatesPage.fillReference('OTRA REFERENCIA 3105554433');
    await expect(affiliatesPage.whatsappNumberInput).toHaveValue('573001234567');

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });
});
