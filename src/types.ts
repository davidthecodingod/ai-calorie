export type Sex = 'female' | 'male'
export type Units = 'metric' | 'imperial'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete'
export type GoalKind = 'lose' | 'maintain' | 'gain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Targets {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Profile {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: GoalKind
  /** kg per week, always positive; direction comes from `goal` */
  rateKgPerWeek: number
  units: Units
  targets: Targets
  createdAt: string
}

export interface Ingredient {
  name: string
  detail: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Analysis {
  name: string
  portion: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  health_score: number
  confidence: number
  note: string
  ingredients: Ingredient[]
  /** Set for packaged food: the brand from the label. */
  brand?: string
  /** Set for packaged food: the ingredients list as printed. */
  ingredientsText?: string
}

export interface Entry extends Analysis {
  id: string
  /** local calendar day, YYYY-MM-DD */
  date: string
  loggedAt: string
  slot: MealSlot
  servings: number
  image?: string
  source: 'photo' | 'text' | 'barcode' | 'label'
}

export interface WeightPoint {
  date: string
  kg: number
}

export interface Settings {
  theme?: 'light' | 'dark' | 'system'
}

export interface AppData {
  profile: Profile | null
  entries: Entry[]
  weights: WeightPoint[]
  settings: Settings
}
