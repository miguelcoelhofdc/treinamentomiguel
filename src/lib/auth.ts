export type ProfileId = 'miguel' | 'sintia'

export interface AccessProfile {
  id: ProfileId
  label: string
  databaseName: string
}

const ACTIVE_PROFILE_KEY = 'treino-active-profile'

const ACCESS_HASHES: Record<ProfileId, string> = {
  miguel: '58fd907dd28fa63fefcc0d678ad44921e2b69d7421067c183d5dd298cf413bd5',
  sintia: '560feb7d1519b097d694c3518b4daf8779918ff7adf2fbeeb26359ffb585310d',
}

export const ACCESS_PROFILES: Record<ProfileId, AccessProfile> = {
  miguel: { id: 'miguel', label: 'Miguel', databaseName: 'treinamento-miguel' },
  sintia: { id: 'sintia', label: 'Cíntia', databaseName: 'treinamento-sintia' },
}

function isProfileId(value: string | null): value is ProfileId {
  return value === 'miguel' || value === 'sintia'
}

export function getStoredProfileId(): ProfileId | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(ACTIVE_PROFILE_KEY)
    return isProfileId(value) ? value : null
  } catch {
    return null
  }
}

export function storeProfileId(profileId: ProfileId): void {
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
}

export function clearStoredProfile(): void {
  try {
    window.localStorage.removeItem(ACTIVE_PROFILE_KEY)
  } finally {
    document.documentElement.classList.remove('dark')
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function authenticateAccessCode(accessCode: string): Promise<ProfileId | null> {
  if (!window.crypto?.subtle) return null
  const hash = await sha256(accessCode.trim())
  return (Object.keys(ACCESS_HASHES) as ProfileId[])
    .find(profileId => ACCESS_HASHES[profileId] === hash) ?? null
}
