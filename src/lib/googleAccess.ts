// Acceso OAuth temporal: sobrevive a una recarga en esta pestaña, sin formar
// parte del historial, los respaldos ni la sesión persistente de Firebase.
export type DriveAuthorization = { accessToken: string; expiresAt: number; email: string };
export type GoogleAccess = DriveAuthorization & { scope: string; uid: string; driveGranted: boolean };
const KEY = 'honor-google-access-v1';
let memory: GoogleAccess | null = null;
let revision = 0;
const emailKey = (email: string) => email.trim().toLowerCase();
export const googleAccessRevision = () => revision;

export function clearGoogleAccess(scope?: string) {
  if (scope && rawAccess()?.scope !== scope) return;
  revision++; memory = null;
  try { sessionStorage.removeItem(KEY); } catch { /* Navegación sin almacenamiento: solo memoria. */ }
}
function rawAccess(): GoogleAccess | null {
  if (memory) return memory;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (value && typeof value.accessToken === 'string' && value.accessToken.length > 0
      && typeof value.email === 'string' && typeof value.uid === 'string' && value.uid.length > 0
      && typeof value.scope === 'string' && (value.scope === 'guest' || value.scope === 'user:' + value.uid)
      && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
      && value.expiresAt <= Date.now() + 60 * 60000 && typeof value.driveGranted === 'boolean') memory = value;
  } catch { /* Una copia inválida no autoriza ninguna consulta. */ }
  return memory;
}
export function readGoogleAccess(scope: string, email?: string): GoogleAccess | null {
  const value = rawAccess();
  if (value && value.expiresAt <= Date.now()) { clearGoogleAccess(); return null; }
  if (!value || value.scope !== scope || (email && emailKey(value.email) !== emailKey(email))) return null;
  return value;
}
export function saveGoogleAccess(value: GoogleAccess, expectedRevision = revision) {
  if (revision !== expectedRevision) return false;
  revision++; memory = value;
  try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Conservar en memoria si la pestaña no admite almacenamiento. */ }
  return true;
}
