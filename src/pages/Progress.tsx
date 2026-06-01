import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Award, Plus, X, BarChart2 } from 'lucide-react'
import WeightChart from '@/components/charts/WeightChart'
import PaceChart from '@/components/charts/PaceChart'
import RunningLogForm from '@/components/RunningLogForm'
import { getWeightHistory, getAllRunningLogs, getStrengthPRs, getDailyLog, saveDailyLog } from '@/db'
import plan from '@/data/plan.json'
import type { RunningLog } from '@/types'

const formatPace = (p?: number) => {
  if (!p) return '—'
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')} /km`
}

export default function Progress() {
  const [weightData, setWeightData] = useState<{ date: string; weight: number }[]>([])
  const [runData, setRunData]  = useState<RunningLog[]>([])
  const [prs, setPrs] = useState<Map<string, { weightKg: number; reps: number; date: string }>>(new Map())
  const [showRunForm, setShowRunForm] = useState(false)
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [testSaving, setTestSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const initialWeight = plan.profile.initialWeight
  const goalWeight = Number(plan.profile.goals.weight)

  const load = async () => {
    const [wh, rl, pr] = await Promise.all([getWeightHistory(), getAllRunningLogs(), getStrengthPRs()])
    setWeightData(wh)
    setRunData(rl)
    setPrs(pr)

    const testLog = await getDailyLog('__tests__')
    if (testLog?.notes) {
      try { setTestValues(JSON.parse(testLog.notes)) } catch { /* noop */ }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const currentWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : undefined
  const weightDelta = currentWeight ? currentWeight - initialWeight : null

  const bestPace = runData.length > 0
    ? Math.min(...runData.filter(r => r.paceMinKm && r.type === 'qualidade').map(r => r.paceMinKm!))
    : null

  const totalKm = runData.reduce((s, r) => s + r.distanceKm, 0)

  const saveTestValue = async (testId: string) => {
    const updated = { ...testValues }
    setTestSaving(s => ({ ...s, [testId]: true }))
    const existing = await getDailyLog('__tests__')
    await saveDailyLog({
      date: '__tests__',
      notes: JSON.stringify(updated),
      ...(existing ? {} : {}),
    })
    setTimeout(() => setTestSaving(s => ({ ...s, [testId]: false })), 1000)
  }

  if (loading) {
    return (
      <div className="page-content space-y-4">
        <div className="skeleton h-8 w-36" />
        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl hidden xs:block" />
        </div>
        <div className="skeleton h-56 w-full rounded-2xl" />
        <div className="skeleton h-56 w-full rounded-2xl" />
      </div>
    )
  }

  const emptyChart = (label: string) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-neutral-600 mb-3" />
      <p className="text-body-md text-slate-400 dark:text-slate-500 mb-1">Nenhum dado ainda</p>
      <p className="text-label text-slate-400 dark:text-slate-500">Registre seu primeiro {label} na tela Hoje</p>
    </div>
  )

  return (
    <div className="page-content page-enter space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Progresso</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {currentWeight ? `${currentWeight}` : '—'}
          </p>
          <p className="text-xs text-slate-400">Peso atual (kg)</p>
          {weightDelta !== null && (
            <p className={`text-xs font-medium mt-0.5 ${weightDelta < 0 ? 'text-green-600' : 'text-red-500'}`}>
              {weightDelta < 0 ? '▼' : '▲'} {Math.abs(weightDelta).toFixed(1)}kg
            </p>
          )}
          <p className="text-label text-slate-400 mt-0.5">(↓ perda · ↑ ganho)</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalKm.toFixed(0)}</p>
          <p className="text-xs text-slate-400">km percorridos</p>
          <p className="text-xs text-slate-400 mt-0.5">{runData.length} sessões</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {bestPace ? formatPace(bestPace).replace(' /km', '') : '—'}
          </p>
          <p className="text-xs text-slate-400">Melhor pace</p>
          <p className="text-xs text-slate-400 mt-0.5">qualidade</p>
        </div>
      </div>

      {/* Weight chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Peso Corporal</h3>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <TrendingDown size={12} className="text-green-500" />
            Meta: {goalWeight}kg
          </div>
        </div>
        {weightData.length === 0
          ? emptyChart('peso')
          : <WeightChart data={weightData} goal={goalWeight} initial={initialWeight} />
        }
      </div>

      {/* Pace chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Pace de Corrida</h3>
          <button onClick={() => setShowRunForm(s => !s)}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
            {showRunForm ? <X size={14} /> : <Plus size={14} />}
            {showRunForm ? 'Fechar' : 'Registrar'}
          </button>
        </div>
        {showRunForm && (
          <div className="mb-4 pb-4 border-b border-slate-100 dark:border-neutral-700">
            <RunningLogForm onSaved={() => { setShowRunForm(false); load() }} />
          </div>
        )}
        {runData.length === 0
          ? emptyChart('dado')
          : <PaceChart data={runData} />
        }
      </div>

      {/* Strength PRs */}
      {prs.size > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-amber-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Recordes de Força</h3>
          </div>
          <div className="space-y-2">
            {Array.from(prs.entries()).map(([exercise, pr]) => (
              <div key={exercise} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-neutral-700 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{exercise}</p>
                  <p className="text-xs text-slate-400">{pr.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600 dark:text-primary-400">{pr.weightKg}kg</p>
                  <p className="text-xs text-slate-400">{pr.reps} reps</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tests */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} className="text-primary-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Testes de Performance</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">Registre seus resultados para comparação. Faça os testes no início e a cada fase.</p>
        <div className="space-y-3">
          {plan.tests.map(test => {
            const current = testValues[test.id]
            const improved = current
              ? test.lower
                ? current < String(test.initial)
                : current > String(test.initial)
              : false
            return (
              <div key={test.id} className="border border-slate-100 dark:border-neutral-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{test.name}</p>
                    <p className="text-xs text-slate-400">Inicial: {test.initial} {test.unit} → Meta: {test.target} {test.unit}</p>
                  </div>
                  {current && improved && <TrendingUp size={16} className="text-green-500" />}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1 text-sm py-2"
                    placeholder={`Atual (${test.unit})`}
                    value={testValues[test.id] ?? ''}
                    onChange={e => setTestValues(v => ({ ...v, [test.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => saveTestValue(test.id)}
                    className="btn-primary py-2 px-3 text-xs"
                  >
                    {testSaving[test.id] ? '✓' : 'Salvar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
