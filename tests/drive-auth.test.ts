import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  uid: 'owner', scopes: [] as string[], apps: [] as { name: string }[],
  initialize: vi.fn((_config: unknown, name = '[DEFAULT]') => ({ name })),
  persistence: vi.fn(), signOut: vi.fn(async () => {}),
  popup: vi.fn(async (_auth: unknown, _provider: unknown) => ({ user: { uid: mock.uid, email: 'example@example.test' } })),
}));
vi.mock('firebase/app', () => ({ getApps: () => mock.apps, initializeApp: mock.initialize }));
vi.mock('firebase/auth', () => ({
  getAuth: (app: { name: string }) => ({ app }),
  inMemoryPersistence: 'memory', setPersistence: mock.persistence,
  browserLocalPersistence: 'local', getRedirectResult: vi.fn(async () => null), onAuthStateChanged: vi.fn(() => () => {}),
  signInWithPopup: mock.popup, signOut: mock.signOut,
  GoogleAuthProvider: class {
    addScope(scope: string) { mock.scopes.push(scope); }
    setCustomParameters() {}
    static credentialFromResult() { return { accessToken: 'temporary-test-token' }; }
  },
}));
vi.mock('firebase/firestore', () => ({ getFirestore: (app: unknown) => ({ app }) }));
beforeEach(() => { mock.uid = 'owner'; mock.scopes.length = 0; vi.clearAllMocks(); vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-test'); vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'example.test'); vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test'); vi.stubEnv('VITE_FIREBASE_APP_ID', 'test'); });
describe('Autorización de Drive separada del historial', () => {
  it('mantiene el cliente principal separado aunque Drive se haya inicializado primero', async () => {
    const { observeUser } = await import('../src/lib/cloud'); mock.apps = [{ name: 'honor-drive' }];
    await observeUser(() => {});
    expect(mock.persistence).toHaveBeenCalledWith({ app: { name: '[DEFAULT]' } }, 'local');
    mock.apps = [];
  });
  it('solicita solo lectura y mantiene la autorización en una app Firebase secundaria en memoria', async () => {
    const { authorizeDrive } = await import('../src/lib/cloud');
    const result = await authorizeDrive('owner');
    expect(result.email).toBe('example@example.test');
    expect(mock.scopes).toEqual(['https://www.googleapis.com/auth/drive.readonly']);
    expect(mock.initialize).toHaveBeenCalledWith(expect.any(Object), 'honor-drive');
    expect(mock.persistence).toHaveBeenCalledWith({ app: { name: 'honor-drive' } }, 'memory');
    expect(mock.signOut).toHaveBeenCalledWith({ app: { name: 'honor-drive' } });
  });
  it('rechaza una cuenta distinta de la que tiene abierto el historial', async () => {
    const { authorizeDrive } = await import('../src/lib/cloud'); mock.uid = 'different';
    await expect(authorizeDrive('owner')).rejects.toThrow('misma cuenta');
    expect(mock.signOut).toHaveBeenCalledOnce();
  });
});
