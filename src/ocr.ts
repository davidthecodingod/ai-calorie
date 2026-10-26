// On-device OCR for nutrition panels. Runs in the browser via a WASM build of
// Tesseract: no API call, no upload, nothing to pay for. The photo never leaves
// the machine.
import { isUsable, parseLabel, scoreFromPanel, type ParsedLabel } from './labelParse'
import type { Analysis } from './types'

type Worker = {
  recognize: (image: string) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<unknown>
}

let workerPromise: Promise<Worker> | null = null

/** The worker and its language data load once, then stay warm. */
async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then((m) =>
      m.createWorker('eng', 1, {
        logger: (msg: { status: string; progress: number }) => {
          if (msg.status === 'recognizing text') onProgress?.(msg.progress)
        },
      }),
    ) as Promise<Worker>
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

/** Grey, stretch contrast and upscale — this is most of OCR accuracy on a panel. */
async function preprocess(dataUrl: string): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()

  const scale = Math.min(2.5, Math.max(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  const frame = ctx.getImageData(0, 0, w, h)
  const px = frame.data

  // Pass one: grey, and find the real black and white points.
  let lo = 255
  let hi = 0
  const grey = new Uint8ClampedArray(px.length / 4)
  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    grey[g] = v
    if (v < lo) lo = v
    if (v > hi) hi = v
  }

  // Pass two: stretch that range back out to 0-255.
  const span = Math.max(1, hi - lo)
  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const v = Math.min(255, Math.max(0, ((grey[g] - lo) * 255) / span))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(frame, 0, 0)
  return canvas.toDataURL('image/png')
}

export interface LabelReadResult {
  parsed: ParsedLabel
  usable: boolean
  text: string
  /** Tesseract's own mean confidence, 0-100. */
  ocrConfidence: number
}

export async function readLabelOnDevice(
  dataUrl: string,
  onProgress?: (p: number) => void,
): Promise<LabelReadResult> {
  const prepared = await preprocess(dataUrl)
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(prepared)
  const parsed = parseLabel(data.text)
  return {
    parsed,
    usable: isUsable(parsed),
    text: data.text,
    ocrConfidence: data.confidence,
  }
}

/** Turn a parsed panel into the same shape the AI paths produce. */
export function analysisFromPanel(p: ParsedLabel): Analysis {
  return {
    name: 'Packaged food',
    portion: p.serving || (p.per100 ? '100 g' : '1 serving'),
    calories: p.calories,
    protein_g: p.protein_g,
    carbs_g: p.carbs_g,
    fat_g: p.fat_g,
    fiber_g: p.fiber_g,
    sugar_g: p.sugar_g,
    health_score: scoreFromPanel(p),
    confidence: p.confidence,
    note: p.per100
      ? 'Read from the panel on this device, per 100 g — set the servings to match what you ate. Tap the name to say what it was.'
      : 'Read from the panel on this device. Tap the name to say what it was.',
    ingredients: [],
  }
}
