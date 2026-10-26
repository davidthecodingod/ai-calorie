import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Sheet } from '../components/ui'
import { api, type AiState } from '../api'
import { useStore } from '../store'
import {
  ACTIVITY_COPY,
  computeTargets,
  formatHeight,
  formatWeight,
  age,
} from '../nutrition'
import type { Activity, GoalKind, Targets, Units } from '../types'

export function Settings() {
  const { data, saveProfile, saveSettings, resetAll, status } = useStore()
  const profile = data.profile!
  const [editTargets, setEditTargets] = useState(false)
  const [editBody, setEditBody] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [ai, setAi] = useState<AiState | null>(null)

  useEffect(() => {
    let live = true
    api
      .aiState()
      .then((s) => live && setAi(s))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const theme = data.settings.theme ?? 'system'

  return (
    <div className="scroll page-pad">
      <div className="wrap-tight" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Settings</p>
        <h1 className="h2">Your plan</h1>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="spread" style={{ marginBottom: 16 }}>
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow">Daily calories</span>
            <span className="num" style={{ fontSize: 34, fontWeight: 690, lineHeight: 1.05 }}>
              {profile.targets.calories.toLocaleString()}
            </span>
          </div>
          <button className="btn btn-sm btn-soft" onClick={() => setEditTargets(true)}>
            <Icon name="pencil" size={14} stroke={1.9} />
            Adjust
          </button>
        </div>
        <div className="row" style={{ gap: 9 }}>
          {([
            ['Protein', profile.targets.protein_g, 'var(--protein)'],
            ['Carbs', profile.targets.carbs_g, 'var(--carbs)'],
            ['Fat', profile.targets.fat_g, 'var(--fat)'],
          ] as const).map(([label, g, color]) => (
            <div key={label} className="card-flat" style={{ padding: '12px 10px', flex: 1, textAlign: 'center' }}>
              <div className="num" style={{ fontSize: 17, fontWeight: 670, color }}>
                {g}
                <span style={{ fontSize: 11.5, fontWeight: 580 }}>g</span>
              </div>
              <p className="small" style={{ fontSize: 11.5 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Group title="Body">
        <Row
          icon="scale"
          label="Height and weight"
          value={`${formatHeight(profile.heightCm, profile.units)} · ${formatWeight(profile.weightKg, profile.units)}`}
          onClick={() => setEditBody(true)}
        />
        <Row icon="info" label="Age" value={`${age(profile.birthYear)} years`} />
        <Row icon="bolt" label="Activity" value={ACTIVITY_COPY[profile.activity].title} onClick={() => setEditBody(true)} />
        <Row
          icon="target"
          label="Goal"
          value={
            profile.goal === 'maintain'
              ? 'Maintain'
              : `${profile.goal === 'lose' ? 'Lose' : 'Gain'} ${profile.rateKgPerWeek} kg/week`
          }
          onClick={() => setEditBody(true)}
        />
      </Group>

      <Group title="App">
        <div style={{ padding: '14px 16px' }}>
          <p className="small" style={{ fontWeight: 620, color: 'var(--ink-2)', marginBottom: 9 }}>
            Units
          </p>
          <div className="seg">
            {(['metric', 'imperial'] as Units[]).map((u) => (
              <button
                key={u}
                aria-pressed={profile.units === u}
                onClick={() => void saveProfile({ ...profile, units: u })}
              >
                {u === 'metric' ? 'cm / kg' : 'ft / lb'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
          <p className="small" style={{ fontWeight: 620, color: 'var(--ink-2)', marginBottom: 9 }}>
            Appearance
          </p>
          <div className="seg">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                aria-pressed={theme === t}
                onClick={() => void saveSettings({ ...data.settings, theme: t })}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Estimates">
        <Row
          icon="sparkle"
          label="Nutrition engine"
          value={
            status?.aiProvider === 'publik'
              ? 'publik API'
              : status?.aiProvider === 'own-key'
                ? 'Own API key'
                : 'Not set up'
          }
        />
        <Row icon="shield" label="Your log lives" value="On this machine" />
        {status && <Row icon="info" label="Version" value={`${status.app} ${status.version}`} />}
        {ai?.credential && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
            <div className="spread" style={{ marginBottom: 10 }}>
              <span className="small" style={{ fontWeight: 620, color: 'var(--ink)' }}>
                publik balance
              </span>
              <span className="small num" style={{ fontWeight: 650 }}>
                {ai.credential.balanceLine}
              </span>
            </div>
            {ai.credential.costSentence && (
              <p className="small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                {ai.credential.costSentence}
              </p>
            )}
            {ai.credential.claimState === 'anonymous'
              ? ai.credential.claimUrl && (
                  <a
                    className="btn btn-sm btn-soft"
                    href={ai.credential.claimUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    Sign in with publik
                  </a>
                )
              : ai.credential.addCreditUrl && (
                  <a
                    className="btn btn-sm btn-soft"
                    href={ai.credential.addCreditUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    Add a plan or pack
                  </a>
                )}
          </div>
        )}
      </Group>

      <div className="banner" style={{ marginBottom: 20 }}>
        <Icon name="info" size={16} stroke={1.9} />
        <span>
          AI Calorie gives estimates, not measurements. It is not medical advice — talk to a
          clinician before making big changes to how you eat.
        </span>
      </div>

      <button className="btn btn-danger btn-block" onClick={() => setConfirmReset(true)}>
        <Icon name="trash" size={16} stroke={1.9} />
        Erase all data
      </button>

      {editTargets && (
        <EditTargets
          targets={profile.targets}
          onClose={() => setEditTargets(false)}
          onReset={() => {
            void saveProfile({ ...profile, targets: computeTargets(profile) })
            setEditTargets(false)
          }}
          onSave={(t) => {
            void saveProfile({ ...profile, targets: t })
            setEditTargets(false)
          }}
        />
      )}

      {editBody && (
        <EditBody
          onClose={() => setEditBody(false)}
          profile={profile}
          onSave={(patch) => {
            const next = { ...profile, ...patch }
            void saveProfile({ ...next, targets: computeTargets(next) })
            setEditBody(false)
          }}
        />
      )}

      {confirmReset && (
        <Sheet title="Erase everything?" onClose={() => setConfirmReset(false)}>
          <p className="body" style={{ marginBottom: 18 }}>
            Your profile, every logged meal and your weight history will be deleted from this
            machine. This cannot be undone.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost grow" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn grow"
              style={{ background: 'var(--bad)', color: '#fff' }}
              onClick={() => void resetAll()}
            >
              Erase
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col" style={{ gap: 10, marginBottom: 22 }}>
      <p className="eyebrow">{title}</p>
      <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: IconName
  label: string
  value: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: 'none',
        border: 0,
        borderTop: '1px solid var(--line)',
        textAlign: 'left',
      }}
    >
      <span style={{ color: 'var(--muted)' }}>
        <Icon name={icon} size={17} stroke={1.8} />
      </span>
      <span className="grow small" style={{ fontWeight: 620, color: 'var(--ink)', fontSize: 14.5 }}>
        {label}
      </span>
      <span className="small truncate" style={{ maxWidth: 160, textAlign: 'right' }}>
        {value}
      </span>
      {onClick && (
        <span style={{ color: 'var(--muted)' }}>
          <Icon name="right" size={15} stroke={2} />
        </span>
      )}
    </Tag>
  )
}

function EditTargets({
  targets,
  onClose,
  onSave,
  onReset,
}: {
  targets: Targets
  onClose: () => void
  onSave: (t: Targets) => void
  onReset: () => void
}) {
  const [t, setT] = useState(targets)
  const field = (key: keyof Targets, label: string, unit: string) => (
    <label className="col" style={{ gap: 6 }} key={key}>
      <span className="eyebrow">{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          className="field num"
          type="number"
          value={String(t[key])}
          onChange={(e) => setT({ ...t, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          style={{ fontWeight: 650, paddingRight: 48 }}
        />
        <span
          className="small"
          style={{ position: 'absolute', right: 16, top: 0, bottom: 0, display: 'grid', placeItems: 'center' }}
        >
          {unit}
        </span>
      </div>
    </label>
  )

  return (
    <Sheet title="Adjust targets" onClose={onClose}>
      <div className="stack" style={{ ['--gap' as string]: '13px', marginBottom: 18 }}>
        {field('calories', 'Calories', 'kcal')}
        {field('protein_g', 'Protein', 'g')}
        {field('carbs_g', 'Carbs', 'g')}
        {field('fat_g', 'Fat', 'g')}
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn-ghost" onClick={onReset}>
          Recalculate
        </button>
        <button className="btn grow" onClick={() => onSave(t)}>
          Save targets
        </button>
      </div>
    </Sheet>
  )
}

function EditBody({
  profile,
  onClose,
  onSave,
}: {
  profile: { heightCm: number; weightKg: number; activity: Activity; goal: GoalKind; rateKgPerWeek: number; units: Units }
  onClose: () => void
  onSave: (patch: Partial<typeof profile>) => void
}) {
  const [heightCm, setHeightCm] = useState(profile.heightCm)
  const [weightKg, setWeightKg] = useState(profile.weightKg)
  const [activity, setActivity] = useState(profile.activity)
  const [goal, setGoal] = useState(profile.goal)
  const [rate, setRate] = useState(profile.rateKgPerWeek || 0.5)

  return (
    <Sheet title="Body and goal" onClose={onClose}>
      <div className="stack" style={{ ['--gap' as string]: '16px', marginBottom: 20 }}>
        <label className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Height (cm)</span>
          <input
            className="field num"
            type="number"
            value={String(Math.round(heightCm))}
            onChange={(e) => setHeightCm(parseFloat(e.target.value) || heightCm)}
          />
        </label>
        <label className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Weight (kg)</span>
          <input
            className="field num"
            type="number"
            step="0.1"
            value={String(Number(weightKg.toFixed(1)))}
            onChange={(e) => setWeightKg(parseFloat(e.target.value) || weightKg)}
          />
        </label>
        <label className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Activity</span>
          <select className="field" value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_COPY) as Activity[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_COPY[a].title}
              </option>
            ))}
          </select>
        </label>
        <label className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Goal</span>
          <select className="field" value={goal} onChange={(e) => setGoal(e.target.value as GoalKind)}>
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Build muscle</option>
          </select>
        </label>
        {goal !== 'maintain' && (
          <label className="col" style={{ gap: 6 }}>
            <span className="eyebrow">Rate (kg per week)</span>
            <select className="field" value={String(rate)} onChange={(e) => setRate(parseFloat(e.target.value))}>
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <option key={r} value={r}>
                  {r} kg
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <button
        className="btn btn-block"
        onClick={() =>
          onSave({ heightCm, weightKg, activity, goal, rateKgPerWeek: goal === 'maintain' ? 0 : rate })
        }
      >
        Save and recalculate
      </button>
    </Sheet>
  )
}
