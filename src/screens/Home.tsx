import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { HealthMeter, MacroBar, Ring, Sheet } from '../components/ui'
import { dayTotals, useStore } from '../store'
import { addDays, clockTime, dayOfMonth, prettyDay, recentWeek, todayKey, weekdayLetter } from '../dates'
import { scoreBand } from '../nutrition'
import type { Entry, MealSlot } from '../types'

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

export function Home({
  date,
  onDateChange,
  onOpenEntry,
  onScan,
}: {
  date: string
  onDateChange: (d: string) => void
  onOpenEntry: (e: Entry) => void
  onScan: () => void
}) {
  const { data } = useStore()
  const profile = data.profile!
  const targets = profile.targets
  const week = useMemo(recentWeek, [])

  const totals = dayTotals(data.entries, date)
  const remaining = Math.round(targets.calories - totals.calories)
  const dayEntries = data.entries
    .filter((e) => e.date === date)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))

  const loggedDays = useMemo(() => new Set(data.entries.map((e) => e.date)), [data.entries])
  const streak = useMemo(() => {
    let n = 0
    // Today only counts once something is logged; otherwise start from yesterday.
    let cursor = loggedDays.has(todayKey()) ? todayKey() : addDays(todayKey(), -1)
    while (loggedDays.has(cursor)) {
      n += 1
      cursor = addDays(cursor, -1)
    }
    return n
  }, [loggedDays])

  const avgScore =
    dayEntries.length > 0
      ? Math.round(dayEntries.reduce((s, e) => s + e.health_score, 0) / dayEntries.length)
      : null

  const grouped = SLOT_ORDER.map((slot) => ({
    slot,
    items: dayEntries.filter((e) => e.slot === slot),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="scroll page-pad">
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="wrap-tight">
          <p className="eyebrow">{prettyDay(date)}</p>
          <h1 className="h2">
            {totals.count === 0
              ? 'Nothing logged yet'
              : `${totals.count} ${totals.count === 1 ? 'item' : 'items'} logged`}
          </h1>
        </div>
        {streak > 0 && (
          <span className="chip" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <Icon name="flame" size={13} stroke={1.9} />
            <span className="num">{streak}</span>
          </span>
        )}
      </div>

      <div className="datestrip" style={{ marginBottom: 18 }}>
        {week.map((d) => (
          <button
            key={d}
            className="day"
            aria-pressed={d === date}
            onClick={() => onDateChange(d)}
          >
            <span className="day-label">{weekdayLetter(d)}</span>
            <span className="day-num">{dayOfMonth(d)}</span>
            {loggedDays.has(d) ? <span className="day-pip" /> : <span style={{ height: 4 }} />}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '24px 20px 20px', marginBottom: 12 }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <Ring value={totals.calories} target={targets.calories}>
            <div className="col" style={{ gap: 2, alignItems: 'center' }}>
              <span
                className="num"
                style={{
                  fontSize: 44,
                  fontWeight: 690,
                  lineHeight: 1,
                  color: remaining < 0 ? 'var(--bad)' : 'var(--ink)',
                }}
              >
                {Math.abs(remaining).toLocaleString()}
              </span>
              <span className="small" style={{ fontWeight: 620 }}>
                {remaining < 0 ? 'kcal over' : 'kcal left'}
              </span>
            </div>
          </Ring>
        </div>

        <div className="spread" style={{ marginBottom: 18 }}>
          <Figure label="Eaten" value={Math.round(totals.calories)} />
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
          <Figure label="Target" value={targets.calories} />
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
          <Figure label="Fibre" value={`${Math.round(totals.fiber_g)}g`} />
        </div>

        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          <MacroBar
            label="Protein"
            icon="bolt"
            value={totals.protein_g}
            target={targets.protein_g}
            color="var(--protein)"
            soft="var(--protein-soft)"
          />
          <MacroBar
            label="Carbs"
            icon="wheat"
            value={totals.carbs_g}
            target={targets.carbs_g}
            color="var(--carbs)"
            soft="var(--carbs-soft)"
          />
          <MacroBar
            label="Fat"
            icon="droplet"
            value={totals.fat_g}
            target={targets.fat_g}
            color="var(--fat)"
            soft="var(--fat-soft)"
          />
        </div>
      </div>

      {avgScore !== null && (
        <div className="card" style={{ padding: 16, marginBottom: 22 }}>
          <HealthMeter score={avgScore} />
          <p className="small" style={{ marginTop: 9 }}>
            {scoreBand(avgScore).label} — averaged across what you logged today.
          </p>
        </div>
      )}

      {dayEntries.length === 0 ? (
        <EmptyDay onScan={onScan} />
      ) : (
        <div className="col" style={{ gap: 22 }}>
          {grouped.map((g) => (
            <div key={g.slot} className="col" style={{ gap: 10 }}>
              <div className="spread">
                <p className="eyebrow">{SLOT_LABEL[g.slot]}</p>
                <p className="small num" style={{ fontWeight: 620 }}>
                  {Math.round(
                    g.items.reduce((s, e) => s + e.calories * (e.servings || 1), 0),
                  ).toLocaleString()}{' '}
                  kcal
                </p>
              </div>
              {g.items.map((e) => (
                <MealRow key={e.id} entry={e} onOpen={() => onOpenEntry(e)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="col" style={{ gap: 2, alignItems: 'center', flex: 1 }}>
      <span className="num" style={{ fontSize: 18, fontWeight: 660 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="small">{label}</span>
    </div>
  )
}

export function MealRow({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const kcal = Math.round(entry.calories * (entry.servings || 1))
  return (
    <button className="meal" onClick={onOpen}>
      {entry.image ? (
        <img className="thumb" src={entry.image} alt="" />
      ) : (
        <span className="thumb" style={{ color: 'var(--muted)' }}>
          <Icon
            name={entry.source === 'barcode' ? 'barcode' : entry.source === 'text' ? 'text' : 'image'}
            size={20}
            stroke={1.7}
          />
        </span>
      )}
      <span className="wrap-tight grow">
        <span className="h3 truncate">{entry.name}</span>
        <span className="small truncate">
          {entry.servings !== 1 ? `${entry.servings}× ` : ''}
          {entry.brand ? `${entry.brand} · ${entry.portion}` : entry.portion}
        </span>
        <span className="row" style={{ gap: 9, marginTop: 4 }}>
          <Macro color="var(--protein)" value={Math.round(entry.protein_g * (entry.servings || 1))} />
          <Macro color="var(--carbs)" value={Math.round(entry.carbs_g * (entry.servings || 1))} />
          <Macro color="var(--fat)" value={Math.round(entry.fat_g * (entry.servings || 1))} />
        </span>
      </span>
      <span className="col" style={{ alignItems: 'flex-end', gap: 3, flex: '0 0 auto' }}>
        <span className="num" style={{ fontSize: 16.5, fontWeight: 680 }}>
          {kcal.toLocaleString()}
        </span>
        <span className="small" style={{ fontSize: 11 }}>
          {clockTime(entry.loggedAt)}
        </span>
      </span>
    </button>
  )
}

function Macro({ color, value }: { color: string; value: number }) {
  return (
    <span className="row num" style={{ gap: 4, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {value}g
    </span>
  )
}

function EmptyDay({ onScan }: { onScan: () => void }) {
  return (
    <div
      className="card-flat"
      style={{ padding: '32px 22px', textAlign: 'center', display: 'grid', placeItems: 'center', gap: 14 }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
        }}
      >
        <Icon name="camera" size={24} stroke={1.6} />
      </span>
      <div className="col" style={{ gap: 5 }}>
        <h3 className="h3">No meals on this day</h3>
        <p className="small" style={{ maxWidth: 260 }}>
          Point the camera at a plate and AI Calorie works out what is on it.
        </p>
      </div>
      <button className="btn btn-sm" onClick={onScan}>
        <Icon name="camera" size={15} stroke={1.9} />
        Scan a meal
      </button>
    </div>
  )
}

export { Sheet }
