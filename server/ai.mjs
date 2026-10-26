// Food analysis. Routes through publik API when an app token is present,
// and falls back to the user's own Anthropic key otherwise.

const PUBLIK_URL = () => process.env.PUBLIK_API_URL || 'https://publikhq.com/api/v1'
const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-opus-5'

export function provider() {
  if (process.env.PUBLIK_APP_TOKEN) return 'publik'
  if (process.env.ANTHROPIC_API_KEY) return 'own-key'
  return 'none'
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

async function callPublik(messages, maxTokens) {
  const res = await fetch(`${PUBLIK_URL()}/ai/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.PUBLIK_APP_TOKEN}`,
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: maxTokens,
      system: SYSTEM,
      messages,
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`publik ai.chat ${res.status}: ${text.slice(0, 400)}`)
  return extractText(JSON.parse(text))
}

async function callAnthropic(messages, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: maxTokens,
      system: SYSTEM,
      messages,
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${text.slice(0, 400)}`)
  return extractText(JSON.parse(text))
}

// Accepts an Anthropic-shaped body, and tolerates a few common wrappers.
function extractText(body) {
  if (typeof body?.text === 'string') return body.text
  if (typeof body?.completion === 'string') return body.completion
  if (Array.isArray(body?.content)) {
    return body.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  }
  const choice = body?.choices?.[0]?.message?.content
  if (typeof choice === 'string') return choice
  if (body?.data) return extractText(body.data)
  if (body?.result) return extractText(body.result)
  throw new Error(`unexpected ai response shape: ${JSON.stringify(body).slice(0, 300)}`)
}

async function complete(messages, maxTokens = 1400) {
  const p = provider()
  if (p === 'publik') return callPublik(messages, maxTokens)
  if (p === 'own-key') return callAnthropic(messages, maxTokens)
  throw new Error(
    'No AI credential configured. Set PUBLIK_APP_TOKEN (preferred) or ANTHROPIC_API_KEY.',
  )
}

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
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : [])
      .slice(0, 8)
      .map((i) => ({
        name: String(i.name || 'Item').slice(0, 60),
        detail: String(i.detail || '').slice(0, 60),
        calories: Math.max(0, Math.round(num(i.calories))),
        protein_g: Math.max(0, Math.round(num(i.protein_g))),
        carbs_g: Math.max(0, Math.round(num(i.carbs_g))),
        fat_g: Math.max(0, Math.round(num(i.fat_g))),
      })),
  }
}

export async function analyzeImage({ base64, mimeType, note }) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
    {
      type: 'text',
      text: `Estimate the nutrition of the food in this photo.${
        note ? `\n\nThe user adds: "${note}" - trust this over what you infer.` : ''
      }\n\n${SCHEMA_RULES}`,
    },
  ]
  return normalize(parseJson(await complete([{ role: 'user', content }])))
}

export async function analyzeText({ description }) {
  const text = `Estimate the nutrition of this meal described in words: "${description}"\n\n${SCHEMA_RULES}`
  return normalize(parseJson(await complete([{ role: 'user', content: text }])))
}

const LABEL_RULES = `Reply with ONE JSON object and nothing else. No prose, no markdown fence.
{
  "name": string,               // the product name as printed
  "brand": string,              // brand if visible, else ""
  "portion": string,            // the serving the panel is stated per, e.g. "1 bar (40 g)"
  "calories": number,           // PER SERVING, exactly as printed
  "protein_g": number,
  "carbs_g": number,            // total carbohydrate
  "fat_g": number,              // total fat
  "fiber_g": number,
  "sugar_g": number,
  "health_score": number,       // 0-100, your own judgement of this food
  "confidence": number,         // 0-1, how legible the panel was
  "ingredients_text": string,   // the ingredients list as printed, or ""
  "ingredients": [],
  "note": string
}
Copy the printed numbers; do not recompute or round them. Use the PER SERVING
column when the panel shows both per-serving and per-100 g. If the panel states
only per 100 g, use that and say so in "note". If a value is not printed, use 0.`

export async function analyzeLabel({ base64, mimeType }) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
    {
      type: 'text',
      text: `This is a photo of a packaged food's nutrition information panel.
Read it and transcribe what it states.\n\n${LABEL_RULES}`,
    },
  ]
  return normalize(parseJson(await complete([{ role: 'user', content }])))
}

export async function refine({ entry, instruction }) {
  const text = `Here is an existing nutrition estimate:
${JSON.stringify(entry, null, 2)}

The user corrects it: "${instruction}"

Apply the correction and re-estimate every affected field.
${SCHEMA_RULES}`
  return normalize(parseJson(await complete([{ role: 'user', content: text }])))
}

// One cheap round trip used by the startup self-test.
export async function ping() {
  const out = await complete(
    [{ role: 'user', content: 'Reply with the single word: ready' }],
    16,
  )
  return out.trim().slice(0, 40)
}
