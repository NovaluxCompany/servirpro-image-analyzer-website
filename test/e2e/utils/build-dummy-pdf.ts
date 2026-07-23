import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.resolve(__dirname, '../fixtures/generated');

/**
 * Genera un .pdf mínimo pero válido (objetos + tabla xref con offsets
 * correctos) para el campo "Documento de identidad" del formulario de
 * afiliados. Es opcional para casi todos los casos, pero obligatorio si la
 * agrupadora elegida resulta ser de tipo "Gestión" — se adjunta siempre
 * para cubrir ambos casos sin depender de qué agrupadora tocó al azar.
 */
export function buildDummyPdf(): string {
  const content = 'BT /F1 18 Tf 20 100 Td (E2E test file) Tj ET\n';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const filePath = path.join(GENERATED_DIR, 'dummy-affiliate-document.pdf');
  fs.writeFileSync(filePath, Buffer.from(pdf, 'latin1'));
  return filePath;
}
