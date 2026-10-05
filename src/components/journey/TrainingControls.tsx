import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import plan from '@/data/activePlan'
import type { TrainingSettings } from '@/types'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'

export default function TrainingControls({ settings, updateSetting }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [duration, setDuration] = useState(String(settings.sessionDurationMin))
  const [level, setLevel] = useState(settings.trainingLevel)
  const [light, setLight] = useState(settings.lightVolume)
  useEffect(() => setDuration(String(settings.sessionDurationMin)), [settings.sessionDurationMin])
  useEffect(() => setLevel(settings.trainingLevel), [settings.trainingLevel])
  useEffect(() => setLight(settings.lightVolume), [settings.lightVolume])
  const save: UpdateTrainingSetting = async (key, value) => {
    setBusy(true); setError('')
    try { await updateSetting(key, value) }
    catch { setLevel(settings.trainingLevel); setLight(settings.lightVolume); setError('Não foi possível salvar o ajuste. Tente novamente.') }
    finally { setBusy(false) }
  }
  if (settings.coaching) return <section className="space-y-4"><h2 className="text-title">Seu objetivo organiza o treino</h2><p className="helper">Ajuste dias, tempo, nível e equipamentos em um só lugar. Treinos iniciados ficam preservados.</p><Link to="/coaching" className="btn-primary">Ajustar meu plano</Link></section>
  return <section className="space-y-5" aria-label="Ajustes de treino"><div><h2 className="text-[16px] font-bold">Treine no seu ritmo</h2><p className="helper">Você escolhe quando mudar o nível ou usar um volume mais leve.</p></div>
    <div><label className="label" htmlFor="training-level">Nível do treino</label><select id="training-level" className="input" value={level} disabled={busy} onChange={event => { const next = event.target.value as TrainingSettings['trainingLevel']; setLevel(next); void save('trainingLevel', next) }}>{plan.phases.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <label className="flex items-center gap-3 text-[14px] font-semibold min-h-11"><input type="checkbox" checked={light} disabled={busy} onChange={event => { setLight(event.target.checked); void save('lightVolume', event.target.checked) }} className="h-5 w-5 accent-accent" />Usar volume mais leve</label>
    <div><label className="label" htmlFor="training-duration">Tempo disponível por sessão · minutos</label><div className="flex gap-2"><input id="training-duration" className="input min-w-0" inputMode="decimal" value={duration} onChange={event => setDuration(event.target.value)} /><button className="btn-secondary" disabled={busy} onClick={() => { const value = Number(duration.replace(',', '.')); if (!Number.isFinite(value) || value <= 0 || value > 1440) { setError('Informe um tempo entre 1 e 1440 minutos.'); return }; void save('sessionDurationMin', value) }}>Salvar</button></div><p className="helper">Uma referência para organizar o treino. O progresso usa o tempo realmente registrado.</p></div>
    {error && <p role="alert" className="text-[13px] text-red-600 dark:text-red-300">{error}</p>}
  </section>
}
