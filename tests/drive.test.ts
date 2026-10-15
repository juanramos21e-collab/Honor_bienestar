import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadHealthZip, DriveAccessExpired, driveFolders, latestHealthZip } from '../src/lib/drive';

afterEach(() => vi.unstubAllGlobals());
describe('Lectura limitada a la carpeta elegida de Drive', () => {
  it('pagina dentro de la carpeta, usa autorización en cabecera y elige la última copia de Health Connect', async () => {
    const requests: URL[] = [];
    const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input); requests.push(url);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
      expect(url.searchParams.get('q')).toContain("'chosen-folder' in parents");
      expect(input).not.toContain('test-token');
      return Response.json(requests.length === 1 ? { nextPageToken: 'second-page', files: [
        { id: 'other', name: 'otro.zip', modifiedTime: '2026-05-10T00:00:00Z', size: '3', version: '1' },
        { id: 'old', name: 'Health Connect.zip', modifiedTime: '2026-05-01T00:00:00Z', size: '3', version: '1' },
      ] } : { files: [{ id: 'new', name: 'Health Connect (1).zip', modifiedTime: '2026-05-03T00:00:00Z', size: '3', version: '2' }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await latestHealthZip('chosen-folder', 'test-token'))?.id).toBe('new');
    expect(requests[1].searchParams.get('pageToken')).toBe('second-page');
  });
  it('distingue carpeta vacía, copia pendiente y descarga incompleta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ files: [] })));
    expect(await latestHealthZip('folder', 'token')).toBeNull();
    const file = { id: 'backup', name: 'Health Connect.zip', size: '0', modifiedTime: '2026-05-01T00:00:00Z', version: '1', mimeType: 'application/zip' };
    await expect(downloadHealthZip(file, 'token')).rejects.toThrow('subiendo');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]))));
    await expect(downloadHealthZip({ ...file, size: '3' }, 'token')).rejects.toThrow('no terminó');
    expect(new Uint8Array(await downloadHealthZip({ ...file, size: '2' }, 'token'))).toEqual(new Uint8Array([1, 2]));
  });
  it('no transforma acceso caducado ni API deshabilitada en una lectura exitosa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(driveFolders('root', 'token')).rejects.toBeInstanceOf(DriveAccessExpired);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { errors: [{ reason: 'accessNotConfigured' }] } }, { status: 403 })));
    await expect(driveFolders('root', 'token')).rejects.toThrow('habilitar Google Drive API');
    await expect(driveFolders("x' or trashed=false", 'token')).rejects.toThrow('no es válida');
  });
});
