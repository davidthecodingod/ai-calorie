import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './env.mjs'
import { store } from './store.mjs'
import {
  analyzeImage,
  analyzeLabel,
  analyzeText,
  refine,
  providerName,
  NeedsConsent,
  PaymentRequired,
} from './ai.mjs'
import { DISCLOSURE, balanceLine, hasAppToken, provision, readCredential } from './publik.mjs'
import { lookupBarcode, NotFound } from './offapi.mjs'
import { runSelfTest, appMeta } from './selftest.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(root)

// publik self-test: one line, one exit code, no server.
if (process.env.PUBLIK_SELF_TEST === '1') {
  process.exit(await runSelfTest())
}

const app = express()
app.use(express.json({ limit: '25mb' }))

const fail = (res, err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[ai-calorie]', message)
  // The UI needs to tell these three apart: consent, balance, everything else.
  if (err instanceof NeedsConsent) {
    return res.status(409).json({ error: message, code: 'needs_consent' })
  }
  if (err instanceof PaymentRequired) {
    return res.status(402).json({ error: message, code: 'payment_required', topUpUrl: err.topUpUrl })
  }
  res.status(500).json({ error: message })
}

app.get('/api/status', (_req, res) => {
  const { slug, version } = appMeta()
  res.json({ app: slug, version, aiProvider: providerName(), dataFile: store.path })
})

/** What the UI needs to decide between asking consent, showing a balance, or nothing. */
app.get('/api/ai', (_req, res) => {
  const c = readCredential()
  res.json({
    provider: providerName(),
    appTokenPresent: hasAppToken(),
    disclosure: DISCLOSURE,
    credential: c
      ? {
          balanceLine: balanceLine(c.balance_micros, c.claim_state),
          costSentence: c.cost_sentence,
          claimState: c.claim_state,
          claimUrl: c.claim_url,
          addCreditUrl: c.add_credit_url,
        }
      : null,
  })
})

/** Called only after the UI has shown DISCLOSURE and the person said yes. */
app.post('/api/ai/consent', async (_req, res) => {
  try {
    const c = await provision()
    res.json({
      provider: providerName(),
      credential: {
        balanceLine: balanceLine(c.balance_micros, c.claim_state),
        costSentence: c.cost_sentence,
        claimState: c.claim_state,
        claimUrl: c.claim_url,
        addCreditUrl: c.add_credit_url,
      },
    })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/data', (_req, res) => res.json(store.all()))

app.patch('/api/data', (req, res) => {
  const allowed = {}
  for (const key of ['profile', 'settings']) {
    if (key in req.body) allowed[key] = req.body[key]
  }
  res.json(store.patch(allowed))
})

app.post('/api/entries', (req, res) => res.json(store.addEntry(req.body)))

app.patch('/api/entries/:id', (req, res) => {
  const updated = store.updateEntry(req.params.id, req.body)
  if (!updated) return res.status(404).json({ error: 'no such entry' })
  res.json(updated)
})

app.delete('/api/entries/:id', (req, res) =>
  res.json({ removed: store.removeEntry(req.params.id) }),
)

app.post('/api/weights', (req, res) => res.json(store.addWeight(req.body)))

app.post('/api/reset', (_req, res) => {
  store.reset()
  res.json({ ok: true })
})

app.post('/api/analyze', async (req, res) => {
  try {
    const { image, mimeType, note, description, mode } = req.body || {}
    if (image) {
      const base64 = String(image).replace(/^data:[^;]+;base64,/, '')
      const type = mimeType || 'image/jpeg'
      res.json(
        mode === 'label'
          ? await analyzeLabel({ base64, mimeType: type })
          : await analyzeImage({ base64, mimeType: type, note }),
      )
    } else if (description) {
      res.json(await analyzeText({ description }))
    } else {
      res.status(400).json({ error: 'send either an image or a description' })
    }
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/barcode', async (req, res) => {
  try {
    const code = req.body?.code
    if (!code) return res.status(400).json({ error: 'a barcode is required' })
    res.json(await lookupBarcode(code))
  } catch (err) {
    if (err instanceof NotFound) return res.status(404).json({ error: err.message })
    fail(res, err)
  }
})

app.post('/api/refine', async (req, res) => {
  try {
    const { entry, instruction } = req.body || {}
    if (!entry || !instruction) {
      return res.status(400).json({ error: 'entry and instruction are both required' })
    }
    res.json(await refine({ entry, instruction }))
  } catch (err) {
    fail(res, err)
  }
})

// Serve the built front end when it exists (the release path).
const dist = join(root, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')))
}

const port = Number(process.env.PORT || 4273)
app.listen(port, () => {
  const { slug, version } = appMeta()
  console.log(`${slug} ${version} - http://localhost:${port}  (ai: ${providerName()})`)
})
