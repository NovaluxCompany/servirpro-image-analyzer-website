import { Locator, Page } from '@playwright/test';

/**
 * Ubica el contenedor de un campo a partir de su <label> (texto único
 * dentro del formulario) y sube al padre inmediato — evitar filtrar `div`
 * por hasText: como el texto del label es el PRIMER contenido de varias
 * secciones/grids anidados, ese filtro matchea también los divs ancestro
 * más grandes (que envuelven todos los campos de la sección), y `.first()`
 * en orden de documento devuelve ese ancestro en vez del wrapper puntual.
 */
function fieldContainer(form: Locator, labelText: string | RegExp): Locator {
  const label = form.locator('label', { hasText: labelText }).first();
  return label.locator('xpath=..');
}

/**
 * Interactúa con <app-searchable-select> (modo "select": click para abrir,
 * escribe en el buscador interno, hace click en la opción). El panel de
 * opciones se renderiza con position:fixed fuera del contenedor del campo,
 * así que se busca por texto en toda la página, no dentro del `field`.
 */
export async function pickSearchableSelectOption(
  page: Page,
  form: Locator,
  labelText: string | RegExp,
  optionText: string | RegExp
): Promise<void> {
  const trigger = fieldContainer(form, labelText).locator('[role="combobox"]');
  await trigger.click();

  const searchBox = page.locator('.ss-dropdown-panel input[placeholder="Buscar..."]');
  if (await searchBox.isVisible().catch(() => false)) {
    await searchBox.fill(typeof optionText === 'string' ? optionText : '');
  }

  await page.locator('.ss-dropdown-panel li', { hasText: optionText }).first().click();
}

/**
 * Selecciona la primera opción disponible, útil cuando el caso de prueba no
 * depende del valor exacto del catálogo (solo necesita "algo válido").
 * Devuelve el texto de la opción elegida (para lógica condicional, ej. el
 * Plan determina qué otros campos se vuelven obligatorios).
 *
 * Algunos campos (ej. Departamento) cierran su panel solos antes de que el
 * catálogo termine de cargar — probablemente por el listener global de
 * scroll/click del componente reaccionando a algo del layout del modal, y
 * está fuera de nuestro control arreglar el componente desde el test. Así
 * que en vez de esperar UNA vez con el panel abierto, se reintenta abrirlo
 * cada segundo mientras no haya opciones reales, hasta agotar `timeoutMs`.
 */
export async function pickFirstSearchableSelectOption(
  page: Page,
  form: Locator,
  labelText: string | RegExp,
  opts?: { timeoutMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 5_000;
  const trigger = fieldContainer(form, labelText).locator('[role="combobox"]');
  const realOption = page
    .locator('.ss-dropdown-panel li')
    .filter({ hasNotText: 'Sin resultados' })
    .first();
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const panelOpen = await page
      .locator('.ss-dropdown-panel')
      .isVisible()
      .catch(() => false);
    if (!panelOpen) {
      await trigger.click();
    }

    const remaining = Math.max(500, deadline - Date.now());
    const found = await realOption
      .waitFor({ state: 'visible', timeout: Math.min(1_000, remaining) })
      .then(() => true)
      .catch(() => false);

    if (found) {
      const text = (await realOption.textContent())?.trim() ?? '';
      await realOption.click();
      return text;
    }

    if (Date.now() > deadline) {
      throw new Error(`El campo "${labelText}" no mostró opciones tras ${timeoutMs}ms.`);
    }
  }
}

/**
 * Modo "combobox" (allowFreeText=true): escribe directo en el input.
 */
export async function fillSearchableCombobox(
  form: Locator,
  labelText: string | RegExp,
  value: string
): Promise<void> {
  await fieldContainer(form, labelText).locator('input[type="text"]').fill(value);
}

/**
 * Modo "combobox" (allowFreeText=true, ej. "Referencia"): no tiene
 * [role="combobox"], sino un input de texto + botón "Ver opciones
 * existentes" para desplegar el catálogo. Selecciona la primera opción.
 */
export async function pickFirstComboboxOption(
  page: Page,
  form: Locator,
  labelText: string | RegExp
): Promise<void> {
  await fieldContainer(form, labelText)
    .getByRole('button', { name: 'Ver opciones existentes' })
    .click();
  const firstOption = page.locator('.ss-dropdown-panel li').first();
  await firstOption.waitFor({ state: 'visible' });
  await firstOption.click();
}
