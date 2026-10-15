import { describe, expect, it } from 'vitest';
import { registerAndroid } from '../scripts/register-android-firebase.mjs';

const certificate = { packageName: 'app.honor.bienestar', sha1: 'a'.repeat(40), sha256: 'b'.repeat(64) };
describe('Registro Android limitado al proyecto y certificado del paquete', () => {
  it('reutiliza la app y los certificados existentes sin repetir escrituras', async () => {
    const writes: string[][] = [];
    const run = async (args: string[]) => {
      if (args[0] === 'apps:list') return [{ appId: 'android-app', packageName: certificate.packageName }];
      if (args[0] === 'apps:android:sha:list') return [{ shaHash: certificate.sha1.toUpperCase() }, { shaHash: certificate.sha256 }];
      writes.push(args); return {};
    };
    expect(await registerAndroid(run, certificate)).toBe('android-app'); expect(writes).toEqual([]);
  });
  it('crea solo el paquete previsto y añade únicamente los certificados que faltan', async () => {
    const calls: string[][] = [];
    const run = async (args: string[]) => {
      calls.push(args);
      if (args[0] === 'apps:list') return [{ appId: 'other', packageName: 'otra.aplicacion' }];
      if (args[0] === 'apps:create') return { appId: 'new-app' };
      if (args[0] === 'apps:android:sha:list') return [{ shaHash: certificate.sha1 }];
      return {};
    };
    await registerAndroid(run, certificate);
    expect(calls.filter(c => c[0] === 'apps:create')[0]).toContain(certificate.packageName);
    expect(calls.filter(c => c[0] === 'apps:android:sha:create')).toEqual([['apps:android:sha:create', 'new-app', certificate.sha256]]);
  });
  it('rechaza metadatos ajenos antes de llamar a Firebase', async () => {
    let called = false; const run = async () => { called = true; return []; };
    await expect(registerAndroid(run, { ...certificate, packageName: 'otro.paquete' })).rejects.toThrow('certificado');
    expect(called).toBe(false);
  });
});
