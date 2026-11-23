export type ProfileId = 'miguel' | 'sintia'

export interface AccessProfile {
  id: ProfileId
  label: string
  databaseName: string
}

const ACTIVE_PROFILE_KEY = 'treino-active-profile'

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

// Keep the database and plan on the profile selected when this tab loaded.
export const loadedProfileId = getStoredProfileId()

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
