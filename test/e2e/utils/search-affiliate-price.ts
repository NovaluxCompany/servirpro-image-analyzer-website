import { Page, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000/api'; // coincide con environment.ts (urlBD)

/**
 * Pega directo a GET /affiliates/search?q=<documento> — el mismo endpoint que
 * usa la pantalla "Nueva transacción" para buscar al afiliado y precargar su
 * "price" (ver AffiliatesPage.searchByReferenceOrCedula, affiliates.service.ts).
 * Es el valor que termina viajando en AffiliateEmbeddedDto.price al crear la
 * transacción, así que es el oráculo correcto para validar contra el Excel de
 * precios en vez de automatizar el formulario de "Nueva transacción" a ciegas.
 */
export async function searchAffiliatePrice(page: Page, documentNumber: string): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const res = await page.request.get(`${API_URL}/affiliates/search?q=${documentNumber}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `No se pudo buscar el afiliado ${documentNumber}: ${await res.text()}`).toBe(true);
  const results = await res.json();
  expect(results.length, `No se encontró ningún afiliado con documento ${documentNumber}`).toBeGreaterThan(0);
  return Number(results[0].price);
}
