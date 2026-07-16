import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.resolve(__dirname, '../fixtures/generated');

export function generatedFilePath(name: string): string {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  return path.join(GENERATED_DIR, name);
}

/**
 * Rellena la plantilla REAL descargada del módulo (botón "Descargar
 * plantilla") con 1-2 filas de datos, en vez de adivinar los nombres de
 * columna a mano — así los headers siempre coinciden exactamente con lo
 * que valida el backend, sin importar cómo estén escritos.
 *
 * Por regla de negocio: nunca más de 2 filas (nada de cargas masivas
 * reales en un ambiente de pruebas).
 */
export async function fillUpdateCompanyTemplate(
  templatePath: string,
  documentNumbers: string[],
  targetCompanyName: string
): Promise<string> {
  if (documentNumbers.length === 0 || documentNumbers.length > 2) {
    throw new Error(
      'Por regla de negocio, el archivo de prueba de Actualizar Empresa debe tener 1 o 2 filas, no más.'
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.worksheets[0];

  const headerRow = sheet.getRow(1);
  const documentColIndex = findColumnIndex(headerRow, /documento/i);
  const companyColIndex = findColumnIndex(headerRow, /empresa/i);

  if (!documentColIndex || !companyColIndex) {
    throw new Error(
      `No se encontraron las columnas esperadas en la plantilla descargada. Headers: ${JSON.stringify(
        headerRow.values
      )}`
    );
  }

  documentNumbers.forEach((doc, i) => {
    const row = sheet.getRow(2 + i);
    row.getCell(documentColIndex).value = doc;
    row.getCell(companyColIndex).value = targetCompanyName;
    row.commit();
  });

  const outPath = generatedFilePath(`update-company-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(outPath);
  return outPath;
}

function findColumnIndex(headerRow: ExcelJS.Row, pattern: RegExp): number | null {
  let found: number | null = null;
  headerRow.eachCell((cell, colNumber) => {
    if (typeof cell.value === 'string' && pattern.test(cell.value)) {
      found = colNumber;
    }
  });
  return found;
}
