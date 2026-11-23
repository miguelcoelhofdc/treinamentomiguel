import { useState } from 'react'
import { ArrowRight, UserCircle } from '@phosphor-icons/react'
import { ACCESS_PROFILES, storeProfileId, type ProfileId } from '@/lib/auth'

export default function Access() {
  const [error, setError] = useState('')

  const openProfile = (profileId: ProfileId) => {
    try {
      storeProfileId(profileId)
    } catch {
      setError('Permita o armazenamento neste navegador para abrir seu perfil.')
      return
    }
    window.location.replace('/')
  }

  return (
    <main className="training-theme tracking-theme app-theme training-access">
      <div className="access-form">
        <p className="page-kicker">Meu ritmo</p>
        <h1 className="page-title mt-2">Escolha seu perfil</h1>
        <div className="mt-6 grid gap-3">
          {Object.values(ACCESS_PROFILES).map(profile => (
            <button
              key={profile.id}
              type="button"
              className="btn-secondary w-full !justify-start gap-3"
              onClick={() => openProfile(profile.id)}
            >
              <UserCircle size={24} weight="duotone" aria-hidden="true" />
              <span className="flex-1 text-left">{profile.label}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p>}
      </div>
    </main>
  )
}
