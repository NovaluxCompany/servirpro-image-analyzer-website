import path from 'path';
import dotenv from 'dotenv';

// Igual que fixtures/credentials.ts: los archivos de test se cargan en el
// worker, no en el proceso que lee playwright.config.ts, así que el .env se
// vuelve a leer aquí en vez de asumir que ya está en process.env.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Base de la API contra la que corren los tests.
 *
 * Por defecto apunta al backend local (el mismo valor de
 * src/environments/environment.development.ts, que es el que usa `ng serve`).
 * Se sobreescribe con API_URL en test/e2e/.env para correr contra el backend
 * desplegado sin tocar código.
 */
export const API_URL = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');
