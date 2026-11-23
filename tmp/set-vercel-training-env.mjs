import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const keys = [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'TRAINING_SESSION_SECRET',
  'TRAINING_MIGUEL_PASSWORD',
  'TRAINING_SINTIA_PASSWORD',
]

for (const key of keys) {
  const value = env[key]
  if (!value) throw new Error(`Missing ${key} in .env.local`)
  for (const environment of ['production', 'preview', 'development']) {
    const result = spawnSync(
      'npx',
      ['--yes', 'vercel@latest', 'env', 'add', key, environment, '--force', '--cwd', root],
      { input: `${value}\n`, encoding: 'utf8', shell: true },
    )
    if (result.status !== 0) {
      console.error(result.stdout)
      console.error(result.stderr)
      throw new Error(`Failed to set ${key} for ${environment}`)
    }
    console.log(`set ${key} (${environment})`)
  }
}

console.log('Done. Redeploy production next.')
