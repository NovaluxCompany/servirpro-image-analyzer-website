import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.resolve(__dirname, '../fixtures/generated');

// PNG 1x1 transparente mínimo pero válido (el endpoint POST /transactions
// exige al menos una imagen jpeg/jpg/png real, no cualquier buffer).
const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** Genera un .png mínimo pero válido para adjuntar a una transacción de prueba. */
export function buildDummyImage(): string {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const filePath = path.join(GENERATED_DIR, 'dummy-receipt.png');
  fs.writeFileSync(filePath, Buffer.from(DUMMY_PNG_BASE64, 'base64'));
  return filePath;
}
