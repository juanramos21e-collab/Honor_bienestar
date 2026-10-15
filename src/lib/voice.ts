import { ACTIVITIES, VARIABLES, type ActivityId, type VariableId } from './model';
import { HEALTH_METRICS, type HealthId } from './health';
import { isNativeAndroid } from './nativeHealth';
import { deviceTools } from './deviceTools';

export type VoiceQuestion = { id: string; text: string; step: number; kind: 'activity' | 'scale' | 'weight' | 'health' | 'notes' | 'confirm'; min?: number; max?: number; integer?: boolean };
export const FEELING_QUESTIONS: Record<string, string> = {
  energy: '¿Cuánta energía tienes?', thoughts: '¿Cuánto te pesan tus pensamientos?', personal: '¿Cómo van tus proyectos personales?', university: '¿Cómo van tus proyectos universitarios?', health: '¿Cómo te sientes de salud?', pain: '¿Cuánto dolor físico o emocional sientes?',
};
const feelingValues: Record<string, number> = { nada: 0, poco: .25, medio: .5, bastante: .75, mucho: 1 };
export function voiceInstruction(question: VoiceQuestion): string {
  if (question.kind === 'activity') return 'Responde solo «sí» o «no».';
  if (question.kind === 'scale') return 'Responde «nada», «poco», «medio», «bastante» o «mucho».';
  if (question.kind === 'weight') return 'Di tu peso en kilogramos. Por ejemplo: «54,3 kilos».';
  if (question.kind === 'health') return 'Di el valor real de esta medición en la unidad indicada, o di «omitir».';
  if (question.kind === 'notes') return 'Puedes dictar tus apuntes o decir «omitir».';
  return 'Di «guardar» o «revisar».';
}
function sectionIntroduction(question: VoiceQuestion): string {
  if (question.kind === 'activity') return 'Primera parte: tus actividades. Responde solo sí o no.';
  if (question.kind === 'scale') return 'Ahora, cómo te sientes. Responde nada, poco, medio, bastante o mucho.';
  if (question.kind === 'weight') return 'Ahora, el peso. Di únicamente tu peso en kilogramos.';
  if (question.kind === 'health') return 'Ahora, los datos de tu reloj. Responde con el valor real en la unidad indicada, o di omitir.';
  return '';
}
export function voiceQuestions(includeHealth: boolean): VoiceQuestion[] {
  return [
    ...ACTIVITIES.map(a => ({ id: a.id, text: `¿Hoy pudiste ${a.label.toLowerCase()}?`, step: 0, kind: 'activity' as const })),
    ...VARIABLES.filter(v => v.id !== 'productivity').map(v => ({ id: v.id, text: FEELING_QUESTIONS[v.id], step: 1, kind: 'scale' as const })),
    { id: 'weight', text: '¿Cuánto pesas hoy, en kilogramos? También puedes decir omitir.', step: 2, kind: 'weight', min: .01, max: 500 },
    ...(includeHealth ? HEALTH_METRICS.map(m => ({ id: m.id, text: `¿Cuál es tu valor de ${m.label.toLowerCase()}, en ${m.unit === 'h' ? 'horas' : m.unit === 'lpm' ? 'latidos por minuto' : m.unit === '/100' ? 'una escala de cero a cien' : m.unit}? Puedes decir omitir.`, step: 2, kind: 'health' as const, min: m.min, max: m.max, integer: m.integer })) : []),
    { id: 'notes', text: '¿Cómo te sientes hoy? Cuéntame lo que quieras dejar en tus apuntes del día.', step: 2, kind: 'notes' },
    { id: 'confirm', text: 'Terminamos. Di guardar para guardar tu día, o revisar para comprobar tus respuestas.', step: 2, kind: 'confirm' },
  ];
}
export const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!;:]/g, ' ').trim().replace(/[.,]$/, '').trim().replace(/\s+/g, ' ');
const small: Record<string, number> = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100 };
function integerWords(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  if (text in small) return small[text];
  const thousands = text.match(/^(?:(.+) )?mil(?: (.+))?$/);
  if (thousands) { const a = thousands[1] ? integerWords(thousands[1]) : 1, b = thousands[2] ? integerWords(thousands[2]) : 0; return a !== null && a >= 1 && a <= 100 && b !== null && b < 1000 ? a * 1000 + b : null; }
  const hundreds: Record<string, number> = { ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
  const [first, ...rest] = text.split(' ');
  if (first in hundreds) { const b = rest.length ? integerWords(rest.join(' ')) : 0; return b !== null && b < 100 ? hundreds[first] + b : null; }
  const tens = text.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa) y (uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)$/);
  return tens ? small[tens[1]] + small[tens[2]] : null;
}
export function spokenNumber(input: string): number | null {
  let text = plain(input).replace(/%/g, '').replace(/\b(kilogramos?|kilos?|kg|pasos?|kilometros?|km|kilocalorias?|calorias?|kcal|latidos por minuto|lpm|por ciento|porcentaje|puntos?|minutos?|min|horas?|h)\b/g, '').trim().replace(/\s+/g, ' ');
  // El reconocedor suele devolver números ya escritos con dígitos.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '');
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(',', '.'));
  const parts = text.split(/ (?:coma|punto) /);
  if (parts.length > 2) return null;
  const whole = integerWords(parts[0]);
  if (whole === null || parts.length === 1) return whole;
  const decimal = parts[1].split(' ').map(word => /^\d+$/.test(word) ? word : small[word] !== undefined && small[word] < 10 ? String(small[word]) : '');
  const fraction = decimal.every(Boolean) ? decimal.join('') : integerWords(parts[1]);
  return fraction !== null ? Number(`${whole}.${fraction}`) : null;
}
export function parseVoiceValue(question: VoiceQuestion, input: string): number | string | null {
  const text = plain(input);
  if (question.kind === 'notes') return input.trim() ? input.trim().slice(0, 2000) : null;
  if (question.kind === 'activity') {
    if (['si', 'si lo hice', 'si pude', 'hecho', 'lo hice'].includes(text)) return 1;
    if (['no', 'no lo hice', 'no pude'].includes(text)) return 0;
    return null;
  }
  if (question.kind === 'scale') return Object.hasOwn(feelingValues, text) ? feelingValues[text] : null;
  if (question.kind === 'confirm') return text === 'guardar' ? 'save' : text === 'revisar' ? 'review' : null;
  let number: number | null;
  const hours = plain(input).match(/^(.+) horas?(?: y)? (.+) minutos?$/);
  if (hours && question.kind === 'health' && question.id.endsWith('Hours')) { const h = spokenNumber(hours[1]), m = spokenNumber(hours[2]); number = h !== null && m !== null && m < 60 ? h + m / 60 : null; }
  else number = spokenNumber(input);
  return number !== null && number >= question.min! && number <= question.max! && (!question.integer || Number.isInteger(number)) ? number : null;
}
export type VoiceAnswer = { kind: 'activity'; id: ActivityId; value: number } | { kind: 'scale'; id: VariableId; value: number } | { kind: 'weight'; value: number } | { kind: 'health'; id: HealthId; value: number } | { kind: 'notes'; value: string };

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null; start: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export type VoiceState = { phase: 'idle' | 'speaking' | 'cue' | 'listening' | 'paused' | 'complete'; index: number; message: string; transcript: string };
export function voiceAvailable() { const w = window as SpeechWindow; return isNativeAndroid() || (!!(w.SpeechRecognition || w.webkitSpeechRecognition) && !!window.speechSynthesis); }
export class VoiceSession {
  state: VoiceState = { phase: 'idle', index: 0, message: '', transcript: '' };
  private generation = 0;
  private recognition?: Recognition;
  private timer?: ReturnType<typeof setTimeout>;
  private audio?: AudioContext;
  private announcedKind?: VoiceQuestion['kind'];
  constructor(readonly questions: VoiceQuestion[], readonly mode: 'full' | 'short', readonly callbacks: { state: (state: VoiceState) => void; answer: (question: VoiceQuestion, value: number | string) => string | void; save: () => void }) {}
  private emit(patch: Partial<VoiceState>) { this.state = { ...this.state, ...patch }; this.callbacks.state(this.state); }
  private stopIO() {
    this.generation++; clearTimeout(this.timer);
    if (this.recognition) { this.recognition.onend = null; this.recognition.onresult = null; this.recognition.onerror = null; this.recognition.abort(); this.recognition = undefined; }
    window.speechSynthesis?.cancel();
    if (isNativeAndroid()) void deviceTools.stop().catch(() => {});
  }
  unlockAudio() { try { this.audio ??= new AudioContext(); void this.audio.resume().catch(() => {}); } catch { /* La señal visual también marca el turno. */ } }
  dispose() { this.stopIO(); void this.audio?.close().catch(() => {}); }
  pause(message = 'En pausa. Puedes revisar o continuar cuando quieras.') { this.stopIO(); this.emit({ phase: 'paused', message }); }
  run(index = this.state.index, retry?: string) {
    this.stopIO();
    if (index < 0 || index >= this.questions.length) return;
    const generation = this.generation, question = this.questions[index];
    this.emit({ index, phase: 'speaking', message: 'Escucha. El micrófono está cerrado.', transcript: '' });
    const introduction = question.kind !== this.announcedKind ? sectionIntroduction(question) : '';
    const prompt = this.mode === 'short' && !['notes', 'confirm'].includes(question.kind) ? `Pregunta ${index + 1}.` : question.text;
    const text = retry ?? [introduction, prompt].filter(Boolean).join(' ');
    if (isNativeAndroid()) {
      this.timer = setTimeout(() => { if (generation === this.generation) this.pause('La lectura se interrumpió. Pulsa continuar para reintentar.'); }, 60000);
      void deviceTools.stop().then(() => { if (generation === this.generation) return deviceTools.speak({ text }); }).then(() => { if (generation === this.generation) this.cue(generation); }).catch((error: Error) => { if (generation === this.generation) this.pause(error.message || 'No se pudo leer la pregunta.'); });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'es-PE'; utterance.rate = 1;
    utterance.onend = () => { if (generation === this.generation) this.cue(generation); };
    utterance.onerror = () => { if (generation === this.generation) this.pause('No se pudo leer la pregunta. Intenta continuar o usa el formulario.'); };
    this.timer = setTimeout(() => { if (generation === this.generation) this.pause('La lectura se interrumpió. Pulsa continuar para reintentar.'); }, 60000);
    window.speechSynthesis.speak(utterance);
  }
  private cue(generation: number) {
    this.announcedKind = this.questions[this.state.index].kind;
    clearTimeout(this.timer); this.emit({ phase: 'cue', message: 'Tu turno…' });
    if (isNativeAndroid()) { void deviceTools.cue().then(() => { if (generation === this.generation) this.listen(generation); }).catch(() => { if (generation === this.generation) this.pause('La señal se interrumpió. Puedes continuar.'); }); return; }
    // El micrófono se abre después de terminar la voz Y la señal.
    if (this.audio?.state === 'running') {
      const tone = this.audio.createOscillator(), gain = this.audio.createGain(); tone.frequency.value = 660; gain.gain.value = .08; tone.connect(gain); gain.connect(this.audio.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); if (generation === this.generation) this.listen(generation); };
      tone.start(); tone.stop(this.audio.currentTime + .14);
    } else this.timer = setTimeout(() => { if (generation === this.generation) this.listen(generation); }, 180);
  }
  private listen(generation: number) {
    if (isNativeAndroid()) {
      this.emit({ phase: 'listening', message: 'Habla ahora · micrófono abierto' });
      this.timer = setTimeout(() => { if (generation === this.generation) this.pause('Se agotó el turno. Puedes continuar o responder en pantalla.'); }, this.questions[this.state.index].kind === 'notes' ? 90000 : 25000);
      void deviceTools.listen().then(result => { if (generation === this.generation) { clearTimeout(this.timer); this.consume(result.transcript); } }).catch((error: Error) => { if (generation === this.generation) this.pause(error.message || 'No se pudo escuchar la respuesta.'); });
      return;
    }
    const w = window as SpeechWindow, Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) { this.pause('Este navegador no admite respuestas por voz. Usa Chrome en Android o Windows.'); return; }
    const recognition = new Constructor(); this.recognition = recognition; recognition.lang = 'es-PE'; recognition.interimResults = true; recognition.continuous = false;
    let finalText = '', interimText = '';
    recognition.onresult = event => {
      if (generation !== this.generation) return;
      finalText = Array.from(event.results).filter(r => r.isFinal).map(r => r[0].transcript).join(' ').trim();
      interimText = Array.from(event.results).map(r => r[0].transcript).join(' ').trim();
      this.emit({ transcript: interimText });
    };
    recognition.onerror = event => { if (generation === this.generation) this.pause(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Permite el micrófono en el navegador para usar la voz.' : event.error === 'no-speech' ? 'No escuché una respuesta. Pulsa continuar para intentarlo de nuevo.' : 'No se pudo escuchar. Comprueba el micrófono y la conexión, y pulsa continuar.'); };
    recognition.onend = () => {
      if (generation !== this.generation) return;
      this.recognition = undefined; clearTimeout(this.timer);
      const question = this.questions[this.state.index];
      // Algunas sesiones terminan tras una respuesta muy corta sin emitir un resultado final.
      // Solo se recuperan opciones completas de los dos conjuntos cerrados, nunca números o apuntes parciales.
      const response = finalText || (['activity', 'scale'].includes(question.kind) && parseVoiceValue(question, interimText) !== null ? interimText : '');
      if (!response) { this.pause('No escuché una respuesta. Pulsa continuar o responde en pantalla.'); return; }
      this.consume(response);
    };
    this.emit({ phase: 'listening', message: 'Habla ahora · micrófono abierto' });
    try { recognition.start(); this.timer = setTimeout(() => { if (generation === this.generation) this.pause('Se agotó el turno. Tu respuesta anterior se conserva; puedes continuar.'); }, this.questions[this.state.index].kind === 'notes' ? 90000 : 25000); }
    catch { this.pause('No se pudo abrir el micrófono. Pulsa continuar para reintentar.'); }
  }
  private consume(text: string) {
    const command = plain(text), question = this.questions[this.state.index];
    if (['pausa', 'pausar'].includes(command)) { this.pause(); return; }
    if (['repetir', 'repite'].includes(command)) { this.run(); return; }
    if (['anterior', 'volver'].includes(command)) { this.run(Math.max(0, this.state.index - 1)); return; }
    if (['omitir', 'saltar', 'mantener'].includes(command) && question.kind !== 'confirm') { this.run(this.state.index + 1); return; }
    const value = parseVoiceValue(question, text);
    if (value === null) { this.run(this.state.index, `No entendí la respuesta. ${voiceInstruction(question)}`); return; }
    if (question.kind === 'confirm') { this.stopIO(); this.emit({ phase: 'complete', message: value === 'save' ? 'Guardando tus respuestas…' : 'Respuestas listas para revisar.' }); if (value === 'save') this.callbacks.save(); return; }
    const error = this.callbacks.answer(question, value);
    if (error) { this.run(this.state.index, error); return; }
    this.run(this.state.index + 1);
  }
}
