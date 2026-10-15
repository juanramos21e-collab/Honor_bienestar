import { normalizeEntry, type DayEntry } from './model';
import type { User } from 'firebase/auth';
import { healthBridge, isNativeAndroid } from './nativeHealth';
export type { User };

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const cloudConfigured = Object.values(config).every(v => typeof v === 'string' && v.trim().length > 0);
let clientPromise: ReturnType<typeof createClient> | undefined;
async function createClient() {
  const [appModule, authModule, firestore] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = appModule.getApps()[0] ?? appModule.initializeApp(config);
  const auth = authModule.getAuth(app);
  await authModule.setPersistence(auth, authModule.browserLocalPersistence);
  return { auth, db: firestore.getFirestore(app), authModule, firestore };
}
function client() {
  if (!cloudConfigured) throw new Error('Google todavía no está configurado en esta web. Puedes continuar en este dispositivo.');
  return clientPromise ??= createClient();
}
export async function observeUser(callback: (user: User | null) => void) {
  const c = await client();
  // El resultado del retorno de Google se resuelve antes de leer la sesión.
  if (!isNativeAndroid()) await c.authModule.getRedirectResult(c.auth);
  return c.authModule.onAuthStateChanged(c.auth, callback);
}
export async function login() {
  const c = await client();
  if (isNativeAndroid()) {
    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) throw new Error('Falta configurar Google para esta versión Android. Puedes continuar en este dispositivo.');
    try {
      const { idToken } = await healthBridge.googleSignIn({ clientId });
      await c.authModule.signInWithCredential(c.auth, c.authModule.GoogleAuthProvider.credential(idToken));
    } catch (error) { if ((error as { code?: string }).code !== 'CANCELLED') throw error; }
    return;
  }
  const provider = new c.authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await c.authModule.signInWithPopup(c.auth, provider); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await c.authModule.signInWithRedirect(c.auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw error;
  }
}
export async function logout() { const c = await client(); await c.authModule.signOut(c.auth); }
export async function fetchCloudDays(uid: string): Promise<DayEntry[]> {
  const c = await client();
  const snapshot = await c.firestore.getDocsFromServer(c.firestore.collection(c.db, 'users', uid, 'days'));
  return snapshot.docs.map(d => normalizeEntry(d.data()));
}
export async function uploadDay(uid: string, entry: DayEntry, expectedVersion: string | null) {
  const c = await client();
  const ref = c.firestore.doc(c.db, 'users', uid, 'days', entry.date);
  return c.firestore.runTransaction(c.db, async transaction => {
    const snapshot = await transaction.get(ref);
    const remote = snapshot.exists() ? normalizeEntry(snapshot.data()) : null;
    if (remote && JSON.stringify(remote) === JSON.stringify(entry)) return { ok: true as const };
    if ((remote?.updatedAt ?? null) !== expectedVersion) return { ok: false as const, remote };
    transaction.set(ref, normalizeEntry(entry));
    return { ok: true as const };
  });
}
export function cloudError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'GOOGLE_SIGN_IN_FAILED') return 'Para conectar Google en Android, registra esta versión y su certificado en Firebase. El paquete incluye el paso android:google; puedes continuar en este dispositivo.';
  if (code.includes('unauthorized-domain')) return 'Este dominio necesita autorización en Firebase para iniciar sesión con Google.';
  if (code.includes('operation-not-allowed')) return 'Falta habilitar el proveedor Google en Firebase Authentication.';
  if (code.includes('permission-denied')) return 'La nube rechazó el acceso. Revisa las reglas de Firestore para esta cuenta.';
  if (code.includes('network') || code.includes('unavailable')) return 'Sin conexión con la nube. Los cambios siguen guardados en este dispositivo.';
  return 'No se pudo conectar con Google o la nube. Tus datos locales siguen disponibles. Inténtalo de nuevo.';
}
