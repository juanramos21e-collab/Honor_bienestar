import { useEffect, useRef } from 'react';
import { Activity, ArrowUpRight, ChevronRight, Folder, RefreshCw, Unplug, X } from 'lucide-react';
import type { DriveHealth } from '../lib/useDriveHealth';

const stamp = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export default function DriveHealthConnection({ drive, onProgress }: { drive: DriveHealth; onProgress: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (drive.picker && !dialog.current?.open) dialog.current?.showModal();
    if (!drive.picker && dialog.current?.open) dialog.current.close();
  }, [drive.picker]);
  const c = drive.connection;
  const phaseText = {
    loading: 'Preparando conexión…', disconnected: 'Elige la carpeta donde Health Connect guarda su copia.',
    authorizing: 'Esperando tu autorización de Google…', checking: 'Buscando y leyendo la copia más reciente…',
    current: 'La copia está revisada. Tus mediciones de HONOR Health están incorporadas.',
    authorization_required: 'Google necesita renovar el acceso. Tu carpeta sigue vinculada.',
    waiting: 'Esperando una copia completa de Health Connect en la carpeta elegida.',
    empty_honor: 'Esta copia todavía no contiene mediciones de HONOR Health.',
    error: 'No se completó la actualización de salud.',
  }[drive.phase];
  return <section className="settings-card health-connection drive-health">
    <div className="card-heading"><Activity className="mint" /><div><h2>Datos de salud</h2><p>Conecta la copia de HONOR Health y sigue tu progreso.</p></div></div>
    <details className="health-setup" open={!c}>
      <summary>Configurar HONOR Health, Health Connect y Drive</summary>
      <ol>
        <li><strong>Descarga HONOR Health.</strong> Sincroniza tu reloj o balanza en su aplicación oficial.<br /><a href="https://play.google.com/store/apps/details?id=com.hihonor.health" target="_blank" rel="noopener noreferrer">HONOR Health en Google Play <ArrowUpRight size={14} /></a></li>
        <li><strong>Instala o abre Health Connect.</strong> En algunos Android ya viene integrado en Ajustes.<br /><a href="https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata" target="_blank" rel="noopener noreferrer">Health Connect en Google Play <ArrowUpRight size={14} /></a></li>
        <li><strong>En HONOR Health:</strong> entra a Configuración → Compartir datos con terceros → Health Connect. Activa los datos que quieras compartir.</li>
        <li><strong>En Health Connect:</strong> Administrar datos → Copia de seguridad y restablecimiento → Exportación programada. Elige Diariamente y una carpeta de Google Drive. Conserva el nombre <strong>Health Connect.zip</strong>.<p className="settings-note">La copia puede tardar: Android espera a que el celular esté cargando y sin uso. Si Drive indica «Esperando red Wi-Fi», conéctate a Wi-Fi o permite transferencias con datos móviles en sus ajustes.</p></li>
        <li><strong>Aquí, pulsa Conectar Drive</strong> y elige esa misma carpeta. Se buscará la copia más reciente, sin descargarla ni importarla manualmente.</li>
      </ol>
    </details>
    {c && <div className="drive-folder-info"><Folder size={19} /><div><strong>{c.folder.name}</strong><small>{c.email}</small>{c.fileName && <small>Última copia revisada: {c.fileName}</small>}</div></div>}
    <p className="drive-status" role="status">{phaseText}</p>
    {drive.phase === 'empty_honor' && <p>Los permisos activados no garantizan que haya mediciones compartidas. Sincroniza el dispositivo en HONOR Health; se incorporarán cuando aparezcan en una nueva copia.</p>}
    {!!c?.ignoredRecords && <p className="settings-note">{c.ignoredRecords.toLocaleString('es-PE')} registros de otros orígenes omitidos.</p>}
    {c?.days !== undefined && c.days > 0 && <p className="settings-note">{c.days} días con mediciones de HONOR Health · {drive.updatedDays} días actualizados en esta consulta.</p>}
    {drive.error && <p className="error-text" role="alert">{drive.error}</p>}
    <div className="button-row">
      {!c && <button className="primary-button" disabled={drive.busy || drive.phase === 'loading'} onClick={() => { void drive.connect(); }}><Folder size={17} />Conectar Drive</button>}
      {c && <><button className="primary-button" disabled={drive.busy || drive.phase === 'loading'} onClick={() => { void (drive.hasAccess ? drive.sync(true) : drive.connect()); }}><RefreshCw size={16} />Actualizar datos de salud</button><button className="text-button" disabled={drive.busy} onClick={() => { void drive.connect(true); }}>Cambiar carpeta</button><button className="text-button" onClick={() => { void drive.disconnect(); }}><Unplug size={15} />Desvincular carpeta</button></>}
    </div>
    <p className="settings-note">{c ? 'Se actualiza al volver a la app y cada cinco minutos mientras esté visible. Se reutiliza tu acceso de Google; si vence, pulsa Actualizar datos de salud.' : 'Google pide permiso de lectura de Drive. La app revisa las copias de la carpeta que elijas.'}</p>
    {c?.checkedAt && <p className="settings-note">Última comprobación: {stamp(c.checkedAt)}.{c.fileModifiedAt && <> Copia de Drive: {stamp(c.fileModifiedAt)}.</>}</p>}
    {c?.importedAt && <p className="settings-note">Última incorporación al historial: {stamp(c.importedAt)}.</p>}
    {c?.warnings?.map(message => <p className="settings-note" key={message}>{message}</p>)}
    <button className="text-button" onClick={onProgress}>Ver mi progreso registrado <ArrowUpRight size={16} /></button>
    <details className="drive-owner-help"><summary>Si Google rechaza la conexión</summary><p>El propietario de esta web debe habilitar Google Drive API y configurar el consentimiento OAuth para lectura de Drive. Activar el acceso con Google para iniciar sesión no activa por sí solo esa API.</p><a href="https://console.cloud.google.com/apis/library/drive.googleapis.com?project=honor-bienestar" target="_blank" rel="noopener noreferrer">Activar Google Drive API <ArrowUpRight size={14} /></a></details>
    <dialog ref={dialog} className="drive-folder-dialog" onCancel={event => { event.preventDefault(); if (!drive.busy) drive.closePicker(); }}>
      <div className="modal-heading"><h2>Elige la carpeta de exportación</h2><button className="icon-button" disabled={drive.busy} aria-label="Cerrar selector de carpeta" onClick={drive.closePicker}><X size={20} /></button></div>
      <p>Selecciona la misma carpeta que configuraste en Health Connect.</p>
      <nav className="drive-breadcrumbs" aria-label="Ruta de Drive">{drive.path.map((folder, index) => <button key={folder.id} disabled={drive.busy} onClick={() => { void drive.openFolder(drive.path.slice(0, index + 1)); }}>{folder.name}<ChevronRight size={13} /></button>)}</nav>
      <div className="drive-folder-list">{drive.folders.map(folder => <button key={folder.id} className="secondary-button" disabled={drive.busy} onClick={() => { void drive.openFolder([...drive.path, folder]); }}><Folder size={18} />{folder.name}<ChevronRight size={16} /></button>)}{!drive.folders.length && <p>Esta carpeta no tiene subcarpetas.</p>}</div>
      {drive.error && <p className="error-text" role="alert">{drive.error}</p>}
      <div className="button-row"><button className="primary-button" disabled={drive.busy} onClick={() => { void drive.chooseFolder(); }}>Vincular esta carpeta</button><button className="secondary-button" disabled={drive.busy} onClick={drive.closePicker}>Cancelar</button></div>
    </dialog>
  </section>;
}
