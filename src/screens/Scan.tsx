import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { api } from '../api'
import type { Analysis } from '../types'

type Mode = 'camera' | 'describe'
type Phase = 'capture' | 'analyzing' | 'error'

export interface ScanResult {
  analysis: Analysis
  image?: string
  source: 'photo' | 'text'
}

const STAGES = [
  'Reading the photo',
  'Identifying the food',
  'Judging the portion',
  'Totalling the macros',
]

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

export function Scan({
  onClose,
  onResult,
}: {
  onClose: () => void
  onResult: (r: ScanResult) => void
}) {
  const [mode, setMode] = useState<Mode>('camera')
  const [phase, setPhase] = useState<Phase>('capture')
  const [shot, setShot] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [stage, setStage] = useState(0)
  const [camError, setCamError] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (mode !== 'camera' || shot) return
    let cancelled = false
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
      .catch(() =>
        !cancelled &&
        setCamError('No camera available here — choose a photo instead.'),
      )
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [mode, shot, stopCamera])

  useEffect(() => {
    if (phase !== 'analyzing') return
    setStage(0)
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1300)
    return () => clearInterval(id)
  }, [phase])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const maxEdge = 1024
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    setShot(canvas.toDataURL('image/jpeg', 0.82))
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

  const runPhoto = async () => {
    if (!shot) return
    setPhase('analyzing')
    try {
      const analysis = await api.analyzePhoto(shot, 'image/jpeg', note.trim() || undefined)
      onResult({ analysis, image: shot, source: 'photo' })
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  const runText = async () => {
    if (!description.trim()) return
    setPhase('analyzing')
    try {
      const analysis = await api.analyzeText(description.trim())
      onResult({ analysis, source: 'text' })
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  if (phase === 'analyzing') return <Analyzing shot={shot} stage={stage} />

  if (phase === 'error') {
    return (
      <div className="fullscreen">
        <div className="scroll page-pad" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="col" style={{ gap: 18, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ color: 'var(--bad)' }}>
              <Icon name="info" size={40} stroke={1.6} />
            </span>
            <h2 className="h2">That estimate failed</h2>
            <p className="body" style={{ maxWidth: 300 }}>
              {error}
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn" onClick={() => setPhase('capture')}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
        <div className="seg grow" style={{ maxWidth: 230 }}>
          <button aria-pressed={mode === 'camera'} onClick={() => setMode('camera')}>
            Photo
          </button>
          <button
            aria-pressed={mode === 'describe'}
            onClick={() => {
              stopCamera()
              setMode('describe')
            }}
          >
            Describe
          </button>
        </div>
        <span style={{ width: 40 }} />
      </div>

      {mode === 'camera' ? (
        <>
          <div className="camera-stage">
            {shot ? (
              <img className="shot" src={shot} alt="Captured meal" />
            ) : camError ? (
              <div
                className="col"
                style={{ gap: 14, alignItems: 'center', color: '#fff', padding: 28, textAlign: 'center' }}
              >
                <Icon name="image" size={34} stroke={1.5} />
                <p className="body" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {camError}
                </p>
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  Choose a photo
                </button>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted />
                <div className="reticle">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p
                  className="small"
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.82)',
                    fontWeight: 600,
                  }}
                >
                  Fill the frame with the whole plate
                </p>
              </>
            )}
          </div>

          <div
            style={{
              padding: '18px 20px calc(22px + env(safe-area-inset-bottom))',
              background: 'var(--bg)',
            }}
          >
            {shot ? (
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
                  <button className="btn btn-accent grow" onClick={runPhoto}>
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
      ) : (
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
            onClick={runText}
            disabled={!description.trim()}
          >
            <Icon name="sparkle" size={17} stroke={1.8} />
            Estimate it
          </button>
        </div>
      )}
    </div>
  )
}

function Analyzing({ shot, stage }: { shot: string | null; stage: number }) {
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
            <Icon name="text" size={34} stroke={1.5} />
          </div>
        )}
      </div>
      <div className="scroll" style={{ paddingTop: 26 }}>
        <h1 className="h1" style={{ marginBottom: 22 }}>
          Working it out…
        </h1>
        <div className="col" style={{ gap: 14 }}>
          {STAGES.map((s, i) => (
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
            Estimates come from what the photo shows. Check the portion on the next screen and
            correct it if it looks off.
          </span>
        </div>
      </div>
    </div>
  )
}
