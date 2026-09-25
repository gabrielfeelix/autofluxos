'use client'

import { useSyncExternalStore } from 'react'
import { acaoDefinirPresenca } from '@/server/acoes-conta'

export type Presenca = 'disponivel' | 'ausente'

/*
 * A presença que a pessoa acabou de escolher, antes de o servidor confirmar.
 *
 * Mora fora do React porque três lugares mostram o mesmo estado (cabeçalho,
 * gaveta do celular, painel "Você") e o clique em um precisa mudar os três na
 * hora. A ação não recarrega mais o layout: era esse `revalidatePath` que
 * fazia o interruptor levar segundos. No próximo carregamento quem manda é o
 * banco, que já tem o valor novo.
 */
let escolhida: Presenca | null = null
const assinantes = new Set<() => void>()
const avisar = () => assinantes.forEach((assinante) => assinante())

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

/** A presença na tela: a escolhida agora, ou a que veio do servidor. */
export function usePresenca(doServidor: string | null | undefined): string | null {
  const agora = useSyncExternalStore(assinar, () => escolhida, () => null)
  return doServidor ? (agora ?? doServidor) : null
}

/** Muda na tela já, grava por trás, e volta atrás se o servidor recusar. */
export async function trocarPresenca(nova: Presenca, anterior: string | null) {
  escolhida = nova
  avisar()
  try {
    await acaoDefinirPresenca(nova)
  } catch {
    escolhida = anterior === 'disponivel' || anterior === 'ausente' ? anterior : null
    avisar()
  }
}
