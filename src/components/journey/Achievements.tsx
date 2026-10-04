import { useEffect, useState } from 'react'
import { Fire, LockSimple, Medal, Sparkle } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import { ACHIEVEMENTS } from '@/lib/journey'

export function AchievementsPanel({ unlocked, onClose }: { unlocked: string[]; onClose: () => void }) {
  return <BottomSheet title="Suas conquistas" description="Cada pequeno passo constrói uma grande jornada." onClose={onClose}>
    <div className="achievement-grid">{ACHIEVEMENTS.map(item => {
      const earned = unlocked.includes(item.id)
      return <div key={item.id} className={`achievement-item ${earned ? 'earned' : ''}`}>
        <span className="achievement-medal" aria-hidden="true">{earned ? item.metric === 'bestStreak' ? <Fire size={31} weight="fill" /> : <Medal size={34} weight="fill" /> : <LockSimple size={27} weight="duotone" />}</span>
        <p className="mt-3 text-[14px] font-bold">{item.title}</p><p className="mt-1 text-[12px] leading-4 text-ink-muted">{item.description}</p><span className="mt-3 block text-[11px] font-bold text-accent-strong">{earned ? 'Conquistada' : 'Ainda por conquistar'}</span>
      </div>
    })}</div>
  </BottomSheet>
}

export function AchievementCelebration() {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    const listener = (event: Event) => setIds((event as CustomEvent<string[]>).detail)
    window.addEventListener('training-achievement', listener)
    return () => window.removeEventListener('training-achievement', listener)
  }, [])
  if (!ids.length) return null
  return <BottomSheet title="Olha o que você conquistou!" onClose={() => setIds([])}>
    <div className="celebration-art" aria-hidden="true"><Sparkle className="celebration-spark left-6 top-5" size={25} weight="fill" /><Medal size={86} weight="fill" /><Sparkle className="celebration-spark bottom-4 right-7" size={29} weight="fill" /></div>
    <div className="mb-7 text-center" role="status">{ids.map(id => <p key={id} className="mt-2 text-[20px] font-bold">{ACHIEVEMENTS.find(item => item.id === id)?.title}</p>)}<p className="mt-3 text-[14px] text-ink-muted">Seu esforço está virando constância. Continue no seu ritmo.</p></div>
    <button className="btn-primary w-full" onClick={() => setIds([])}>Continuar minha jornada</button>
  </BottomSheet>
}
