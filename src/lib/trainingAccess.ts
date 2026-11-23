import type { ProfileId } from './auth'

export class TrainingCloudError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super('Não foi possível acessar a nuvem.')
  }
}

export async function trainingRequest<T>(query: string, profile?: ProfileId, body?: string): Promise<T> {
  const response = await fetch('/api/training' + query, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'X-Training-Request': '1',
      ...(profile && { 'X-Training-Profile': profile }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body,
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new TrainingCloudError(response.status, data?.code ?? 'CLOUD_UNAVAILABLE')
  return data
}

export async function signInTraining(profile: ProfileId, password: string) {
  return trainingRequest<{ profile: ProfileId }>('?action=login', profile, JSON.stringify({ profile, password }))
}

export async function signOutTraining() {
  await trainingRequest('?action=logout', undefined, '{}')
}
