import { useState } from 'react'
import { Icon } from './Icon'
import { Sheet } from './ui'
import { api, type AiState } from '../api'

/** Shown before the first paid call: publik's disclosure, verbatim, and a yes. */
export function ConsentSheet({
  state,
  onClose,
  onAccepted,
}: {
  state: AiState
  onClose: () => void
  onAccepted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const accept = async () => {
    setBusy(true)
    setError('')
    try {
      await api.consent()
      onAccepted()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Set up AI estimates" onClose={onClose}>
      <p className="body" style={{ marginBottom: 14 }}>
        {state.disclosure}
      </p>
      <div className="banner" style={{ marginBottom: 16 }}>
        <Icon name="shield" size={16} stroke={1.9} />
        <span>
          Barcodes and nutrition panels stay free and never use this — only meal photos and
          written descriptions do.
        </span>
      </div>
      {error && (
        <p className="small" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button className="btn btn-block" onClick={accept} disabled={busy}>
        {busy ? <span className="spinner" /> : <Icon name="check" size={17} stroke={2.2} />}
        {busy ? 'Setting up…' : 'Use publik API'}
      </button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onClose}>
        Not now
      </button>
      <p className="small" style={{ marginTop: 12 }}>
        Prefer your own key? Put <code>ANTHROPIC_API_KEY</code> in <code>.env</code> and restart —
        it takes precedence over publik.
      </p>
    </Sheet>
  )
}

/** A 402: publik's message, and exactly one link. */
export function BalanceSheet({
  message,
  topUpUrl,
  onClose,
}: {
  message: string
  topUpUrl: string | null
  onClose: () => void
}) {
  return (
    <Sheet title="Out of balance" onClose={onClose}>
      <p className="body" style={{ marginBottom: 18 }}>
        {message}
      </p>
      {topUpUrl && (
        <a
          className="btn btn-block"
          href={topUpUrl}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: 'none' }}
          onClick={onClose}
        >
          Sign in with publik
        </a>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        Barcode and nutrition-panel scanning keep working either way — they cost nothing.
      </p>
    </Sheet>
  )
}
