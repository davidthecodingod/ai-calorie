// Parse a Nutrition Facts / nutrition information panel out of OCR text.
// Pure and synchronous so it can be unit tested without a browser.

export interface ParsedLabel {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  satfat_g: number
  /** Serving text as printed, when the panel states one. */
  serving: string
  /** True when the figures are stated per 100 g/ml rather than per serving. */
  per100: boolean
  /** Which fields were actually found. */
  found: string[]
  /** 0-1, from how much of the panel was legible. */
  confidence: number
}

/** OCR reads digits as letters constantly; only ever applied to a quantity token. */
function fixDigits(token: string): string {
  return token
    .replace(/[oO]/g, '0')
    .replace(/[lI|i]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '6')
}

// Every word that can appear in a panel beside the numbers. Removing these first
// is what stops letters inside words being read as digits.
const STRIP =
  /\b(?:nutrition|nutritlon|nutritional|facts|fact|information|info|typical|values?|amount|average|approx|per|portion|serving|servings|size|container|pack|daily|reference|intake|total|of|which|includes|added|trans|saturated|saturates|satfat|polyunsaturated|monounsaturated|unsaturated|dietary|calories|calorie|energy|protein|protien|proteins|carbohydrates?|carbs?|fats?|fiber|fibre|sugars?|salt|sodium|cholesterol|vitamin|calcium|iron|potassium|and|the)\b/g

const QTY = /((?:\d|[oOlI|isS])+(?:[.,](?:\d|[oOlI|isS])+)?)\s*(g|mg|mcg|kcal|kj|ml|oz)?/gi

interface Quantity {
  value: number
  hadUnit: boolean
  /** OCR often turns a trailing unit "g" into "9"; this is the value without it. */
  withoutTrailingUnit: number | null
}

/** Quantities on a line, after its label words have been removed. */
function quantitiesOn(line: string): Quantity[] {
  const stripped = line.replace(STRIP, ' ')
  const out: Quantity[] = []
  for (const m of stripped.matchAll(QTY)) {
    const [, token, unit] = m
    // A quantity is believable when it holds a real digit, or carries a unit.
    if (!/\d/.test(token) && !unit) continue
    const fixed = fixDigits(token).replace(',', '.')
    const n = parseFloat(fixed)
    if (!Number.isFinite(n)) continue
    // "12g" misread as "129": only a candidate when no unit was found and
    // dropping the 9 still leaves a number.
    let alt: number | null = null
    if (!unit && /^\d{2,}$/.test(fixed) && fixed.endsWith('9')) {
      const stripped9 = parseFloat(fixed.slice(0, -1))
      if (Number.isFinite(stripped9)) alt = stripped9
    }
    out.push({ value: n, hadUnit: Boolean(unit), withoutTrailingUnit: alt })
  }
  return out
}

const numbers = (qs: Quantity[]) => qs.map((q) => q.value)

/** Loose keyword match: OCR mangles a character or two. */
function hasWord(line: string, variants: string[]): boolean {
  return variants.some((v) => {
    if (line.includes(v)) return true
    if (v.length < 5) return false
    for (let i = 0; i < v.length; i++) {
      const pattern = `${v.slice(0, i)}.${v.slice(i + 1)}`
      if (new RegExp(pattern).test(line)) return true
    }
    return false
  })
}

const FIELDS: { key: keyof ParsedLabel; words: string[]; exclude?: string[] }[] = [
  { key: 'satfat_g', words: ['saturated', 'saturates', 'satfat'] },
  { key: 'fiber_g', words: ['fiber', 'fibre'] },
  { key: 'sugar_g', words: ['sugars', 'sugar'] },
  { key: 'protein_g', words: ['protein', 'protien'] },
  // After saturates and sugars, so those lines are already claimed.
  { key: 'fat_g', words: ['total fat', 'fat'], exclude: ['saturated', 'saturates', 'trans'] },
  { key: 'carbs_g', words: ['carbohydrate', 'carbohydrates', 'total carb', 'carbs'] },
]

export function parseLabel(rawText: string): ParsedLabel {
  const text = rawText.toLowerCase().replace(/ /g, ' ')
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean)

  const result: ParsedLabel = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    satfat_g: 0,
    serving: '',
    per100: false,
    found: [],
    confidence: 0,
  }

  const claimed = new Set<number>()
  // field -> the reading if its trailing digit was really a unit "g"
  const ambiguous: Record<string, number> = {}

  // --- energy ---
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!hasWord(line, ['calories', 'calorie', 'energy', 'kcal'])) continue
    // "1046kJ / 250kcal" - prefer the figure actually labelled kcal.
    const kcal = line.match(/(\d+(?:[.,]\d+)?)\s*k?cal/)
    let value = kcal ? parseFloat(kcal[1].replace(',', '.')) : NaN
    if (!Number.isFinite(value)) {
      const plausible = numbers(quantitiesOn(line)).filter((n) => n >= 5 && n <= 1500)
      // With both kJ and kcal present and unlabelled, kcal is the smaller.
      value = /kj/.test(line) && plausible.length > 1 ? Math.min(...plausible) : plausible[0] ?? NaN
    }
    if (Number.isFinite(value) && value > 0) {
      result.calories = Math.round(value)
      result.found.push('calories')
      claimed.add(i)
      break
    }
  }

  // --- macros ---
  for (const field of FIELDS) {
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue
      const line = lines[i]
      if (!hasWord(line, field.words)) continue
      if (field.exclude?.some((x) => line.includes(x))) continue
      const qs = quantitiesOn(line).filter((q) => q.value >= 0 && q.value <= 400)
      if (!qs.length) continue
      claimed.add(i)
      ;(result[field.key] as number) = Math.round(qs[0].value)
      if (qs[0].withoutTrailingUnit !== null) {
        ambiguous[field.key as string] = Math.round(qs[0].withoutTrailingUnit)
      }
      result.found.push(field.key)
      break
    }
  }

  // --- serving size ---
  const servingLine =
    lines.find((l) => hasWord(l, ['serving size'])) ??
    lines.find((l) => hasWord(l, ['portion size'])) ??
    lines.find((l) => /\d/.test(l) && /\(.*\d.*\)/.test(l) && hasWord(l, ['serving', 'portion']))
  if (servingLine) {
    const cleaned = servingLine
      .replace(/serving size|portion size|per serving|serving|portion/g, '')
      .replace(/^[:\-\s]+/, '')
      .trim()
    if (cleaned && /\d/.test(cleaned)) {
      // "(55g)" commonly reads as "(559)".
      result.serving = cleaned.replace(/(\d)9\)/g, '$1g)').slice(0, 60)
      result.found.push('serving')
    }
  }

  // --- resolve "12g" read as "129" ---
  // A panel is internally consistent: sugars cannot exceed carbohydrate,
  // saturates cannot exceed fat, fibre cannot exceed carbohydrate, and the
  // macros must roughly account for the stated energy. Each of those is enough
  // to tell a real 9 from a misread unit.
  const contained: [string, string][] = [
    ['sugar_g', 'carbs_g'],
    ['satfat_g', 'fat_g'],
    ['fiber_g', 'carbs_g'],
  ]
  for (const [child, parent] of contained) {
    const alt = ambiguous[child]
    if (alt === undefined) continue
    const parentValue = result[parent as keyof ParsedLabel] as number
    if (parentValue > 0 && (result[child as keyof ParsedLabel] as number) > parentValue) {
      ;(result[child as keyof ParsedLabel] as number) = alt
      delete ambiguous[child]
    }
  }

  if (result.calories > 0) {
    const energyFields = ['protein_g', 'carbs_g', 'fat_g'].filter((k) => k in ambiguous)
    if (energyFields.length) {
      const kcal = (r: ParsedLabel) => r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9
      let best = { miss: Math.abs(kcal(result) - result.calories), combo: -1 }
      // Try every subset of the ambiguous energy fields; keep the closest fit.
      for (let mask = 1; mask < 1 << energyFields.length; mask++) {
        const trial = { ...result }
        energyFields.forEach((k, bit) => {
          if (mask & (1 << bit)) (trial[k as keyof ParsedLabel] as number) = ambiguous[k]
        })
        const miss = Math.abs(kcal(trial) - result.calories)
        if (miss < best.miss) best = { miss, combo: mask }
      }
      if (best.combo > 0) {
        energyFields.forEach((k, bit) => {
          if (best.combo & (1 << bit)) (result[k as keyof ParsedLabel] as number) = ambiguous[k]
        })
      }
    }
  }

  // --- per 100 g panels ---
  result.per100 = /per\s*1?[o0]{2}\s*(g|ml)/.test(text) && !/per serving/.test(text)

  const macros = ['protein_g', 'carbs_g', 'fat_g'].filter((k) => result.found.includes(k)).length
  const extras = ['fiber_g', 'sugar_g', 'satfat_g', 'serving'].filter((k) =>
    result.found.includes(k),
  ).length
  if (result.calories > 0) {
    result.confidence = Math.min(0.95, 0.3 + macros * 0.18 + extras * 0.05)
  }
  return result
}

/** Enough of the panel to log without asking a model. */
export function isUsable(p: ParsedLabel): boolean {
  const macros = ['protein_g', 'carbs_g', 'fat_g'].filter((k) => p.found.includes(k)).length
  if (p.calories <= 0 || macros < 2) return false
  // Sanity: the macros should roughly account for the stated energy.
  const implied = p.protein_g * 4 + p.carbs_g * 4 + p.fat_g * 9
  if (implied > 0 && (implied > p.calories * 2.2 || implied < p.calories * 0.4)) return false
  return true
}

/** A 0-100 diet-quality score from the panel alone. */
export function scoreFromPanel(p: ParsedLabel): number {
  let score = 62
  score -= Math.min(26, (p.sugar_g / 10) * 7)
  score -= Math.min(20, (p.satfat_g / 5) * 7)
  score += Math.min(14, p.fiber_g * 2.6)
  score += Math.min(12, p.protein_g * 0.7)
  return Math.round(Math.min(95, Math.max(5, score)))
}
