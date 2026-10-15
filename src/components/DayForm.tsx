import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Heart, Scale, Sparkles } from 'lucide-react';
import { ACTIVITIES, VARIABLES, emptyEntry, formatDate, hasContent, productivity, showPercent, type DayEntry, type VariableId } from '../lib/model';
import { getDraft, removeDraft, saveDraft } from '../lib/storage';
import HealthFields, { healthText } from './HealthFields';
import VoiceAssistant from './VoiceAssistant';
import { HEALTH_METRICS, normalizeHealth, type HealthId } from '../lib/health';
import type { VoiceQuestion } from '../lib/voice';
import type { ActivityId } from '../lib/model';

const questions: Record<string, { question: string; hint: string }> = {
  energy: { question: '¿Cuánta energía tienes?', hint: 'Piensa en tu vitalidad en este momento.' },
  thoughts: { question: '¿Cuánto te pesan tus pensamientos?', hint: 'Pensamientos sobre situaciones que te quitan paz. Más intensidad resta al estado.' },
  personal: { question: '¿Cómo van tus proyectos personales?', hint: 'Tu avance en proyectos, oficios o emprendimientos.' },
  university: { question: '¿Cómo van tus proyectos universitarios?', hint: 'Tu avance con tareas y proyectos de tus cursos.' },
  health: { question: '¿Cómo te sientes de salud?', hint: 'Tu percepción de salud en este momento.' },
  pain: { question: '¿Cuánto dolor o malestar sientes?', hint: 'Incluye dolor físico y emocional. Más intensidad resta al estado.' },
};
export default function DayForm({ scope, initial, date, onBack, onSave, notify }: {
  scope: string; initial?: DayEntry; date: string; onBack: () => void; onSave: (entry: DayEntry) => Promise<void>; notify: (m: string) => void;
}) {
  const [entry, setEntry] = useState(initial ?? emptyEntry(date));
  const [step, setStep] = useState(0); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState<DayEntry | null>(null);
  const [failedDraft, setFailedDraft] = useState<DayEntry | null>(null);
  const [weightText, setWeightText] = useState(initial?.weight?.toString() ?? '');
  const [healthValues, setHealthValues] = useState(healthText(initial?.health));
  const [voiceActive, setVoiceActive] = useState(false);
  const locked = saving || voiceActive;
  const draftStatus = savedDraft === entry ? 'Borrador guardado en este dispositivo' : failedDraft === entry ? 'No se pudo guardar el borrador' : 'Guardando borrador…';
  const lastWrite = useRef<Promise<void>>(Promise.resolve());
  const finished = useRef(false);
  useEffect(() => {
    let active = true;
    getDraft(scope, date).then(draft => {
      if (active && draft) { setEntry(draft); setWeightText(draft.weight?.toString() ?? ''); setHealthValues(healthText(draft.health)); notify('Retomaste tu borrador. Tus respuestas siguen aquí.'); }
    }).catch(() => notify('No se pudo recuperar el borrador.')).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [date, scope, notify]);
  useEffect(() => {
    if (!ready || finished.current) return;
    // Serializar las escrituras evita que un borrador antiguo reemplace al último.
    lastWrite.current = lastWrite.current.catch(() => {}).then(() => saveDraft(scope, entry));
    lastWrite.current.then(() => setSavedDraft(entry)).catch(() => { setFailedDraft(entry); notify('No se pudo guardar. Revisa el espacio disponible del navegador.'); });
  }, [entry, ready, scope, notify]);
  const setAnswer = (id: VariableId, value: number | null) => setEntry(e => ({ ...e, answers: { ...e.answers, [id]: value } }));
  const invalidWeight = weightText.trim() !== '' && (!Number.isFinite(Number(weightText.replace(',', '.'))) || Number(weightText.replace(',', '.')) <= 0 || Number(weightText.replace(',', '.')) > 500);
  let healthError = '';
  try { normalizeHealth(Object.fromEntries(Object.entries(healthValues).filter(([, raw]) => raw.trim()).map(([key, raw]) => [key, Number(raw.replace(',', '.'))]))); }
  catch (error) { healthError = (error as Error).message; }
  const changeHealth = (id: HealthId, raw: string) => {
    setHealthValues(values => ({ ...values, [id]: raw }));
    const metric = HEALTH_METRICS.find(m => m.id === id)!, value = Number(raw.replace(',', '.'));
    setEntry(prev => { const health = { ...prev.health }; delete health[id]; if (raw.trim() && Number.isFinite(value) && value >= metric.min && value <= metric.max && (!metric.integer || Number.isInteger(value))) health[id] = value; const next = { ...prev }; if (Object.keys(health).length) next.health = health; else delete next.health; return next; });
  };
  const voiceAnswer = (question: VoiceQuestion, value: number | string): string | void => {
    if (question.kind === 'activity') setEntry(e => ({ ...e, productivityMode: 'activities', activities: { ...e.activities, [question.id as ActivityId]: Number(value) } }));
    if (question.kind === 'scale') setAnswer(question.id as VariableId, Number(value));
    if (question.kind === 'weight') { setWeightText(String(value)); setEntry(e => ({ ...e, weight: Number(value) })); }
    if (question.kind === 'health') changeHealth(question.id as HealthId, String(value));
    if (question.kind === 'notes') setEntry(e => ({ ...e, notes: String(value) }));
  };
  const save = async () => {
    if (invalidWeight) { notify('Ingresa un peso válido entre 0 y 500 kg, mayor que cero.'); return; }
    if (healthError) { notify(healthError); setStep(2); return; }
    if (!hasContent(entry)) { notify('Completa al menos una respuesta, un dato de salud o tu peso.'); return; }
    setSaving(true);
    try {
      await lastWrite.current;
      const complete = { ...entry, answers: { ...entry.answers, productivity: productivity(entry) }, updatedAt: new Date().toISOString() };
      await onSave(complete);
      finished.current = true; await removeDraft(scope, date); onBack(); notify('Tu día está guardado. Puedes volver y editar tus respuestas.');
    } catch { notify('No se pudo guardar el registro. Tu borrador se conserva para reintentarlo.'); }
    finally { setSaving(false); }
  };
  if (!ready) return <p className="loading">Recuperando tus respuestas…</p>;
  return <div className="form-page page-enter">
    <button className="text-button back-button" onClick={onBack}><ArrowLeft size={17} /> Volver al inicio</button>
    <div className="section-heading"><span className="eyebrow">UN MOMENTO PARA TI</span><h1>{initial ? 'Tu día puede cambiar.' : '¿Qué hiciste hoy?'}</h1><p>{formatDate(date, true)} · Puedes revisar y editar tus respuestas.</p></div>
    <VoiceAssistant disabled={saving} onAnswer={voiceAnswer} onSave={() => { void save(); }} onStep={setStep} onActive={setVoiceActive} />
    <div className="steps" aria-label="Pasos del registro">{['Mis actividades', 'Cómo me siento', 'Peso y cierre'].map((label, index) => <button key={label} disabled={locked} onClick={() => setStep(index)} className={step === index ? 'active' : ''} aria-current={step === index ? 'step' : undefined}><span>{index < step ? <Check size={15} /> : index + 1}</span>{label}</button>)}</div>
    {step === 0 && <section className="form-card"><div className="card-heading"><Sparkles className="mint" /><div><h2>Los pequeños pasos cuentan</h2><p>Marca lo que hiciste. Puedes dejar respuestas pendientes.</p></div></div>
      {entry.productivityMode === 'manual' && <div className="notice"><p>Productividad importada: <strong>{showPercent(entry.answers.productivity)}</strong>. Se conserva hasta que elijas calcularla con tus actividades.</p><button className="text-button" onClick={() => setEntry(e => ({ ...e, productivityMode: 'activities' }))}>Calcular con mis actividades <ArrowRight size={16} /></button></div>}
      <div className="activities">{ACTIVITIES.map(a => <div className="activity-row" key={a.id}><div><h3>{a.label}</h3><p>{a.hint}</p><small>Aporta {a.weight * 100}% a productividad</small></div><div className="answer-pills" role="group" aria-label={a.label}>{[{ label: 'No', value: 0 }, { label: 'Sí', value: 1 }].map(option => <button key={option.label} aria-pressed={entry.activities[a.id] === option.value} disabled={locked} className={entry.activities[a.id] === option.value ? 'selected' : ''} onClick={() => setEntry(e => ({ ...e, productivityMode: 'activities', activities: { ...e.activities, [a.id]: e.activities[a.id] === option.value ? null : option.value } }))}>{option.value === 1 ? <CheckCircle2 size={16} /> : <Circle size={16} />}{option.label}</button>)}{entry.activities[a.id] !== null && ![0, 1].includes(entry.activities[a.id]!) && <small>{showPercent(entry.activities[a.id])} registrado</small>}</div></div>)}</div>
      <div className="form-total"><span>Tu productividad</span><strong>{showPercent(productivity(entry))}</strong></div>
    </section>}
    {step === 1 && <section className="form-card"><div className="card-heading"><Heart className="mint" /><div><h2>¿Cómo estás en este momento?</h2><p>No hay respuestas correctas. Escúchate con calma.</p></div></div><div className="questions">{VARIABLES.filter(v => v.id !== 'productivity').map(v => <div className="question" key={v.id}><label htmlFor={v.id}><h3>{questions[v.id].question}</h3></label><p>{questions[v.id].hint}</p><div className="scale-options">{[0, .25, .5, .75, 1].map((value, i) => <button key={value} aria-label={`${v.label}: ${value * 100}%`} aria-pressed={entry.answers[v.id] === value} className={entry.answers[v.id] === value ? 'selected' : ''} disabled={locked} onClick={() => setAnswer(v.id, value)}>{['Nada', 'Poco', 'Medio', 'Bastante', 'Mucho'][i]}</button>)}</div><div className="exact-value"><label htmlFor={v.id}>Valor exacto (%)</label><input id={v.id} type="number" min="0" max="100" step="1" inputMode="decimal" value={entry.answers[v.id] === null ? '' : Number((entry.answers[v.id]! * 100).toFixed(4))} disabled={locked} onChange={e => { const raw = e.target.value; const value = Number(raw); if (raw === '') setAnswer(v.id, null); else if (Number.isFinite(value) && value >= 0 && value <= 100) setAnswer(v.id, value / 100); }} /><button className="text-button" onClick={() => setAnswer(v.id, null)} disabled={locked}>Omitir</button></div></div>)}</div></section>}
    {step === 2 && <section className="form-card"><div className="card-heading"><Scale className="mint" /><div><h2>Un último vistazo</h2><p>El peso es opcional y no cambia el cálculo de tu estado.</p></div></div><label className="field-label" htmlFor="weight">¿Cuál es tu peso hoy?</label><div className="weight-input"><input id="weight" type="text" inputMode="decimal" placeholder="Ej. 54,3" aria-invalid={invalidWeight} value={weightText} disabled={locked} onChange={e => { const raw = e.target.value; setWeightText(raw); const value = Number(raw.replace(',', '.')); setEntry(prev => ({ ...prev, weight: raw.trim() && Number.isFinite(value) && value > 0 && value <= 500 ? value : null })); }} /><span>kg</span></div>{invalidWeight && <p className="error-text">Usa un número mayor que cero y hasta 500 kg.</p>}<HealthFields values={healthValues} disabled={locked} onChange={changeHealth} />{healthError && <p className="error-text" role="alert">{healthError}</p>}<label className="field-label" htmlFor="notes">Algo que quieras recordar <span>(opcional)</span></label><textarea id="notes" placeholder="¿Qué hizo especial este día?" maxLength={2000} value={entry.notes} disabled={locked} onChange={e => setEntry(prev => ({ ...prev, notes: e.target.value }))} /></section>}
    <div className="form-footer"><span className="draft-status"><span className="status-dot" />{draftStatus}</span><div className="form-actions">{step > 0 && <button className="secondary-button" disabled={locked} onClick={() => { setStep(s => s - 1); window.scrollTo(0, 0); }}>Anterior</button>}{step < 2 ? <button className="primary-button" disabled={locked} onClick={() => { setStep(s => s + 1); window.scrollTo(0, 0); }}>Continuar <ArrowRight size={18} /></button> : <button className="primary-button" disabled={locked || invalidWeight || !!healthError} onClick={() => { void save(); }}>{saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar mi día'} <Check size={18} /></button>}</div></div>
  </div>;
}
