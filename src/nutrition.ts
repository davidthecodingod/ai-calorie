import type { Activity, GoalKind, Profile, Sex, Targets } from './types'

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
}

export const ACTIVITY_COPY: Record<Activity, { title: string; detail: string }> = {
  sedentary: { title: 'Mostly sitting', detail: 'Desk work, little deliberate exercise' },
  light: { title: 'Lightly active', detail: 'Walking or light exercise 1–3 days a week' },
  moderate: { title: 'Moderately active', detail: 'Exercise 3–5 days a week' },
  high: { title: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  athlete: { title: 'Athlete', detail: 'Training twice a day or a physical job' },
}

/** Mifflin–St Jeor resting metabolic rate, kcal/day. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function age(birthYear: number): number {
  return Math.max(13, new Date().getFullYear() - birthYear)
}

/** 1 kg of body mass ≈ 7700 kcal. */
const KCAL_PER_KG = 7700

export function computeTargets(p: {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: GoalKind
  rateKgPerWeek: number
}): Targets {
  const tdee = bmr(p.sex, p.weightKg, p.heightCm, age(p.birthYear)) * ACTIVITY_FACTOR[p.activity]
  const dailyShift = (p.rateKgPerWeek * KCAL_PER_KG) / 7
  let calories = tdee
  if (p.goal === 'lose') calories = tdee - dailyShift
  if (p.goal === 'gain') calories = tdee + dailyShift

  // Never prescribe below a safe floor.
  const floor = p.sex === 'male' ? 1500 : 1200
  calories = Math.max(floor, Math.round(calories / 10) * 10)

  // Protein scales with body mass and goal; fat holds at 27% of intake; carbs take the rest.
  const proteinPerKg = p.goal === 'lose' ? 2.0 : p.goal === 'gain' ? 1.8 : 1.6
  const protein_g = Math.round(p.weightKg * proteinPerKg)
  const fat_g = Math.round((calories * 0.27) / 9)
  const carbs_g = Math.max(40, Math.round((calories - protein_g * 4 - fat_g * 9) / 4))

  return { calories, protein_g, carbs_g, fat_g }
}

export function recomputeTargets(profile: Profile): Targets {
  return computeTargets(profile)
}

export const lbToKg = (lb: number) => lb / 2.2046226
export const kgToLb = (kg: number) => kg * 2.2046226
export const inToCm = (inch: number) => inch * 2.54
export const cmToIn = (cm: number) => cm / 2.54

export function formatWeight(kg: number, units: 'metric' | 'imperial'): string {
  return units === 'metric' ? `${kg.toFixed(1)} kg` : `${kgToLb(kg).toFixed(1)} lb`
}

export function formatHeight(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'metric') return `${Math.round(cm)} cm`
  const total = Math.round(cmToIn(cm))
  return `${Math.floor(total / 12)}′ ${total % 12}″`
}

/** Weeks to reach a goal weight at the configured rate. */
export function weeksToGoal(current: number, goal: number, rate: number): number | null {
  if (rate <= 0) return null
  const diff = Math.abs(current - goal)
  if (diff < 0.1) return 0
  return Math.ceil(diff / rate)
}

export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Excellent', color: 'var(--good)' }
  if (score >= 55) return { label: 'Good', color: 'var(--good)' }
  if (score >= 35) return { label: 'Fair', color: 'var(--warn)' }
  return { label: 'Heavy', color: 'var(--bad)' }
}
