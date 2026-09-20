import 'server-only'
import { lerOnboarding } from '@/core/onboarding'
import { db } from '../db'

export async function onboardingDaConta(clienteId: string) {
  const { data, error } = await db().from('clients').select('onboarding').eq('id', clienteId).maybeSingle()
  // Compatibilidade antes da migration: as telas existentes seguem acessíveis.
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') return null
    throw new Error('Não foi possível carregar a preparação da empresa. Tente novamente.')
  }
  return lerOnboarding(data?.onboarding)
}
