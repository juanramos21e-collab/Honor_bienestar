// Sustituido únicamente por Playwright en el servidor de desarrollo.
// No se importa desde la aplicación ni se incluye en dist.
import { clearGoogleAccess, readGoogleAccess, saveGoogleAccess } from '/src/lib/googleAccess.ts';
export const cloudConfigured = true;
let observer;
export async function observeUser(callback) { observer = callback; callback(null); return () => { if (observer === callback) observer = null; }; }
export async function login() {
  const uid = window.__drive.loginUid ?? 'owner';
  const access = readGoogleAccess('guest');
  if (access?.uid === uid) saveGoogleAccess({ ...access, scope: 'user:' + uid });
  observer?.({ uid, email: 'drive@example.test', displayName: 'Cuenta sintética' });
}
export async function logout() { clearGoogleAccess(); observer?.(null); }
export async function fetchCloudDays() { return []; }
export async function uploadDay() { return { ok: true }; }
export function cloudError() { return 'Error de nube simulado.'; }
export const forgetDriveAuthorization = clearGoogleAccess;
export async function restoreDriveAuthorization(scope, email) { return readGoogleAccess(scope, email); }
export async function authorizeDrive(uid, email) {
  const scope = uid ? 'user:' + uid : 'guest';
  const existing = await restoreDriveAuthorization(scope, email);
  if (existing) return existing;
  window.__drive.authCalls++;
  const result = { accessToken: 'browser-test-token', email: 'drive@example.test', expiresAt: Date.now() + 55 * 60000, scope, uid: uid ?? 'owner', driveGranted: true };
  saveGoogleAccess(result);
  return result;
}
