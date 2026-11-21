interface ProgressRingProps {
  value: number
  size?: number
  stroke?: number
  label?: string
  inverse?: boolean
  /** Classe Tailwind/CSS para a cor do arco (ex.: cor indicativa). */
  toneClass?: string
  /** Cor explícita do arco (sobrescreve toneClass quando definida). */
  toneColor?: string
}

export default function ProgressRing({ value, size = 72, stroke = 7, label, inverse = false, toneClass, toneColor }: ProgressRingProps) {
  const safeValue = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (safeValue / 100) * circumference

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden="true" className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={inverse ? 'text-white/15' : 'text-line'}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor ?? 'currentColor'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={toneColor ? undefined : (inverse ? 'text-primary-300' : (toneClass ?? 'text-accent'))}
          style={{ transition: 'stroke-dashoffset 480ms cubic-bezier(0.16, 1, 0.3, 1), stroke 480ms ease' }}
        />
      </svg>
      <span className={`absolute text-[13px] font-bold tabular-nums ${inverse ? 'text-white' : 'text-ink'}`}>
        {label ?? `${Math.round(safeValue)}%`}
      </span>
    </div>
  )
}
