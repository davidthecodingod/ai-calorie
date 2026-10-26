import type { Analysis, AppData, Entry, Profile, Settings, WeightPoint } from './types'

const BASE = '/api'

/** Carries publik's two actionable states: needs consent, and out of balance. */
export class ApiError extends Error {
  code?: string
  topUpUrl?: string | null
  constructor(message: string, code?: string, topUpUrl?: string | null) {
    super(message)
    this.code = code
    this.topUpUrl = topUpUrl ?? null
  }
}

export interface AiState {
  provider: 'publik' | 'own-key' | 'needs-consent'
  appTokenPresent: boolean
  disclosure: string
  credential: {
    balanceLine: string
    costSentence: string | null
    claimState: 'anonymous' | 'claimed'
    claimUrl: string | null
    addCreditUrl: string | null
  } | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Bad response from the app server: ${text.slice(0, 160)}`)
  }
  if (!res.ok) {
    const b = body as { error?: string; code?: string; topUpUrl?: string | null } | null
    throw new ApiError(b?.error || `Request failed (${res.status})`, b?.code, b?.topUpUrl)
  }
  return body as T
}

export interface Status {
  app: string
  version: string
  aiProvider: 'publik' | 'own-key' | 'none'
  dataFile: string
}

export const api = {
  status: () => request<Status>('/status'),
  aiState: () => request<AiState>('/ai'),
  consent: () => request<{ provider: string; credential: AiState['credential'] }>('/ai/consent', { method: 'POST' }),
  data: () => request<AppData>('/data'),
  saveProfile: (profile: Profile) =>
    request<AppData>('/data', { method: 'PATCH', body: JSON.stringify({ profile }) }),
  saveSettings: (settings: Settings) =>
    request<AppData>('/data', { method: 'PATCH', body: JSON.stringify({ settings }) }),
  addEntry: (entry: Entry) =>
    request<Entry>('/entries', { method: 'POST', body: JSON.stringify(entry) }),
  updateEntry: (id: string, partial: Partial<Entry>) =>
    request<Entry>(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(partial) }),
  removeEntry: (id: string) => request<{ removed: boolean }>(`/entries/${id}`, { method: 'DELETE' }),
  addWeight: (point: WeightPoint) =>
    request<WeightPoint>('/weights', { method: 'POST', body: JSON.stringify(point) }),
  reset: () => request<{ ok: true }>('/reset', { method: 'POST' }),

  analyzePhoto: (image: string, mimeType: string, note?: string) =>
    request<Analysis>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType, note }),
    }),
  analyzeLabel: (image: string, mimeType: string) =>
    request<Analysis>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType, mode: 'label' }),
    }),
  lookupBarcode: (code: string) =>
    request<Analysis>('/barcode', { method: 'POST', body: JSON.stringify({ code }) }),
  analyzeText: (description: string) =>
    request<Analysis>('/analyze', { method: 'POST', body: JSON.stringify({ description }) }),
  refine: (entry: Analysis, instruction: string) =>
    request<Analysis>('/refine', { method: 'POST', body: JSON.stringify({ entry, instruction }) }),
}
