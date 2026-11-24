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

/**
 * Indicativos del desplegable junto a "WhatsApp certificados". La lista real
 * sale de la tabla whatsapp_country_codes (GET /whatsapp-country-codes/dropdown);
 * agregar un país es insertar una fila allí. Esta lista fija solo se usa
 * mientras carga el catálogo o si la consulta falla.
 */
export type WhatsappCountryCode = string;
export const DEFAULT_WHATSAPP_COUNTRY_CODE: WhatsappCountryCode = '57';

export interface WhatsappCountryOption {
  value: WhatsappCountryCode;
  label: string;
}

export const WHATSAPP_COUNTRY_OPTIONS: WhatsappCountryOption[] = [
  { value: '57', label: '+57 Colombia' },
  { value: '58', label: '+58 Venezuela' },
];

/** Convierte una fila del catálogo en opción del desplegable. */
export function toWhatsappCountryOption(row: { code: string; country: string }): WhatsappCountryOption {
  return { value: row.code, label: `+${row.code} ${row.country}` };
}

/**
 * Separa un número guardado (siempre con indicativo, ej. 584121234567) en
 * indicativo + número local, para precargar el desplegable y el campo.
 *
 * countryCode es el que ya detectó el backend contra el catálogo; si no
 * llega, se busca en knownCodes probando primero el más largo ('593'
 * Ecuador antes que '59').
 */
export function splitWhatsappNumber(
  value: string | null | undefined,
  countryCode?: string | null,
  knownCodes: readonly string[] = WHATSAPP_COUNTRY_OPTIONS.map((o) => o.value),
): { countryCode: WhatsappCountryCode; localNumber: string } {
  const digits = (value ?? '').replace(/\D/g, '');
  const known = [...knownCodes].sort((a, b) => b.length - a.length);
  const code =
    (countryCode && /^\d{1,4}$/.test(countryCode) ? countryCode : null) ??
    known.find((c) => digits.length > 10 && digits.startsWith(c)) ??
    DEFAULT_WHATSAPP_COUNTRY_CODE;
  const localNumber = digits.length > 10 && digits.startsWith(code) ? digits.slice(code.length) : digits;
  return { countryCode: code, localNumber };
}

/**
 * Arma el número que se envía al backend: solo dígitos con el indicativo
 * elegido adelante. Si ya lo trae (más de 10 dígitos que arrancan por el
 * indicativo) no se duplica. Misma regla que normalizeWhatsappNumber del
 * backend. Vacío → null.
 */
export function composeWhatsappNumber(countryCode: string, value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length > 10 && digits.startsWith(countryCode)) return digits;
  return `${countryCode}${digits}`;
}
