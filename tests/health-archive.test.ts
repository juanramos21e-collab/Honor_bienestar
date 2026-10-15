import { beforeAll, describe, expect, it } from 'vitest';
import type { SqlJsStatic } from 'sql.js';
import JSZip from 'jszip';
import { aggregateIntervals, readHonorArchive } from '../src/lib/healthArchiveCore';
import { HONOR_HEALTH_PACKAGE, MAX_HEALTH_ZIP, mergeHonorReadings, preserveUneditedHealth, type HonorArchive } from '../src/lib/honorHealth';
import { emptyEntry } from '../src/lib/model';
import { addInterval, archive, insert, testDatabase, testSql } from './helpers/health-archive';

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await testSql(); });
describe('Copia de Health Connect, exclusivamente HONOR', () => {
  it('un formulario abierto conserva las lecturas que llegaron mientras se contestaba, salvo campos editados', () => {
    const base = emptyEntry('2026-05-01'); base.health = { steps: 100 }; base.weight = 66;
    const current = { ...base, health: { steps: 200, heartRate: 70 }, weight: 66.5 };
    const submitted = { ...base, notes: 'Respuesta nueva.' };
    expect(preserveUneditedHealth(current, submitted, base)).toMatchObject({ notes: 'Respuesta nueva.', weight: 66.5, health: { steps: 200, heartRate: 70 } });
    expect(preserveUneditedHealth(current, { ...submitted, health: { steps: 150 }, weight: 67 }, base)).toMatchObject({ weight: 67, health: { steps: 150, heartRate: 70 } });
  });
  it('ignora teléfono, apps anteriores y etiquetas que imitan el nombre de HONOR', async () => {
    const db = testDatabase(SQL);
    addInterval(db, 'steps_record_table', 'count', 600, { app: 10 });
    addInterval(db, 'distance_record_table', 'distance', 2000, { app: 30 });
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.origin).toBe(HONOR_HEALTH_PACKAGE); expect(result.entries).toEqual([]);
    expect(result.sourceRecords).toBe(0); expect(result.ignoredRecords).toBe(2);
    expect(result.inventory).toEqual([
      { key: 'distance_record_table', label: 'Distancia', supported: true, sources: [{ kind: 'other', name: 'Salud de HONOR', records: 1 }] },
      { key: 'steps_record_table', label: 'Pasos', supported: true, sources: [{ kind: 'phone', name: 'Teléfono', records: 1 }] },
    ]);
  });
  it('detecta calorías del teléfono sin importarlas y distingue tipos de HONOR aún no compatibles', async () => {
    const db = testDatabase(SQL);
    addInterval(db, 'active_calories_burned_record_table', 'energy', 200000, { app: 10 });
    db.exec('CREATE TABLE total_calories_burned_record_table (row_id INTEGER, app_info_id INTEGER); INSERT INTO total_calories_burned_record_table VALUES (1,20)');
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries).toEqual([]);
    expect(result.inventory).toEqual([
      { key: 'active_calories_burned_record_table', label: 'Calorías activas', supported: true, sources: [{ kind: 'phone', name: 'Teléfono', records: 1 }] },
      { key: 'total_calories_burned_record_table', label: 'Calorías totales', supported: false, sources: [{ kind: 'honor', name: 'HONOR Health', records: 1 }] },
    ]);
  });
  it('lee calorías HONOR aunque la versión de la copia no incluya nombres visibles de aplicaciones', async () => {
    const db = testDatabase(SQL); db.exec('ALTER TABLE application_info_table DROP COLUMN app_name');
    addInterval(db, 'active_calories_burned_record_table', 'energy', 350000);
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries[0].health.activeCalories).toBe(350);
    expect(result.inventory?.[0].sources).toEqual([{ kind: 'honor', name: 'HONOR Health', records: 1 }]);
  });
  it('lee solo el escritor oficial y reparte pasos, metros y calorías al cruzar medianoche', async () => {
    const db = testDatabase(SQL), start = Date.parse('2026-05-01T23:59:50-05:00'), end = start + 20000;
    for (const [table, column, value] of [['steps_record_table', 'count', 100], ['distance_record_table', 'distance', 1000], ['active_calories_burned_record_table', 'energy', 2000]] as const) addInterval(db, table, column, value, { start, end });
    addInterval(db, 'steps_record_table', 'count', 9000, { id: 2, app: 10, start, end });
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries.map(x => x.date)).toEqual(['2026-05-01', '2026-05-02']);
    for (const entry of result.entries) expect(entry.health).toEqual({ steps: 50, distanceKm: .5, activeCalories: 1 });
    expect(result.entries.every(x => x.weight === undefined && x.health.sleepHours === undefined)).toBe(true);
  });
  it('resuelve intervalos superpuestos y duplicados sin inflar los totales', () => {
    const result = aggregateIntervals([{ start: 0, end: 10000, value: 100, modified: 1 }, { start: 5000, end: 15000, value: 200, modified: 2 }, { start: 5000, end: 15000, value: 200, modified: 2 }]);
    expect([...result.values()]).toEqual([250]);
    expect([...aggregateIntervals([{ start: 0, end: 0, value: 5, modified: 1 }, { start: 0, end: 0, value: 7, modified: 2 }]).values()]).toEqual([7]);
  });
  it('convierte gramos a kg y filtra también las muestras de pulso por el padre oficial', async () => {
    const db = testDatabase(SQL), time = Date.parse('2026-05-01T14:00:00-05:00');
    for (const [id, app, weight, timestamp] of [[1, 20, 66000, time], [2, 20, 66500, time + 60000], [3, 30, 99000, time + 120000]]) insert(db, 'weight_record_table', { row_id: id, app_info_id: app, last_modified_time: id, time: timestamp, zone_offset: -18000, weight });
    addInterval(db, 'heart_rate_record_table', 'unused', 0, { id: 1, start: time, end: time + 60000 });
    addInterval(db, 'heart_rate_record_table', 'unused', 0, { id: 2, app: 30, start: time, end: time + 60000 });
    for (const [parent, bpm, timestamp] of [[1, 70, time], [1, 80, time + 5000], [2, 200, time + 10000]]) insert(db, 'heart_rate_record_series_table', { parent_key: parent, epoch_millis: timestamp, beats_per_minute: bpm });
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries[0]).toEqual({ date: '2026-05-01', health: { heartRate: 75 }, weight: 66.5 });
  });
  it('asigna sueño al despertar, une sesiones y excluye pausas incluso con ejercicios solapados', async () => {
    const db = testDatabase(SQL), start = Date.parse('2026-05-01T23:00:00-05:00'), hour = 3600000;
    addInterval(db, 'sleep_session_record_table', 'unused', 0, { start, end: start + 8 * hour });
    insert(db, 'sleep_stages_table', { parent_key: 1, stage_start_time: start, stage_end_time: start + 2 * hour, stage_type: 5 });
    insert(db, 'sleep_stages_table', { parent_key: 1, stage_start_time: start + 2 * hour, stage_end_time: start + 7 * hour, stage_type: 4 });
    insert(db, 'sleep_stages_table', { parent_key: 1, stage_start_time: start + 7 * hour, stage_end_time: start + 8 * hour, stage_type: 1 });
    const exerciseStart = start - 4 * hour;
    for (const id of [1, 2]) addInterval(db, 'exercise_session_record_table', 'exercise_type', 0, { id, start: exerciseStart, end: exerciseStart + hour, modified: id });
    insert(db, 'exercise_segments_table', { parent_key: 2, segment_start_time: exerciseStart + 600000, segment_end_time: exerciseStart + 1200000, segment_type: 67 });
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries.find(x => x.date === '2026-05-02')?.health).toEqual({ sleepHours: 7, lightSleepHours: 5, deepSleepHours: 2 });
    expect(result.entries.find(x => x.date === '2026-05-01')?.health.exerciseMinutes).toBe(50);
  });
  it('no convierte una sesión con fases de vigilia en horas dormidas', async () => {
    const db = testDatabase(SQL), start = Date.parse('2026-05-02T01:00:00-05:00');
    addInterval(db, 'sleep_session_record_table', 'unused', 0, { start, end: start + 600000 });
    insert(db, 'sleep_stages_table', { parent_key: 1, stage_start_time: start, stage_end_time: start + 600000, stage_type: 1 });
    const result = await readHonorArchive(await archive(db), SQL); db.close();
    expect(result.entries[0].health.sleepHours).toBe(0);
  });
  it('rechaza ZIP incompleto, otro formato, base dañada y métricas fuera de rango', async () => {
    await expect(readHonorArchive(new ArrayBuffer(MAX_HEALTH_ZIP + 1), SQL)).rejects.toThrow('20 MB');
    await expect(readHonorArchive(new Uint8Array([1, 2, 3]).buffer, SQL)).rejects.toThrow('incompleta');
    await expect(readHonorArchive(await new JSZip().file('otro.txt', 'hola').generateAsync({ type: 'arraybuffer' }), SQL)).rejects.toThrow('Health Connect');
    await expect(readHonorArchive(await new JSZip().file('health_connect_export.db', 'dañado').generateAsync({ type: 'arraybuffer' }), SQL)).rejects.toThrow('no es válida');
    const db = testDatabase(SQL);
    insert(db, 'oxygen_saturation_record_table', { row_id: 1, app_info_id: 20, last_modified_time: 1, time: Date.parse('2026-05-01T12:00:00Z'), zone_offset: 0, percentage: 101 });
    await expect(readHonorArchive(await archive(db), SQL)).rejects.toThrow('Oxígeno'); db.close();
  });
  it('conserva respuestas, actividades, notas y datos ausentes, y repetir la copia no cambia nada', () => {
    const before = emptyEntry('2026-05-01'); before.notes = 'Apunte sintético.'; before.weight = 66; before.answers.energy = .75; before.activities.read = 1; before.health = { stress: 20, spo2: 98 };
    const report: HonorArchive = { origin: HONOR_HEALTH_PACKAGE, readAt: '2026-05-03T12:00:00Z', sourceRecords: 1, ignoredRecords: 0, warnings: [], entries: [{ date: before.date, health: { steps: 0 } }] };
    const [after] = mergeHonorReadings([before], report);
    expect(after.answers).toEqual(before.answers); expect(after.activities).toEqual(before.activities); expect(after.notes).toBe(before.notes); expect(after.weight).toBe(66);
    expect(after.health).toEqual({ stress: 20, spo2: 98, steps: 0 }); expect(mergeHonorReadings([after], report)).toEqual([]);
    expect(() => mergeHonorReadings([before], { ...report, origin: 'another.app' as typeof HONOR_HEALTH_PACKAGE })).toThrow('HONOR Health');
    expect(mergeHonorReadings([before], { ...report, entries: [] })).toEqual([]);
  });
});
