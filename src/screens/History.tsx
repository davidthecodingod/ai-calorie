import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { MealRow } from './Home'
import { dayTotals, useStore } from '../store'
import { prettyDay } from '../dates'
import type { Entry } from '../types'

export function History({ onOpenEntry }: { onOpenEntry: (e: Entry) => void }) {
  const { data } = useStore()
  const profile = data.profile!
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? data.entries.filter(
          (e) => e.name.toLowerCase().includes(q) || e.portion.toLowerCase().includes(q),
        )
      : data.entries
    const byDate = new Map<string, Entry[]>()
    for (const e of matched) {
      const list = byDate.get(e.date) ?? []
      list.push(e)
      byDate.set(e.date, list)
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
      }))
  }, [data.entries, query])

  return (
    <div className="scroll page-pad">
      <div className="wrap-tight" style={{ marginBottom: 16 }}>
        <p className="eyebrow">History</p>
        <h1 className="h2">Everything you logged</h1>
      </div>

      <input
        className="field"
        placeholder="Search your meals"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 22 }}
      />

      {groups.length === 0 ? (
        <div className="card-flat" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <span style={{ color: 'var(--muted)' }}>
            <Icon name="image" size={26} stroke={1.6} />
          </span>
          <p className="small" style={{ marginTop: 10 }}>
            {query ? `Nothing matches “${query}”.` : 'Your logged meals will collect here.'}
          </p>
        </div>
      ) : (
        <div className="col" style={{ gap: 24 }}>
          {groups.map((g) => {
            const totals = dayTotals(data.entries, g.date)
            const over = totals.calories > profile.targets.calories
            return (
              <div key={g.date} className="col" style={{ gap: 10 }}>
                <div className="spread">
                  <p className="eyebrow">{prettyDay(g.date)}</p>
                  <span
                    className="small num"
                    style={{ fontWeight: 650, color: over ? 'var(--bad)' : 'var(--ink-2)' }}
                  >
                    {Math.round(totals.calories).toLocaleString()} /{' '}
                    {profile.targets.calories.toLocaleString()} kcal
                  </span>
                </div>
                {g.items.map((e) => (
                  <MealRow key={e.id} entry={e} onOpen={() => onOpenEntry(e)} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
