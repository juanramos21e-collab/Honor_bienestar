import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudConfigured, cloudError, fetchCloudDays, observeUser, uploadDay, type User } from './cloud';
import { defaultProfile, type Conflict, type DayEntry, type Profile } from './model';
import { acknowledgeSync, applyCloudSnapshot, getDays, getPending, getProfile, putDays, patchProfile, queueSync, readSetting, saveLocalDays, saveSetting } from './storage';

export function useWellbeing(notify: (message: string) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [days, setDays] = useState<DayEntry[]>([]);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Solo en este dispositivo');
  const [syncConflicts, setSyncConflicts] = useState<Conflict[]>([]);
  const [storageError, setStorageError] = useState(false);
  const scope = user ? `user:${user.uid}` : 'guest';
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const syncing = useRef(false);
  const conflictRef = useRef(syncConflicts); conflictRef.current = syncConflicts;
  useEffect(() => {
    if (!cloudConfigured) return;
    let stop: (() => void) | undefined; let active = true;
    observeUser(value => { if (active) setUser(value); }).then(fn => { if (active) stop = fn; else fn(); }).catch(error => notify(cloudError(error)));
    return () => { active = false; stop?.(); };
  }, [notify]);
  useEffect(() => {
    let active = true;
    setLoading(true); setDays([]); setProfile(defaultProfile); setSyncConflicts([]);
    Promise.all([getDays(scope), getProfile(scope)]).then(([records, preferences]) => {
      if (active) { setDays(records); setProfile(preferences); setStorageError(false); }
    }).catch(() => { if (active) { setStorageError(true); notify('No se pudo abrir el almacenamiento del navegador. Habilita los datos del sitio para guardar tu progreso.'); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, notify]);
  const sync = useCallback(async () => {
    if (!user || syncing.current || conflictRef.current.length) return;
    if (!navigator.onLine) { setStatus('Cambios guardados · sin conexión'); return; }
    const account = `user:${user.uid}`;
    syncing.current = true; setStatus('Sincronizando…');
    try {
      const remote = await fetchCloudDays(user.uid);
      if (scopeRef.current !== account) return;
      const { pending, bases } = await applyCloudSnapshot(account, remote);
      const versions = { ...bases };
      const sent: DayEntry[] = [], conflicts: Conflict[] = [];
      for (const entry of pending) {
        const result = await uploadDay(user.uid, entry, bases?.[entry.date] ?? null);
        if (result.ok) { sent.push(entry); versions[entry.date] = entry.updatedAt; }
        else if (result.remote) conflicts.push({ local: entry, incoming: result.remote });
        else throw new Error('Un registro cambió en la nube. Vuelve a sincronizar para revisar los cambios.');
      }
      await acknowledgeSync(account, sent); await saveSetting(`bases|${account}`, versions);
      if (scopeRef.current !== account) return;
      setDays(await getDays(account)); setSyncConflicts(conflicts);
      setStatus(conflicts.length ? 'Hay cambios por revisar' : (await getPending(account)).length ? 'Cambios pendientes de sincronizar' : 'Sincronizado con tu cuenta');
    } catch (error) { if (scopeRef.current === account) { setStatus('Guardado aquí · nube pendiente'); notify(cloudError(error)); } }
    finally { syncing.current = false; }
  }, [user, notify]);
  useEffect(() => {
    if (loading || !user) { if (!user) setStatus('Solo en este dispositivo'); return; }
    void sync();
    const onFocus = () => { void sync(); };
    window.addEventListener('online', onFocus); window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => { window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [sync, loading, user]);
  const saveEntries = async (entries: DayEntry[]) => {
    const account = scope;
    await saveLocalDays(account, entries, !!user); // Datos y cola de sincronización en una transacción local.
    if (scopeRef.current === account) setDays(await getDays(account));
    if (user) { setStatus('Guardado aquí · sincronizando'); void sync(); }
  };
  const saveProfile = async (value: Partial<Profile>) => { const updated = await patchProfile(scope, value); if (scopeRef.current === scope) setProfile(updated); };
  const resolveSync = async (choices: Record<string, 'local' | 'incoming'>) => {
    if (!user) return;
    const versions = await readSetting<Record<string, string>>(`bases|${scope}`) ?? {};
    const picked: DayEntry[] = [], accepted: DayEntry[] = [], uploads: DayEntry[] = [];
    for (const conflict of syncConflicts) {
      versions[conflict.local.date] = conflict.incoming.updatedAt;
      if (choices[conflict.local.date] === 'incoming') { picked.push(conflict.incoming); accepted.push(conflict.local); }
      else { const updated = { ...conflict.local, updatedAt: new Date().toISOString() }; picked.push(updated); uploads.push(updated); }
    }
    await acknowledgeSync(scope, accepted); await queueSync(scope, uploads); await putDays(scope, picked); await saveSetting(`bases|${scope}`, versions);
    setDays(await getDays(scope)); conflictRef.current = []; setSyncConflicts([]); void sync();
  };
  return { user, days, profile, scope, loading, status, storageError, saveEntries, saveProfile, sync, syncConflicts, resolveSync };
}
