// Sustituido únicamente por Playwright en el servidor de desarrollo.
// No se importa desde la aplicación ni se incluye en dist.
export const cloudConfigured = true;
export async function observeUser(callback) { callback(null); return () => {}; }
export async function login() {}
export async function logout() {}
export async function fetchCloudDays() { return []; }
export async function uploadDay() { return { ok: true }; }
export function cloudError() { return 'Error de nube simulado.'; }
export async function authorizeDrive() {
  window.__drive.authCalls++;
  return { accessToken: 'browser-test-token', email: 'drive@example.test', expiresAt: Date.now() + 55 * 60000 };
}
