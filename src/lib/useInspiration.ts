import { useCallback, useEffect, useState } from 'react';
import catalog from '../data/inspiration.json';
import { VARIABLES, answersFor, moodScore, type DayEntry, type VariableId } from './model';
import { readSetting, saveSetting } from './storage';

type History = { phrases: { time: number; slot: number; text: string }[]; advice: { date: string; id: VariableId; text: string }[] };
export function useInspiration(scope: string, entry?: DayEntry) {
  const [phrase, setPhrase] = useState('Cada pequeño paso también es progreso.');
  const [advice, setAdvice] = useState({ label: 'Tu primer paso', text: 'Registra tu día para conocer qué te ayuda y qué necesita más atención.' });
  const score = entry ? moodScore(entry) : null;
  const rotate = useCallback(async (force = false) => {
    const now = Date.now(), slot = Math.floor(now / (2 * 3600000));
    const history = await readSetting<History>(`inspiration|${scope}`) ?? { phrases: [], advice: [] };
    const group = catalog.phrases.filter(p => score !== null && score >= .5 ? p.number > 30 : p.number <= 30);
    const texts = group.map(p => p.text);
    const previous = history.phrases.findLast(p => p.slot === slot && texts.includes(p.text));
    if (previous && !force) setPhrase(previous.text);
    else {
      const recent = history.phrases.filter(p => p.time > now - 7 * 86400000).map(p => p.text);
      let available = texts.filter(t => !recent.includes(t)); if (!available.length) available = texts.filter(t => t !== previous?.text); if (!available.length) available = texts;
      const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
      const selected = available[Math.floor(random * available.length)];
      history.phrases = [...history.phrases.filter(p => p.time > now - 7 * 86400000), { time: now, slot, text: selected }]; setPhrase(selected);
    }
    if (entry) {
      const answers = answersFor(entry);
      const available = VARIABLES.filter(v => answers[v.id] !== null);
      const focus = available.reduce<typeof VARIABLES[number] | undefined>((min, v) => !min || answers[v.id]! < answers[min.id]! ? v : min, undefined);
      if (focus) {
        const options = catalog.advice[focus.id];
        let chosen = history.advice.find(a => a.date === entry.date && a.id === focus.id)?.text;
        if (!chosen) {
          const used = history.advice.filter(a => a.id === focus.id).map(a => a.text);
          let remaining = options.filter(t => !used.includes(t));
          if (!remaining.length) { history.advice = history.advice.filter(a => a.id !== focus.id); remaining = options; }
          chosen = remaining[Math.floor(Math.random() * remaining.length)];
          history.advice.push({ date: entry.date, id: focus.id, text: chosen });
        }
        setAdvice({ label: focus.label, text: chosen });
      } else setAdvice({ label: 'Un día a la vez', text: 'Puedes registrar cómo te sientes además de tu peso.' });
    } else setAdvice({ label: 'Tu primer paso', text: 'Registra tu día para conocer qué te ayuda y qué necesita más atención.' });
    await saveSetting(`inspiration|${scope}`, history);
  }, [scope, score, entry]);
  useEffect(() => { void rotate().catch(() => {}); const timer = setInterval(() => { void rotate().catch(() => {}); }, 60000); return () => clearInterval(timer); }, [rotate]);
  return { phrase, advice, rotate: () => rotate(true) };
}
