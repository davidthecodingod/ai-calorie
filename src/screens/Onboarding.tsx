import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store'
import {
  ACTIVITY_COPY,
  cmToIn,
  computeTargets,
  inToCm,
  kgToLb,
  lbToKg,
} from '../nutrition'
import type { Activity, GoalKind, Profile, Sex, Units } from '../types'

const GOALS: { key: GoalKind; title: string; detail: string }[] = [
  { key: 'lose', title: 'Lose weight', detail: 'Eat below what you burn' },
  { key: 'maintain', title: 'Maintain', detail: 'Hold steady and eat well' },
  { key: 'gain', title: 'Build muscle', detail: 'Eat above what you burn' },
]

const RATES = [0.25, 0.5, 0.75, 1]

export function Onboarding() {
  const { saveProfile } = useStore()
  const [step, setStep] = useState(0)

  const [sex, setSex] = useState<Sex>('female')
  const [units, setUnits] = useState<Units>('metric')
  const [heightCm, setHeightCm] = useState(170)
  const [weightKg, setWeightKg] = useState(70)
  const [birthYear, setBirthYear] = useState(new Date().getFullYear() - 28)
  const [activity, setActivity] = useState<Activity>('light')
  const [goal, setGoal] = useState<GoalKind>('lose')
  const [rate, setRate] = useState(0.5)

  const draft = { sex, birthYear, heightCm, weightKg, activity, goal, rateKgPerWeek: goal === 'maintain' ? 0 : rate }
  const targets = useMemo(() => computeTargets(draft), [sex, birthYear, heightCm, weightKg, activity, goal, rate])

  const steps = goal === 'maintain' ? 6 : 7
  const last = steps - 1

  const commit = async () => {
    const profile: Profile = {
      ...draft,
      units,
      targets,
      createdAt: new Date().toISOString(),
    }
    await saveProfile(profile)
  }

  const next = () => (step >= last ? setStep(steps) : setStep(step + 1))

  if (step === steps) return <BuildingPlan targets={targets} goal={goal} onDone={commit} />

  return (
    <div className="shell">
      <div className="scroll page-pad" style={{ paddingBottom: 24 }}>
        {step > 0 && (
          <div className="row" style={{ gap: 12, marginBottom: 22 }}>
            <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="Back">
              <Icon name="left" size={18} stroke={2} />
            </button>
            <div className="macro-track grow">
              <div
                className="macro-fill"
                style={{ width: `${(step / last) * 100}%`, background: 'var(--ink)' }}
              />
            </div>
            <span className="small num" style={{ fontWeight: 620 }}>
              {step}/{last}
            </span>
          </div>
        )}

        {step === 0 && <Welcome onStart={() => setStep(1)} />}

        {step === 1 && (
          <Question
            title="Which should we base your metabolism on?"
            hint="Resting energy differs between bodies. You can change this later."
          >
            <div className="stack">
              {(['female', 'male'] as Sex[]).map((s) => (
                <button
                  key={s}
                  className="option"
                  aria-pressed={sex === s}
                  onClick={() => setSex(s)}
                >
                  <span className="option-dot" />
                  <span className="h3" style={{ textTransform: 'capitalize' }}>
                    {s}
                  </span>
                </button>
              ))}
            </div>
          </Question>
        )}

        {step === 2 && (
          <Question title="Your height and weight" hint="This sets the scale for every estimate.">
            <div className="seg" style={{ marginBottom: 20 }}>
              {(['metric', 'imperial'] as Units[]).map((u) => (
                <button key={u} aria-pressed={units === u} onClick={() => setUnits(u)}>
                  {u === 'metric' ? 'cm / kg' : 'ft / lb'}
                </button>
              ))}
            </div>
            {units === 'metric' ? (
              <div className="stack" style={{ ['--gap' as string]: '14px' }}>
                <Labeled label="Height">
                  <NumField value={Math.round(heightCm)} onChange={setHeightCm} suffix="cm" />
                </Labeled>
                <Labeled label="Weight">
                  <NumField
                    value={Number(weightKg.toFixed(1))}
                    onChange={setWeightKg}
                    suffix="kg"
                    stepDecimal
                  />
                </Labeled>
              </div>
            ) : (
              <div className="stack" style={{ ['--gap' as string]: '14px' }}>
                <Labeled label="Height">
                  <div className="row" style={{ gap: 10 }}>
                    <NumField
                      value={Math.floor(cmToIn(heightCm) / 12)}
                      onChange={(ft) => setHeightCm(inToCm(ft * 12 + (Math.round(cmToIn(heightCm)) % 12)))}
                      suffix="ft"
                    />
                    <NumField
                      value={Math.round(cmToIn(heightCm)) % 12}
                      onChange={(inch) =>
                        setHeightCm(inToCm(Math.floor(cmToIn(heightCm) / 12) * 12 + inch))
                      }
                      suffix="in"
                    />
                  </div>
                </Labeled>
                <Labeled label="Weight">
                  <NumField
                    value={Math.round(kgToLb(weightKg))}
                    onChange={(lb) => setWeightKg(lbToKg(lb))}
                    suffix="lb"
                  />
                </Labeled>
              </div>
            )}
          </Question>
        )}

        {step === 3 && (
          <Question title="What year were you born?" hint="Energy needs fall slowly with age.">
            <NumField value={birthYear} onChange={setBirthYear} suffix="" big />
            <p className="small" style={{ marginTop: 12 }}>
              That makes you {new Date().getFullYear() - birthYear}.
            </p>
          </Question>
        )}

        {step === 4 && (
          <Question title="How much do you move?" hint="Be honest — over-reporting is the usual mistake.">
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              {(Object.keys(ACTIVITY_COPY) as Activity[]).map((a) => (
                <button
                  key={a}
                  className="option"
                  aria-pressed={activity === a}
                  onClick={() => setActivity(a)}
                >
                  <span className="option-dot" />
                  <span className="wrap-tight">
                    <span className="h3">{ACTIVITY_COPY[a].title}</span>
                    <span className="small">{ACTIVITY_COPY[a].detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </Question>
        )}

        {step === 5 && (
          <Question title="What are you here to do?">
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  className="option"
                  aria-pressed={goal === g.key}
                  onClick={() => setGoal(g.key)}
                >
                  <span className="option-dot" />
                  <span className="wrap-tight">
                    <span className="h3">{g.title}</span>
                    <span className="small">{g.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </Question>
        )}

        {step === 6 && goal !== 'maintain' && (
          <Question
            title={`How fast do you want to ${goal === 'lose' ? 'lose' : 'gain'}?`}
            hint="Slower is easier to keep and protects muscle."
          >
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              {RATES.map((r) => (
                <button key={r} className="option" aria-pressed={rate === r} onClick={() => setRate(r)}>
                  <span className="option-dot" />
                  <span className="wrap-tight">
                    <span className="h3 num">
                      {units === 'metric' ? `${r} kg` : `${(r * 2.2).toFixed(1)} lb`} per week
                    </span>
                    <span className="small">
                      {r <= 0.25 ? 'Very gradual' : r <= 0.5 ? 'Recommended' : r <= 0.75 ? 'Brisk' : 'Aggressive'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Question>
        )}
      </div>

      {step > 0 && (
        <div style={{ padding: '0 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <button className="btn btn-block" onClick={next}>
            {step === last ? 'Build my plan' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="col" style={{ minHeight: '72vh', justifyContent: 'center', gap: 26 }}>
      <div
        className="pop"
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: 'var(--ink)',
          color: 'var(--bg)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name="camera" size={34} stroke={1.6} />
      </div>
      <div className="col" style={{ gap: 14 }}>
        <h1 className="h1" style={{ fontSize: 38 }}>
          Photograph a meal.
          <br />
          Get the numbers.
        </h1>
        <p className="body" style={{ fontSize: 16.5 }}>
          AI Calorie reads a plate of food and gives you its calories, protein, carbs and fat — no
          weighing, no searching a database.
        </p>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {[
          ['camera', 'One photo per meal'],
          ['target', 'Targets built from your body and goal'],
          ['shield', 'Your log stays on this machine'],
        ].map(([icon, text]) => (
          <div key={text} className="row" style={{ gap: 11 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--ink-2)',
              }}
            >
              <Icon name={icon as 'camera'} size={15} stroke={1.8} />
            </span>
            <span className="body" style={{ color: 'var(--ink)', fontWeight: 540 }}>
              {text}
            </span>
          </div>
        ))}
      </div>
      <button className="btn btn-block" onClick={onStart}>
        Get started
      </button>
    </div>
  )
}

function Question({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="pop">
      <h1 className="h1" style={{ marginBottom: hint ? 8 : 22 }}>
        {title}
      </h1>
      {hint && (
        <p className="body" style={{ marginBottom: 24 }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="col" style={{ gap: 7 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

function NumField({
  value,
  onChange,
  suffix,
  big,
  stepDecimal,
}: {
  value: number
  onChange: (v: number) => void
  suffix: string
  big?: boolean
  stepDecimal?: boolean
}) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        className="field num"
        type="number"
        inputMode="decimal"
        step={stepDecimal ? 0.1 : 1}
        value={String(value)}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        style={{
          fontSize: big ? 30 : 17,
          fontWeight: 650,
          height: big ? 68 : 52,
          paddingRight: suffix ? 52 : 16,
        }}
      />
      {suffix && (
        <span
          className="small"
          style={{
            position: 'absolute',
            right: 16,
            top: 0,
            bottom: 0,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 620,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

function BuildingPlan({
  targets,
  goal,
  onDone,
}: {
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  goal: GoalKind
  onDone: () => void
}) {
  const [phase, setPhase] = useState(0)
  const lines = [
    'Working out your resting burn',
    'Adding what your activity costs',
    'Setting the daily gap for your goal',
    'Splitting it into protein, carbs and fat',
  ]

  useEffect(() => {
    if (phase >= lines.length) return
    const id = setTimeout(() => setPhase((p) => p + 1), 620)
    return () => clearTimeout(id)
  }, [phase])

  const done = phase >= lines.length

  return (
    <div className="shell">
      <div className="scroll page-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '40px 0' }}>
          {!done ? (
            <div className="col" style={{ gap: 18, width: '100%' }}>
              <h1 className="h1">Building your plan…</h1>
              <div className="col" style={{ gap: 13, marginTop: 8 }}>
                {lines.map((l, i) => (
                  <div key={l} className="row" style={{ gap: 11, opacity: i <= phase ? 1 : 0.32 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        background: i < phase ? 'var(--good)' : 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        color: '#fff',
                      }}
                    >
                      {i < phase ? (
                        <Icon name="check" size={12} stroke={2.6} />
                      ) : i === phase ? (
                        <span className="spinner" style={{ width: 11, height: 11, borderWidth: 2, color: 'var(--ink-2)' }} />
                      ) : null}
                    </span>
                    <span className="body" style={{ color: 'var(--ink)' }}>
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="col pop" style={{ gap: 22, width: '100%' }}>
              <div className="col" style={{ gap: 8 }}>
                <p className="eyebrow">Your daily plan</p>
                <h1 className="h1">
                  {goal === 'lose'
                    ? 'Here is your deficit.'
                    : goal === 'gain'
                      ? 'Here is your surplus.'
                      : 'Here is your baseline.'}
                </h1>
              </div>
              <div className="card" style={{ padding: 22, textAlign: 'center' }}>
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Calories a day
                </p>
                <div className="num" style={{ fontSize: 54, fontWeight: 690, lineHeight: 1 }}>
                  {targets.calories.toLocaleString()}
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                {[
                  ['Protein', targets.protein_g, 'var(--protein)'],
                  ['Carbs', targets.carbs_g, 'var(--carbs)'],
                  ['Fat', targets.fat_g, 'var(--fat)'],
                ].map(([label, g, color]) => (
                  <div key={label as string} className="card" style={{ padding: 14, flex: 1, textAlign: 'center' }}>
                    <div className="num" style={{ fontSize: 21, fontWeight: 670, color: color as string }}>
                      {g as number}
                      <span style={{ fontSize: 12, fontWeight: 580 }}>g</span>
                    </div>
                    <p className="small" style={{ marginTop: 3 }}>
                      {label as string}
                    </p>
                  </div>
                ))}
              </div>
              <p className="small">
                These are estimates from your height, weight, age and activity. Adjust them any time
                in Settings.
              </p>
              <button className="btn btn-block" onClick={onDone}>
                Start tracking
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
