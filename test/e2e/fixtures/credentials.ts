import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

// Carga test/e2e/.env explícitamente (además del .env de la raíz si existe).
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export type RoleName = 'Administrador' | 'Asesor' | 'Pago' | 'CargaAfiliados';

export interface RoleCredentials {
  role: RoleName;
  email: string;
  password: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno "${name}". Copia test/e2e/.env.example a test/e2e/.env y complétala.`
    );
  }
  return value;
}

export const CREDENTIALS: Record<RoleName, RoleCredentials> = {
  Administrador: {
    role: 'Administrador',
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
  },
  Asesor: {
    role: 'Asesor',
    email: requireEnv('ASESOR_EMAIL'),
    password: requireEnv('ASESOR_PASSWORD'),
  },
  Pago: {
    role: 'Pago',
    email: requireEnv('PAGO_EMAIL'),
    password: requireEnv('PAGO_PASSWORD'),
  },
  CargaAfiliados: {
    role: 'CargaAfiliados',
    email: requireEnv('CARGA_AFILIADOS_EMAIL'),
    password: requireEnv('CARGA_AFILIADOS_PASSWORD'),
  },
};

export const AUTH_STATE_DIR = path.resolve(__dirname, '../.auth');

export function authStateFile(role: RoleName): string {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}
