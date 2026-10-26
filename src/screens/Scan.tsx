import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { api, ApiError, type AiState } from '../api'
import { BalanceSheet, ConsentSheet } from '../components/AiGate'
import { analysisFromPanel, readLabelOnDevice } from '../ocr'
import type { Analysis } from '../types'

type Mode = 'camera' | 'package' | 'describe'
type Phase = 'capture' | 'analyzing' | 'reading' | 'unreadable' | 'error'

export interface ScanResult {
  analysis: Analysis
  image?: string
  source: 'photo' | 'text' | 'barcode' | 'label'
}

const MEAL_STAGES = [
  'Reading the photo',
  'Identifying the food',
  'Judging the portion',
  'Totalling the macros',
]
const LABEL_STAGES = ['Reading the panel', 'Transcribing the figures', 'Checking the serving size']
const BARCODE_STAGES = ['Looking up the barcode', 'Reading the label data', 'Scaling to one serving']

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'code_128', 'itf']

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

const barcodeSupported = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

/** Downscale and re-encode so the upload stays small. */
async function toJpeg(blobUrl: string, maxEdge = 1024): Promise<{ dataUrl: string }> {
  const img = new Image()
  img.src = blobUrl
  await img.decode()
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82) }
}

function frameToJpeg(video: HTMLVideoElement, maxEdge = 1280): string | null {
  if (!video.videoWidth) return null
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function Scan({
  onClose,
  onResult,
}: {
  onClose: () => void
  onResult: (r: ScanResult) => void
}) {
  const [mode, setMode] = useState<Mode>('camera')
  const [phase, setPhase] = useState<Phase>('capture')
  const [stages, setStages] = useState<string[]>(MEAL_STAGES)
  const [shot, setShot] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [description, setDescription] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [detected, setDetected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [stage, setStage] = useState(0)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [camError, setCamError] = useState('')
  const [gate, setGate] = useState<
    | { kind: 'consent'; state: AiState }
    | { kind: 'balance'; message: string; topUpUrl: string | null }
    | null
  >(null)
  const retryRef = useRef<null | (() => Promise<ScanResult>)>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const busyRef = useRef(false)

  const liveCamera = (mode === 'camera' || mode === 'package') && !shot

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!liveCamera) return
    let cancelled = false
    setCamError('')
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => !cancelled && setCamError('No camera available here.'))
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [liveCamera, stopCamera])

  // Poll the video for a barcode while package mode is live.
  useEffect(() => {
    if (mode !== 'package' || camError || detected || phase !== 'capture') return
    if (!barcodeSupported()) return
    const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
    let detector: BarcodeDetectorLike
    try {
      detector = new Ctor({ formats: BARCODE_FORMATS })
    } catch {
      return
    }
    let stop = false
    const tick = async () => {
      const video = videoRef.current
      if (stop || !video || !video.videoWidth) return
      try {
        const found = await detector.detect(video)
        const code = found.find((f) => /^\d{6,14}$/.test(f.rawValue.replace(/\D/g, '')))
        if (code && !stop) setDetected(code.rawValue.replace(/\D/g, ''))
      } catch {
        /* a frame that cannot be decoded is normal */
      }
    }
    const id = setInterval(tick, 350)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [mode, camError, detected, phase])

  useEffect(() => {
    if (phase !== 'analyzing') return
    setStage(0)
    const id = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 1100)
    return () => clearInterval(id)
  }, [phase, stages])

  const run = async (label: string[], fn: () => Promise<ScanResult>) => {
    if (busyRef.current) return
    busyRef.current = true
    setStages(label)
    setPhase('analyzing')
    try {
      onResult(await fn())
    } catch (e) {
      // publik has two states the person can actually do something about.
      if (e instanceof ApiError && e.code === 'needs_consent') {
        retryRef.current = fn
        setPhase('capture')
        try {
          setGate({ kind: 'consent', state: await api.aiState() })
        } catch {
          setError((e as Error).message)
          setPhase('error')
        }
      } else if (e instanceof ApiError && e.code === 'payment_required') {
        retryRef.current = fn
        setPhase('capture')
        setGate({ kind: 'balance', message: e.message, topUpUrl: e.topUpUrl ?? null })
      } else {
        setError((e as Error).message)
        setPhase('error')
      }
    } finally {
      busyRef.current = false
    }
  }

  // A detected barcode goes straight to lookup.
  useEffect(() => {
    if (!detected) return
    stopCamera()
    void run(BARCODE_STAGES, async () => ({
      analysis: await api.lookupBarcode(detected),
      source: 'barcode',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected])

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const data = frameToJpeg(video, 1024)
    if (!data) return
    setShot(data)
    stopCamera()
  }

  const pickFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    try {
      const { dataUrl } = await toJpeg(url)
      setShot(dataUrl)
      stopCamera()
    } catch {
      setError('That file could not be read as an image.')
      setPhase('error')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const panelImage = () => {
    const video = videoRef.current
    return shot ?? (video ? frameToJpeg(video, 1280) : null)
  }

  /** Free path: OCR runs here in the browser, nothing is uploaded. */
  const readPanelFree = async () => {
    const data = panelImage()
    if (!data || busyRef.current) return
    busyRef.current = true
    setShot(data)
    stopCamera()
    setOcrProgress(0)
    setPhase('reading')
    try {
      const { parsed, usable } = await readLabelOnDevice(data, setOcrProgress)
      if (usable) {
        onResult({ analysis: analysisFromPanel(parsed), image: data, source: 'label' })
      } else {
        setPhase('unreadable')
      }
    } catch (e) {
      setError(
        `On-device reading failed: ${(e as Error).message}. You can have it read by AI instead.`,
      )
      setPhase('unreadable')
    } finally {
      busyRef.current = false
    }
  }

  /** Paid fallback: the panel photo goes to the model. */
  const readPanelWithAi = () => {
    const data = panelImage()
    if (!data) return
    setShot(data)
    stopCamera()
    void run(LABEL_STAGES, async () => ({
      analysis: await api.analyzeLabel(data, 'image/jpeg'),
      image: data,
      source: 'label',
    }))
  }

  const retry = () => {
    setError('')
    setDetected(null)
    setManualCode('')
    setShot(null)
    setPhase('capture')
  }

  const gateUi = gate && (
    gate.kind === 'consent' ? (
      <ConsentSheet
        state={gate.state}
        onClose={() => setGate(null)}
        onAccepted={() => {
          setGate(null)
          const again = retryRef.current
          retryRef.current = null
          if (again) void run(stages, again)
        }}
      />
    ) : (
      <BalanceSheet
        message={gate.message}
        topUpUrl={gate.topUpUrl}
        onClose={() => setGate(null)}
      />
    )
  )

  if (phase === 'analyzing')
    return (
      <>
        <Analyzing shot={shot} stage={stage} stages={stages} />
        {gateUi}
      </>
    )

  if (phase === 'reading') return <ReadingPanel shot={shot} progress={ocrProgress} />

  if (phase === 'unreadable') {
    return (
      <div className="fullscreen">
        <div className="scroll page-pad" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="col" style={{ gap: 16, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ color: 'var(--warn)' }}>
              <Icon name="info" size={38} stroke={1.6} />
            </span>
            <h2 className="h2">Could not read that panel</h2>
            <p className="body" style={{ maxWidth: 310 }}>
              {error ||
                'Not enough of the numbers came out clearly. A straight-on photo in good light usually does it.'}
            </p>
            <div className="col" style={{ gap: 10, width: '100%', maxWidth: 320, marginTop: 4 }}>
              <button
                className="btn btn-block"
                onClick={() => {
                  setError('')
                  setShot(null)
                  setPhase('capture')
                }}
              >
                Retake the photo
              </button>
              <button className="btn btn-soft btn-block" onClick={readPanelWithAi}>
                <Icon name="sparkle" size={16} stroke={1.8} />
                Read it with AI instead
              </button>
              <p className="small">Reading with AI uses a small amount of credit.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="fullscreen">
        <div className="scroll page-pad" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="col" style={{ gap: 18, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ color: 'var(--bad)' }}>
              <Icon name="info" size={40} stroke={1.6} />
            </span>
            <h2 className="h2">That did not work</h2>
            <p className="body" style={{ maxWidth: 300 }}>
              {error}
            </p>
            {mode === 'package' && (
              <p className="small" style={{ maxWidth: 300 }}>
                Own-brand and loose items are often missing from the database. Photographing the
                nutrition panel works for anything.
              </p>
            )}
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn" onClick={retry}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const switchMode = (next: Mode) => {
    stopCamera()
    setShot(null)
    setDetected(null)
    setNote('')
    setMode(next)
  }

  return (
    <div className="fullscreen">
      <div
        className="spread"
        style={{ padding: 'max(14px, env(safe-area-inset-top)) 18px 12px', gap: 10 }}
      >
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" size={17} stroke={2.1} />
        </button>
        <div className="seg grow" style={{ maxWidth: 290 }}>
          <button aria-pressed={mode === 'camera'} onClick={() => switchMode('camera')}>
            Meal
          </button>
          <button aria-pressed={mode === 'package'} onClick={() => switchMode('package')}>
            Package
          </button>
          <button aria-pressed={mode === 'describe'} onClick={() => switchMode('describe')}>
            Describe
          </button>
        </div>
        <span style={{ width: 40 }} />
      </div>

      {mode === 'describe' ? (
        <div className="scroll" style={{ paddingTop: 8 }}>
          <h1 className="h1" style={{ marginBottom: 10 }}>
            Describe what you ate
          </h1>
          <p className="body" style={{ marginBottom: 20 }}>
            Portions help: “a large flat white and two slices of sourdough with butter”.
          </p>
          <textarea
            className="field"
            style={{ minHeight: 140 }}
            placeholder="What did you eat?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="btn btn-accent btn-block"
            style={{ marginTop: 16 }}
            disabled={!description.trim()}
            onClick={() =>
              void run(MEAL_STAGES, async () => ({
                analysis: await api.analyzeText(description.trim()),
                source: 'text',
              }))
            }
          >
            <Icon name="sparkle" size={17} stroke={1.8} />
            Estimate it
          </button>
        </div>
      ) : (
        <>
          <div className="camera-stage">
            {shot ? (
              <img className="shot" src={shot} alt="Captured" />
            ) : camError ? (
              <div
                className="col"
                style={{ gap: 14, alignItems: 'center', color: '#fff', padding: 28, textAlign: 'center' }}
              >
                <Icon name="image" size={34} stroke={1.5} />
                <p className="body" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {camError}{' '}
                  {mode === 'package'
                    ? 'Type the barcode below, or choose a photo of the label.'
                    : 'Choose a photo instead.'}
                </p>
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  Choose a photo
                </button>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted />
                {mode === 'package' ? <BarcodeReticle /> : <MealReticle />}
                <p
                  className="small"
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 16,
                    right: 16,
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.82)',
                    fontWeight: 600,
                  }}
                >
                  {mode === 'package'
                    ? barcodeSupported()
                      ? 'Hold the barcode inside the line'
                      : 'This browser cannot read barcodes live — type the number or shoot the panel'
                    : 'Fill the frame with the whole plate'}
                </p>
              </>
            )}
          </div>

          <div
            style={{
              padding: '16px 20px calc(20px + env(safe-area-inset-bottom))',
              background: 'var(--bg)',
            }}
          >
            {mode === 'package' ? (
              <div className="col" style={{ gap: 12 }}>
                <div className="row" style={{ gap: 10 }}>
                  <input
                    className="field num grow"
                    inputMode="numeric"
                    placeholder="Or type the barcode number"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
                  />
                  <button
                    className="btn btn-accent"
                    disabled={manualCode.length < 6}
                    onClick={() =>
                      void run(BARCODE_STAGES, async () => ({
                        analysis: await api.lookupBarcode(manualCode),
                        source: 'barcode',
                      }))
                    }
                  >
                    Look up
                  </button>
                </div>
                <button
                  className="btn btn-soft btn-block"
                  onClick={() => void readPanelFree()}
                  disabled={!!camError && !shot}
                >
                  <Icon name="text" size={16} stroke={1.8} />
                  {shot ? 'Read this panel — free' : 'Read the nutrition panel — free'}
                </button>
                {shot && (
                  <button className="btn btn-ghost btn-block" onClick={() => setShot(null)}>
                    Retake
                  </button>
                )}
              </div>
            ) : shot ? (
              <div className="col" style={{ gap: 13 }}>
                <input
                  className="field"
                  placeholder="Anything the photo misses? (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="row" style={{ gap: 10 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShot(null)
                      setNote('')
                    }}
                  >
                    Retake
                  </button>
                  <button
                    className="btn btn-accent grow"
                    onClick={() =>
                      void run(MEAL_STAGES, async () => ({
                        analysis: await api.analyzePhoto(shot, 'image/jpeg', note.trim() || undefined),
                        image: shot,
                        source: 'photo',
                      }))
                    }
                  >
                    <Icon name="sparkle" size={17} stroke={1.8} />
                    Analyse
                  </button>
                </div>
              </div>
            ) : (
              <div className="spread">
                <button
                  className="icon-btn"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Choose a photo"
                >
                  <Icon name="image" size={18} stroke={1.8} />
                </button>
                <button className="shutter" onClick={capture} aria-label="Take photo" disabled={!!camError}>
                  <span className="shutter-core" />
                </button>
                <span style={{ width: 40 }} />
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickFile(f)
              e.target.value = ''
            }}
          />
        </>
      )}

      {gateUi}
    </div>
  )
}

function MealReticle() {
  return (
    <div className="reticle">
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

function BarcodeReticle() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        top: '38%',
        height: 128,
        border: '2.5px solid rgba(255,255,255,0.92)',
        borderRadius: 14,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: '50%',
          height: 2,
          background: 'var(--accent)',
          boxShadow: '0 0 10px var(--accent)',
        }}
      />
    </div>
  )
}

function Analyzing({
  shot,
  stage,
  stages,
}: {
  shot: string | null
  stage: number
  stages: string[]
}) {
  return (
    <div className="fullscreen">
      <div className="camera-stage" style={{ flex: '0 0 46%' }}>
        {shot ? (
          <>
            <img className="shot" src={shot} alt="" style={{ filter: 'brightness(0.72)' }} />
            <div className="scan-sweep" />
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Icon name="barcode" size={40} stroke={1.5} />
          </div>
        )}
      </div>
      <div className="scroll" style={{ paddingTop: 26 }}>
        <h1 className="h1" style={{ marginBottom: 22 }}>
          Working it out…
        </h1>
        <div className="col" style={{ gap: 14 }}>
          {stages.map((s, i) => (
            <div key={s} className="row" style={{ gap: 11, opacity: i <= stage ? 1 : 0.3 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: i < stage ? 'var(--good)' : 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  color: '#fff',
                }}
              >
                {i < stage ? (
                  <Icon name="check" size={12} stroke={2.6} />
                ) : i === stage ? (
                  <span
                    className="spinner"
                    style={{ width: 11, height: 11, borderWidth: 2, color: 'var(--ink-2)' }}
                  />
                ) : null}
              </span>
              <span className="body" style={{ color: 'var(--ink)' }}>
                {s}
              </span>
            </div>
          ))}
        </div>
        <div className="banner" style={{ marginTop: 26 }}>
          <Icon name="info" size={16} stroke={1.9} />
          <span>
            Check the serving size on the next screen — a pack is often more than one serving.
          </span>
        </div>
      </div>
    </div>
  )
}

function ReadingPanel({ shot, progress }: { shot: string | null; progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div className="fullscreen">
      <div className="camera-stage" style={{ flex: '0 0 46%' }}>
        {shot && (
          <>
            <img className="shot" src={shot} alt="" style={{ filter: 'brightness(0.72)' }} />
            <div className="scan-sweep" />
          </>
        )}
      </div>
      <div className="scroll" style={{ paddingTop: 26 }}>
        <h1 className="h1" style={{ marginBottom: 10 }}>
          Reading the panel…
        </h1>
        <p className="body" style={{ marginBottom: 20 }}>
          This runs on your own machine. The photo is not uploaded and this costs nothing.
        </p>
        <div className="macro-track" style={{ height: 8 }}>
          <div className="macro-fill" style={{ width: `${Math.max(4, pct)}%`, background: 'var(--accent)' }} />
        </div>
        <p className="small num" style={{ marginTop: 8 }}>
          {pct}%
        </p>
        <div className="banner" style={{ marginTop: 26 }}>
          <Icon name="shield" size={16} stroke={1.9} />
          <span>
            The first panel you read downloads the text-recognition data once, then works offline.
          </span>
        </div>
      </div>
    </div>
  )
}
