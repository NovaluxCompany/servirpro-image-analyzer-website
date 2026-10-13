/**
 * Saca el celular de la referencia del afiliado y lo devuelve con indicativo
 * (57), que es como se guarda y como lo espera Wasapi. La referencia es
 * texto libre: además del número trae nombres y otras palabras
 * ("MARIA GOMEZ 300 123 4567").
 *
 * Misma lógica que extractWhatsappNumber del backend
 * (src/common/whatsapp-number.util.ts en la API): si cambia una, cambia la otra.
 *
 * Se miran los grupos de dígitos por separado y no todos los dígitos del
 * texto pegados: en "GRUPO 2023 - 3001234567" pegarlos daría un número
 * inventado que arranca con parte del año. Solo si ningún grupo suelto es un
 * celular se reintenta uniendo los que están separados por espacios o
 * guiones ("+57 300 123 4567").
 *
 * Si no hay un celular reconocible devuelve null a propósito: es mejor dejar
 * el campo vacío —y que lo escriban a mano— que adivinar un número y
 * mandarle el certificado a otra persona.
 */
export function extractWhatsappNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  const pick = (value: string): string | null => {
    for (const run of value.match(/\d+/g) ?? []) {
      if (/^(?:57)?3\d{9}$/.test(run)) return run.length === 10 ? `57${run}` : run;
    }
    return null;
  };
  return pick(text) ?? pick(text.replace(/(\d)[\s.()\-+]+(?=\d)/g, '$1'));
}
