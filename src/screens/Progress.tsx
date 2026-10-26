import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Sheet, StatTile } from '../components/ui'
import { dayTotals, useStore } from '../store'
import { fromKey, lastNDays, todayKey } from '../dates'
import { formatWeight, kgToLb, lbToKg } from '../nutrition'

type Range = 7 | 30 | 90

export function Progress() {
  const { data, addWeight } = useStore()
  const profile = data.profile!
  const [range, setRange] = useState<Range>(7)
  const [logOpen, setLogOpen] = useState(false)

  const days = useMemo(() => lastNDays(range), [range])
  const perDay = useMemo(
    () => days.map((d) => ({ date: d, ...dayTotals(data.entries, d) })),
    [days, data.entries],
  )

  const loggedDays = perDay.filter((d) => d.count > 0)
  const avgCalories = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length)
    : 0
  const avgProtein = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.protein_g, 0) / loggedDays.length)
    : 0
  const onTarget = loggedDays.filter(
    (d) => Math.abs(d.calories - profile.targets.calories) <= profile.targets.calories * 0.1,
  ).length

  const weights = data.weights
  const latestWeight = weights.length ? weights[weights.length - 1].kg : profile.weightKg
  const firstWeight = weights.length ? weights[0].kg : profile.weightKg
  const delta = latestWeight - firstWeight

  const maxCal = Math.max(profile.targets.calories, ...perDay.map((d) => d.calories), 1)

  return (
    <div className="scroll page-pad">
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="wrap-tight">
          <p className="eyebrow">Progress</p>
          <h1 className="h2">How it is going</h1>
        </div>
        <button className="btn btn-sm btn-soft" onClick={() => setLogOpen(true)}>
          <Icon name="scale" size={15} stroke={1.8} />
          Log weight
        </button>
      </div>

      <div className="seg" style={{ marginBottom: 18 }}>
        {([7, 30, 90] as Range[]).map((r) => (
          <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
            {r} days
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <StatTile label="Avg calories" value={avgCalories.toLocaleString()} unit="kcal" icon="flame" color="var(--accent)" />
        <StatTile label="Avg protein" value={avgProtein} unit="g" icon="bolt" color="var(--protein)" />
      </div>
      <div className="row" style={{ gap: 10, marginBottom: 24 }}>
        <StatTile label="Days logged" value={`${loggedDays.length}/${range}`} icon="check" color="var(--good)" />
        <StatTile label="On target" value={onTarget} unit={`of ${loggedDays.length}`} icon="target" />
      </div>

      <div className="col" style={{ gap: 11, marginBottom: 24 }}>
        <div className="spread">
          <p className="eyebrow">Calories a day</p>
          <span className="small">
            Target {profile.targets.calories.toLocaleString()}
          </span>
        </div>
        <div className="card" style={{ padding: '18px 16px' }}>
          <CalorieBars data={perDay} target={profile.targets.calories} max={maxCal} />
        </div>
      </div>

      <div className="col" style={{ gap: 11, marginBottom: 24 }}>
        <div className="spread">
          <p className="eyebrow">Weight</p>
          {weights.length > 1 && (
            <span
              className="small num"
              style={{ fontWeight: 650, color: delta <= 0 ? 'var(--good)' : 'var(--warn)' }}
            >
              {delta > 0 ? '+' : ''}
              {profile.units === 'metric'
                ? `${delta.toFixed(1)} kg`
                : `${kgToLb(delta).toFixed(1)} lb`}
            </span>
          )}
        </div>
        <div className="card" style={{ padding: '18px 16px' }}>
          {weights.length < 2 ? (
            <div className="col" style={{ gap: 10, alignItems: 'center', padding: '14px 0', textAlign: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>
                <Icon name="chart" size={26} stroke={1.6} />
              </span>
              <p className="small" style={{ maxWidth: 240 }}>
                Log your weight on two different days and the trend shows up here.
              </p>
              <button className="btn btn-sm btn-soft" onClick={() => setLogOpen(true)}>
                Log today
              </button>
            </div>
          ) : (
            <WeightChart points={weights} units={profile.units} />
          )}
        </div>
      </div>

      {logOpen && (
        <LogWeight
          units={profile.units}
          current={latestWeight}
          onClose={() => setLogOpen(false)}
          onSave={async (kg) => {
            await addWeight({ date: todayKey(), kg })
            setLogOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CalorieBars({
  data,
  target,
  max,
}: {
  data: { date: string; calories: number }[]
  target: number
  max: number
}) {
  const showLabels = data.length <= 14
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `calc(${(target / max) * 100}% + 20px)`,
          borderTop: '1.5px dashed var(--line-strong)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 30 ? 1 : 4, height: 132 }}>
        {data.map((d) => {
          const pct = (d.calories / max) * 100
          const over = d.calories > target * 1.05
          return (
            <div
              key={d.date}
              className="col"
              style={{ flex: 1, alignItems: 'center', gap: 6, minWidth: 0, height: '100%' }}
            >
              <div
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <div
                  title={`${fromKey(d.date).toLocaleDateString()} — ${Math.round(d.calories)} kcal`}
                  style={{
                    width: '100%',
                    maxWidth: 26,
                    height: `${Math.max(pct, d.calories > 0 ? 3 : 0)}%`,
                    minHeight: d.calories > 0 ? 3 : 0,
                    borderRadius: 5,
                    background:
                      d.calories === 0 ? 'var(--line)' : over ? 'var(--bad)' : 'var(--accent)',
                    opacity: d.calories === 0 ? 0.5 : 1,
                    transition: 'height 0.5s cubic-bezier(0.22,0.8,0.26,1)',
                  }}
                />
              </div>
              {showLabels && (
                <span className="small num" style={{ fontSize: 10 }}>
                  {fromKey(d.date).getDate()}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeightChart({
  points,
  units,
}: {
  points: { date: string; kg: number }[]
  units: 'metric' | 'imperial'
}) {
  const w = 320
  const h = 128
  const pad = 10
  const values = points.map((p) => (units === 'metric' ? p.kg : kgToLb(p.kg)))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const xy = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return [x, y] as const
  })
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${h - pad} L${xy[0][0].toFixed(1)} ${h - pad} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Weight trend">
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wfill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 4 : 2.6} fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.6" />
        ))}
      </svg>
      <div className="spread" style={{ marginTop: 6 }}>
        <span className="small num">{formatWeight(points[0].kg, units)}</span>
        <span className="small num" style={{ fontWeight: 650, color: 'var(--ink)' }}>
          {formatWeight(points[points.length - 1].kg, units)}
        </span>
      </div>
    </div>
  )
}

function LogWeight({
  units,
  current,
  onClose,
  onSave,
}: {
  units: 'metric' | 'imperial'
  current: number
  onClose: () => void
  onSave: (kg: number) => void
}) {
  const [value, setValue] = useState(
    units === 'metric' ? current.toFixed(1) : kgToLb(current).toFixed(1),
  )
  const n = parseFloat(value)
  const valid = Number.isFinite(n) && n > 20 && n < 700

  return (
    <Sheet title="Today's weight" onClose={onClose}>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          className="field num"
          type="number"
          inputMode="decimal"
          step="0.1"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ fontSize: 30, fontWeight: 660, height: 70, paddingRight: 60 }}
        />
        <span
          className="small"
          style={{
            position: 'absolute',
            right: 18,
            top: 0,
            bottom: 0,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 620,
          }}
        >
          {units === 'metric' ? 'kg' : 'lb'}
        </span>
      </div>
      <button
        className="btn btn-block"
        disabled={!valid}
        onClick={() => onSave(units === 'metric' ? n : lbToKg(n))}
      >
        Save
      </button>
    </Sheet>
  )
}
