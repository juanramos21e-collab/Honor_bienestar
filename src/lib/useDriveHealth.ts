import { useEffect, useRef, useState } from 'react';
import { authorizeDrive, forgetDriveAuthorization, restoreDriveAuthorization, type DriveAuthorization, type User } from './cloud';
import { downloadHealthZip, DriveAccessExpired, driveFileVersion, driveFolders, latestHealthZip, type DriveFolder } from './drive';
import { parseHealthArchive } from './healthArchive';
import { readSetting, saveSetting } from './storage';
import { HONOR_HEALTH_PACKAGE, type HonorArchive } from './honorHealth';

export type DriveConnection = {
  folder: DriveFolder; email: string; origin: typeof HONOR_HEALTH_PACKAGE;
  fileVersion?: string; fileName?: string; fileModifiedAt?: string;
  checkedAt?: string; importedAt?: string; days?: number; sourceRecords?: number; ignoredRecords?: number; warnings?: string[];
};
type Phase = 'loading' | 'disconnected' | 'authorizing' | 'checking' | 'current' | 'authorization_required' | 'waiting' | 'empty_honor' | 'error';
export function useDriveHealth({ scope, user, ready, onSave }: { scope: string; user: User | null; ready: boolean; onSave: (archive: HonorArchive) => Promise<number> }) {
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [phase, setPhase] = useState<Phase>('loading'), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [picker, setPicker] = useState(false);
  const [path, setPath] = useState<DriveFolder[]>([{ id: 'root', name: 'Mi unidad' }]);
  const [folders, setFolders] = useState<DriveFolder[]>([]), [updatedDays, setUpdatedDays] = useState(0);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const previousScope = useRef(scope);
  const props = useRef({ user, ready, onSave }); props.current = { user, ready, onSave };
  const saved = useRef<DriveConnection | null>(null), auth = useRef<DriveAuthorization | null>(null);
  const locked = useRef(false), browsing = useRef(false), generation = useRef(0), mounted = useRef(true);
  const controller = useRef<AbortController | null>(null), lastAttempt = useRef(0);
  const key = (account: string) => 'honor-drive-v1|' + account;
  const valid = (account: string, op: number) => mounted.current && scopeRef.current === account && generation.current === op;
  const begin = () => { const abort = new AbortController(); controller.current = abort; return abort; };
  const authorization = () => {
    if (!auth.current || auth.current.expiresAt <= Date.now()) { auth.current = null; throw new DriveAccessExpired(); }
    return auth.current;
  };
  useEffect(() => {
    mounted.current = true;
    if (previousScope.current !== scope) forgetDriveAuthorization(previousScope.current);
    previousScope.current = scope;
    const account = scope, op = ++generation.current;
    controller.current?.abort(); auth.current = null; saved.current = null; locked.current = false; browsing.current = false; lastAttempt.current = 0;
    setConnection(null); setPhase('loading'); setError(''); setBusy(false); setPicker(false); setUpdatedDays(0);
    void readSetting<DriveConnection>(key(account)).then(async value => {
      if (!valid(account, op)) return;
      if (value?.origin === HONOR_HEALTH_PACKAGE && /^[A-Za-z0-9_-]{1,200}$/.test(value.folder?.id ?? '') && typeof value.folder.name === 'string' && typeof value.email === 'string') {
        locked.current = true; saved.current = value; setConnection(value);
        try {
          const restored = await restoreDriveAuthorization(account, props.current.user?.email ?? value.email, begin().signal);
          if (!valid(account, op)) return;
          auth.current = restored;
          setPhase(restored ? value.days ? 'current' : value.checkedAt ? 'empty_honor' : 'waiting' : 'authorization_required');
        } finally { if (valid(account, op)) locked.current = false; }
        if (valid(account, op) && auth.current && props.current.ready) void syncRef.current(true);
      } else setPhase('disconnected');
    }).catch(() => { if (valid(account, op)) { setPhase('error'); setError('No se pudo abrir la configuración de Drive guardada en este dispositivo.'); } });
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); auth.current = null; };
  }, [scope]);
  const fail = (err: unknown) => {
    if ((err as Error).name === 'AbortError') return;
    if (err instanceof DriveAccessExpired) { forgetDriveAuthorization(scopeRef.current); auth.current = null; setPhase('authorization_required'); setError(''); }
    else { setPhase('error'); setError(err instanceof Error ? err.message : 'No se pudo consultar Drive.'); }
  };
  const sync = async (force = false) => {
    if (!props.current.ready || !saved.current || locked.current || browsing.current || !navigator.onLine || document.hidden) return;
    if (!force && Date.now() - lastAttempt.current < 60000) return;
    const account = scopeRef.current, op = generation.current, before = saved.current;
    locked.current = true; setBusy(true); setError(''); setPhase('checking'); lastAttempt.current = Date.now();
    const abort = begin();
    try {
      if (!auth.current || auth.current.expiresAt <= Date.now()) {
        const restored = await restoreDriveAuthorization(account, props.current.user?.email ?? before.email, abort.signal);
        if (!valid(account, op)) return;
        auth.current = restored;
      }
      const access = authorization(), file = await latestHealthZip(before.folder.id, access.accessToken, abort.signal);
      if (!valid(account, op)) return;
      if (!file || Number(file.size) === 0) { setPhase('waiting'); return; }
      const version = driveFileVersion(file);
      if (version === before.fileVersion) {
        const checked = { ...before, checkedAt: new Date().toISOString() };
        await saveSetting(key(account), checked);
        if (valid(account, op)) { saved.current = checked; setConnection(checked); setPhase(checked.days ? 'current' : 'empty_honor'); setUpdatedDays(0); }
        return;
      }
      const bytes = await downloadHealthZip(file, access.accessToken, abort.signal);
      const archive = await parseHealthArchive(bytes, abort.signal);
      // Evita procesar una descarga que Drive estaba reemplazando al leerla.
      const latest = await latestHealthZip(before.folder.id, access.accessToken, abort.signal);
      if (!latest || driveFileVersion(latest) !== version) throw new Error('La copia está cambiando en Drive. Se comprobará de nuevo en la próxima actualización.');
      if (!valid(account, op)) return;
      if (!props.current.ready) return;
      const count = await props.current.onSave(archive);
      if (!valid(account, op)) return;
      const checked: DriveConnection = { ...before, fileVersion: version, fileName: file.name, fileModifiedAt: file.modifiedTime, checkedAt: new Date().toISOString(), ...(count ? { importedAt: new Date().toISOString() } : {}), days: archive.entries.length, sourceRecords: archive.sourceRecords, ignoredRecords: archive.ignoredRecords, warnings: archive.warnings };
      await saveSetting(key(account), checked);
      if (valid(account, op)) { saved.current = checked; setConnection(checked); setUpdatedDays(count); setPhase(archive.entries.length ? 'current' : 'empty_honor'); }
    } catch (err) { if (valid(account, op)) fail(err); }
    finally { if (valid(account, op)) { locked.current = false; setBusy(false); } }
  };
  const syncRef = useRef(sync); syncRef.current = sync;
  useEffect(() => {
    if (!ready) return;
    const check = () => { void syncRef.current(); };
    const visible = () => { if (!document.hidden) check(); };
    void syncRef.current(true);
    window.addEventListener('online', check); window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(check, 5 * 60000);
    return () => { window.removeEventListener('online', check); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', visible); clearInterval(timer); };
  }, [ready]);
  const connect = async (changeFolder = false) => {
    if (locked.current || !props.current.ready) return;
    const account = scopeRef.current, op = generation.current;
    locked.current = true; setBusy(true); setError(''); setPhase('authorizing');
    let shouldSync = false;
    try {
      const result = await authorizeDrive(props.current.user?.uid, props.current.user?.email ?? (changeFolder ? undefined : saved.current?.email));
      if (!valid(account, op)) return;
      if (!changeFolder && saved.current && result.email.toLowerCase() !== saved.current.email.toLowerCase()) throw new Error('Elige la cuenta que contiene tu carpeta vinculada, o pulsa Cambiar carpeta.');
      auth.current = result;
      if (saved.current && !changeFolder) { shouldSync = true; }
      else {
        const abort = begin(), root = [{ id: 'root', name: 'Mi unidad' }];
        const next = await driveFolders('root', result.accessToken, abort.signal);
        if (!valid(account, op)) return;
        setPath(root); setFolders(next); setPicker(true); browsing.current = true; setPhase('disconnected');
      }
    } catch (err) { if (valid(account, op)) fail(err); }
    finally { if (valid(account, op)) { locked.current = false; setBusy(false); } }
    if (shouldSync && valid(account, op)) await syncRef.current(true);
  };
  const openFolder = async (nextPath: DriveFolder[]) => {
    if (locked.current || !nextPath.length) return;
    const account = scopeRef.current, op = generation.current; locked.current = true; setBusy(true); setError('');
    try {
      const result = await driveFolders(nextPath.at(-1)!.id, authorization().accessToken, begin().signal);
      if (valid(account, op)) { setPath(nextPath); setFolders(result); }
    } catch (err) { if (valid(account, op)) fail(err); }
    finally { if (valid(account, op)) { locked.current = false; setBusy(false); } }
  };
  const chooseFolder = async () => {
    if (locked.current || !path.length) return;
    const account = scopeRef.current, op = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      const value: DriveConnection = { folder: path.at(-1)!, email: authorization().email, origin: HONOR_HEALTH_PACKAGE };
      await saveSetting(key(account), value);
      if (!valid(account, op)) return;
      saved.current = value; setConnection(value); setPicker(false); browsing.current = false; setUpdatedDays(0);
    } catch (err) { if (valid(account, op)) fail(err); }
    finally { if (valid(account, op)) { locked.current = false; setBusy(false); } }
    if (valid(account, op) && !browsing.current) await syncRef.current(true);
  };
  const closePicker = () => { browsing.current = false; setPicker(false); setPhase(saved.current ? auth.current ? saved.current.days ? 'current' : saved.current.checkedAt ? 'empty_honor' : 'waiting' : 'authorization_required' : 'disconnected'); };
  const disconnect = async () => {
    const account = scopeRef.current;
    forgetDriveAuthorization(account);
    generation.current++; controller.current?.abort(); auth.current = null; saved.current = null; browsing.current = false; locked.current = false;
    setPicker(false); setConnection(null); setError(''); setPhase('disconnected'); setBusy(false); setUpdatedDays(0);
    await saveSetting(key(account), null);
  };
  return { connection, phase, error, busy, picker, path, folders, updatedDays, hasAccess: !!auth.current && auth.current.expiresAt > Date.now(), connect, sync, openFolder, chooseFolder, closePicker, disconnect };
}
export type DriveHealth = ReturnType<typeof useDriveHealth>;
