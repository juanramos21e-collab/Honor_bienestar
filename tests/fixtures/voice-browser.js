// Doble controlable del navegador: ninguna grabación ni servicio externo.
(() => {
  const mock = { utterances: [], speechActive: false, recognitionStarts: 0, activeRecognition: null, speech: null, tone: null, overlap: false };
  mock.finishReading = () => { const speech = mock.speech; mock.speech = null; mock.speechActive = false; speech?.onend?.(); };
  mock.finishCue = () => { const tone = mock.tone; mock.tone = null; tone?.onended?.(); };
  mock.answer = (...parts) => { const r = mock.activeRecognition; if (!r) throw new Error('No está escuchando'); mock.activeRecognition = null; r.onresult?.({ results: parts.map(transcript => ({ isFinal: true, 0: { transcript } })) }); r.onend?.(); };
  mock.error = error => mock.activeRecognition?.onerror?.({ error });
  window.__voice = mock;
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    cancel() { mock.speechActive = false; mock.speech = null; },
    speak(speech) { if (mock.activeRecognition) mock.overlap = true; mock.speechActive = true; mock.speech = speech; mock.utterances.push(speech.text); },
  } });
  window.SpeechRecognition = class {
    start() { if (mock.speechActive || mock.tone) mock.overlap = true; mock.recognitionStarts++; mock.activeRecognition = this; }
    abort() { if (mock.activeRecognition === this) mock.activeRecognition = null; }
  };
  window.AudioContext = class {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
    createOscillator() { const tone = { frequency: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() { mock.tone = tone; }, onended: null }; return tone; }
  };
})();
