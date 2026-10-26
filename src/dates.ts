export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayKey = () => toKey(new Date())

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** The seven days ending today, oldest first. */
export function recentWeek(): string[] {
  const out: string[] = []
  for (let i = 6; i >= 0; i--) out.push(addDays(todayKey(), -i))
  return out
}

export function lastNDays(n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(todayKey(), -i))
  return out
}

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const weekdayLetter = (key: string) => WEEKDAY[fromKey(key).getDay()]
export const dayOfMonth = (key: string) => fromKey(key).getDate()

export function prettyDay(key: string): string {
  if (key === todayKey()) return 'Today'
  if (key === addDays(todayKey(), -1)) return 'Yesterday'
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function guessSlot(d = new Date()): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = d.getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
