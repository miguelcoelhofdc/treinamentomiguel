import type { DailyLog } from '@/types'
import { ENERGY_LABELS } from '@/components/journey/QuickCheckIn'

const PAIN = ['Sem dor', 'Leve', 'Moderada', 'Forte']

export default function WellnessDetails({ log }: { log?: DailyLog }) {
  if (!log) return <p className="text-[14px] text-ink-muted">Sem check-in registrado nesta data.</p>
  const readings = [
    ['Energia', log.energy == null ? null : ENERGY_LABELS[log.energy - 1]],
    ['Sono', log.sleepH == null ? null : `${log.sleepH} h`],
    ['Peso', log.weightKg == null ? null : `${log.weightKg.toLocaleString('pt-BR')} kg`],
    ['Ombro', log.shoulderPain == null ? null : PAIN[log.shoulderPain]],
    ['Joelho', log.kneePain == null ? null : PAIN[log.kneePain]],
    ['Esforço percebido', log.rpe == null ? null : `${log.rpe}/10`],
  ]
  return <>
    <dl className="health-details">{readings.filter(([, value]) => value != null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {log.notes && <div className="mt-6"><p className="label">Notas do dia</p><p className="text-[14px] leading-6 whitespace-pre-wrap break-words">{log.notes}</p></div>}
  </>
}
