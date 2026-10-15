import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  uid: 'owner', token: 'temporary-test-token' as string | null, scopes: [] as string[], apps: [] as { name: string }[],
  initialize: vi.fn((_config: unknown, name = '[DEFAULT]') => ({ name })),
  parameters: vi.fn(), persistence: vi.fn(), signOut: vi.fn(async () => {}),
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
    setCustomParameters(parameters: unknown) { mock.parameters(parameters); }
    static credentialFromResult() { return mock.token ? { accessToken: mock.token } : null; }
  },
}));
vi.mock('firebase/firestore', () => ({ getFirestore: (app: unknown) => ({ app }) }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mock.uid = 'owner'; mock.token = 'temporary-test-token'; mock.scopes.length = 0; mock.apps = [];
  const storage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ user: { emailAddress: 'example@example.test' } })));
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-test'); vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'example.test'); vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test'); vi.stubEnv('VITE_FIREBASE_APP_ID', 'test');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Reutilización del acceso Google sin cambiar el historial', () => {
  it('mantiene el cliente principal separado aunque Drive se haya inicializado primero', async () => {
    const { observeUser } = await import('../src/lib/cloud'); mock.apps = [{ name: 'honor-drive' }];
    await observeUser(() => {});
    expect(mock.persistence).toHaveBeenCalledWith({ app: { name: '[DEFAULT]' } }, 'local');
  });
  it('pide lectura con la cuenta conocida sin forzar un selector y separa la sesión del historial', async () => {
    const { authorizeDrive } = await import('../src/lib/cloud');
    const result = await authorizeDrive('owner', 'example@example.test');
    expect(result.email).toBe('example@example.test');
    expect(mock.scopes).toEqual(['https://www.googleapis.com/auth/drive.readonly']);
    expect(mock.parameters).toHaveBeenCalledWith({ include_granted_scopes: 'true', login_hint: 'example@example.test' });
    expect(mock.initialize).toHaveBeenCalledWith(expect.any(Object), 'honor-drive');
    expect(mock.persistence).toHaveBeenCalledWith({ app: { name: 'honor-drive' } }, 'memory');
    expect(mock.signOut).toHaveBeenCalledWith({ app: { name: 'honor-drive' } });
  });
  it('reutiliza el permiso al actualizar y después de recargar la pestaña', async () => {
    const { authorizeDrive } = await import('../src/lib/cloud');
    const first = await authorizeDrive('owner');
    expect(await authorizeDrive('owner')).toEqual(first);
    vi.resetModules();
    const reloaded = await import('../src/lib/cloud');
    expect(await reloaded.restoreDriveAuthorization('user:owner', 'EXAMPLE@example.test')).toEqual(first);
    expect(await reloaded.authorizeDrive('owner')).toEqual(first);
    expect(mock.popup).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  });
  it('rechaza una cuenta distinta y no conserva ese permiso', async () => {
    const { authorizeDrive, restoreDriveAuthorization } = await import('../src/lib/cloud'); mock.uid = 'different';
    await expect(authorizeDrive('owner')).rejects.toThrow('misma cuenta');
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
    expect(mock.signOut).toHaveBeenCalledOnce();
  });
  it('no comparte el permiso entre invitado, otra cuenta o un correo distinto', async () => {
    const { authorizeDrive, restoreDriveAuthorization } = await import('../src/lib/cloud');
    await authorizeDrive();
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
    expect(await restoreDriveAuthorization('guest', 'other@example.test')).toBeNull();
    await authorizeDrive('owner');
    expect(await restoreDriveAuthorization('user:other')).toBeNull();
    expect(mock.popup).toHaveBeenCalledTimes(2);
  });
  it('solicita otro acceso solo al vencer y lo descarta al cerrar sesión', async () => {
    const { authorizeDrive, restoreDriveAuthorization, logout } = await import('../src/lib/cloud');
    const first = await authorizeDrive('owner');
    vi.spyOn(Date, 'now').mockReturnValue(first.expiresAt + 1);
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
    await authorizeDrive('owner'); expect(mock.popup).toHaveBeenCalledTimes(2);
    await logout(); expect(await restoreDriveAuthorization('user:owner')).toBeNull();
    expect(sessionStorage.getItem('honor-google-access-v1')).toBeNull();
  });
  it('aprovecha el acceso devuelto al iniciar sesión cuando Google ya permite Drive', async () => {
    const { login, authorizeDrive } = await import('../src/lib/cloud');
    await login();
    expect(fetch).not.toHaveBeenCalled();
    expect((await authorizeDrive('owner')).accessToken).toBe('temporary-test-token');
    expect(mock.popup).toHaveBeenCalledOnce();
    expect(mock.scopes).toEqual([]);
    expect(fetch).toHaveBeenCalledWith('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', expect.objectContaining({ headers: { Authorization: 'Bearer temporary-test-token' } }));
  });
  it('no confunde iniciar sesión con haber concedido el permiso de Drive', async () => {
    const { login, restoreDriveAuthorization, authorizeDrive } = await import('../src/lib/cloud');
    await login();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
    await authorizeDrive('owner');
    expect(mock.popup).toHaveBeenCalledTimes(2);
    expect(mock.scopes).toEqual(['https://www.googleapis.com/auth/drive.readonly']);
  });
  it('no restaura una autorización si se cerró sesión mientras Google respondía', async () => {
    const { authorizeDrive, restoreDriveAuthorization, logout } = await import('../src/lib/cloud');
    let finish!: (value: { user: { uid: string; email: string } }) => void;
    mock.popup.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = authorizeDrive('owner');
    await vi.waitFor(() => expect(mock.popup).toHaveBeenCalledOnce());
    await logout(); finish({ user: { uid: 'owner', email: 'example@example.test' } });
    await expect(pending).rejects.toThrow('sesión cambió');
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
  });
  it('no muestra conexión sin un token OAuth válido', async () => {
    const { authorizeDrive, restoreDriveAuthorization } = await import('../src/lib/cloud');
    mock.token = null;
    await expect(authorizeDrive('owner')).rejects.toThrow('no concedió');
    expect(await restoreDriveAuthorization('user:owner')).toBeNull();
  });
});
