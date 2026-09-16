import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { AffiliatesPage } from '../pages/affiliates.page';
import { randomDocumentNumber, randomEmail } from '../utils/test-data';
import { searchAffiliatePrice } from '../utils/search-affiliate-price';

test.use({ storageState: authStateFile('Administrador') });

/**
 * Tarifas INDEPENDIENTE tal cual están en PRECIOS INDEPENDIENTES.xlsx (raíz
 * de la carpeta "Servi Pro"), cargadas por
 * sql/new-seed/plans/002_seed_plans_independiente.sql.
 * firstMonthPrice = "PRECIO PRIMER MES / TRAMITE", salePrice = "PRECIO NORMAL".
 *
 * Este spec valida, de punta a punta contra el backend real (no un mock), el
 * valor que queda precargado en la pantalla de crear transacción para un
 * afiliado INDEPENDIENTE: GET /affiliates/search (AffiliatesService.
 * searchByReferenceOrCedula), que es lo que termina viajando como
 * AffiliateEmbeddedDto.price al registrar el pago — el mismo dato que se
 * guarda en transaction_affiliates.price (ver resolveTransactionPrice en el
 * backend, resolve-transaction-price.spec.ts para la validación unitaria de
 * esa función contra las mismas 30 filas del Excel).
 *
 * Por cada plan se crean DOS afiliados de prueba INDEPENDIENTES, separados
 * (no el mismo afiliado cambiando de estado) para que ambos queden visibles
 * al final en la tabla de Afiliados y se puedan inspeccionar a mano:
 *  - "...-Viejo-...": queda tal cual se crea (isNew=false por defecto, ver
 *    CreateAffiliateDto) -> debe cobrar el precio "antiguo"/mensualidad
 *    (sale_price). No se le hace nada más después de crearlo.
 *  - "...-Nuevo-...": se crea y luego se desactiva + reactiva ("Activar" en
 *    el menú de acciones) -> único camino real de UI para que el backend
 *    ponga isNew=true (AffiliatesService.toggle, ver affiliates.service.ts
 *    línea ~2420) -- equivale a un reingreso real. Queda así, con
 *    isNew=true, para poder cobrar el precio "nuevo"/trámite
 *    (first_month_price).
 */
interface IndependientePlanCase {
  name: string;
  firstMonthPrice: number;
  salePrice: number;
}

const INDEPENDIENTE_PLANS: IndependientePlanCase[] = [
  { name: 'AFP', firstMonthPrice: 110000, salePrice: 338000 },
  { name: 'EPS', firstMonthPrice: 152000, salePrice: 265000 },
  { name: 'ARL1', firstMonthPrice: 60000, salePrice: 60000 },
  { name: 'ARL2', firstMonthPrice: 60000, salePrice: 60000 },
  { name: 'ARL3', firstMonthPrice: 60000, salePrice: 60000 },
  { name: 'ARL4', firstMonthPrice: 60000, salePrice: 60000 },
  { name: 'ARL5', firstMonthPrice: 60000, salePrice: 60000 },
  { name: 'EPS+ARL1', firstMonthPrice: 165000, salePrice: 275000 },
  { name: 'EPS+ARL2', firstMonthPrice: 165000, salePrice: 283500 },
  { name: 'EPS+ARL3', firstMonthPrice: 165000, salePrice: 307500 },
  { name: 'EPS+ARL4', firstMonthPrice: 165000, salePrice: 340000 },
  { name: 'EPS+ARL5', firstMonthPrice: 165000, salePrice: 385000 },
  { name: 'EPS+CCF', firstMonthPrice: 165000, salePrice: 300000 },
  { name: 'EPS+AFP', firstMonthPrice: 152000, salePrice: 552000 },
  { name: 'EPS+ARL1+CCF', firstMonthPrice: 193500, salePrice: 310000 },
  { name: 'EPS+ARL2+CCF', firstMonthPrice: 193500, salePrice: 318500 },
  { name: 'EPS+ARL3+CCF', firstMonthPrice: 193500, salePrice: 342500 },
  { name: 'EPS+ARL4+CCF', firstMonthPrice: 193500, salePrice: 375000 },
  { name: 'EPS+ARL5+CCF', firstMonthPrice: 193500, salePrice: 420000 },
  { name: 'EPS+ARL1+AFP', firstMonthPrice: 165000, salePrice: 561000 },
  { name: 'EPS+ARL2+AFP', firstMonthPrice: 165000, salePrice: 570000 },
  { name: 'EPS+ARL3+AFP', firstMonthPrice: 165000, salePrice: 595000 },
  { name: 'EPS+ARL4+AFP', firstMonthPrice: 165000, salePrice: 629000 },
  { name: 'EPS+ARL5+AFP', firstMonthPrice: 165000, salePrice: 674000 },
  { name: 'EPS+CCF+AFP', firstMonthPrice: 193500, salePrice: 587000 },
  { name: 'EPS+ARL1+CCF+AFP', firstMonthPrice: 193500, salePrice: 596000 },
  { name: 'EPS+ARL2+CCF+AFP', firstMonthPrice: 193500, salePrice: 605500 },
  { name: 'EPS+ARL3+CCF+AFP', firstMonthPrice: 193500, salePrice: 630000 },
  { name: 'EPS+ARL4+CCF+AFP', firstMonthPrice: 193500, salePrice: 664000 },
  { name: 'EPS+ARL5+CCF+AFP', firstMonthPrice: 193500, salePrice: 709000 },
];

/** Crea un afiliado INDEPENDIENTE de prueba con el plan dado y devuelve sus datos. */
async function createIndependienteAffiliate(
  page: import('@playwright/test').Page,
  planName: string,
  label: 'Viejo' | 'Nuevo',
): Promise<{ documentNumber: string; fullName: string }> {
  const affiliatesPage = new AffiliatesPage(page);
  const suffix = Date.now().toString().slice(-6);
  const firstName = `Prueba-Independiente-${label}-${suffix}`;
  const lastName = planName.replace(/\+/g, '-');
  const documentNumber = randomDocumentNumber();
  const email = randomEmail(firstName);

  await affiliatesPage.goto();
  await affiliatesPage.openCreateModal();
  await affiliatesPage.fillPersonalData({
    documentNumber,
    firstName,
    lastName,
    email,
    documentType: 'CC',
    birthDate: '1990-01-01',
    genderText: 'Hombre',
  });
  await affiliatesPage.openSectionAfiliacion();
  await affiliatesPage.fillAffiliationData({
    planText: planName,
    affiliateType: 'INDEPENDIENTE',
  });
  await affiliatesPage.submitAndGetCreated();
  await affiliatesPage.expectCreatedToastOrModalClosed();

  return { documentNumber, fullName: `${firstName} ${lastName}` };
}

test.describe('Precios INDEPENDIENTES (PRECIOS INDEPENDIENTES.xlsx) — validación end-to-end', () => {
  for (const planCase of INDEPENDIENTE_PLANS) {
    test(`plan ${planCase.name} — Viejo (mensualidad) cobra el precio normal del excel`, async ({ page }) => {
      test.setTimeout(90_000);

      const { documentNumber } = await createIndependienteAffiliate(page, planCase.name, 'Viejo');

      // Queda tal cual (isNew=false por defecto): no se le hace nada más.
      const price = await searchAffiliatePrice(page, documentNumber);
      expect(price, `Precio "Viejo" del plan ${planCase.name} no coincide con PRECIO NORMAL del excel`).toBe(
        planCase.salePrice,
      );
    });

    test(`plan ${planCase.name} — Nuevo (trámite) cobra el precio primer mes del excel`, async ({ page }) => {
      test.setTimeout(90_000);

      const affiliatesPage = new AffiliatesPage(page);
      const { documentNumber, fullName } = await createIndependienteAffiliate(page, planCase.name, 'Nuevo');

      // Desactivar + reactivar -> backend marca isNew=true (reingreso real) -> cobra trámite. Queda así.
      await affiliatesPage.goto();
      await affiliatesPage.searchByName(fullName);
      await affiliatesPage.deactivateRowWithReason(fullName, 'Prueba E2E de precios independientes', 'CLIENT_REQUEST');
      await affiliatesPage.expectRowDisabled(fullName);
      await affiliatesPage.reactivateRow(fullName);

      const price = await searchAffiliatePrice(page, documentNumber);
      expect(
        price,
        `Precio "Nuevo" del plan ${planCase.name} no coincide con PRECIO PRIMER MES/TRAMITE del excel`,
      ).toBe(planCase.firstMonthPrice);
    });
  }
});
