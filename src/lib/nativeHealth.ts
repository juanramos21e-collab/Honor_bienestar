import { Capacitor, registerPlugin } from '@capacitor/core';
import { normalizeHealth, type HealthMetrics } from './health';
import { emptyEntry, normalizeEntry, sameEntry, validDate, type DayEntry } from './model';

export type HealthStatus = {
  availability: 'available' | 'install_required' | 'unsupported' | 'web' | 'ios';
  device?: { manufacturer: string; model: string; androidVersion: string };
  apps: { id: string; label: string; installed: boolean }[];
  granted: string[];
};
export type HealthSource = { id: string; label: string };
export type HealthRead = { entries: { date: string; health: HealthMetrics; weight?: number }[]; readAt: string; from: string; to: string; origin: string; warnings: string[] };
interface HealthBridge {
  status(): Promise<HealthStatus>;
  requestAccess(): Promise<HealthStatus>;
  openSetup(options: { target: 'provider' | 'permissions' | 'honor' }): Promise<void>;
  sources(options: { from: string; to: string }): Promise<{ sources: HealthSource[] }>;
  read(options: { from: string; to: string; origin: string }): Promise<HealthRead>;
  googleSignIn(options: { clientId: string }): Promise<{ idToken: string }>;
}
export const healthBridge = registerPlugin<HealthBridge>('HealthData');
export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export async function healthStatus(): Promise<HealthStatus> {
  if (!isNativeAndroid()) return { availability: Capacitor.getPlatform() === 'ios' ? 'ios' : 'web', apps: [], granted: [] };
  return healthBridge.status();
}
export function validateHealthRange(from: string, to: string): string {
  if (!validDate(from) || !validDate(to) || from > to) return 'Elige un rango de fechas válido.';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  return days > 30 ? 'Consulta hasta 30 días por actualización.' : '';
}
// Incorporar solo los campos recibidos: las respuestas, notas y métricas ausentes se conservan.
export function prepareHealthUpdate(current: DayEntry[], result: HealthRead): DayEntry[] {
  if (validateHealthRange(result.from, result.to) || !result.origin || !Array.isArray(result.entries) || result.entries.length > 30 || isNaN(Date.parse(result.readAt))) throw new Error('La lectura de salud no es válida.');
  const existing = new Map(current.map(day => [day.date, day]));
  const dates = new Set<string>();
  return result.entries.flatMap(reading => {
    if (!validDate(reading.date) || reading.date < result.from || reading.date > result.to || dates.has(reading.date)) throw new Error('La lectura contiene fechas repetidas o fuera del rango.');
    dates.add(reading.date);
    const health = normalizeHealth(reading.health);
    if (!health && reading.weight === undefined) return [];
    const before = existing.get(reading.date) ?? emptyEntry(reading.date);
    const next = normalizeEntry({ ...before, ...(health ? { health: { ...before.health, ...health } } : {}), ...(reading.weight !== undefined ? { weight: reading.weight } : {}), updatedAt: result.readAt });
    // Una fase nueva puede volver incoherentes las fases antiguas que la fuente ya no comparte.
    // normalizeEntry rechaza esa mezcla; nunca se guarda ni se corrige inventando valores.
    return existing.has(reading.date) && sameEntry(before, next) ? [] : [next];
  });
}
