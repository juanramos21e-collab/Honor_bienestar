import { describe, expect, it } from 'vitest';
import { ACTIVITIES, VARIABLES, aggregate, emptyEntry, moodScore, normalizeEntry, periodKey, planMerge, productivity, validDate } from '../src/lib/model';

describe('Cálculos compatibles con el Excel', () => {
  it('usa los nueve pesos originales y conserva actividades pendientes', () => {
    expect(ACTIVITIES.reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(1);
    const e = emptyEntry('2026-10-11'); expect(productivity(e)).toBeNull();
    e.activities.personal = 1; e.activities.help = 1; e.activities.read = 1;
    expect(productivity(e)).toBeCloseTo(.45);
    e.activities.personal = 0; expect(productivity(e)).toBeCloseTo(.23);
  });
  it('calcula el estado usando positivos menos negativos dividido entre tres', () => {
    const e = emptyEntry('2026-10-11'); e.productivityMode = 'manual';
    e.answers = { productivity: .6, energy: 1, thoughts: .7, personal: 0, university: .6, health: 1, pain: .3 };
    expect(moodScore(e)).toBeCloseTo(2.2 / 3);
    expect(normalizeEntry(e)).toEqual(e);
  });
  it('distingue cero de ausencia y no incluye el peso en el estado', () => {
    const e = emptyEntry('2026-10-11'); e.weight = 54.3;
    expect(moodScore(e)).toBeNull();
    e.answers.energy = 0; expect(moodScore(e)).toBe(0);
    e.weight = 58.2; expect(moodScore(e)).toBe(0);
  });
  it('conserva estados negativos y valores mayores que cien por ciento', () => {
    const e = emptyEntry('2026-10-11'); e.productivityMode = 'manual';
    e.answers.thoughts = 1; e.answers.pain = 1;
    expect(moodScore(e)).toBeCloseTo(-2 / 3);
    for (const v of VARIABLES) e.answers[v.id] = v.negative ? 0 : 1;
    expect(moodScore(e)).toBeCloseTo(5 / 3);
  });
  it('agrupa por lunes y promedia solo los datos disponibles', () => {
    expect(periodKey('2026-01-04', 'Semana')).toBe('2025-12-29');
    const a = emptyEntry('2026-10-01'), b = emptyEntry('2026-10-02');
    a.weight = 54; b.answers.energy = .6;
    const data = aggregate([a, b], 'Mes');
    expect(data).toHaveLength(1); expect(data[0].weight).toBe(54); expect(data[0].mood).toBeCloseTo(.2);
    expect(data[0].energy).toBe(.6); expect(data[0].health).toBeNull();
  });
});
describe('Protección del historial', () => {
  it('rechaza fechas inexistentes, pesos inválidos y porcentajes fuera de rango', () => {
    expect(validDate('2026-02-30')).toBe(false); expect(validDate('2024-02-29')).toBe(true);
    const e = emptyEntry('2026-10-11');
    expect(() => normalizeEntry({ ...e, weight: 0 })).toThrow();
    expect(() => normalizeEntry({ ...e, weight: -3 })).toThrow();
    expect(() => normalizeEntry({ ...e, answers: { energy: 2 } })).toThrow();
    expect(() => normalizeEntry({ ...e, answers: { energy: '0.5' } })).toThrow();
  });
  it('requiere resolver dos respuestas diferentes para la misma fecha', () => {
    const a = emptyEntry('2026-10-11'); a.weight = 54;
    const b = { ...a, weight: 55 }; const c = emptyEntry('2026-10-12'); c.weight = 56;
    const plan = planMerge([a], [b, c]);
    expect(plan.conflicts).toEqual([{ local: a, incoming: b }]); expect(plan.additions).toEqual([c]);
  });
  it('no duplica registros cuando solo cambia la fecha de actualización', () => {
    const a = emptyEntry('2026-10-11'); a.weight = 54;
    const b = { ...a, updatedAt: '2026-10-12T12:00:00Z' };
    expect(planMerge([a], [b])).toEqual({ additions: [], conflicts: [] });
  });
});
