// Packaged-food lookup against Open Food Facts (open data, no key).
// Returns the same shape the AI estimator produces, so the rest of the app
// does not care where a result came from.

const BASE = 'https://world.openfoodfacts.org/api/v2/product'
const FIELDS = [
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriscore_grade',
  'ingredients_text',
  'nutriments',
].join(',')

export class NotFound extends Error {}

const NUTRISCORE = { a: 88, b: 72, c: 55, d: 38, e: 20 }

/** "30 g", "2 biscuits (25g)", "1/2 cup (120 ml)" -> grams, when we can tell. */
function gramsFromServing(text, servingQuantity) {
  const q = Number(servingQuantity)
  if (Number.isFinite(q) && q > 0) return q
  if (!text) return null
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

const per100 = (nutriments, ...keys) => {
  for (const k of keys) {
    const v = nutriments?.[`${k}_100g`] ?? nutriments?.[k]
    const n = typeof v === 'string' ? parseFloat(v) : v
    if (Number.isFinite(n)) return n
  }
  return 0
}

/** Fall back to a rough quality score when the product has no Nutri-Score. */
function heuristicScore(n100) {
  let score = 62
  score -= Math.min(26, (n100.sugars / 10) * 7)
  score -= Math.min(20, (n100.satfat / 5) * 7)
  score += Math.min(14, n100.fiber * 2.6)
  score += Math.min(12, n100.protein * 0.7)
  score -= Math.min(10, n100.salt * 4)
  return Math.round(Math.min(95, Math.max(5, score)))
}

const grams0 = (p) => gramsFromServing(p.serving_size, p.serving_quantity)

/** Turn the label's serving text into one readable phrase. */
function tidyServing(text, grams) {
  let raw = String(text || '').trim().replace(/\s+/g, ' ')
  if (!raw) return `a ${grams} g serving`
  // A wholly parenthesised serving: "(330 ml)" -> "330 ml"
  if (/^\(.*\)$/.test(raw)) raw = raw.slice(1, -1).trim()
  // A bare measure gets the word "serving": "30 g" -> "a 30 g serving"
  if (/^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|l|oz|fl ?oz)$/i.test(raw)) {
    return `a ${raw} serving`
  }
  // Anything that names its own unit reads better as-is: "1 portion (330 ml)"
  return raw.replace(/^1 /, 'one ')
}

/** "400.0 g" -> "400 g" */
function tidyQuantity(q) {
  return String(q || '')
    .trim()
    .replace(/(\d+)\.0+(?=\s*[a-z])/gi, '$1')
}

export async function lookupBarcode(rawCode) {
  const code = String(rawCode).replace(/\D/g, '')
  if (code.length < 6 || code.length > 14) throw new NotFound('That is not a valid barcode.')

  const res = await fetch(`${BASE}/${code}.json?fields=${FIELDS}`, {
    headers: { 'user-agent': 'AI-Calorie/1.0 (local app)' },
  })
  if (res.status === 404) throw new NotFound('No product with that barcode in the database.')
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`)

  const body = await res.json()
  const p = body?.product
  if (!p || body.status === 0) throw new NotFound('No product with that barcode in the database.')

  const n = p.nutriments || {}
  const n100 = {
    calories: per100(n, 'energy-kcal'),
    protein: per100(n, 'proteins'),
    carbs: per100(n, 'carbohydrates'),
    fat: per100(n, 'fat'),
    fiber: per100(n, 'fiber', 'fibre'),
    sugars: per100(n, 'sugars'),
    satfat: per100(n, 'saturated-fat'),
    salt: per100(n, 'salt'),
  }
  if (n100.calories <= 0) {
    throw new NotFound('That product is in the database but has no nutrition data on it.')
  }

  const servingText = tidyServing(p.serving_size, grams0(p))
  const grams = gramsFromServing(p.serving_size, p.serving_quantity)
  const factor = (grams ?? 100) / 100
  const scale = (v) => Math.max(0, Math.round(v * factor))

  const name = (p.product_name || p.generic_name || 'Packaged food').trim().slice(0, 80)
  const brand = (p.brands || '').split(',')[0].trim().slice(0, 40)
  const packSize = tidyQuantity(p.quantity)
  const portion = grams
    ? servingText
    : `100 g${packSize ? ` (pack is ${packSize})` : ''}`

  const rawGrade = String(p.nutriscore_grade || '').toLowerCase()
  const grade = rawGrade in NUTRISCORE ? rawGrade : ''

  return {
    name,
    brand,
    portion,
    calories: Math.round(n100.calories * factor / 5) * 5,
    protein_g: scale(n100.protein),
    carbs_g: scale(n100.carbs),
    fat_g: scale(n100.fat),
    fiber_g: scale(n100.fiber),
    sugar_g: scale(n100.sugars),
    health_score: NUTRISCORE[grade] ?? heuristicScore(n100),
    confidence: 0.97,
    note: grams
      ? `Label figures for ${servingText}.${grade ? ` Nutri-Score ${grade.toUpperCase()}.` : ''}`
      : `Label figures per 100 g — set the servings to match what you ate.${grade ? ` Nutri-Score ${grade.toUpperCase()}.` : ''}`,
    ingredientsText: (p.ingredients_text || '').trim().slice(0, 600),
    ingredients: [],
    source: 'barcode',
  }
}
