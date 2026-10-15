import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Check, RefreshCw, Smartphone } from 'lucide-react';
import { HEALTH_METRICS } from '../lib/health';
import { formatDate, localDate, type DayEntry } from '../lib/model';
import { readSetting, saveSetting } from '../lib/storage';
import { healthBridge, healthStatus, prepareHealthUpdate, validateHealthRange, type HealthRead, type HealthSource, type HealthStatus } from '../lib/nativeHealth';

type LastRead = { checkedAt: string; importedAt?: string; source: string; days: number };
export default function HealthConnection({ scope, days, onSave, onProgress, notify }: { scope: string; days: DayEntry[]; onSave: (entries: DayEntry[]) => Promise<void>; onProgress: () => void; notify: (message: string) => void }) {
  const [status, setStatus] = useState<HealthStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [sources, setSources] = useState<HealthSource[]>([]), [source, setSource] = useState('');
  const start = new Date(); start.setDate(start.getDate() - 6);
  const [from, setFrom] = useState(localDate(start)), [to, setTo] = useState(localDate());
  const [result, setResult] = useState<HealthRead | null>(null), [last, setLast] = useState<LastRead | null>(null);
  const alive = useRef(true), generation = useRef(0);
  const refresh = async () => { const next = await healthStatus(); if (alive.current) setStatus(next); return next; };
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => { if (alive.current) setError('No se pudo comprobar el acceso a salud. Vuelve a intentarlo.'); });
    void readSetting<LastRead>(`health-read|${scope}`).then(value => { if (alive.current) setLast(value ?? null); }).catch(() => {});
    const focus = () => { void refresh().catch(() => {}); };
    window.addEventListener('focus', focus);
    const visible = () => { if (!document.hidden) focus(); }; document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; generation.current++; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible); };
  }, [scope]);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (err) { if (alive.current) setError((err as Error).message || 'No se pudo consultar salud. Revisa los permisos y vuelve a intentarlo.'); } finally { if (alive.current) setBusy(false); } };
  const rangeError = validateHealthRange(from, to);
  const resetRange = (setter: (value: string) => void, value: string) => { generation.current++; setter(value); setSources([]); setSource(''); setResult(null); };
  const discover = async () => {
    if (rangeError) return;
    const token = ++generation.current; setResult(null); const response = await healthBridge.sources({ from, to });
    if (!alive.current || token !== generation.current) return;
    setSources(response.sources); setSource(response.sources.find(s => s.id === 'com.hihonor.health')?.id ?? (response.sources.length === 1 ? response.sources[0].id : ''));
    if (!response.sources.length) setError('No hay datos compartidos en estas fechas. Sincroniza el reloj en su app y comprueba que esa app tenga permiso para escribir en Health Connect. Tenerla instalada no garantiza que comparta mediciones.');
  };
  let changes: DayEntry[] = [], mergeError = '';
  if (result) { try { changes = prepareHealthUpdate(days, result); } catch (err) { mergeError = (err as Error).message; } }
  const available = status?.availability === 'available';
  const stamp = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  return <section className="settings-card health-connection"><div className="card-heading"><Activity className="mint" /><div><h2>Datos de salud</h2><p>Consulta las mediciones que tus apps comparten con Android.</p></div></div>
    {!status ? <p role="status">Comprobando compatibilidad…</p> : <>
      {status.device && <p className="health-device"><Smartphone size={16} />{status.device.manufacturer} {status.device.model} · Android {status.device.androidVersion}</p>}
      {status.availability === 'web' || status.availability === 'ios' ? <><p>Para consultar los datos del teléfono necesitas la versión Android de Honor, con Android 9 o posterior. En el navegador y en iPhone puedes registrar datos manualmente y consultar tu progreso.</p><a className="secondary-button health-apk" href="/downloads/Honor-salud-android.apk" download>Descargar versión Android <ArrowUpRight size={16} /></a><p className="settings-note">El acceso depende de que tu app de salud comparta las mediciones con Health Connect.</p></> : status.availability === 'unsupported' ? <p>Este dispositivo no ofrece Health Connect compatible. El registro manual sigue disponible.</p> : <>
        {status.availability === 'install_required' && <><p>Android necesita instalar o actualizar Health Connect para compartir las mediciones.</p><button className="secondary-button" disabled={busy} onClick={() => { void run(async () => { await healthBridge.openSetup({ target: 'provider' }); }); }}>Instalar o actualizar Health Connect</button></>}
        <div className="health-apps">{status.apps.map(app => <span key={app.id}>{app.label}: {app.installed ? 'instalada' : 'no detectada'}</span>)}</div>
        <div className="button-row">{!status.apps.some(a => a.id === 'com.hihonor.health' && a.installed) && <button className="secondary-button" disabled={busy} onClick={() => { void run(async () => { await healthBridge.openSetup({ target: 'honor' }); }); }}>Instalar Salud de HONOR</button>}{available && <><button className="secondary-button" disabled={busy} onClick={() => { void run(async () => { const next = await healthBridge.requestAccess(); if (alive.current) { setStatus(next); setSources([]); setSource(''); setResult(null); if (!next.granted.length) setError('No se concedió acceso de lectura. Puedes revisar los permisos o continuar con el registro manual.'); } }); }}>{status.granted.length ? 'Revisar acceso de lectura' : 'Conectar datos de salud'}</button><button className="text-button" disabled={busy} onClick={() => { void run(async () => { await healthBridge.openSetup({ target: 'permissions' }); }); }}>Abrir permisos de Health Connect</button></>}</div>
        {available && status.granted.length > 0 && <><p className="settings-note">Acceso concedido a {status.granted.length} tipos de datos. Se consultan únicamente al pulsar el botón.</p><div className="health-read-filters"><label>Salud desde<input type="date" value={from} disabled={busy} onChange={e => resetRange(setFrom, e.target.value)} /></label><label>Salud hasta<input type="date" value={to} disabled={busy} onChange={e => resetRange(setTo, e.target.value)} /></label></div>{rangeError && <p className="error-text">{rangeError}</p>}<div className="button-row"><button className="secondary-button" disabled={busy || !!rangeError} onClick={() => { void run(discover); }}>Buscar aplicaciones con datos</button>{sources.length > 0 && <label className="health-source-label">Aplicación de origen<select value={source} disabled={busy} onChange={e => { generation.current++; setSource(e.target.value); setResult(null); }}><option value="">Elige una aplicación</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}<button className="primary-button" disabled={busy || !!rangeError || !source} onClick={() => { void run(async () => { const token = ++generation.current; const next = await healthBridge.read({ from, to, origin: source }); if (!alive.current || token !== generation.current) return; prepareHealthUpdate(days, next); setResult(next); const checked = { ...last, checkedAt: next.readAt, source: sources.find(s => s.id === source)?.label ?? source, days: next.entries.length }; await saveSetting(`health-read|${scope}`, checked); if (alive.current) setLast(checked); }); }}><RefreshCw size={16} />{busy ? 'Consultando…' : 'Actualizar datos'}</button></div></>}
      </>}
      <button className="text-button" disabled={busy} onClick={() => { void run(async () => { await refresh(); }); }}>Comprobar compatibilidad de nuevo</button>
    </>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {result && <div className="health-read-preview"><h3>Lectura: {formatDate(result.from)} – {formatDate(result.to)}</h3><p>{result.entries.length} días con mediciones · {changes.length} días para incorporar.</p>{result.warnings.map((warning, i) => <p key={i} className="settings-note">{warning}</p>)}{mergeError ? <p className="error-text" role="alert">{mergeError}</p> : <>{changes.length > 0 ? <><p>Las respuestas y los apuntes se conservan. Se actualizarán solo las mediciones recibidas del origen elegido. Revisa los valores antes de guardarlos.</p><div className="health-import-days">{changes.map(entry => <details key={entry.date}><summary>{formatDate(entry.date, true)}</summary>{HEALTH_METRICS.filter(m => result.entries.find(r => r.date === entry.date)?.health[m.id] !== undefined).map(m => <p key={m.id}>{m.label}: {entry.health?.[m.id]?.toLocaleString('es-PE')} {m.unit}</p>)}{result.entries.find(r => r.date === entry.date)?.weight !== undefined && <p>Peso: {entry.weight} kg</p>}</details>)}</div><button className="primary-button" disabled={busy} onClick={() => { void run(async () => { await onSave(changes); const imported = { checkedAt: result.readAt, importedAt: new Date().toISOString(), source: sources.find(s => s.id === result.origin)?.label ?? result.origin, days: changes.length }; await saveSetting(`health-read|${scope}`, imported); if (alive.current) { setLast(imported); setResult(null); notify('Las mediciones están guardadas en tu historial.'); } }); }}><Check size={16} />Guardar lecturas en mi historial</button></> : <p>No hay mediciones nuevas que incorporar. Tu historial se conserva.</p>}</>}</div>}
    {last && <div className="health-last-read"><p>Última consulta: {stamp(last.checkedAt)} · {last.source} · {last.days} días.</p><p>{last.importedAt ? `Último guardado de salud: ${stamp(last.importedAt)}.` : 'Esta consulta todavía no ha guardado cambios.'}</p></div>}
    <button className="text-button" onClick={onProgress}>Ver mi progreso registrado <ArrowUpRight size={16} /></button>
  </section>;
}
