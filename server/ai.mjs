// Food analysis. Routes through publik API (OpenAI-compatible, tier models) when
// this install has a publik credential, and through the user's own Anthropic key
// when they have set one. The own-key path takes precedence and is unchanged.
import { MODELS, resolveProvider, topUpUrlFrom402 } from './publik.mjs'

/** The UI must show the publik disclosure and get a yes before provisioning. */
export class NeedsConsent extends Error {
  constructor() {
    super('publik API has not been set up on this computer yet.')
    this.code = 'needs_consent'
  }
}

/** A 402 from publik: out of balance. Carries the one link we may show. */
export class PaymentRequired extends Error {
  constructor(message, topUpUrl) {
    super(message)
    this.code = 'payment_required'
    this.topUpUrl = topUpUrl
  }
}

const ownKey = () =>
  process.env.ANTHROPIC_API_KEY
    ? { baseURL: 'https://api.anthropic.com', apiKey: process.env.ANTHROPIC_API_KEY }
    : null

export function provider() {
  return resolveProvider(ownKey())
}

/** For /api/status and the settings screen. */
export function providerName() {
  const p = provider()
  if (p.kind === 'own') return 'own-key'
  if (p.kind === 'publik') return 'publik'
  return 'needs-consent'
}

const SCHEMA_RULES = `Reply with ONE JSON object and nothing else. No prose, no markdown fence.
{
  "name": string,               // short dish name, e.g. "Chicken burrito bowl"
  "portion": string,            // human portion, e.g. "1 bowl (approx. 450 g)"
  "calories": number,           // kcal for the whole portion shown
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "health_score": number,       // 0-100, diet quality of this item
  "confidence": number,         // 0-1, how sure you are
  "ingredients": [ { "name": string, "detail": string, "calories": number,
                     "protein_g": number, "carbs_g": number, "fat_g": number } ],
  "note": string                // one short sentence of useful context
}
Round grams to whole numbers and calories to the nearest 5. Estimate from visible
portion size; never return 0 calories for real food. Keep ingredients to 2-6 items
whose calories roughly sum to the total.`

const SYSTEM = `You are the nutrition estimator inside AI Calorie, a calorie tracking app.
You look at a photo or description of a meal and return your best structured estimate
of its nutrition. You are decisive: give a concrete number rather than a range, and
never refuse because a photo is imperfect. If the image clearly contains no food, set
calories to 0 and put the reason in "note".`

const LABEL_RULES = `Reply with ONE JSON object and nothing else. No prose, no markdown fence.
{
  "name": string,               // the product name as printed
  "brand": string,              // brand if visible, else ""
  "portion": string,            // the serving the panel is stated per, e.g. "1 bar (40 g)"
  "calories": number,           // PER SERVING, exactly as printed
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "health_score": number,       // 0-100 diet quality, where 100 is best. NOT 0-10.
  "confidence": number,         // 0-1, how legible the panel was
  "ingredients_text": string,   // the ingredients list as printed, or ""

  "ingredients": [],
  "note": string
}
Copy the printed numbers; do not recompute or round them. Use the PER SERVING
column when the panel shows both per-serving and per-100 g. If the panel states
only per 100 g, use that and say so in "note". If a value is not printed, use 0.`

/* ---------------- transport ---------------- */

async function callPublik(p, { text, image, maxTokens, tier }) {
  const content = [{ type: 'text', text }]
  if (image) {
    content.unshift({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })
  }
  const res = await fetch(`${p.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.apiKey}` },
    body: JSON.stringify({
      model: MODELS[tier] ?? MODELS.balanced,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content },
      ],
    }),
  })
  const raw = await res.text()
  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(`publik API returned a non-JSON response: ${raw.slice(0, 200)}`)
  }
  if (res.status === 402) {
    const { message, url } = topUpUrlFrom402(body)
    throw new PaymentRequired(message, url)
  }
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `publik API answered ${res.status}`)
  }
  const out = body?.choices?.[0]?.message?.content
  if (typeof out !== 'string') {
    throw new Error(`publik API returned no completion: ${JSON.stringify(body).slice(0, 200)}`)
  }
  return out
}

async function callAnthropic(p, { text, image, maxTokens }) {
  const content = []
  if (image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
    })
  }
  content.push({ type: 'text', text })

  const res = await fetch(`${p.baseURL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': p.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  })
  const raw = await res.text()
  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(`Anthropic returned a non-JSON response: ${raw.slice(0, 200)}`)
  }
  if (!res.ok) throw new Error(body?.error?.message ?? `Anthropic answered ${res.status}`)
  const out = (body.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  if (!out) throw new Error('Anthropic returned no completion')
  return out
}

async function complete({ text, image, maxTokens = 1400, tier = 'balanced' }) {
  const p = provider()
  if (p.kind === 'needs_consent') throw new NeedsConsent()
  return p.kind === 'own'
    ? callAnthropic(p, { text, image, maxTokens })
    : callPublik(p, { text, image, maxTokens, tier })
}

/* ---------------- shaping ---------------- */

function parseJson(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`model did not return JSON: ${raw.slice(0, 200)}`)
  return JSON.parse(raw.slice(start, end + 1))
}

const num = (v, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : fallback
}

function normalize(raw) {
  return {
    name: String(raw.name || 'Unknown food').slice(0, 80),
    portion: String(raw.portion || '1 serving').slice(0, 80),
    calories: Math.max(0, Math.round(num(raw.calories))),
    protein_g: Math.max(0, Math.round(num(raw.protein_g))),
    carbs_g: Math.max(0, Math.round(num(raw.carbs_g))),
    fat_g: Math.max(0, Math.round(num(raw.fat_g))),
    fiber_g: Math.max(0, Math.round(num(raw.fiber_g))),
    sugar_g: Math.max(0, Math.round(num(raw.sugar_g))),
    health_score: Math.min(100, Math.max(0, Math.round(num(raw.health_score, 50)))),
    confidence: Math.min(1, Math.max(0, num(raw.confidence, 0.6))),
    note: String(raw.note || '').slice(0, 240),
    brand: String(raw.brand || '').slice(0, 40),
    ingredientsText: String(raw.ingredients_text || raw.ingredientsText || '').slice(0, 600),
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : []).slice(0, 8).map((i) => ({
      name: String(i.name || 'Item').slice(0, 60),
      detail: String(i.detail || '').slice(0, 60),
      calories: Math.max(0, Math.round(num(i.calories))),
      protein_g: Math.max(0, Math.round(num(i.protein_g))),
      carbs_g: Math.max(0, Math.round(num(i.carbs_g))),
      fat_g: Math.max(0, Math.round(num(i.fat_g))),
    })),
  }
}

/* ---------------- the four jobs ---------------- */

export async function analyzeImage({ base64, mimeType, note }) {
  const text = `Estimate the nutrition of the food in this photo.${
    note ? `\n\nThe user adds: "${note}" - trust this over what you infer.` : ''
  }\n\n${SCHEMA_RULES}`
  // A meal photo is a judgement about a scene; balanced is the cheapest tier
  // that does it well.
  return normalize(parseJson(await complete({ text, image: { base64, mimeType }, tier: 'balanced' })))
}

export async function analyzeText({ description }) {
  const text = `Estimate the nutrition of this meal described in words: "${description}"\n\n${SCHEMA_RULES}`
  return normalize(parseJson(await complete({ text, tier: 'balanced' })))
}

export async function analyzeLabel({ base64, mimeType }) {
  const text = `This is a photo of a packaged food's nutrition information panel.
Read it and transcribe what it states.\n\n${LABEL_RULES}`
  // Transcribing printed numbers needs no more than the fast tier.
  return normalize(parseJson(await complete({ text, image: { base64, mimeType }, tier: 'fast' })))
}

export async function refine({ entry, instruction }) {
  const text = `Here is an existing nutrition estimate:
${JSON.stringify(entry, null, 2)}

The user corrects it: "${instruction}"

Apply the correction and re-estimate every affected field.
${SCHEMA_RULES}`
  return normalize(parseJson(await complete({ text, tier: 'balanced' })))
}
