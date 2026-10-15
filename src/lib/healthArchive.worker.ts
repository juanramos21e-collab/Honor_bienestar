import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readHonorArchive } from './healthArchiveCore';

let sql: ReturnType<typeof initSqlJs> | undefined;
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const SQL = await (sql ??= initSqlJs({ locateFile: () => wasmUrl }));
    self.postMessage({ result: await readHonorArchive(event.data, SQL) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo leer la copia de salud.' }); }
};
