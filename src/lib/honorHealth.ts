import { HEALTH_METRICS, normalizeHealth, type HealthMetrics } from './health';
import { emptyEntry, normalizeEntry, sameEntry, validDate, type DayEntry } from './model';

export const HONOR_HEALTH_PACKAGE = 'com.hihonor.health';
export type HonorReading = { date: string; health: HealthMetrics; weight?: number };
export type HonorArchive = {
  origin: typeof HONOR_HEALTH_PACKAGE;
  readAt: string;
  entries: HonorReading[];
  sourceRecords: number;
  ignoredRecords: number;
  warnings: string[];
};
export const MAX_HEALTH_ZIP = 20 * 1024 * 1024;
export const MAX_HEALTH_DATABASE = 64 * 1024 * 1024;

// Conserva una lectura que llegó después de abrir el formulario si ese campo
// de salud no fue editado por la persona.
export function preserveUneditedHealth(current: DayEntry, submitted: DayEntry, baseline: DayEntry): DayEntry {
  if (current.date !== submitted.date || baseline.date !== submitted.date) throw new Error('Las fechas del registro no coinciden.');
  const health: HealthMetrics = {};
  for (const metric of HEALTH_METRICS) {
    const value = submitted.health?.[metric.id] === baseline.health?.[metric.id] ? current.health?.[metric.id] : submitted.health?.[metric.id];
    if (value !== undefined) health[metric.id] = value;
  }
  const next = { ...submitted, weight: submitted.weight === baseline.weight ? current.weight : submitted.weight };
  if (Object.keys(health).length) next.health = health; else delete next.health;
  return normalizeEntry(next);
}

// No se acepta un origen parecido por nombre: debe ser el paquete oficial exacto.
export function mergeHonorReadings(current: DayEntry[], archive: HonorArchive): DayEntry[] {
  if (archive.origin !== HONOR_HEALTH_PACKAGE || !Array.isArray(archive.entries) || archive.entries.length > 10000 || !Number.isFinite(Date.parse(archive.readAt))) throw new Error('La copia no es una lectura válida de HONOR Health.');
  const previous = new Map(current.map(day => [day.date, day]));
  const seen = new Set<string>();
  return archive.entries.flatMap(reading => {
    if (!validDate(reading.date) || seen.has(reading.date)) throw new Error('La copia contiene fechas inválidas o repetidas.');
    seen.add(reading.date);
    const health = normalizeHealth(reading.health);
    if (!health && reading.weight === undefined) return [];
    const before = previous.get(reading.date) ?? emptyEntry(reading.date);
    const next = normalizeEntry({ ...before, ...(health ? { health: { ...before.health, ...health } } : {}), ...(reading.weight !== undefined ? { weight: reading.weight } : {}), updatedAt: archive.readAt });
    return previous.has(reading.date) && sameEntry(before, next) ? [] : [next];
  });
}
