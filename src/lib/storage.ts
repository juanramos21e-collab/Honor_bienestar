import { openDB } from 'idb';
import { defaultProfile, normalizeEntry, type DayEntry, type Profile } from './model';

const dbPromise = openDB('honor-bienestar-v1', 1, {
  upgrade(db) { db.createObjectStore('days'); db.createObjectStore('settings'); db.createObjectStore('drafts'); },
});
export async function getDays(scope: string): Promise<DayEntry[]> {
  const db = await dbPromise;
  const tx = db.transaction('days');
  const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
  return values.filter((_, i) => String(keys[i]).startsWith(`${scope}|`)).map(normalizeEntry).sort((a, b) => a.date.localeCompare(b.date));
}
export async function putDays(scope: string, entries: DayEntry[]) {
  const db = await dbPromise;
  const tx = db.transaction('days', 'readwrite');
  await Promise.all(entries.map(e => tx.store.put(normalizeEntry(e), `${scope}|${e.date}`)));
  await tx.done;
}
export async function getProfile(scope: string): Promise<Profile> {
  return { ...defaultProfile, ...await (await dbPromise).get('settings', `profile|${scope}`) };
}
export async function patchProfile(scope: string, patch: Partial<Profile>): Promise<Profile> {
  const db = await dbPromise; const tx = db.transaction('settings', 'readwrite');
  const updated = { ...defaultProfile, ...await tx.store.get(`profile|${scope}`), ...patch };
  await tx.store.put(updated, `profile|${scope}`); await tx.done; return updated;
}
export async function saveLocalDays(scope: string, entries: DayEntry[], sync: boolean) {
  const db = await dbPromise; const tx = db.transaction(['days', 'settings'], 'readwrite');
  if (sync) {
    const previous: DayEntry[] = await tx.objectStore('settings').get(`pending|${scope}`) ?? [];
    const merged = new Map(previous.map(e => [e.date, e]));
    for (const e of entries) merged.set(e.date, normalizeEntry(e));
    await tx.objectStore('settings').put([...merged.values()], `pending|${scope}`);
  }
  for (const e of entries) await tx.objectStore('days').put(normalizeEntry(e), `${scope}|${e.date}`);
  await tx.done;
}
export async function applyCloudSnapshot(scope: string, remote: DayEntry[]) {
  const db = await dbPromise; const tx = db.transaction(['days', 'settings'], 'readwrite');
  const settings = tx.objectStore('settings');
  const pending: DayEntry[] = await settings.get(`pending|${scope}`) ?? [];
  const bases: Record<string, string> = await settings.get(`bases|${scope}`) ?? {};
  const pendingDates = new Set(pending.map(e => e.date));
  for (const entry of remote) if (!pendingDates.has(entry.date)) {
    await tx.objectStore('days').put(normalizeEntry(entry), `${scope}|${entry.date}`);
    bases[entry.date] = entry.updatedAt;
  }
  await settings.put(bases, `bases|${scope}`); await tx.done;
  return { pending, bases };
}
export async function readSetting<T>(key: string): Promise<T | undefined> { return (await dbPromise).get('settings', key); }
export async function saveSetting(key: string, value: unknown) { await (await dbPromise).put('settings', value, key); }
export async function getDraft(scope: string, date: string): Promise<DayEntry | undefined> { return (await dbPromise).get('drafts', `${scope}|${date}`); }
export async function saveDraft(scope: string, entry: DayEntry) { await (await dbPromise).put('drafts', entry, `${scope}|${entry.date}`); }
export async function removeDraft(scope: string, date: string) { await (await dbPromise).delete('drafts', `${scope}|${date}`); }
export async function queueSync(scope: string, entries: DayEntry[]) {
  const db = await dbPromise;
  const tx = db.transaction('settings', 'readwrite');
  const previous: DayEntry[] = await tx.store.get(`pending|${scope}`) ?? [];
  const merged = new Map(previous.map(e => [e.date, e]));
  for (const e of entries) merged.set(e.date, e);
  await tx.store.put([...merged.values()], `pending|${scope}`);
  await tx.done;
}
export async function getPending(scope: string): Promise<DayEntry[]> { return await readSetting<DayEntry[]>(`pending|${scope}`) ?? []; }
export async function acknowledgeSync(scope: string, sent: DayEntry[]) {
  const db = await dbPromise;
  const tx = db.transaction('settings', 'readwrite');
  const sentVersions = new Map(sent.map(e => [e.date, e.updatedAt]));
  const previous: DayEntry[] = await tx.store.get(`pending|${scope}`) ?? [];
  await tx.store.put(previous.filter(e => sentVersions.get(e.date) !== e.updatedAt), `pending|${scope}`);
  await tx.done;
}
