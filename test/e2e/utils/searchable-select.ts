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
  optionText: string | RegExp,
  opts?: { searchText?: string }
): Promise<void> {
  const trigger = fieldContainer(form, labelText).locator('[role="combobox"]');
  await trigger.click();

  // El panel puede no traer TODAS las opciones renderizadas hasta que se
  // escribe algo en el buscador interno (paginado/filtrado por el catálogo).
  // Si optionText es un RegExp exacto (ej. /^EPS$/, para no matchear
  // "EPS+AFP"), hace falta pasar aparte el texto plano a escribir en el
  // buscador — si no, el regex no filtra nada y la opción puede no aparecer.
  const searchBox = page.locator('.ss-dropdown-panel input[placeholder="Buscar..."]');
  if (await searchBox.isVisible().catch(() => false)) {
    const textToType = opts?.searchText ?? (typeof optionText === 'string' ? optionText : '');
    await searchBox.fill(textToType);
  }

  await page.locator('.ss-dropdown-panel li', { hasText: optionText }).first().click();
}

/**
 * Selecciona la primera opción disponible (o, si se pasa `opts.matchText`,
 * la primera opción cuyo texto matchea exactamente ese valor — útil cuando
 * el caso de prueba SÍ necesita un valor específico del catálogo, ej. un
 * Plan/Agrupadora con regla sembrada en siigo_pricing_rules). Devuelve el
 * texto de la opción elegida (para lógica condicional, ej. el Plan
 * determina qué otros campos se vuelven obligatorios).
 *
 * Algunos campos (ej. Departamento, Plan) cierran su panel solos antes de
 * que el catálogo termine de cargar — probablemente por el listener global
 * de scroll/click del componente reaccionando a algo del layout del modal,
 * y está fuera de nuestro control arreglar el componente desde el test. Así
 * que en vez de esperar UNA vez con el panel abierto, se reintenta abrirlo
 * (y volver a escribir en el buscador si aplica) cada segundo mientras no
 * haya opciones reales, hasta agotar `timeoutMs`.
 */
export async function pickFirstSearchableSelectOption(
  page: Page,
  form: Locator,
  labelText: string | RegExp,
  opts?: { timeoutMs?: number; matchText?: string | RegExp; searchText?: string }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 5_000;
  const trigger = fieldContainer(form, labelText).locator('[role="combobox"]');
  const searchBox = page.locator('.ss-dropdown-panel input[placeholder="Buscar..."]');
  const candidateOption = opts?.matchText
    ? page.locator('.ss-dropdown-panel li', { hasText: opts.matchText }).first()
    : page.locator('.ss-dropdown-panel li').filter({ hasNotText: 'Sin resultados' }).first();
  const deadline = Date.now() + timeoutMs;
  // Escribir el texto de búsqueda reinicia el debounce del filtro interno.
  // Si el panel "parpadea" cerrado/abierto (falso negativo de isVisible por
  // una transición CSS) y se reescribe en cada vuelta, el debounce nunca
  // llega a asentarse y la opción jamás aparece dentro de la ventana de esa
  // vuelta — por eso solo se escribe UNA vez, la primera vez que se abre.
  let hasTypedSearch = false;

  while (true) {
    const panelOpen = await page
      .locator('.ss-dropdown-panel')
      .isVisible()
      .catch(() => false);
    if (!panelOpen) {
      await trigger.click();
      if (opts?.searchText && !hasTypedSearch && (await searchBox.isVisible().catch(() => false))) {
        await searchBox.fill(opts.searchText);
        hasTypedSearch = true;
      }
    }

    const remaining = Math.max(500, deadline - Date.now());
    const found = await candidateOption
      .waitFor({ state: 'visible', timeout: Math.min(1_000, remaining) })
      .then(() => true)
      .catch(() => false);

    if (found) {
      const text = (await candidateOption.textContent())?.trim() ?? '';
      await candidateOption.click();
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
