import { useState } from 'react'
import { Icon } from '../components/Icon'
import { HealthMeter, Sheet, Stepper } from '../components/ui'
import { api } from '../api'
import { useStore } from '../store'
import { clockTime, guessSlot, prettyDay, todayKey } from '../dates'
import { scoreBand } from '../nutrition'
import type { Analysis, Entry, MealSlot } from '../types'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function Result({
  draft,
  existing,
  image,
  source,
  date,
  onClose,
}: {
  draft: Analysis
  existing?: Entry
  image?: string
  source: 'photo' | 'text'
  date: string
  onClose: () => void
}) {
  const { addEntry, updateEntry, removeEntry } = useStore()
  const [a, setA] = useState<Analysis>(draft)
  const [servings, setServings] = useState(existing?.servings ?? 1)
  const [slot, setSlot] = useState<MealSlot>(existing?.slot ?? guessSlot())
  const [editingName, setEditingName] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const [fixText, setFixText] = useState('')
  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const photo = image ?? existing?.image
  const s = servings || 1
  const band = scoreBand(a.health_score)

  const applyFix = async () => {
    if (!fixText.trim()) return
    setFixing(true)
    setFixError('')
    try {
      const next = await api.refine(a, fixText.trim())
      setA(next)
      setFixOpen(false)
      setFixText('')
    } catch (e) {
      setFixError((e as Error).message)
    } finally {
      setFixing(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      if (existing) {
        await updateEntry(existing.id, { ...a, servings, slot })
      } else {
        const entry: Entry = {
          ...a,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          loggedAt: new Date().toISOString(),
          slot,
          servings,
          image,
          source,
        }
        await addEntry(entry)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const drop = async () => {
    if (!existing) return
    await removeEntry(existing.id)
    onClose()
  }

  return (
    <div className="fullscreen">
      <div className="scroll" style={{ padding: 0 }}>
        <div style={{ position: 'relative' }}>
          {photo ? (
            <img
              src={photo}
              alt=""
              style={{ width: '100%', height: 248, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                height: 150,
                background: 'var(--surface-2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--muted)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <Icon name="text" size={32} stroke={1.5} />
            </div>
          )}
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', left: 16 }}
          >
            <Icon name="left" size={18} stroke={2} />
          </button>
          {existing && (
            <button
              className="icon-btn"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete"
              style={{
                position: 'absolute',
                top: 'max(14px, env(safe-area-inset-top))',
                right: 16,
                color: 'var(--bad)',
              }}
            >
              <Icon name="trash" size={17} stroke={1.9} />
            </button>
          )}
        </div>

        <div style={{ padding: '20px 20px calc(120px + env(safe-area-inset-bottom))' }}>
          <div className="spread" style={{ marginBottom: 4 }}>
            <p className="eyebrow">
              {existing ? `${prettyDay(existing.date)} · ${clockTime(existing.loggedAt)}` : 'New entry'}
            </p>
            <span className="chip">
              {Math.round(a.confidence * 100)}% confident
            </span>
          </div>

          {editingName ? (
            <input
              className="field"
              autoFocus
              value={a.name}
              onChange={(e) => setA({ ...a, name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              style={{ fontSize: 24, fontWeight: 660, height: 60, marginBottom: 6 }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <h1 className="h1">{a.name}</h1>
              <span style={{ color: 'var(--muted)', marginTop: 7 }}>
                <Icon name="pencil" size={15} stroke={1.9} />
              </span>
            </button>
          )}
          <p className="small" style={{ marginBottom: 18 }}>
            {a.portion}
          </p>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <div className="spread" style={{ marginBottom: 18 }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="eyebrow">Calories</span>
                <span className="num" style={{ fontSize: 40, fontWeight: 690, lineHeight: 1.05 }}>
                  {Math.round(a.calories * s).toLocaleString()}
                </span>
              </div>
              <div className="col" style={{ gap: 7, alignItems: 'flex-end' }}>
                <span className="eyebrow">Servings</span>
                <Stepper
                  value={servings}
                  onChange={setServings}
                  step={0.5}
                  min={0.5}
                  max={10}
                  format={(v) => `${v}×`}
                />
              </div>
            </div>

            <div className="row" style={{ gap: 9 }}>
              <MacroCard label="Protein" grams={a.protein_g * s} color="var(--protein)" soft="var(--protein-soft)" icon="bolt" />
              <MacroCard label="Carbs" grams={a.carbs_g * s} color="var(--carbs)" soft="var(--carbs-soft)" icon="wheat" />
              <MacroCard label="Fat" grams={a.fat_g * s} color="var(--fat)" soft="var(--fat-soft)" icon="droplet" />
            </div>

            <div className="row" style={{ gap: 9, marginTop: 9 }}>
              <MiniStat label="Fibre" value={`${Math.round(a.fiber_g * s)}g`} />
              <MiniStat label="Sugar" value={`${Math.round(a.sugar_g * s)}g`} />
              <MiniStat label="Quality" value={band.label} color={band.color} />
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <HealthMeter score={a.health_score} />
            {a.note && (
              <p className="small" style={{ marginTop: 10, color: 'var(--ink-2)' }}>
                {a.note}
              </p>
            )}
          </div>

          {a.ingredients.length > 0 && (
            <div className="col" style={{ gap: 10, marginBottom: 12 }}>
              <p className="eyebrow">What it is made of</p>
              <div className="card" style={{ padding: '4px 16px' }}>
                {a.ingredients.map((ing, i) => (
                  <div
                    key={`${ing.name}-${i}`}
                    className="spread"
                    style={{
                      padding: '13px 0',
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span className="wrap-tight grow">
                      <span className="h3" style={{ fontSize: 15 }}>
                        {ing.name}
                      </span>
                      {ing.detail && <span className="small">{ing.detail}</span>}
                    </span>
                    <span className="num small" style={{ fontWeight: 650, color: 'var(--ink)' }}>
                      {Math.round(ing.calories * s)} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn btn-soft btn-block"
            style={{ marginBottom: 20 }}
            onClick={() => setFixOpen(true)}
          >
            <Icon name="sparkle" size={16} stroke={1.8} />
            Not right? Correct it in words
          </button>

          <div className="col" style={{ gap: 10 }}>
            <p className="eyebrow">Meal</p>
            <div className="seg">
              {SLOTS.map((sl) => (
                <button key={sl} aria-pressed={slot === sl} onClick={() => setSlot(sl)}>
                  {sl[0].toUpperCase() + sl.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '14px 20px calc(18px + env(safe-area-inset-bottom))',
          background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--line)',
        }}
      >
        <button className="btn btn-block" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={18} stroke={2.2} />}
          {existing ? 'Save changes' : 'Add to today'}
        </button>
      </div>

      {fixOpen && (
        <Sheet title="Correct the estimate" onClose={() => setFixOpen(false)}>
          <p className="body" style={{ marginBottom: 14 }}>
            Say what is wrong and it will be re-estimated — “it was a double portion”, “no
            dressing”, “that is almond milk, not dairy”.
          </p>
          <textarea
            className="field"
            autoFocus
            placeholder="What should change?"
            value={fixText}
            onChange={(e) => setFixText(e.target.value)}
          />
          {fixError && (
            <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }}>
              {fixError}
            </p>
          )}
          <button
            className="btn btn-accent btn-block"
            style={{ marginTop: 14 }}
            onClick={applyFix}
            disabled={fixing || !fixText.trim()}
          >
            {fixing ? <span className="spinner" /> : <Icon name="sparkle" size={16} stroke={1.8} />}
            {fixing ? 'Re-estimating…' : 'Apply correction'}
          </button>
        </Sheet>
      )}

      {confirmDelete && (
        <Sheet title="Delete this entry?" onClose={() => setConfirmDelete(false)}>
          <p className="body" style={{ marginBottom: 18 }}>
            It will be removed from {existing ? prettyDay(existing.date).toLowerCase() : 'your log'}.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost grow" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button className="btn grow" style={{ background: 'var(--bad)', color: '#fff' }} onClick={drop}>
              Delete
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function MacroCard({
  label,
  grams,
  color,
  soft,
  icon,
}: {
  label: string
  grams: number
  color: string
  soft: string
  icon: 'bolt' | 'wheat' | 'droplet'
}) {
  return (
    <div className="card-flat" style={{ padding: '13px 12px', flex: 1, minWidth: 0 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: soft,
          color,
          display: 'grid',
          placeItems: 'center',
          marginBottom: 9,
        }}
      >
        <Icon name={icon} size={14} stroke={1.9} />
      </span>
      <div className="num" style={{ fontSize: 19, fontWeight: 670 }}>
        {Math.round(grams)}
        <span style={{ fontSize: 12, fontWeight: 580, color: 'var(--muted)' }}>g</span>
      </div>
      <p className="small" style={{ fontSize: 12 }}>
        {label}
      </p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card-flat" style={{ padding: '11px 12px', flex: 1, minWidth: 0 }}>
      <div className="num" style={{ fontSize: 14.5, fontWeight: 660, color: color || 'var(--ink)' }}>
        {value}
      </div>
      <p className="small" style={{ fontSize: 11.5 }}>
        {label}
      </p>
    </div>
  )
}
