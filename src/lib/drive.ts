import { MAX_HEALTH_ZIP } from './honorHealth';

export type DriveFile = { id: string; name: string; modifiedTime: string; version: string; size: string; md5Checksum?: string; mimeType: string };
export type DriveFolder = { id: string; name: string };
export class DriveAccessExpired extends Error { constructor() { super('Google necesita renovar el acceso a Drive.'); } }
const API = 'https://www.googleapis.com/drive/v3';
const idValid = (id: string) => /^[A-Za-z0-9_-]{1,200}$/.test(id);
export const driveFileVersion = (file: DriveFile) => [file.id, file.version, file.modifiedTime, file.md5Checksum ?? '', file.size].join('|');
async function request(path: string, token: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token }, signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (response.status === 401) throw new DriveAccessExpired();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reasons = (body.error?.errors ?? []).map((x: { reason?: string }) => x.reason);
    if (response.status === 403 && (reasons.includes('accessNotConfigured') || (body.error?.details ?? []).some((x: { reason?: string }) => x.reason === 'SERVICE_DISABLED'))) throw new Error('Falta habilitar Google Drive API en el proyecto honor-bienestar.');
    if (response.status === 403 && (reasons.includes('insufficientPermissions') || (body.error?.details ?? []).some((x: { reason?: string }) => x.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) throw new DriveAccessExpired();
    if (response.status === 403) throw new Error('Google no concedió lectura de esta carpeta. Revisa el permiso de Drive y vuelve a conectar.');
    if (response.status === 404) throw new Error('La carpeta o la copia ya no está disponible. Elige la carpeta de exportación de nuevo.');
    if (response.status === 429 || response.status >= 500) throw new Error('Drive está ocupado. Se volverá a comprobar en la próxima actualización.');
    throw new Error('No se pudo consultar la copia de Drive.');
  }
  return response;
}
async function list<T>(query: string, fields: string, token: string, signal?: AbortSignal, orderBy = 'name'): Promise<T[]> {
  const result: T[] = []; let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ q: query, fields: 'nextPageToken,files(' + fields + ')', pageSize: '100', orderBy, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}) });
    const response = await request('/files?' + params.toString(), token, signal);
    const data = await response.json();
    if (!Array.isArray(data.files)) throw new Error('Drive devolvió una lista de archivos inválida.');
    result.push(...data.files); pageToken = data.nextPageToken ?? '';
    if (!pageToken) return result;
  }
  throw new Error('Esta carpeta contiene demasiados archivos. Usa una carpeta dedicada a la copia de Health Connect.');
}
export async function driveFolders(parent: string, token: string, signal?: AbortSignal): Promise<DriveFolder[]> {
  if (!idValid(parent)) throw new Error('La carpeta de Drive no es válida.');
  return list("'" + parent + "' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'", 'id,name', token, signal);
}
export async function latestHealthZip(folder: string, token: string, signal?: AbortSignal): Promise<DriveFile | null> {
  if (!idValid(folder)) throw new Error('La carpeta de Drive no es válida.');
  const files = await list<DriveFile>("'" + folder + "' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'", 'id,name,modifiedTime,version,size,md5Checksum,mimeType', token, signal, 'modifiedTime desc');
  // Solo archivos directos de la carpeta elegida; nunca buscar por todo Drive.
  const candidates = files.filter(file => /\.zip$/i.test(file.name) && /^healthconnect/i.test(file.name.replace(/[\s_-]/g, '')));
  candidates.sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime) || a.id.localeCompare(b.id));
  const file = candidates[0];
  if (!file) return null;
  if (!idValid(file.id) || !Number.isFinite(Date.parse(file.modifiedTime)) || !/^\d+$/.test(file.size ?? '') || typeof file.version !== 'string') throw new Error('La copia de Drive todavía no tiene metadatos completos. Espera a que termine de subirse.');
  return file;
}
export async function downloadHealthZip(file: DriveFile, token: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!idValid(file.id) || !/^\d+$/.test(file.size) || Number(file.size) <= 0) throw new Error('Drive todavía está subiendo la copia de Health Connect.');
  if (Number(file.size) > MAX_HEALTH_ZIP) throw new Error('La copia supera los 20 MB permitidos.');
  const response = await request('/files/' + encodeURIComponent(file.id) + '?alt=media&supportsAllDrives=true', token, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No se pudo descargar la copia de salud.');
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_HEALTH_ZIP) throw new Error('La copia supera los 20 MB permitidos.');
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  if (length !== Number(file.size)) throw new Error('La copia cambió o no terminó de descargarse. Se comprobará de nuevo.');
  const result = new Uint8Array(length); let start = 0;
  for (const part of parts) { result.set(part, start); start += part.byteLength; }
  return result.buffer;
}
