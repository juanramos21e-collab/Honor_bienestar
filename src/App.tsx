import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChartNoAxesCombined, Cloud, Home, Leaf, Menu, Plus, RefreshCw, Settings2, Smartphone, Sparkles, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { cloudConfigured, cloudError, login, logout } from './lib/cloud';
import { formatDate, localDate, moodScore, planMerge, showPercent, validDate, type Conflict, type DayEntry } from './lib/model';
import { getDays, readSetting, saveSetting } from './lib/storage';
import { useWellbeing } from './lib/useWellbeing';
import { useInspiration } from './lib/useInspiration';
import DayForm from './components/DayForm';
import Settings from './components/Settings';
import MergeDialog from './components/MergeDialog';
import { isNativeAndroid } from './lib/nativeHealth';
const Progress = lazy(() => import('./components/Progress'));

type Page = 'inicio' | 'progreso' | 'ajustes' | 'registro';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Merge = { title: string; description: string; incomingLabel: string; additions: DayEntry[]; conflicts: Conflict[] };
function hashPage(): Page { const page = location.hash.slice(1).split('?')[0]; return ['inicio', 'progreso', 'ajustes', 'registro'].includes(page) ? page as Page : 'inicio'; }
function hashDate(): string { const date = new URLSearchParams(location.hash.split('?')[1] ?? '').get('fecha'); return date && validDate(date) ? date : localDate(); }

export default function App() {
  const [toast, setToast] = useState(''); const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 7000); }, []);
  const data = useWellbeing(notify);
  const [started, setStarted] = useState<boolean | null>(null); const [page, setPage] = useState<Page>(hashPage);
  const [menu, setMenu] = useState(false); const [date, setDate] = useState(hashDate); const [today, setToday] = useState(localDate());
  const [merge, setMerge] = useState<Merge | null>(null); const [googleBusy, setGoogleBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false); const updateSW = useRef<((reload?: boolean) => Promise<void>) | undefined>(undefined);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);
  const latest = data.days.filter(e => moodScore(e) !== null).at(-1); const previous = data.days.filter(e => moodScore(e) !== null).at(-2);
  const latestWeight = data.days.filter(e => e.weight !== null).at(-1); const todayEntry = data.days.find(e => e.date === today);
  const inspiration = useInspiration(data.scope, latest);
  useEffect(() => { readSetting<boolean>('started').then(value => setStarted(!!value)).catch(() => setStarted(false)); }, []);
  useEffect(() => { if (data.user) { setStarted(true); void saveSetting('started', true).catch(() => {}); } }, [data.user]);
  useEffect(() => { const change = () => { setPage(hashPage()); if (hashPage() === 'registro') setDate(hashDate()); setMenu(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { const timer = setInterval(() => setToday(localDate()), 30000); const listener = () => setToday(localDate()); window.addEventListener('focus', listener); return () => { clearInterval(timer); window.removeEventListener('focus', listener); }; }, []);
  useEffect(() => { const listener = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); }; window.addEventListener('beforeinstallprompt', listener); return () => window.removeEventListener('beforeinstallprompt', listener); }, []);
  useEffect(() => {
    if (isNativeAndroid()) return;
    updateSW.current = registerSW({ onNeedRefresh() { setUpdateAvailable(true); }, onOfflineReady() { notify('Honor ya puede abrirse sin conexión en este dispositivo.'); } });
    return () => clearTimeout(toastTimer.current);
  }, [notify]);
  const navigate = (next: Page) => { location.hash = next; setPage(next); setMenu(false); window.scrollTo(0, 0); };
  const edit = (selectedDate = today) => { setDate(selectedDate); location.hash = `registro?fecha=${selectedDate}`; setPage('registro'); setMenu(false); window.scrollTo(0, 0); };
  const google = async () => {
    if (!cloudConfigured) { setShowGoogleHelp(true); return; }
    setGoogleBusy(true); try { await login(); } catch (error) { notify(cloudError(error)); } finally { setGoogleBusy(false); }
  };
  const startLocal = async () => {
    try { await saveSetting('started', true); setStarted(true); navigate('inicio'); void navigator.storage?.persist?.().catch(() => false); }
    catch { notify('Este navegador no permite guardar datos. Activa el almacenamiento del sitio para continuar.'); }
  };
  const prepareImport = (entries: DayEntry[], source = 'archivo') => {
    const plan = planMerge(data.days, entries);
    setMerge({ title: source === 'celular' ? 'Lleva tu historial a tu cuenta' : 'Revisa tu importación', description: source === 'celular' ? 'Los registros sin cuenta se copiarán a tu historial con Google. La copia local se conservará.' : 'Se agregarán los días nuevos. Si una fecha ya existe, tú eliges qué respuestas conservar.', incomingLabel: source === 'celular' ? 'Registros sin cuenta' : 'Archivo importado', ...plan });
  };
  const importGuest = async () => { try { const entries = await getDays('guest'); if (!entries.length) notify('No hay registros sin cuenta en este dispositivo.'); else prepareImport(entries, 'celular'); } catch { notify('No se pudieron leer los registros locales.'); } };
  const install = async () => {
    if (!installEvent) { notify('En Chrome de Android: menú ⋮ → Añadir a pantalla de inicio o Instalar aplicación. La web debe estar publicada con HTTPS.'); return; }
    await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null);
  };
  const name = data.profile.name || data.user?.displayName?.split(' ')[0] || '';
  const delta = latest && previous ? moodScore(latest)! - moodScore(previous)! : null;
  const overlay = <>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
    {showGoogleHelp && <div className="modal-backdrop"><section className="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="google-help"><div className="modal-title"><h2 id="google-help">Conectar con Google</h2><button className="icon-button" aria-label="Cerrar información de Google" autoFocus onClick={() => setShowGoogleHelp(false)}><X size={20} /></button></div><Cloud size={38} className="mint" /><p>El modo local está disponible. Para usar Google y compartir tu historial entre dispositivos, falta conectar esta web con Firebase y habilitar el acceso con Google.</p><p>La guía de configuración está incluida en el proyecto. Una vez activado, podrás incorporar los registros que guardes ahora.</p><button className="primary-button" onClick={() => setShowGoogleHelp(false)}>Entendido <Check size={17} /></button></section></div>}
    {merge && !data.syncConflicts.length && <MergeDialog {...merge} onCancel={() => setMerge(null)} onConfirm={async entries => { await data.saveEntries(entries.map(e => ({ ...e, updatedAt: new Date().toISOString() }))); setMerge(null); notify('Importación completada. Tu historial está guardado.'); }} />}
    {!!data.syncConflicts.length && <MergeDialog title="Hay cambios en otro dispositivo" description="Algunos días fueron editados en la nube. Revisa cuál registro quieres conservar antes de sincronizar." incomingLabel="Cuenta en la nube" additions={[]} conflicts={data.syncConflicts} onConfirm={async (_, choices) => { await data.resolveSync(choices); notify('Tus elecciones están guardadas.'); }} />}
  </>;
  if (started === null || data.loading) return <div className="splash"><Leaf size={40} /><p>Preparando tu espacio…</p>{overlay}</div>;
  if (data.storageError) return <div className="splash"><Smartphone size={40} /><h1>Necesitamos guardar tu progreso</h1><p>El navegador no permite abrir el almacenamiento. Habilita los datos del sitio o prueba Chrome en modo normal.</p>{overlay}</div>;
  if (!started && !data.user) return <main className="welcome"><div className="welcome-art" /><div className="welcome-content"><a className="brand" href="#inicio"><span className="brand-mark"><Leaf size={22} /></span>honor<span className="brand-dot">.</span></a><span className="eyebrow">TU ESPACIO DE BIENESTAR</span><h1>Un día a la vez.<br /><em>Un paso hacia ti.</em></h1><p>Escucha cómo te sientes, registra lo que hiciste y descubre tu progreso. A tu ritmo.</p><div className="welcome-features"><span><Check size={16} />Tu día y tus hábitos</span><span><Check size={16} />Ánimo y peso</span><span><Check size={16} />Respuestas editables</span></div><button className="google-button" disabled={googleBusy} onClick={() => { void google(); }}><span className="google-g">G</span>{googleBusy ? 'Conectando…' : 'Continuar con Google'}<ArrowUpRight size={18} /></button><button className="primary-button" onClick={() => { void startLocal(); }}><Smartphone size={18} />Usar en este dispositivo<ArrowRight size={18} /></button><p className="welcome-note">Puedes empezar sin cuenta y conectar Google más adelante.<br />Tus datos locales quedan en este navegador.</p></div>{overlay}</main>;
  return <div className="app-shell">
    <div className="app-background" aria-hidden="true" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,20,23,.32), rgba(7,20,23,.48)), url("${data.profile.hero || '/landscape.svg'}")` }} />
    <header className="mobile-header"><button className="icon-button" aria-label="Abrir menú" onClick={() => setMenu(true)}><Menu size={23} /></button><a className="brand" href="#inicio"><Leaf size={22} />honor<span className="brand-dot">.</span></a><span className="avatar">{(name || 'T')[0].toUpperCase()}</span></header>
    {menu && <button className="menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? 'open' : ''} has-image`} style={{ backgroundImage: `linear-gradient(180deg, rgba(9,22,24,.35), rgba(9,22,24,.55)), url("${data.profile.panel || '/landscape.svg'}")` }}><div className="sidebar-top"><a className="brand" href="#inicio"><span className="brand-mark"><Leaf size={23} /></span>honor<span className="brand-dot">.</span></a><button className="icon-button close-menu" aria-label="Cerrar menú" onClick={() => setMenu(false)}><X size={20} /></button></div><p className="sidebar-caption">UN ESPACIO PARA TI</p><nav aria-label="Menú principal">{([{ id: 'inicio', label: 'Mi espacio', icon: Home }, { id: 'progreso', label: 'Mi progreso', icon: ChartNoAxesCombined }, { id: 'ajustes', label: 'Cuenta y ajustes', icon: Settings2 }] as const).map(item => <button key={item.id} className={page === item.id || (page === 'registro' && item.id === 'inicio') ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}{page === item.id && <span className="nav-indicator" />}</button>)}</nav><div className="sidebar-reflection"><Sparkles size={20} /><p>No necesitas un día perfecto.<br />Solo un momento para ti.</p><span>CRECE A TU RITMO</span></div><div className="sidebar-bottom"><div className="sidebar-account"><span className="avatar">{(name || 'T')[0].toUpperCase()}</span><div><strong>{name || 'Tu espacio personal'}</strong><small>{data.user ? 'Cuenta de Google' : 'En este dispositivo'}</small></div><button className="icon-button" aria-label="Abrir ajustes de cuenta" onClick={() => navigate('ajustes')}><Settings2 size={17} /></button></div><span className="local-badge"><span className="status-dot" />{data.status}</span></div></aside>
    <main className="main-content"><div className="topbar"><span>MI BIENESTAR <i>/</i> {page === 'inicio' ? 'Mi espacio' : page === 'progreso' ? 'Mi progreso' : page === 'registro' ? 'Mi día' : 'Ajustes'}</span><span className="topbar-date">{formatDate(today, true)}</span></div>
      {page === 'inicio' && <div className="page-enter"><section className="hero" style={{ backgroundImage: 'linear-gradient(90deg, rgba(7,20,23,.3), rgba(7,20,23,.04))' }}><div className="hero-content"><span className="eyebrow">BIENVENIDO A TU ESPACIO</span><h1>{name ? `Hola, ${name}.` : 'Hola, qué bueno verte.'}<br /><em>¿Cómo va tu día?</em></h1><p>Un momento para escucharte.<br />Un pequeño paso para cuidarte.</p></div><span className="hero-caption">TU CAMINO, TU RITMO</span></section>
        <div className="home-section-title"><h2>¿Por dónde empezamos?</h2><span>Todo a tu ritmo</span></div><div className="action-grid"><button className="action-card register-card" onClick={() => edit()}><span className="action-top"><span className="action-icon"><Plus size={25} /></span><ArrowUpRight size={22} /></span><span className="action-label">{todayEntry ? 'Revisa cómo va tu día' : '¿Qué hiciste hoy?'}</span><span className="action-description">{todayEntry ? 'Tus respuestas están guardadas. Cambia lo que necesites.' : 'Registra tus hábitos, cómo te sientes y tu peso.'}</span><span className="action-link">{todayEntry ? 'Editar mi día' : 'Registrar mi día'}<ArrowRight size={17} /></span></button><button className="action-card progress-card" onClick={() => navigate('progreso')}><span className="action-top"><span className="action-icon"><ChartNoAxesCombined size={24} /></span><ArrowUpRight size={22} /></span><span className="action-label">Mira cuánto has avanzado</span><span className="action-description">Encuentra patrones y acompaña tu bienestar día a día.</span><span className="action-link">Ver mi progreso<ArrowRight size={17} /></span></button></div>
        <div className="home-section-title"><h2>Una mirada a tu bienestar</h2><button className="text-button" onClick={() => navigate('progreso')}>Ver detalle<ArrowRight size={15} /></button></div><div className="stats-grid"><div className="stat-card"><span>Tu último estado</span><strong>{showPercent(latest ? moodScore(latest) : null)}</strong><small>{delta !== null ? `${delta >= 0 ? '+' : ''}${(delta * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })} puntos respecto al anterior` : latest ? formatDate(latest.date) : 'Aparecerá con tu primer registro'}</small></div><div className="stat-card"><span>Tu último peso</span><strong>{latestWeight?.weight?.toLocaleString('es-PE') ?? '—'}<em> kg</em></strong><small>{latestWeight ? formatDate(latestWeight.date, true) : 'Regístralo cuando quieras'}</small></div><div className="stat-card"><span>Días en tu historia</span><strong>{data.days.length}<em> días</em></strong><small>Cada registro es un paso más</small></div></div>
        <div className="inspiration-grid"><section className="inspiration-card"><span className="card-eyebrow"><Sparkles size={15} />ORIENTACIÓN DEL DÍA</span><span className="advice-badge">{inspiration.advice.label}</span><p>{inspiration.advice.text}</p></section><section className="inspiration-card quote-card"><span className="card-eyebrow">UNA PAUSA PARA INSPIRARTE<button className="icon-button" aria-label="Cambiar frase" onClick={() => { void inspiration.rotate().catch(() => notify('No se pudo guardar la frase.')); }}><RefreshCw size={15} /></button></span><p>{inspiration.phrase}</p></section></div>
        {!data.days.length && <div className="import-hint"><span>¿Ya tienes registros guardados? Puedes incorporarlos a tu historial.</span><button className="text-button" onClick={() => navigate('ajustes')}>Importar mis registros<ArrowRight size={16} /></button></div>}
      </div>}
      {page === 'registro' && <DayForm key={`${data.scope}|${date}`} scope={data.scope} initial={data.days.find(e => e.date === date)} date={date} notify={notify} onBack={() => navigate('inicio')} onSave={async entry => { await data.saveEntries([entry]); }} />}
      {page === 'progreso' && <Suspense fallback={<p className="loading">Preparando tus gráficas…</p>}><Progress days={data.days} onEdit={edit} /></Suspense>}
      {page === 'ajustes' && <Settings key={data.scope} scope={data.scope} onHealthSave={data.saveEntries} onProgress={() => navigate('progreso')} profile={data.profile} days={data.days} user={data.user} status={data.status} onProfile={data.saveProfile} onImport={prepareImport} onGoogle={() => { void google(); }} onLogout={() => { void logout().then(() => { navigate('inicio'); notify('Sesión cerrada. Volviste al historial sin cuenta de este dispositivo.'); }).catch(error => notify(cloudError(error))); }} onSync={() => { void data.sync(); }} onGuestImport={() => { void importGuest(); }} onInstall={() => { void install(); }} notify={notify} />}
      <footer className="app-footer"><Leaf size={13} /><span>Hecho para acompañarte, un día a la vez.</span></footer>
    </main>
    <nav className="bottom-nav" aria-label="Navegación móvil">{([{ id: 'inicio', label: 'Inicio', icon: Home }, { id: 'progreso', label: 'Progreso', icon: ChartNoAxesCombined }, { id: 'ajustes', label: 'Ajustes', icon: Settings2 }] as const).map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={20} />{item.label}</button>)}</nav>
    {updateAvailable && <div className="update-banner"><span>Hay una nueva versión. Guarda tu registro antes de actualizar.</span><button className="secondary-button" onClick={() => { void updateSW.current?.(true); }}>Actualizar</button></div>}
    {overlay}
  </div>;
}
