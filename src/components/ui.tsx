import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/* ---------------- calorie ring ---------------- */

export function Ring({
  value,
  target,
  size = 184,
  thickness = 14,
  children,
}: {
  value: number
  target: number
  size?: number
  thickness?: number
  children?: ReactNode
}) {
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(value / target, 1) : 0
  const over = target > 0 && value > target

  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(ratio))
    return () => cancelAnimationFrame(id)
  }, [ratio])

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--bad)' : 'var(--accent)'}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn)}
          style={{ transition: 'stroke-dashoffset 0.85s cubic-bezier(0.22,0.8,0.26,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------------- macro bar ---------------- */

export function MacroBar({
  label,
  icon,
  value,
  target,
  color,
  soft,
}: {
  label: string
  icon: IconName
  value: number
  target: number
  color: string
  soft: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const left = Math.max(0, Math.round(target - value))
  return (
    <div className="col" style={{ gap: 7, flex: 1, minWidth: 0 }}>
      <div className="row" style={{ gap: 7 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: soft,
            color,
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <Icon name={icon} size={14} stroke={1.9} />
        </span>
        <span className="small" style={{ fontWeight: 620, color: 'var(--ink-2)' }}>
          {label}
        </span>
      </div>
      <div className="num" style={{ fontSize: 17, fontWeight: 660 }}>
        {left}
        <span style={{ fontSize: 12, fontWeight: 580, color: 'var(--muted)' }}> g left</span>
      </div>
      <div className="macro-track">
        <div className="macro-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/* ---------------- health meter ---------------- */

export function HealthMeter({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 65 ? 'var(--good)' : pct >= 40 ? 'var(--warn)' : 'var(--bad)'
  const h = size === 'sm' ? 5 : 7
  return (
    <div className="col" style={{ gap: 6, width: '100%' }}>
      <div className="spread">
        <span className="small" style={{ fontWeight: 620, color: 'var(--ink-2)' }}>
          Health score
        </span>
        <span className="num" style={{ fontSize: 13, fontWeight: 680, color }}>
          {pct}/100
        </span>
      </div>
      <div className="macro-track" style={{ height: h }}>
        <div className="macro-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/* ---------------- sheet ---------------- */

export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {title && (
          <div className="spread" style={{ marginBottom: 16 }}>
            <h2 className="h2">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={17} stroke={2} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* ---------------- stepper ---------------- */

export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0.5,
  max = 10,
  format,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  format?: (v: number) => string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className="row" style={{ gap: 10 }}>
      <button
        className="icon-btn"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Less"
      >
        <Icon name="minus" size={16} stroke={2.2} />
      </button>
      <span
        className="num"
        style={{ minWidth: 54, textAlign: 'center', fontSize: 17, fontWeight: 660 }}
      >
        {format ? format(value) : value}
      </span>
      <button
        className="icon-btn"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="More"
      >
        <Icon name="plus" size={16} stroke={2.2} />
      </button>
    </div>
  )
}

/* ---------------- header ---------------- */

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <div className="row" style={{ gap: 12, padding: '4px 0 18px' }}>
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="left" size={18} stroke={2} />
        </button>
      )}
      <div className="wrap-tight grow">
        <h1 className="h2 truncate">{title}</h1>
        {subtitle && <p className="small">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/* ---------------- stat tile ---------------- */

export function StatTile({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string
  value: string | number
  unit?: string
  icon?: IconName
  color?: string
}) {
  return (
    <div className="card" style={{ padding: 14, flex: 1, minWidth: 0 }}>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        {icon && (
          <span style={{ color: color || 'var(--muted)' }}>
            <Icon name={icon} size={14} stroke={1.9} />
          </span>
        )}
        <span className="small" style={{ fontWeight: 620 }}>
          {label}
        </span>
      </div>
      <div className="num" style={{ fontSize: 23, fontWeight: 670 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 12.5, fontWeight: 580, color: 'var(--muted)' }}> {unit}</span>
        )}
      </div>
    </div>
  )
}
