import { ACTIVITIES, VARIABLES, answersFor, emptyEntry, hasContent, localDate, moodScore, normalizeEntry, validDate, type DayEntry } from './model';
import type { Cell, CellValue, Row } from 'exceljs';

const clean = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');
function readCell(cell: Cell): unknown {
  // ExcelJS omite result: 0 del objeto .value; el getter .result sí lo conserva.
  if (cell.type === 6 && cell.result !== undefined) return cell.result;
  return cellValue(cell.value);
}
function cellValue(value: CellValue): unknown {
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('richText' in value) return value.richText.map(v => v.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}
function dateValue(value: unknown): string | null {
  if (value instanceof Date) return localDate(new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12));
  if (typeof value === 'number') return dateValue(new Date(Date.UTC(1899, 11, 30) + value * 86400000));
  if (typeof value !== 'string') return null;
  const iso = value.slice(0, 10);
  if (validDate(iso)) return iso;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const formatted = match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
  return validDate(formatted) ? formatted : null;
}
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' || typeof value === 'boolean') throw new Error('Una celda contiene una fórmula sin resultado o un valor no numérico. Guarda primero el Excel.');
  const number = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  if (!Number.isFinite(number)) throw new Error('El archivo contiene un número inválido.');
  return number;
}
export async function importFile(file: File): Promise<DayEntry[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo debe pesar menos de 10 MB.');
  let entries: DayEntry[];
  if (/\.json$/i.test(file.name)) {
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Selecciona una copia de respaldo de Honor.');
    if (data.entries.length > 10000) throw new Error('El respaldo supera los 10 000 registros.');
    entries = data.entries.map(normalizeEntry);
  } else if (/\.xlsx$/i.test(file.name)) entries = await importExcel(await file.arrayBuffer());
  else throw new Error('Selecciona un archivo .xlsx o un respaldo .json.');
  const byDate = new Map<string, DayEntry>();
  for (const entry of entries) {
    if (byDate.has(entry.date)) throw new Error(`El archivo tiene dos registros para ${entry.date}. Revísalos antes de importar.`);
    byDate.set(entry.date, entry);
  }
  return [...byDate.values()].filter(hasContent).sort((a, b) => a.date.localeCompare(b.date));
}
export async function importExcel(buffer: ArrayBuffer): Promise<DayEntry[]> {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Estado_Animo');
  if (!sheet) throw new Error('No se encontró la hoja Estado_Animo.');
  if (sheet.rowCount > 10001) throw new Error('El Excel supera los 10 000 registros.');
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => columns.set(clean(readCell(cell)), col));
  for (const name of ['Fecha', ...VARIABLES.map(v => v.excel), 'Peso']) {
    if (!columns.has(name)) throw new Error(`Falta la columna ${name}.`);
  }
  const read = (row: Row, name: string) => readCell(row.getCell(columns.get(name)!));
  const entries: DayEntry[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const rawDate = read(row, 'Fecha');
    const date = dateValue(rawDate);
    if (!date) {
      if (rawDate !== null && rawDate !== undefined && rawDate !== '') throw new Error(`Fecha inválida en la fila ${index}.`);
      return;
    }
    const entry = emptyEntry(date);
    entry.productivityMode = 'manual';
    for (const v of VARIABLES) entry.answers[v.id] = numeric(read(row, v.excel));
    entry.weight = numeric(read(row, 'Peso'));
    if (columns.has('Notas')) entry.notes = clean(read(row, 'Notas')).slice(0, 2000);
    // Los enlaces de productividad devuelven 0 en las filas futuras vacías.
    const realState = VARIABLES.some(v => v.id !== 'productivity' && entry.answers[v.id] !== null) || (entry.answers.productivity !== null && entry.answers.productivity !== 0);
    if (!realState) entry.answers.productivity = null;
    if (hasContent(entry)) entries.push(normalizeEntry(entry));
  });
  const activitySheet = book.getWorksheet('Productividad');
  if (activitySheet) {
    let activityCols = new Map<string, number>();
    activitySheet.eachRow((row, index) => {
      const first = clean(readCell(row.getCell(1)));
      if (first === 'Fecha') {
        const next = new Map<string, number>();
        row.eachCell((cell, col) => next.set(clean(readCell(cell)), col));
        // En el archivo original Meditar es el resultado de una fórmula matricial.
        if (!next.has('Meditar') && next.has('Leer') && index > 1) next.set('Meditar', 2);
        if (ACTIVITIES.every(a => next.has(a.excel))) activityCols = next;
        return;
      }
      if (!activityCols.size) return;
      const date = dateValue(readCell(row.getCell(1)));
      const entry = entries.find(e => e.date === date);
      if (!entry) return;
      for (const a of ACTIVITIES) entry.activities[a.id] = numeric(readCell(row.getCell(activityCols.get(a.excel)!)));
      // Mantener el valor original de productividad; el usuario puede elegir recalcularlo.
      normalizeEntry(entry);
    });
  }
  return entries;
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function exportBackup(entries: DayEntry[]) {
  download(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' }), `honor-respaldo-${localDate()}.json`);
}
export async function exportExcel(entries: DayEntry[]) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  const sheet = book.addWorksheet('Estado_Animo');
  sheet.addRow(['N', 'Fecha', ...VARIABLES.map(v => v.excel), 'EStado de animo', 'Porcentaje de estado', 'Peso', 'Notas']);
  entries.forEach((entry, index) => {
    const answers = answersFor(entry); const score = moodScore(entry);
    sheet.addRow([index + 1, entry.date, ...VARIABLES.map(v => answers[v.id]), score === null ? null : score * 3, score, entry.weight, entry.notes]);
  });
  sheet.columns.forEach(c => { c.width = 22; }); sheet.getRow(1).font = { bold: true };
  const activities = book.addWorksheet('Productividad');
  activities.addRow(['Fecha', ...ACTIVITIES.map(a => a.excel), 'Productividad']);
  for (const entry of entries) activities.addRow([entry.date, ...ACTIVITIES.map(a => entry.activities[a.id]), answersFor(entry).productivity]);
  const buffer = await book.xlsx.writeBuffer();
  download(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `honor-registros-${localDate()}.xlsx`);
}
export async function prepareImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elige una imagen JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 10 MB.');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return canvas.toDataURL('image/webp', .78);
}
