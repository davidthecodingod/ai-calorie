import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, type Status } from './api'
import type { AppData, Entry, Profile, Settings, WeightPoint } from './types'

interface Ctx {
  ready: boolean
  error: string | null
  status: Status | null
  data: AppData
  saveProfile: (p: Profile) => Promise<void>
  saveSettings: (s: Settings) => Promise<void>
  addEntry: (e: Entry) => Promise<void>
  updateEntry: (id: string, partial: Partial<Entry>) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  addWeight: (p: WeightPoint) => Promise<void>
  resetAll: () => Promise<void>
}

const EMPTY: AppData = { profile: null, entries: [], weights: [], settings: {} }
const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY)
  const [status, setStatus] = useState<Status | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([api.data(), api.status().catch(() => null)])
      .then(([d, s]) => {
        if (!live) return
        setData({ ...EMPTY, ...d })
        setStatus(s)
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])

  const saveProfile = useCallback(async (profile: Profile) => {
    setData((d) => ({ ...d, profile }))
    await api.saveProfile(profile)
  }, [])

  const saveSettings = useCallback(async (settings: Settings) => {
    setData((d) => ({ ...d, settings }))
    await api.saveSettings(settings)
  }, [])

  const addEntry = useCallback(async (entry: Entry) => {
    setData((d) => ({ ...d, entries: [entry, ...d.entries] }))
    await api.addEntry(entry)
  }, [])

  const updateEntry = useCallback(async (id: string, partial: Partial<Entry>) => {
    setData((d) => ({
      ...d,
      entries: d.entries.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    }))
    await api.updateEntry(id, partial)
  }, [])

  const removeEntry = useCallback(async (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))
    await api.removeEntry(id)
  }, [])

  const addWeight = useCallback(async (point: WeightPoint) => {
    setData((d) => ({
      ...d,
      weights: [...d.weights.filter((w) => w.date !== point.date), point].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }))
    await api.addWeight(point)
  }, [])

  const resetAll = useCallback(async () => {
    await api.reset()
    setData(EMPTY)
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      ready,
      error,
      status,
      data,
      saveProfile,
      saveSettings,
      addEntry,
      updateEntry,
      removeEntry,
      addWeight,
      resetAll,
    }),
    [ready, error, status, data, saveProfile, saveSettings, addEntry, updateEntry, removeEntry, addWeight, resetAll],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Totals for one calendar day, scaled by each entry's servings. */
export function dayTotals(entries: Entry[], date: string) {
  return entries
    .filter((e) => e.date === date)
    .reduce(
      (acc, e) => {
        const s = e.servings || 1
        acc.calories += e.calories * s
        acc.protein_g += e.protein_g * s
        acc.carbs_g += e.carbs_g * s
        acc.fat_g += e.fat_g * s
        acc.fiber_g += e.fiber_g * s
        acc.count += 1
        return acc
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    )
}
