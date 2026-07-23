import fs from 'fs';
import path from 'path';

/**
 * Puente muy simple entre specs: affiliates.spec.ts guarda aquí el nombre
 * completo del afiliado "Prueba-*" que acaba de crear (si la creación salió
 * bien), y deactivate-affiliates.spec.ts lo reutiliza para desactivar ESE
 * mismo registro por nombre exacto, en vez de depender de un prefijo
 * genérico que puede no matchear ningún afiliado "sin pago" del mes actual.
 *
 * Requiere que affiliates.spec.ts corra antes que deactivate-affiliates.spec.ts
 * en la misma ejecución (orden alfabético por defecto de Playwright, y
 * workers:1 / fullyParallel:false en playwright.config.ts garantizan orden
 * secuencial entre archivos). Si no hay estado guardado (por correr el spec
 * suelto, o porque la creación falló), deactivate-affiliates.spec.ts cae de
 * vuelta al prefijo configurado en TEST_DEACTIVATE_AFFILIATE_NAME.
 */
const STATE_DIR = path.resolve(__dirname, '../.state');
const STATE_FILE = path.join(STATE_DIR, 'created-affiliate.json');

export function saveCreatedAffiliateName(fullName: string): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ fullName, createdAt: new Date().toISOString() }));
}

export function loadCreatedAffiliateName(): string | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return typeof data.fullName === 'string' ? data.fullName : null;
  } catch {
    return null;
  }
}
