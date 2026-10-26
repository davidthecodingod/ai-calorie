import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DIR = process.env.AI_CALORIE_DATA_DIR || join(homedir(), '.ai-calorie')
const FILE = join(DIR, 'data.json')

const EMPTY = { profile: null, entries: [], weights: [], settings: {} }

function read() {
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8'))
    return { ...EMPTY, ...parsed }
  } catch {
    return { ...EMPTY }
  }
}

function write(data) {
  mkdirSync(DIR, { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, FILE)
}

export const store = {
  path: FILE,
  all: () => read(),
  patch(partial) {
    const next = { ...read(), ...partial }
    write(next)
    return next
  },
  addEntry(entry) {
    const data = read()
    data.entries.unshift(entry)
    write(data)
    return entry
  },
  updateEntry(id, partial) {
    const data = read()
    const i = data.entries.findIndex((e) => e.id === id)
    if (i === -1) return null
    data.entries[i] = { ...data.entries[i], ...partial, id }
    write(data)
    return data.entries[i]
  },
  removeEntry(id) {
    const data = read()
    const before = data.entries.length
    data.entries = data.entries.filter((e) => e.id !== id)
    write(data)
    return data.entries.length < before
  },
  addWeight(w) {
    const data = read()
    data.weights = data.weights.filter((x) => x.date !== w.date)
    data.weights.push(w)
    data.weights.sort((a, b) => a.date.localeCompare(b.date))
    write(data)
    return w
  },
  reset() {
    write({ ...EMPTY })
  },
}
