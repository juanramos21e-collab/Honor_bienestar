import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { VARIABLES, answersFor, formatDate, showPercent, type DayEntry } from '../lib/model';
import './DayComposition.css';

export default function DayComposition({ entry }: { entry: DayEntry }) {
  const answers = answersFor(entry);
  const available = VARIABLES.map(variable => ({ ...variable, value: answers[variable.id] })).filter(variable => variable.value !== null);
  const slices = available.filter(variable => variable.value! > 0);
  const total = slices.reduce((sum, variable) => sum + variable.value!, 0);

  return <div className="composition-layout">
    <figure className="composition-chart" aria-label={`Gráfico de torta del ${formatDate(entry.date, true)}`}>
      <h3>Composición del día</h3>
      {total > 0 ? <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={42} outerRadius={94}
            labelLine={false} label={({ percent }) => (percent ?? 0) >= .06 ? showPercent(percent ?? 0) : ''} isAnimationActive={false}>
            {slices.map(variable => <Cell key={variable.id} fill={variable.color} stroke="#112224" strokeWidth={2} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#142326', border: '1px solid #334b4a', borderRadius: 12, fontSize: 12 }}
            itemStyle={{ color: '#eff5ee' }} formatter={(value, name) => [`${showPercent(Number(value))} · ${showPercent(Number(value) / total)} del total`, String(name)]} />
        </PieChart>
      </ResponsiveContainer> : <p className="chart-empty">{available.length ? 'Las respuestas de este día están en cero.' : 'Aún no hay respuestas para mostrar la composición.'}</p>}
    </figure>
    <div className="detail-variables">{VARIABLES.map(variable => <div key={variable.id}>
      <span><i style={{ background: variable.color }} />{variable.label}</span>
      <strong>{showPercent(answers[variable.id])}</strong>
    </div>)}</div>
  </div>;
}
