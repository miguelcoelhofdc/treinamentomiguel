import { useState } from 'react'
import { PencilSimple } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import WellnessDetails from '@/components/progress/WellnessDetails'
import SessionForm from './SessionForm'
import { activitySummary, numberLabel, sessionStrength } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import type { TrackingData } from '@/hooks/useTracking'
import type { ActivityLog } from '@/types'

export default function SessionDetails({ activity, data, onClose, onSaved }: { activity: ActivityLog; data: TrackingData; onClose: () => void; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const records = sessionStrength(activity, data.strength)
  const run = data.running.find(item => activity.id === `run:${item.id}`)
  return <BottomSheet title={editing ? 'Editar treino' : activity.name} description={formatShortDate(activity.date)} onClose={onClose}>
    {editing ? <SessionForm data={data} initial={activity} onSaved={onSaved} /> : <div className="session-details">
      <p className="detail-summary">{activitySummary(activity)}</p>
      {activity.id.startsWith('legacy') && <p className="helper">Registro antigo, organizado pela data informada.</p>}
      {records.length > 0 && <section><h3>Exercícios registrados</h3><div className="detail-exercises">{records.map(record => <div key={record.id}><h4>{record.exercise}</h4><p>{record.sets.map(set => `${numberLabel(set.weightKg)} kg × ${set.reps}`).join(' · ')}</p>{record.notes && <p className="helper">{record.notes}</p>}</div>)}</div></section>}
      {(activity.notes || run?.notes) && <p className="whitespace-pre-wrap break-words">{activity.notes || run?.notes}</p>}
      <button className="btn-secondary w-full" onClick={() => setEditing(true)}><PencilSimple size={19} />Editar registro</button>
      <section><h3>Como foi esse dia</h3><WellnessDetails log={data.byDate.get(activity.date)} /></section>
    </div>}
  </BottomSheet>
}
