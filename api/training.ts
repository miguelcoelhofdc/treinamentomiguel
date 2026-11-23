import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  TRAINING_TABLES, hasLocalPrimaryKey, mergeTrainingChanges, trainingChanges, trainingRowKey,
  type SyncChange, type SyncRow, type SyncSnapshot, type TrainingTable,
} from '../src/lib/trainingSyncModel.js'

type Profile = 'miguel' | 'sintia'
interface CloudSnapshot extends SyncSnapshot { deleted: [string, number][]; applied: string[] }
interface TrainingStore {
  read(profile: Profile): Promise<CloudSnapshot>
  write(profile: Profile, expectedRevision: number, snapshot: CloudSnapshot): Promise<boolean>
}
interface AuthConfig { sessionSecret: string; passwords: Partial<Record<Profile, string>> }

const SESSION_COOKIE = 'meu_ritmo_session'
const SESSION_LIFETIME = 30 * 24 * 60 * 60
const PAGE_BYTES = 800_000
const MAX_EDITS = 1_000
const MAX_APPLIED_BATCHES = 1_000
const tableNames = new Set<string>(TRAINING_TABLES)
const encoder = new TextEncoder()
const empty = (): CloudSnapshot => ({ revision: 0, records: [], deleted: [], applied: [] })

function profileId(value: unknown): value is Profile {
  return value === 'miguel' || value === 'sintia'
}

function json(payload: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  })
}

function digest(secret: string, text: string) {
  return createHmac('sha256', secret).update(text).digest('base64url')
}

function compare(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function sessionSignature(config: AuthConfig, profile: Profile, expires: string) {
  return digest(config.sessionSecret, JSON.stringify([profile, expires, config.passwords[profile]]))
}

function sessionProfile(request: Request, config: AuthConfig): Profile | null {
  const token = request.headers.get('cookie')?.split(';').map(item => item.trim())
    .find(item => item.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1)
  const [profile, expires, signature, extra] = token?.split('.') ?? []
  if (extra !== undefined || !profileId(profile) || !config.passwords[profile]
    || !/^\d{10,12}$/.test(expires ?? '') || Number(expires) <= Math.floor(Date.now() / 1000)
    || !signature || !compare(signature, sessionSignature(config, profile, expires))) return null
  return profile
}

function cookie(request: Request, value: string, duration: number) {
  const protocol = process.env.VERCEL ? 'https:' : new URL(request.url).protocol
  return SESSION_COOKIE + '=' + value + '; Max-Age=' + duration
    + '; Path=/; HttpOnly; SameSite=Strict' + (protocol === 'https:' ? '; Secure' : '')
}

function isObject(value: unknown): value is SyncRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validRow(table: TrainingTable, key: string, row: unknown): row is SyncRow {
  if (!isObject(row) || (hasLocalPrimaryKey(table) && Object.hasOwn(row, 'id'))) return false
  if (trainingRowKey(table, row) !== key || encoder.encode(JSON.stringify(row)).length > PAGE_BYTES) return false
  if (table === 'settings') return typeof row.key === 'string' && typeof row.value === 'string'
  if (table === 'dailyLogs') return typeof row.date === 'string'
  if (table === 'exerciseChecks') return typeof row.date === 'string' && typeof row.exerciseId === 'string' && typeof row.done === 'boolean'
  if (table === 'routineEntries' && (typeof row.routineId !== 'string' || typeof row.date !== 'string')) return false
  if (table === 'runningLogs' || table === 'strengthLogs') return Number.isSafeInteger(row.id) && Number(row.id) > 0
  if (table === 'plannedSessions' && typeof row.date !== 'string') return false
  return typeof row.id === 'string' && row.id.length > 0
}

function validEdits(value: unknown): value is SyncChange[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EDITS) return false
  return value.every(edit => {
    if (!isObject(edit) || typeof edit.table !== 'string' || !tableNames.has(edit.table)
      || typeof edit.key !== 'string' || !edit.key.length || edit.key.length > 1024) return false
    const table = edit.table as TrainingTable
    return (edit.before !== null || edit.after !== null)
      && (edit.before === null || validRow(table, edit.key, edit.before))
      && (edit.after === null || validRow(table, edit.key, edit.after))
  })
}

function changesAfter(snapshot: CloudSnapshot, edits: SyncChange[], base: number, batch: string) {
  const deleted = new Map(snapshot.deleted)
  const keyOf = ({ table, key }: Pick<SyncChange, 'table' | 'key'>) => JSON.stringify([table, key])
  const records = mergeTrainingChanges(snapshot.records, edits, {
    canCreate: edit => (deleted.get(keyOf(edit)) ?? 0) <= base,
  })
  const changes = trainingChanges(snapshot.records, records)
  const revision = snapshot.revision + 1
  for (const change of changes) {
    if (change.after) deleted.delete(keyOf(change))
    else deleted.set(keyOf(change), revision)
  }
  return { records, revision, deleted: [...deleted], applied: [...snapshot.applied.slice(1 - MAX_APPLIED_BATCHES), batch] }
}

export function createTrainingHandler(store: TrainingStore | null, config: AuthConfig | null) {
  return async function handleTraining(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const origin = request.headers.get('origin')
    if (request.method === 'POST' && (
      (origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site'
      || request.headers.get('x-training-request') !== '1'
    )) return json({ code: 'INVALID_ORIGIN' }, 403)
    if (action === 'logout' && request.method === 'POST') {
      return json({}, 200, { 'Set-Cookie': cookie(request, '', 0) })
    }
    if (!config || !store) return json({ code: 'CLOUD_NOT_CONFIGURED' }, 503)

    try {
      if (action === 'login' && request.method === 'POST') {
        const body: unknown = await request.json().catch(() => null)
        const profile = isObject(body) ? body.profile : null
        const password = isObject(body) ? body.password : null
        if (!profileId(profile) || typeof password !== 'string' || password.length > 256
          || !config.passwords[profile]
          || !compare(digest(config.sessionSecret, password), digest(config.sessionSecret, config.passwords[profile]))) {
          return json({ code: 'INVALID_CREDENTIALS' }, 401)
        }
        const expires = String(Math.floor(Date.now() / 1000) + SESSION_LIFETIME)
        const signed = [profile, expires, sessionSignature(config, profile, expires)].join('.')
        return json({ profile }, 200, { 'Set-Cookie': cookie(request, signed, SESSION_LIFETIME) })
      }

      const profile = sessionProfile(request, config)
      if (!profile || request.headers.get('x-training-profile') !== profile) return json({ code: 'AUTH_REQUIRED' }, 401)
      if (request.method === 'GET') {
        const snapshot = await store.read(profile)
        const revision = url.searchParams.get('revision')
        const offset = Number(url.searchParams.get('offset') ?? '0')
        if (revision !== null && revision !== String(snapshot.revision)) return json({ code: 'PAGE_CHANGED' }, 409)
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > snapshot.records.length
          || (offset > 0 && revision === null)) return json({ code: 'INVALID_PAGE' }, 400)
        if (revision === null && url.searchParams.get('since') === String(snapshot.revision)) {
          return json({ revision: snapshot.revision, unchanged: true })
        }
        const records = []
        let bytes = 0
        for (const record of snapshot.records.slice(offset)) {
          const size = encoder.encode(JSON.stringify(record)).length + 1
          if (records.length && bytes + size > PAGE_BYTES) break
          records.push(record)
          bytes += size
        }
        const end = offset + records.length
        return json({ revision: snapshot.revision, records, next: end < snapshot.records.length ? end : null })
      }

      if (request.method !== 'POST' || action !== 'sync') return json({ code: 'METHOD_NOT_ALLOWED' }, 405)
      const text = await request.text()
      if (encoder.encode(text).length > 2_000_000) return json({ code: 'PAYLOAD_TOO_LARGE' }, 413)
      let body: unknown
      try { body = JSON.parse(text) }
      catch { return json({ code: 'INVALID_EDITS' }, 400) }
      if (!isObject(body) || typeof body.base !== 'number' || !Number.isSafeInteger(body.base)
        || body.base < 0 || typeof body.batch !== 'string' || !/^[a-f0-9-]{36}:\d{1,9}$/.test(body.batch)
        || !validEdits(body.changes)) return json({ code: 'INVALID_EDITS' }, 400)

      for (let attempt = 0; attempt < 5; attempt++) {
        const snapshot = await store.read(profile)
        if (body.base > snapshot.revision) return json({ code: 'INVALID_REVISION' }, 409)
        if (snapshot.applied.includes(body.batch)) return json({ revision: snapshot.revision })
        const next = changesAfter(snapshot, body.changes, body.base, body.batch)
        if (await store.write(profile, snapshot.revision, next)) return json({ revision: next.revision })
      }
      return json({ code: 'CONCURRENT_WRITE' }, 409)
    } catch {
      return json({ code: 'CLOUD_UNAVAILABLE' }, 503)
    }
  }
}

export function createPostgresTrainingStore(url: string, secret: string, send = fetch): TrainingStore {
  const endpoint = new URL('/rest/v1/training_sync', url)
  const headers = { apikey: secret, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  const rowType = { select: 'revision,records,deleted,applied' }

  return {
    async read(profile) {
      const query = new URL(endpoint)
      query.search = new URLSearchParams({ ...rowType, profile: 'eq.' + profile }).toString()
      const response = await send(query, { headers, cache: 'no-store', signal: AbortSignal.timeout(9000) })
      if (!response.ok) throw new Error('POSTGRES_READ_FAILED')
      const rows = await response.json() as CloudSnapshot[]
      return rows[0] ?? empty()
    },
    async write(profile, expectedRevision, snapshot) {
      const query = new URL(endpoint)
      const insert = expectedRevision === 0
      query.search = new URLSearchParams(insert
        ? { select: 'revision' }
        : { select: 'revision', profile: 'eq.' + profile, revision: 'eq.' + expectedRevision },
      ).toString()
      const response = await send(query, {
        method: insert ? 'POST' : 'PATCH',
        headers,
        body: JSON.stringify(insert ? { profile, ...snapshot } : snapshot),
        signal: AbortSignal.timeout(9000),
      })
      if (insert && response.status === 409 && (await response.json())?.code === '23505') return false
      if (!response.ok) throw new Error('POSTGRES_WRITE_FAILED')
      const rows = await response.json() as { revision: number }[]
      return rows.some(row => row.revision === snapshot.revision)
    },
  }
}

const configuredPassword = (password?: string) => password && /^[A-Za-z0-9_-]{24,256}$/.test(password) ? password : undefined

export default {
  fetch(request: Request) {
    const url = process.env.SUPABASE_URL
    const secret = process.env.SUPABASE_SECRET_KEY
    const sessionSecret = process.env.TRAINING_SESSION_SECRET
    const passwords = {
      miguel: configuredPassword(process.env.TRAINING_MIGUEL_PASSWORD),
      sintia: configuredPassword(process.env.TRAINING_SINTIA_PASSWORD),
    }
    const store = url && secret && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && secret.startsWith('sb_secret_')
      ? createPostgresTrainingStore(url, secret)
      : null
    const auth = sessionSecret && sessionSecret.length >= 32 && (passwords.miguel || passwords.sintia)
      ? { sessionSecret, passwords }
      : null
    return createTrainingHandler(store, auth)(request)
  },
}
