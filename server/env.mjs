import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Minimal .env loader so the built app works without a dependency.
// Values already in process.env always win.
export function loadEnv(dir = process.cwd()) {
  for (const name of ['.env.local', '.env']) {
    let raw
    try {
      raw = readFileSync(resolve(dir, name), 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
}
