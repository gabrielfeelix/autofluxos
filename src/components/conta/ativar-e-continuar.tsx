'use client'

import { useRouter } from 'next/navigation'
import { DuasEtapas } from './duas-etapas'

/** A página obrigatória do admin: ao ligar, segue para a administração. */
export function AtivarEContinuar() {
  const router = useRouter()
  return <DuasEtapas ligada={false} aoConcluir={() => router.push('/admin')} />
}
