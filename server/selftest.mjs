import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_SLUG, APP_VERSION, selfTest } from './publik.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function appMeta() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    return { slug: APP_SLUG, version: pkg.version || APP_VERSION }
  } catch {
    return { slug: APP_SLUG, version: APP_VERSION }
  }
}

/** Prints exactly one line, then the caller exits. Required by publik: the
 *  built app must make this call itself on startup under PUBLIK_SELF_TEST=1. */
export async function runSelfTest() {
  const line = await selfTest()
  console.log(line)
  return line.includes(': ok ') ? 0 : 1
}
