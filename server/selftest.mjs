import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { provider, ping } from './ai.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function appMeta() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return { slug: process.env.PUBLIK_APP_SLUG || pkg.name, version: pkg.version }
}

// Prints exactly one line, then the caller exits. Required by publik: the
// built app must make this call itself on startup under PUBLIK_SELF_TEST=1.
export async function runSelfTest() {
  const { slug, version } = appMeta()
  try {
    if (provider() !== 'publik') {
      throw new Error(
        'publik API not wired: PUBLIK_APP_TOKEN is not set in this build environment',
      )
    }
    const reply = await ping()
    if (!reply) throw new Error('publik ai.chat returned an empty completion')
    console.log(`publik self-test: ok ${slug} ${version}`)
    return 0
  } catch (err) {
    console.log(`publik self-test: failed: ${err.message}`)
    return 1
  }
}
