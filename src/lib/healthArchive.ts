import { MAX_HEALTH_ZIP, type HonorArchive } from './honorHealth';

export function parseHealthArchive(buffer: ArrayBuffer, signal?: AbortSignal): Promise<HonorArchive> {
  if (buffer.byteLength > MAX_HEALTH_ZIP) return Promise.reject(new Error('La copia supera los 20 MB permitidos.'));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Lectura cancelada.', 'AbortError')); return; }
    const worker = new Worker(new URL('./healthArchive.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Lectura cancelada.', 'AbortError')); };
    const timer = setTimeout(() => { finish(); reject(new Error('La copia tardó demasiado en procesarse. Vuelve a intentarlo.')); }, 30000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: HonorArchive; error?: string }>) => {
      finish();
      if (event.data.result) resolve(event.data.result); else reject(new Error(event.data.error ?? 'No se pudo leer la copia.'));
    };
    worker.onerror = () => { finish(); reject(new Error('No se pudo abrir el lector de salud. Actualiza la página e inténtalo de nuevo.')); };
    worker.postMessage(buffer, [buffer]);
  });
}
