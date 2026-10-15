import { describe, expect, it } from 'vitest';
import { aggregateHealth, normalizeHealth, pairedHealth } from '../src/lib/health';
import { emptyEntry, hasContent, moodScore, normalizeEntry, planMerge } from '../src/lib/model';
import { parseVoiceValue, spokenNumber, voiceQuestions } from '../src/lib/voice';

describe('Datos de reloj sin alterar el historial', () => {
  it('mantiene los registros anteriores y conserva cero frente a vacío', () => {
    const old = emptyEntry('2026-10-11');
    expect(normalizeEntry(old)).toEqual(old);
    expect(normalizeHealth({ steps: 0, sleepHours: null })).toEqual({ steps: 0 });
    const watch = { ...old, health: { steps: 0, sleepHours: 7.5 } };
    expect(hasContent(watch)).toBe(true); expect(moodScore(watch)).toBeNull();
    expect(normalizeEntry(JSON.parse(JSON.stringify(watch)))).toEqual(watch);
    expect(planMerge([old], [watch]).conflicts).toHaveLength(1);
  });
  it('rechaza valores imposibles, fracciones de pasos y fases mayores al sueño total', () => {
    for (const bad of [{ steps: 2.5 }, { spo2: 101 }, { heartRate: 0 }, { stress: -1 }, { sleepHours: 25 }, { sleepHours: 7, deepSleepHours: 3, lightSleepHours: 4, remSleepHours: 1 }, { steps: '8000' }, { futureMetric: 5 }]) expect(() => normalizeHealth(bad)).toThrow();
    expect(normalizeHealth({ sleepHours: 7.5, deepSleepHours: 2, lightSleepHours: 4, remSleepHours: 1.5 })).toBeDefined();
  });
  it('suma la actividad, promedia mediciones y solo compara días con ambos datos', () => {
    const a = emptyEntry('2026-10-01'), b = emptyEntry('2026-10-03'), c = emptyEntry('2026-10-10');
    a.health = { steps: 0, sleepHours: 8, heartRate: 70 }; a.answers.energy = .6;
    b.health = { steps: 8000, heartRate: 80 }; c.weight = 54;
    const data = aggregateHealth([a, b, c], 'Mes')[0];
    expect(data.steps).toBe(8000); expect(data.sleepHours).toBe(8); expect(data.heartRate).toBe(75); expect(data.spo2).toBeNull();
    expect(pairedHealth([a, b, c], 'steps')).toEqual([{ date: a.date, value: 0, mood: 20 }]);
  });
});
describe('Respuestas de voz en español', () => {
  it('entiende dígitos, palabras, decimales, unidades y miles, sin adivinar frases', () => {
    for (const [text, value] of [['54,3 kg', 54.3], ['cincuenta y cuatro coma tres', 54.3], ['siete coma veinticinco', 7.25], ['ocho mil quinientos', 8500], ['8.500 pasos', 8500], ['98%', 98], ['cero coma cero cinco', .05]] as const) expect(spokenNumber(text)).toBe(value);
    for (const text of ['uno dos', 'mucho', 'tengo 60 o 70', '-1']) expect(spokenNumber(text)).toBeNull();
  });
  it('acepta solo sí/no en actividades y las cinco palabras de estado con los mismos valores del formulario', () => {
    const all = voiceQuestions(false), feeling = all.find(q => q.kind === 'scale')!, activity = all[0];
    for (const text of ['sí', 'Sí.', 'si', 'sí lo hice']) expect(parseVoiceValue(activity, text)).toBe(1);
    for (const text of ['no', 'No.', 'no lo hice']) expect(parseVoiceValue(activity, text)).toBe(0);
    for (const text of ['uno', 'cinco', '1', '5', 'poco']) expect(parseVoiceValue(activity, text)).toBeNull();
    for (const [text, value] of [['nada', 0], ['Poco.', .25], ['medio', .5], ['Bastante', .75], ['mucho', 1]] as const) expect(parseVoiceValue(feeling, text)).toBe(value);
    for (const text of ['sí', 'no', 'uno', 'tres', 'cinco', '5', 'muy bien']) expect(parseVoiceValue(feeling, text)).toBeNull();
    const weight = all.find(q => q.kind === 'weight')!;
    expect(parseVoiceValue(weight, 'cincuenta y cuatro coma tres kilogramos')).toBe(54.3);
    for (const text of ['mucho', 'sí', '0', '501 kg']) expect(parseVoiceValue(weight, text)).toBeNull();
  });
  it('incluye salud opcional, interpreta horas y permite apuntes libres antes de confirmar', () => {
    const all = voiceQuestions(true), sleep = all.find(q => q.id === 'sleepHours')!;
    expect(parseVoiceValue(sleep, 'siete horas treinta minutos')).toBe(7.5);
    expect(parseVoiceValue(sleep, 'siete horas noventa minutos')).toBeNull();
    expect(voiceQuestions(false).some(q => q.kind === 'health')).toBe(false);
    expect(all.at(-2)?.kind).toBe('notes'); expect(all.at(-1)?.kind).toBe('confirm');
    expect(parseVoiceValue(all.at(-2)!, 'Hoy me sentí mejor, salí a caminar.')).toBe('Hoy me sentí mejor, salí a caminar.');
  });
});
