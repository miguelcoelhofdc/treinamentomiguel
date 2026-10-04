import { useState } from 'react'
import { CheckCircle, Fire, Plus, SpinnerGap } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import DailyLogForm from '@/components/DailyLogForm'
import { saveDailyActivity } from '@/lib/trainingActivity'
import type { DailyLog } from '@/types'

export const ENERGY_LABELS = ['Exausto', 'Baixa', 'Estável', 'Boa', 'Ótima']

export default function QuickCheckIn({ date, checkedIn, log }: { date: string; checkedIn: boolean; log?: DailyLog }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={`checkin-banner ${checkedIn ? 'checkin-done' : ''}`} onClick={() => setOpen(true)}>
      <span className="checkin-icon">{checkedIn ? <CheckCircle size={25} weight="fill" /> : <Fire size={25} weight="fill" />}</span>
      <span className="flex-1 text-left"><span className="block text-[15px] font-bold">{checkedIn ? 'Você marcou presença!' : 'Como está sua energia hoje?'}</span><span className="mt-0.5 block text-[12px] text-ink-muted">{checkedIn ? 'Check-in feito · ver ou adicionar detalhes' : 'Faça seu check-in e mantenha a sequência'}</span></span>
      <span className="text-[12px] font-bold text-accent-strong">{checkedIn ? 'Ver' : 'Check-in'}</span>
    </button>
    {open && <CheckInPanel date={date} initialEnergy={log?.energy} onClose={() => setOpen(false)} />}
  </>
}

function CheckInPanel({ date, initialEnergy, onClose }: { date: string; initialEnergy?: number; onClose: () => void }) {
  const [energy, setEnergy] = useState(initialEnergy)
  const [details, setDetails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (!energy || busy) return
    setBusy(true); setError('')
    try { await saveDailyActivity({ date, energy, checkInDone: true }); onClose() }
    catch { setError('Não foi possível salvar seu check-in. Tente novamente.'); setBusy(false) }
  }
  return <BottomSheet title="Um momento para você" description="Seu check-in vale presença, inclusive nos dias de descanso." onClose={onClose}>
    {details ? <DailyLogForm key={date} date={date} initialEnergy={energy} onSaved={onClose} /> : <>
      <fieldset disabled={busy} className="mb-6"><legend className="label">Como está sua energia?</legend>
        <div className="energy-picker">{ENERGY_LABELS.map((label, index) => <button key={label} type="button" aria-pressed={energy === index + 1} aria-label={`${index + 1}: ${label}`} onClick={() => setEnergy(index + 1)} className={energy === index + 1 ? 'energy-selected' : ''}><span className="energy-face" aria-hidden="true">{['😴', '😕', '😐', '🙂', '🤩'][index]}</span><span className="block text-[11px] font-semibold">{label}</span></button>)}</div>
      </fieldset>
      {error && <p role="alert" className="mb-3 text-[13px] text-red-600 dark:text-red-300">{error}</p>}
      <button className="btn-primary w-full" disabled={!energy || busy} onClick={() => void save()}>{busy ? <SpinnerGap size={20} className="animate-spin" /> : <CheckCircle size={20} weight="bold" />}{busy ? 'Salvando…' : 'Confirmar meu check-in'}</button>
      <button className="btn-ghost mt-3 w-full" disabled={busy} onClick={() => setDetails(true)}><Plus size={18} weight="bold" />Adicionar detalhes opcionais</button>
    </>}
  </BottomSheet>
}
