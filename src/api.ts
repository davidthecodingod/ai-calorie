import type { Analysis, AppData, Entry, Profile, Settings, WeightPoint } from './types'

const BASE = '/api'

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
    const msg = (body as { error?: string } | null)?.error || `Request failed (${res.status})`
    throw new Error(msg)
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
  analyzeText: (description: string) =>
    request<Analysis>('/analyze', { method: 'POST', body: JSON.stringify({ description }) }),
  refine: (entry: Analysis, instruction: string) =>
    request<Analysis>('/refine', { method: 'POST', body: JSON.stringify({ entry, instruction }) }),
}
