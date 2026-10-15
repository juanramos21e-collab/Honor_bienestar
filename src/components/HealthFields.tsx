import { HEALTH_METRICS, type HealthId, type HealthMetrics } from '../lib/health';

export default function HealthFields({ values, disabled, onChange }: { values: Partial<Record<HealthId, string>>; disabled: boolean; onChange: (id: HealthId, raw: string) => void }) {
  return <details className="health-fields"><summary>Datos de mi reloj · opcional</summary><p>Copia los valores de Salud de HONOR. Las mediciones disponibles dependen de tu modelo; deja en blanco las que no tengas.</p><div className="health-input-grid">{HEALTH_METRICS.map(metric => <label key={metric.id} htmlFor={`watch-${metric.id}`}>{metric.label}<span className="health-input"><input id={`watch-${metric.id}`} aria-label={metric.label} type="text" inputMode={metric.integer ? 'numeric' : 'decimal'} value={values[metric.id] ?? ''} disabled={disabled} placeholder="Sin dato" onChange={e => onChange(metric.id, e.target.value)} /><small>{metric.unit}</small></span></label>)}</div><p className="muted">Sueño en horas decimales: 7 h 30 min = 7,5 h. Estos datos no cambian tu puntuación de estado.</p></details>;
}
export function healthText(health?: HealthMetrics) {
  return Object.fromEntries(Object.entries(health ?? {}).map(([id, value]) => [id, String(value)])) as Partial<Record<HealthId, string>>;
}
