import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import JSZip from 'jszip';
import { resolve } from 'node:path';

export async function testSql(): Promise<SqlJsStatic> {
  return initSqlJs({ locateFile: name => resolve('node_modules/sql.js/dist', name) });
}
export function testDatabase(SQL: SqlJsStatic): Database {
  const db = new SQL.Database();
  db.exec("CREATE TABLE application_info_table (row_id INTEGER PRIMARY KEY, package_name TEXT, app_name TEXT); INSERT INTO application_info_table VALUES (10,'com.android.healthconnect.phone.test','Teléfono'),(20,'com.hihonor.health','Salud de HONOR'),(30,'another.app','Salud de HONOR');");
  const base = 'row_id INTEGER PRIMARY KEY, app_info_id INTEGER, last_modified_time INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER';
  for (const [table, extra] of [
    ['steps_record_table', 'count INTEGER'], ['distance_record_table', 'distance REAL'],
    ['active_calories_burned_record_table', 'energy REAL'], ['exercise_session_record_table', 'exercise_type INTEGER'],
    ['heart_rate_record_table', 'unused INTEGER'], ['sleep_session_record_table', 'unused INTEGER'],
  ]) db.exec('CREATE TABLE ' + table + ' (' + base + ', ' + extra + ')');
  for (const [table, extra] of [
    ['weight_record_table', 'weight REAL'], ['resting_heart_rate_record_table', 'beats_per_minute REAL'],
    ['oxygen_saturation_record_table', 'percentage REAL'],
  ]) db.exec('CREATE TABLE ' + table + ' (row_id INTEGER PRIMARY KEY, app_info_id INTEGER, last_modified_time INTEGER, time INTEGER, zone_offset INTEGER, ' + extra + ')');
  db.exec('CREATE TABLE heart_rate_record_series_table (parent_key INTEGER, epoch_millis INTEGER, beats_per_minute INTEGER); CREATE TABLE sleep_stages_table (parent_key INTEGER, stage_start_time INTEGER, stage_end_time INTEGER, stage_type INTEGER); CREATE TABLE exercise_segments_table (parent_key INTEGER, segment_start_time INTEGER, segment_end_time INTEGER, segment_type INTEGER)');
  return db;
}
export function insert(db: Database, table: string, values: Record<string, SqlValue>) {
  const keys = Object.keys(values);
  db.run('INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')', Object.values(values));
}
export function addInterval(db: Database, table: string, column: string, value: number, { id = 1, app = 20, start = Date.parse('2026-05-01T12:00:00-05:00'), end = start + 60000, modified = 1, shift = -18000 }: { id?: number; app?: number; start?: number; end?: number; modified?: number; shift?: number } = {}) {
  insert(db, table, { row_id: id, app_info_id: app, start_time: start, end_time: end, start_zone_offset: shift, end_zone_offset: shift, last_modified_time: modified, [column]: value });
}
export async function archive(db: Database): Promise<ArrayBuffer> {
  return new JSZip().file('health_connect_export.db', db.export()).generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
