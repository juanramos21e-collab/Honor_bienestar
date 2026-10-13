export const ACTIVITIES = [
  { id: 'meditate', excel: 'Meditar', label: 'Meditar u orar', weight: .05, hint: 'Un momento para detenerte y conectar contigo.' },
  { id: 'read', excel: 'Leer', label: 'Leer', weight: .08, hint: 'Una lectura para crecer personal o profesionalmente.' },
  { id: 'tidy', excel: 'Limpieza_orden', label: 'Ordenar mi espacio', weight: .05, hint: 'Cuidar la limpieza y el orden de tu entorno.' },
  { id: 'university', excel: 'Proyectos_U', label: 'Avanzar en la universidad', weight: .15, hint: 'Tareas o proyectos de tus cursos.' },
  { id: 'personal', excel: 'Proyectos_P', label: 'Trabajar en mis proyectos', weight: .22, hint: 'Tu emprendimiento, oficio o proyecto personal.' },
  { id: 'learn', excel: 'Aprender', label: 'Aprender algo', weight: .10, hint: 'Una habilidad, herramienta o conocimiento nuevo.' },
  { id: 'help', excel: 'Pendiente_apoyo_Tram', label: 'Apoyar a alguien', weight: .15, hint: 'Enseñar, orientar o acompañar a otra persona.' },
  { id: 'schedule', excel: 'Cronograma_100%', label: 'Cumplir mi planificación', weight: .10, hint: 'Completar las actividades que planificaste para hoy.' },
  { id: 'gym', excel: 'Gym', label: 'Ir al gimnasio', weight: .10, hint: 'Tu actividad de gimnasio.' },
] as const;

export const VARIABLES = [
  { id: 'productivity', excel: 'Productibidad', label: 'Productividad', color: '#8fb8ff', negative: false },
  { id: 'energy', excel: 'Energia', label: 'Energía', color: '#e9bc70', negative: false },
  { id: 'thoughts', excel: 'Pass_think', label: 'Pensamientos que quitan paz', color: '#b7a7d9', negative: true },
  { id: 'personal', excel: 'Proyectos mios', label: 'Proyectos personales', color: '#6ee7c2', negative: false },
  { id: 'university', excel: 'Proyectos - trabajos Uni', label: 'Proyectos universitarios', color: '#a1b5fd', negative: false },
  { id: 'health', excel: 'Salud', label: 'Salud', color: '#b9d891', negative: false },
  { id: 'pain', excel: 'Heartache', label: 'Dolor físico o emocional', color: '#ed9ca6', negative: true },
] as const;

export type VariableId = typeof VARIABLES[number]['id'];
export type ActivityId = typeof ACTIVITIES[number]['id'];
export type DayEntry = {
  date: string;
  answers: Record<VariableId, number | null>;
  activities: Record<ActivityId, number | null>;
  productivityMode: 'activities' | 'manual';
  weight: number | null;
  notes: string;
  updatedAt: string;
};
export type Profile = { name: string; hero: string; panel: string };
export const defaultProfile: Profile = { name: '', hero: '', panel: '' };
export type Period = 'Día' | 'Semana' | 'Mes' | 'Año';
export type AggregatePoint = { date: string; mood: number | null; weight: number | null } & Record<VariableId, number | null>;

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !isNaN(date.getTime()) && localDate(date) === value;
}
export function formatDate(value: string, long = false): string {
  return new Intl.DateTimeFormat('es-PE', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`));
}
export function emptyEntry(date = localDate()): DayEntry {
  return { date, answers: Object.fromEntries(VARIABLES.map(v => [v.id, null])) as DayEntry['answers'], activities: Object.fromEntries(ACTIVITIES.map(a => [a.id, null])) as DayEntry['activities'], productivityMode: 'activities', weight: null, notes: '', updatedAt: new Date().toISOString() };
}
export function productivity(entry: DayEntry): number | null {
  if (entry.productivityMode === 'manual') return entry.answers.productivity;
  if (!ACTIVITIES.some(a => entry.activities[a.id] !== null)) return null;
  return Number(ACTIVITIES.reduce((total, a) => total + (entry.activities[a.id] ?? 0) * a.weight, 0).toFixed(10));
}
export function answersFor(entry: DayEntry): DayEntry['answers'] {
  return { ...entry.answers, productivity: productivity(entry) };
}
// Misma fórmula del Excel: (productividad + energía + proyectos + universidad
// + salud - pensamientos - dolor) / 3. No normalizar ni limitar a 100%.
export function moodScore(entry: DayEntry): number | null {
  const answers = answersFor(entry);
  if (!VARIABLES.some(v => answers[v.id] !== null)) return null;
  return VARIABLES.reduce((sum, v) => sum + (answers[v.id] ?? 0) * (v.negative ? -1 : 1), 0) / 3;
}
export function hasContent(entry: DayEntry): boolean {
  return moodScore(entry) !== null || entry.weight !== null || !!entry.notes.trim();
}
export function sameEntry(a: DayEntry, b: DayEntry): boolean {
  return JSON.stringify({ ...normalizeEntry(a), updatedAt: '' }) === JSON.stringify({ ...normalizeEntry(b), updatedAt: '' });
}
export function showPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`;
}
export function normalizeEntry(input: unknown): DayEntry {
  if (!input || typeof input !== 'object') throw new Error('Registro inválido.');
  const value = input as Record<string, unknown>;
  if (typeof value.date !== 'string' || !validDate(value.date)) throw new Error('Hay una fecha inválida en el archivo.');
  const entry = emptyEntry(value.date);
  const readNumber = (v: unknown, max: number): number | null => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new Error('Hay valores fuera del rango permitido.');
    return v;
  };
  const answers = value.answers as Record<string, unknown> | undefined;
  const activities = value.activities as Record<string, unknown> | undefined;
  for (const v of VARIABLES) entry.answers[v.id] = readNumber(answers?.[v.id], 1);
  for (const a of ACTIVITIES) entry.activities[a.id] = readNumber(activities?.[a.id], 1);
  entry.productivityMode = value.productivityMode === 'activities' ? 'activities' : 'manual';
  entry.weight = readNumber(value.weight, 500);
  if (entry.weight === 0) throw new Error('El peso debe ser mayor que cero.');
  entry.notes = typeof value.notes === 'string' ? value.notes.slice(0, 2000) : '';
  if (typeof value.updatedAt === 'string' && !isNaN(Date.parse(value.updatedAt))) entry.updatedAt = value.updatedAt;
  return entry;
}
export function periodKey(date: string, period: Period): string {
  if (period === 'Año') return date.slice(0, 4) + '-01-01';
  if (period === 'Mes') return date.slice(0, 7) + '-01';
  if (period === 'Semana') {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return localDate(d);
  }
  return date;
}
export function aggregate(entries: DayEntry[], period: Period): AggregatePoint[] {
  const groups = new Map<string, DayEntry[]>();
  for (const entry of entries) {
    const key = periodKey(entry.date, period);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const mean = (values: (number | null)[]) => {
    const available = values.filter((v): v is number => v !== null);
    return available.length ? available.reduce((a, b) => a + b, 0) / available.length : null;
  };
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({
    date, mood: mean(list.map(moodScore)), weight: mean(list.map(e => e.weight)),
    ...Object.fromEntries(VARIABLES.map(v => {
      const vals = list.map(e => answersFor(e)[v.id]).filter((x): x is number => x !== null);
      return [v.id, vals.length ? vals.reduce((a, b) => a + b, 0) : null];
    })) as Record<VariableId, number | null>,
  }));
}
export type Conflict = { local: DayEntry; incoming: DayEntry };
export function planMerge(current: DayEntry[], incoming: DayEntry[]) {
  const byDate = new Map(current.map(e => [e.date, e]));
  const additions: DayEntry[] = [], conflicts: Conflict[] = [];
  for (const entry of incoming) {
    const previous = byDate.get(entry.date);
    if (!previous) additions.push(entry);
    else if (!sameEntry(previous, entry)) conflicts.push({ local: previous, incoming: entry });
  }
  return { additions, conflicts };
}
