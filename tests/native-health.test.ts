import { describe, expect, it } from 'vitest';
import { emptyEntry, moodScore } from '../src/lib/model';
import { prepareHealthUpdate, validateHealthRange, type HealthRead } from '../src/lib/nativeHealth';

function reading(): HealthRead { return { from: '2026-10-01', to: '2026-10-03', readAt: '2026-10-04T02:00:00Z', origin: 'com.hihonor.health', warnings: [], entries: [{ date: '2026-10-01', health: { steps: 0, sleepHours: 7.5 }, weight: 54.3 }, { date: '2026-10-03', health: { heartRate: 75 } }] }; }
describe('Actualizar desde Health Connect', () => {
  it('incorpora solo las mediciones recibidas y conserva respuestas, apuntes y otros datos', () => {
    const before = emptyEntry('2026-10-01'); before.answers.energy = .75; before.activities.read = 1; before.notes = 'Un día importante.'; before.health = { stress: 25, spo2: 98 }; before.weight = 55;
    const score = moodScore(before), result = prepareHealthUpdate([before], reading());
    expect(result[0].notes).toBe(before.notes); expect(result[0].activities).toEqual(before.activities); expect(result[0].answers).toEqual(before.answers); expect(moodScore(result[0])).toBe(score);
    expect(result[0].health).toEqual({ steps: 0, sleepHours: 7.5, stress: 25, spo2: 98 }); expect(result[0].weight).toBe(54.3);
    expect(result[1].weight).toBeNull(); expect(result[1].health).toEqual({ heartRate: 75 }); expect(before.weight).toBe(55);
  });
  it('no duplica días ni genera cambios al repetir la misma consulta', () => {
    const first = prepareHealthUpdate([], reading());
    expect(prepareHealthUpdate(first, { ...reading(), readAt: '2026-10-05T00:00:00Z' })).toEqual([]);
    expect(prepareHealthUpdate(first, { ...reading(), entries: [] })).toEqual([]);
  });
  it('rechaza duplicados, fechas fuera del rango, falta de origen y valores imposibles', () => {
    const good = reading();
    for (const bad of [{ ...good, entries: [good.entries[0], good.entries[0]] }, { ...good, entries: [{ ...good.entries[0], date: '2026-09-30' }] }, { ...good, origin: '' }, { ...good, entries: [{ ...good.entries[0], health: { spo2: 101 } }] }, { ...good, entries: [{ ...good.entries[0], weight: 0 }] }]) expect(() => prepareHealthUpdate([], bad)).toThrow();
  });
  it('no mezcla fases antiguas incompatibles con un sueño total nuevo', () => {
    const before = emptyEntry('2026-10-01'); before.health = { sleepHours: 8, deepSleepHours: 5 };
    const next = reading(); next.entries[0].health.sleepHours = 4;
    expect(() => prepareHealthUpdate([before], next)).toThrow('fases de sueño'); expect(before.health.sleepHours).toBe(8);
  });
  it('limita las consultas a treinta fechas reales, incluyendo cambios de mes', () => {
    expect(validateHealthRange('2026-09-20', '2026-10-19')).toBe(''); expect(validateHealthRange('2026-09-20', '2026-10-20')).not.toBe('');
    expect(validateHealthRange('2026-02-30', '2026-03-02')).not.toBe(''); expect(validateHealthRange('2026-10-03', '2026-10-01')).not.toBe('');
  });
});
