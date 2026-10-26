// Real OCR over a rendered panel, straight into the parser.
// Usage: node --experimental-strip-types test/ocrSmoke.ts <image path>
import { createWorker } from 'tesseract.js'
import { parseLabel, isUsable } from '../src/labelParse.ts'

const image = process.argv[2]
if (!image) throw new Error('pass an image path')

const worker = await createWorker('eng')
const { data } = await worker.recognize(image)
await worker.terminate()

console.log('--- raw OCR text ---')
console.log(data.text.trim())
console.log(`--- tesseract mean confidence: ${data.confidence.toFixed(1)} ---`)

const parsed = parseLabel(data.text)
console.log('--- parsed ---')
console.log(JSON.stringify(parsed, null, 2))
console.log('usable:', isUsable(parsed))
