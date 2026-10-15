import JSZip from 'jszip';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { normalizeHealth, type HealthId } from './health';
import { HONOR_HEALTH_PACKAGE, MAX_HEALTH_DATABASE, MAX_HEALTH_ZIP, type HonorArchive, type HonorReading } from './honorHealth';

type Row = Record<string, SqlValue>;
type Interval = { start: number; end: number; value: number; modified: number; duration?: boolean; exclude?: { start: number; end: number }[] };
const DAY = 86400000;
const MAX_ROWS = 300000;
const tables = ['steps_record_table', 'distance_record_table', 'active_calories_burned_record_table', 'exercise_session_record_table', 'heart_rate_record_table', 'resting_heart_rate_record_table', 'oxygen_saturation_record_table', 'weight_record_table', 'sleep_session_record_table'];
const finite = (v: SqlValue | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
function number(row: Row, key: string): number {
  const value = row[key];
  if (!finite(value)) throw new Error('La copia contiene una medición sin valor numérico válido.');
  return value;
}
function offset(row: Row, key: string): number {
  const value = number(row, key);
  if (!Number.isInteger(value) || Math.abs(value) > 64800) throw new Error('La copia contiene una zona horaria inválida.');
  return value * 1000;
}
function localTime(time: number, shift: number): number {
  const value = time + shift;
  if (!Number.isSafeInteger(value) || value < 0 || value >= Date.UTC(2200, 0, 1)) throw new Error('La copia contiene una fecha de medición inválida.');
  return value;
}
function date(time: number) { return new Date(time).toISOString().slice(0, 10); }
function interval(row: Row, value: number): Interval {
  const start = localTime(number(row, 'start_time'), offset(row, 'start_zone_offset'));
  const end = localTime(number(row, 'end_time'), offset(row, 'end_zone_offset'));
  if (end < start || end - start > 31 * DAY || value < 0) throw new Error('La copia contiene un intervalo de salud inválido.');
  return { start, end, value, modified: number(row, 'last_modified_time') };
}
function priority(a: Interval, b: Interval) {
  return a.modified - b.modified || a.start - b.start || a.end - b.end || a.value - b.value;
}

// Criterio de AOSP: en un solapamiento del mismo origen prevalece el registro
// modificado más recientemente. Se reparte su valor por duración, sin sumar dos
// veces el mismo intervalo. Cada corte de medianoche respeta el offset guardado.
export function aggregateIntervals(records: Interval[]): Map<string, number> {
  const events = records.flatMap((r, index) => [{ time: r.start, index, start: true }, { time: r.end, index, start: false }]).sort((a, b) => a.time - b.time || Number(b.start) - Number(a.start));
  const active = new Set<number>(), heap: number[] = [], result = new Map<string, number>();
  const above = (a: number, b: number) => priority(records[a], records[b]) > 0;
  const push = (id: number) => {
    heap.push(id); let i = heap.length - 1;
    while (i) { const parent = (i - 1) >> 1; if (!above(heap[i], heap[parent])) break; [heap[i], heap[parent]] = [heap[parent], heap[i]]; i = parent; }
  };
  const pop = () => {
    const last = heap.pop()!;
    if (!heap.length) return;
    heap[0] = last; let i = 0;
    while (2 * i + 1 < heap.length) {
      let child = 2 * i + 1;
      if (child + 1 < heap.length && above(heap[child + 1], heap[child])) child++;
      if (!above(heap[child], heap[i])) break;
      [heap[i], heap[child]] = [heap[child], heap[i]]; i = child;
    }
  };
  const add = (start: number, end: number, rate: number) => {
    while (start < end) { const stop = Math.min(end, (Math.floor(start / DAY) + 1) * DAY), key = date(start); result.set(key, (result.get(key) ?? 0) + (stop - start) * rate); start = stop; }
  };
  for (let i = 0; i < events.length;) {
    const time = events[i].time;
    const instants: Interval[] = [];
    while (i < events.length && events[i].time === time) {
      const event = events[i++], r = records[event.index];
      if (r.start === r.end) { if (event.start) instants.push(r); continue; }
      if (event.start) { active.add(event.index); push(event.index); } else active.delete(event.index);
    }
    if (instants.length) {
      const chosen = instants.reduce((a, b) => priority(a, b) > 0 ? a : b);
      const key = date(time); result.set(key, (result.get(key) ?? 0) + chosen.value);
    }
    while (heap.length && !active.has(heap[0])) pop();
    if (heap.length && i < events.length) {
      const r = records[heap[0]];
      const rate = r.duration ? 1 : r.value / (r.end - r.start);
      if (r.duration) add(time, events[i].time, 0);
      let start = time;
      for (const pause of r.exclude ?? []) {
        if (pause.end <= start) continue;
        if (pause.start >= events[i].time) break;
        if (pause.start > start) add(start, Math.min(pause.start, events[i].time), rate);
        start = Math.max(start, pause.end);
      }
      if (start < events[i].time) add(start, events[i].time, rate);
    }
  }
  return result;
}
function unionDuration(values: { start: number; end: number }[]) {
  let total = 0, end = -Infinity;
  for (const v of [...values].sort((a, b) => a.start - b.start)) {
    if (v.end > end) { total += v.end - Math.max(v.start, end); end = v.end; }
  }
  return total;
}
function boundedDatabase(zip: JSZip.JSZipObject): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const parts: Uint8Array[] = []; let length = 0, failed = false;
    // Método de JSZip 3.10.2; sus tipos omiten este lector incremental.
    const stream = (zip as JSZip.JSZipObject & { internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream('uint8array');
    stream.on('data', chunk => {
      if (failed) return;
      length += chunk.length;
      if (length > MAX_HEALTH_DATABASE) { failed = true; stream.pause(); reject(new Error('La base de salud supera los 64 MB permitidos.')); }
      else parts.push(chunk);
    }).on('error', () => { if (!failed) reject(new Error('No se pudo descomprimir la copia de Health Connect.')); }).on('end', () => {
      if (failed) return;
      const result = new Uint8Array(length); let start = 0;
      for (const part of parts) { result.set(part, start); start += part.length; }
      resolve(result);
    }).resume();
  });
}

export async function readHonorArchive(buffer: ArrayBuffer, SQL: SqlJsStatic): Promise<HonorArchive> {
  if (!buffer.byteLength || buffer.byteLength > MAX_HEALTH_ZIP) throw new Error('La copia debe ser un ZIP completo de hasta 20 MB.');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw new Error('La copia ZIP está vacía, incompleta o no es compatible. Espera a que Drive termine de subirla.'); }
  if (Object.keys(zip.files).length > 32) throw new Error('El archivo no tiene la estructura esperada de Health Connect.');
  const file = zip.file('health_connect_export.db');
  if (!file) throw new Error('Este ZIP no contiene la base exportada por Health Connect.');
  const bytes = await boundedDatabase(file);
  if (new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\u0000') throw new Error('La base de datos de la copia no es válida.');
  let db: Database;
  try { db = new SQL.Database(bytes); } catch { throw new Error('La base de datos de la copia está dañada o no es compatible.'); }
  try {
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;');
    const names = new Set(db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(v => String(v[0])) ?? []);
    let queried = 0;
    const query = (sql: string, params: SqlValue[] = []): Row[] => {
      const statement = db.prepare(sql), result: Row[] = [];
      try { statement.bind(params); while (statement.step()) { if (++queried > MAX_ROWS) throw new Error('La copia tiene demasiadas mediciones para esta versión.'); result.push(statement.getAsObject()); } } finally { statement.free(); }
      return result;
    };
    if (!names.has('application_info_table')) throw new Error('La copia no contiene información de las aplicaciones de origen.');
    const origins = query('SELECT row_id FROM application_info_table WHERE package_name = ?', [HONOR_HEALTH_PACKAGE]).map(row => number(row, 'row_id'));
    const readings = new Map<string, HonorReading>(), warnings = new Set<string>();
    let ignoredRecords = 0, sourceRecords = 0;
    const day = (key: string) => {
      if (!readings.has(key)) { if (readings.size >= 10000) throw new Error('La copia supera los 10 000 días.'); readings.set(key, { date: key, health: {} }); }
      return readings.get(key)!;
    };
    const set = (key: string, metric: HealthId, value: number) => { day(key).health[metric] = rounded(value); };
    const sourceRows = (table: string): Row[] => {
      if (!names.has(table)) return [];
      const count = Number(db.exec('SELECT COUNT(*) FROM "' + table + '"')[0].values[0][0]);
      const rows = origins.length ? query('SELECT * FROM "' + table + '" WHERE app_info_id IN (' + origins.map(() => '?').join(',') + ')', origins) : [];
      ignoredRecords += count - rows.length; sourceRecords += rows.length;
      return rows;
    };
    const raw = new Map(tables.map(table => [table, sourceRows(table)]));
    for (const [table, metric, divisor] of [
      ['steps_record_table', 'steps', 1], ['distance_record_table', 'distanceKm', 1000],
      ['active_calories_burned_record_table', 'activeCalories', 1000],
    ] as const) {
      const column = metric === 'steps' ? 'count' : metric === 'distanceKm' ? 'distance' : 'energy';
      const records = raw.get(table)!.map(row => {
        const value = number(row, column);
        if (metric === 'steps' && !Number.isSafeInteger(value)) throw new Error('La copia contiene una cantidad de pasos inválida.');
        return interval(row, value);
      });
      for (const [key, value] of aggregateIntervals(records)) set(key, metric, metric === 'steps' ? Math.trunc(value) : value / divisor);
    }
    // Mediciones puntuales: se mantienen separadas por fecha y no se usan
    // mediciones de otra app para rellenar lo que HONOR no haya compartido.
    for (const [table, column, metric] of [
      ['resting_heart_rate_record_table', 'beats_per_minute', 'restingHeartRate'],
      ['oxygen_saturation_record_table', 'percentage', 'spo2'],
      ['weight_record_table', 'weight', 'weight'],
    ] as const) {
      const byTime = new Map<number, Row>();
      for (const row of raw.get(table)!) {
        const time = number(row, 'time'), old = byTime.get(time);
        if (!old || number(row, 'last_modified_time') > number(old, 'last_modified_time')) byTime.set(time, row);
      }
      const grouped = new Map<string, { value: number; time: number }[]>();
      for (const [time, row] of byTime) {
        const key = date(localTime(time, offset(row, 'zone_offset')));
        const value = number(row, column);
        if (metric !== 'weight') normalizeHealth({ [metric]: value });
        const values = grouped.get(key) ?? []; values.push({ value, time }); grouped.set(key, values);
      }
      for (const [key, list] of grouped) {
        if (metric === 'weight') day(key).weight = rounded(list.reduce((a, b) => a.time > b.time ? a : b).value / 1000);
        else set(key, metric, list.reduce((n, x) => n + x.value, 0) / list.length);
      }
    }
    // El filtro se aplica al padre antes de leer las muestras: otro origen
    // nunca entra a través de las tablas de series, fases o segmentos.
    const children = (table: string, parent: Row) => names.has(table) ? query('SELECT * FROM "' + table + '" WHERE parent_key = ?', [number(parent, 'row_id')]) : [];
    const heartSamples = new Map<number, { value: number; modified: number; shift: number }>();
    for (const parent of raw.get('heart_rate_record_table')!) {
      for (const sample of children('heart_rate_record_series_table', parent)) {
        const time = number(sample, 'epoch_millis'), old = heartSamples.get(time), modified = number(parent, 'last_modified_time');
        if (time < number(parent, 'start_time') || time > number(parent, 'end_time')) throw new Error('Una muestra de pulso está fuera de su registro.');
        const value = number(sample, 'beats_per_minute'); normalizeHealth({ heartRate: value });
        if (!old || modified > old.modified) heartSamples.set(time, { value, modified, shift: offset(parent, 'start_zone_offset') });
      }
    }
    const heartDays = new Map<string, number[]>();
    for (const [time, sample] of heartSamples) { const key = date(localTime(time, sample.shift)), values = heartDays.get(key) ?? []; values.push(sample.value); heartDays.set(key, values); }
    for (const [key, list] of heartDays) set(key, 'heartRate', list.reduce((a, b) => a + b, 0) / list.length);

    // El ejercicio usa la unión de sesiones y excluye pausas/descansos.
    const exercise: Interval[] = [];
    for (const parent of raw.get('exercise_session_record_table')!) {
      const r = interval(parent, 0), shift = offset(parent, 'start_zone_offset');
      const pauses = children('exercise_segments_table', parent).filter(row => [66, 67].includes(number(row, 'segment_type'))).map(row => ({
        start: Math.max(r.start, localTime(number(row, 'segment_start_time'), shift)),
        end: Math.min(r.end, localTime(number(row, 'segment_end_time'), shift)),
      })).filter(x => x.end > x.start).sort((a, b) => a.start - b.start);
      exercise.push({ ...r, duration: true, value: r.end - r.start - unionDuration(pauses), exclude: pauses });
    }
    for (const [key, value] of aggregateIntervals(exercise)) set(key, 'exerciseMinutes', value / 60000);

    const sleep = new Map<string, { all: { start: number; end: number; type: number }[] }>();
    for (const parent of raw.get('sleep_session_record_table')!) {
      const r = interval(parent, 0), key = date(r.end), shift = offset(parent, 'start_zone_offset');
      const stages = children('sleep_stages_table', parent).map(row => ({
        start: Math.max(r.start, localTime(number(row, 'stage_start_time'), shift)),
        end: Math.min(r.end, localTime(number(row, 'stage_end_time'), shift)),
        type: number(row, 'stage_type'),
      })).filter(x => x.end > x.start);
      const asleep = stages.filter(x => [2, 4, 5, 6].includes(x.type));
      const all = stages.length ? asleep : [{ start: r.start, end: r.end, type: 2 }];
      if (!stages.length) warnings.add('El sueño sin fases usa la duración de la sesión y se asigna al día de despertar.');
      sleep.set(key, { all: [...(sleep.get(key)?.all ?? []), ...all] });
    }
    for (const [key, value] of sleep) {
      const total = unionDuration(value.all) / 3600000;
      set(key, 'sleepHours', total);
      const stages = ([[4, 'lightSleepHours'], [5, 'deepSleepHours'], [6, 'remSleepHours']] as const).map(([type, id]) => ({ id, present: value.all.some(x => x.type === type), hours: unionDuration(value.all.filter(x => x.type === type)) / 3600000 }));
      if (stages.reduce((sum, s) => sum + s.hours, 0) <= total + .05) for (const s of stages) { if (s.present) set(key, s.id, s.hours); }
      else warnings.add('Se omitieron fases de sueño superpuestas para conservar una duración coherente.');
    }
    const entries = [...readings.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const entry of entries) {
      entry.health = normalizeHealth(entry.health) ?? {};
      if (entry.weight !== undefined && (entry.weight <= 0 || entry.weight > 500)) throw new Error('La copia contiene un peso fuera del rango permitido.');
    }
    return { origin: HONOR_HEALTH_PACKAGE, readAt: new Date().toISOString(), entries, sourceRecords, ignoredRecords, warnings: [...warnings] };
  } finally { db.close(); }
}
