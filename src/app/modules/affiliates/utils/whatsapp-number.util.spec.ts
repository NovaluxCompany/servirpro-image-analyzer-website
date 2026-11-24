import { describe, it, expect } from 'vitest';
import { composeWhatsappNumber, extractWhatsappNumber, splitWhatsappNumber } from './whatsapp-number.util';

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

describe('splitWhatsappNumber / composeWhatsappNumber', () => {
  it('separa indicativo y número local', () => {
    expect(splitWhatsappNumber('573001234567')).toEqual({ countryCode: '57', localNumber: '3001234567' });
    expect(splitWhatsappNumber('584121234567')).toEqual({ countryCode: '58', localNumber: '4121234567' });
    expect(splitWhatsappNumber('584121234567', '58')).toEqual({ countryCode: '58', localNumber: '4121234567' });
    expect(splitWhatsappNumber(null)).toEqual({ countryCode: '57', localNumber: '' });
  });

  it('usa los indicativos del catálogo, probando primero el más largo', () => {
    expect(splitWhatsappNumber('593991234567', null, ['57', '59', '593'])).toEqual({
      countryCode: '593',
      localNumber: '991234567',
    });
    expect(splitWhatsappNumber('593991234567', '593', ['57'])).toEqual({ countryCode: '593', localNumber: '991234567' });
  });

  it('arma el número con el indicativo elegido sin duplicarlo', () => {
    expect(composeWhatsappNumber('58', '4121234567')).toBe('584121234567');
    expect(composeWhatsappNumber('58', '584121234567')).toBe('584121234567');
    expect(composeWhatsappNumber('57', '300 123 4567')).toBe('573001234567');
    expect(composeWhatsappNumber('57', '')).toBeNull();
  });
});
