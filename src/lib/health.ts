import { moodScore, periodKey, type DayEntry, type Period } from './model';

export const HEALTH_METRICS = [
  { id: 'steps', label: 'Pasos', unit: 'pasos', min: 0, max: 100000, integer: true, sum: true },
  { id: 'distanceKm', label: 'Distancia', unit: 'km', min: 0, max: 1000, integer: false, sum: true },
  { id: 'activeCalories', label: 'Calorías activas', unit: 'kcal', min: 0, max: 20000, integer: false, sum: true },
  { id: 'exerciseMinutes', label: 'Tiempo de ejercicio', unit: 'min', min: 0, max: 1440, integer: false, sum: true },
  { id: 'heartRate', label: 'Frecuencia cardíaca media', unit: 'lpm', min: 1, max: 300, integer: false, sum: false },
  { id: 'restingHeartRate', label: 'Pulso en reposo', unit: 'lpm', min: 1, max: 300, integer: false, sum: false },
  { id: 'spo2', label: 'Oxígeno en sangre (SpO₂)', unit: '%', min: 1, max: 100, integer: false, sum: false },
  { id: 'sleepHours', label: 'Sueño total', unit: 'h', min: 0, max: 24, integer: false, sum: false },
  { id: 'deepSleepHours', label: 'Sueño profundo', unit: 'h', min: 0, max: 24, integer: false, sum: false },
  { id: 'lightSleepHours', label: 'Sueño ligero', unit: 'h', min: 0, max: 24, integer: false, sum: false },
  { id: 'remSleepHours', label: 'Sueño REM', unit: 'h', min: 0, max: 24, integer: false, sum: false },
  { id: 'stress', label: 'Estrés del reloj', unit: '/100', min: 0, max: 100, integer: false, sum: false },
] as const;
export type HealthId = typeof HEALTH_METRICS[number]['id'];
export type HealthMetrics = Partial<Record<HealthId, number>>;
export function normalizeHealth(input: unknown): HealthMetrics | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Los datos de salud no son válidos.');
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !HEALTH_METRICS.some(m => m.id === key))) throw new Error('Hay una métrica de salud desconocida.');
  const health: HealthMetrics = {};
  for (const metric of HEALTH_METRICS) {
    const value = values[metric.id];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < metric.min || value > metric.max || (metric.integer && !Number.isInteger(value))) throw new Error(`${metric.label}: usa un valor entre ${metric.min} y ${metric.max} ${metric.unit}${metric.integer ? ', sin decimales' : ''}.`);
    health[metric.id] = value;
  }
  const stages = (health.deepSleepHours ?? 0) + (health.lightSleepHours ?? 0) + (health.remSleepHours ?? 0);
  if (stages > 24 || (health.sleepHours !== undefined && stages > health.sleepHours + .05)) throw new Error('Las fases de sueño no pueden sumar más que el sueño total.');
  return Object.keys(health).length ? health : undefined;
}
export function aggregateHealth(entries: DayEntry[], period: Period) {
  const groups = new Map<string, DayEntry[]>();
  for (const entry of entries) { const key = periodKey(entry.date, period); groups.set(key, [...(groups.get(key) ?? []), entry]); }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, days]) => ({
    date, timestamp: Date.parse(`${date}T00:00:00Z`),
    ...Object.fromEntries(HEALTH_METRICS.map(metric => {
      const values = days.map(day => day.health?.[metric.id]).filter((v): v is number => v !== undefined);
      return [metric.id, values.length ? values.reduce((a, b) => a + b, 0) / (metric.sum ? 1 : values.length) : null];
    })) as Record<HealthId, number | null>,
  }));
}
export function pairedHealth(entries: DayEntry[], metric: HealthId) {
  return entries.flatMap(entry => { const x = entry.health?.[metric], mood = moodScore(entry); return x !== undefined && mood !== null ? [{ date: entry.date, value: x, mood: mood * 100 }] : []; });
}
