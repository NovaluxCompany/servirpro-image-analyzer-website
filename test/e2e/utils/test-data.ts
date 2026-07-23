/**
 * Genera nombres de afiliado marcados como datos de prueba.
 * Regla de negocio: todo afiliado creado/editado desde e2e debe llevar el
 * prefijo "Prueba-{nombrePrueba}" para poder distinguirlo en Siigo de un
 * afiliado real.
 */
export function testAffiliateName(caseName: string): { firstName: string; lastName: string } {
  const suffix = Date.now().toString().slice(-6);
  return {
    firstName: `Prueba-${caseName}`,
    lastName: `E2E-${suffix}`,
  };
}

export function testFullName(caseName: string): string {
  const { firstName, lastName } = testAffiliateName(caseName);
  return `${firstName} ${lastName}`;
}

export function randomDocumentNumber(): string {
  // 10 dígitos, dentro del rango que acepta el campo (maxlength 11).
  return `9${Math.floor(100000000 + Math.random() * 899999999)}`;
}

export function randomEmail(prefix: string): string {
  return `${prefix.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now()}@e2e-test.local`;
}
