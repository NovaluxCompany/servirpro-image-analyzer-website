import { describe, it, expect } from 'vitest';
import { extractWhatsappNumber } from './whatsapp-number.util';

describe('extractWhatsappNumber', () => {
  it('saca el celular aunque la referencia traiga nombres', () => {
    expect(extractWhatsappNumber('MARIA GOMEZ 3001234567')).toBe('573001234567');
    expect(extractWhatsappNumber('573001234567 - JUAN')).toBe('573001234567');
  });

  it('siempre devuelve el número con indicativo', () => {
    expect(extractWhatsappNumber('3001234567')).toBe('573001234567');
    expect(extractWhatsappNumber('573001234567')).toBe('573001234567');
  });

  it('une el número partido por espacios, guiones o el +', () => {
    expect(extractWhatsappNumber('+57 300 123 4567')).toBe('573001234567');
    expect(extractWhatsappNumber('300-123-4567 PEDRO')).toBe('573001234567');
  });

  it('no mezcla otros números de la referencia con el celular', () => {
    // Pegando todos los dígitos saldría "2023300123..." — un número de nadie.
    expect(extractWhatsappNumber('GRUPO 2023 - 3001234567')).toBe('573001234567');
    expect(extractWhatsappNumber('REF 2-3001234567')).toBe('573001234567');
  });

  it('devuelve null en vez de adivinar cuando no hay celular', () => {
    expect(extractWhatsappNumber('SIN NUMERO')).toBeNull();
    // Fijo, no celular: se deja vacío para escribirlo a mano.
    expect(extractWhatsappNumber('OFICINA 6012345678')).toBeNull();
    expect(extractWhatsappNumber('')).toBeNull();
    expect(extractWhatsappNumber(null)).toBeNull();
    expect(extractWhatsappNumber(undefined)).toBeNull();
  });
});
