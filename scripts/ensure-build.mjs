// Runs automatically before `npm start` (npm's prestart hook).
//
// The front end is built output, so it is not in the repository. Someone who
// clones and runs `npm start` would otherwise get a server with no pages.
// Build it once, here, rather than relying on anyone remembering to.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const built = join(root, 'dist', 'index.html')

if (existsSync(built)) process.exit(0)

console.log('AI Calorie: building the interface (first run only)…')
try {
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
} catch {
  console.error(
    [
      '',
      'AI Calorie could not build its interface.',
      '',
      'This usually means the build tools are missing. Run:',
      '',
      '  npm install',
      '',
      'and then start it again. If you installed with --omit=dev or',
      'NODE_ENV=production, run a plain `npm install` instead: the build needs',
      'the dev dependencies.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}
