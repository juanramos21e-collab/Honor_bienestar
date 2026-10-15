import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Volume2 } from 'lucide-react';
import { VoiceSession, voiceAvailable, voiceQuestions, type VoiceQuestion, type VoiceState } from '../lib/voice';

const initial: VoiceState = { phase: 'idle', index: 0, message: '', transcript: '' };
export default function VoiceAssistant({ disabled, onAnswer, onSave, onStep, onActive }: {
  disabled: boolean; onAnswer: (question: VoiceQuestion, value: number | string) => string | void; onSave: () => void; onStep: (step: number) => void; onActive: (active: boolean) => void;
}) {
  const [mode, setMode] = useState<'full' | 'short'>('full');
  const [scale, setScale] = useState<4 | 5>(4);
  const [includeHealth, setIncludeHealth] = useState(true);
  const [state, setState] = useState(initial);
  const session = useRef<VoiceSession | null>(null);
  const handlers = useRef({ onAnswer, onSave, onStep, onActive }); handlers.current = { onAnswer, onSave, onStep, onActive };
  const active = ['speaking', 'cue', 'listening'].includes(state.phase);
  const questions = session.current?.questions ?? voiceQuestions(includeHealth);
  const question = questions[state.index];
  const available = voiceAvailable();
  useEffect(() => () => { session.current?.dispose(); handlers.current.onActive(false); }, []);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden && session.current) session.current.pause('En pausa porque saliste de la pantalla. Pulsa continuar para seguir.'); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);
  const start = () => {
    session.current?.dispose();
    const next = new VoiceSession(voiceQuestions(includeHealth), mode, scale, {
      state: value => { setState(value); handlers.current.onActive(['speaking', 'cue', 'listening'].includes(value.phase)); handlers.current.onStep(next.questions[value.index].step); },
      answer: (q, value) => handlers.current.onAnswer(q, value), save: () => handlers.current.onSave(),
    });
    session.current = next; next.unlockAudio(); next.run(0);
  };
  const resume = () => { session.current?.unlockAudio(); session.current?.run(); };
  return <section className="voice-card" aria-label="Asistente de voz"><div className="card-heading"><Volume2 className="mint" /><div><h2>Responder por voz</h2><p>Escucha la pregunta y habla después de la señal.</p></div></div>
    {state.phase === 'idle' || state.phase === 'complete' ? <><div className="voice-options"><label>Lectura<select aria-label="Lectura" value={mode} onChange={e => setMode(e.target.value as typeof mode)} disabled={disabled}><option value="full">Completa · lee cada pregunta</option><option value="short">Breve · solo «Pregunta 1…»</option></select></label><label>Escala de respuestas<select aria-label="Escala de respuestas" value={scale} onChange={e => setScale(Number(e.target.value) as 4 | 5)} disabled={disabled}><option value="4">1 Nada · 2 Poco · 3 Bastante · 4 Mucho</option><option value="5">1 Nada · 2 Poco · 3 Medio · 4 Bastante · 5 Mucho</option></select></label></div><label className="voice-checkbox"><input type="checkbox" checked={includeHealth} onChange={e => setIncludeHealth(e.target.checked)} disabled={disabled} />Incluir las preguntas de mi reloj</label><p className="muted">Actividades: sí o no; también puedes usar la escala numérica. Di «omitir» para conservar un dato, «anterior», «repetir» o «pausa». Al final podrás dictar tus apuntes y elegir guardar o revisar.</p><button className="secondary-button" disabled={disabled || !available} onClick={start}><Mic size={17} />{state.phase === 'complete' ? 'Empezar otro recorrido' : 'Comenzar por voz'}</button></> : <><div className={`voice-turn ${state.phase}`} role="status" aria-live="polite"><span className="status-dot" /><strong>{state.message}</strong></div><p className="voice-counter">Pregunta {state.index + 1} de {questions.length}</p><h3>{question.text}</h3>{['scale', 'activity'].includes(question.kind) && <p>{scale === 4 ? '1 Nada · 2 Poco · 3 Bastante · 4 Mucho' : '1 Nada · 2 Poco · 3 Medio · 4 Bastante · 5 Mucho'}</p>}{state.transcript && <p className="voice-transcript">Escuchado: {state.transcript}</p>}<div className="voice-actions">{active ? <button className="secondary-button" onClick={() => session.current?.pause()}><Pause size={16} />Pausar voz</button> : <button className="primary-button" disabled={disabled} onClick={resume}><Mic size={17} />Continuar por voz</button>}<button className="text-button" disabled={state.index === 0 || disabled} onClick={() => session.current?.run(state.index - 1)}>Anterior por voz</button>{question.kind !== 'confirm' && <button className="text-button" disabled={disabled} onClick={() => session.current?.run(state.index + 1)}>Omitir pregunta</button>}<button className="text-button" onClick={() => { session.current?.dispose(); session.current = null; setState(initial); onActive(false); }}>Terminar voz y revisar</button></div></>}
    {!available ? <p className="muted">Tu navegador no admite este modo. Prueba Chrome en Android o Windows, o completa el formulario.</p> : <p className="voice-privacy">Necesita permiso de micrófono y puede necesitar Internet. El navegador puede enviar el audio a su servicio de reconocimiento. Honor guarda el texto y los valores; no guarda grabaciones.</p>}
    {state.phase === 'complete' && <p role="status">{state.message}</p>}
  </section>;
}
