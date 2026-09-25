'use client'

import { useSyncExternalStore } from 'react'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'

/**
 * As agendadas que esta aba criou ou cancelou, antes de o servidor redesenhar.
 *
 * O ícone do cabeçalho, a lista do painel e o contador da fila mostram a mesma
 * mensagem. Agendar e cancelar não recarregam mais a página (ver
 * `gestoSemRecarregar` em `server/recarregar-contato.ts`), então os três leem
 * daqui o que mudou, no molde de `conversa-local.ts`.
 *
 * Criar é otimista: a linha aparece no clique com um id provisório e troca
 * pelo id do banco quando ele responde. Cancelar **não** é: uma mensagem
 * mostrada como cancelada que o servidor não cancelou sairia para o cliente.
 * Só entra aqui depois do "ok".
 */

export type Agendada = MensagemAgendada & { nomeDoContato?: string | null }

type Estado = { criadas: Agendada[]; canceladas: ReadonlySet<string> }

let estado: Estado = { criadas: [], canceladas: new Set() }
const assinantes = new Set<() => void>()

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

function trocar(novo: Estado) {
  estado = novo
  assinantes.forEach((assinante) => assinante())
}

/**
 * A lista do servidor com o que esta aba mudou.
 * `contatoId` limita às criadas deste contato; sem ele, é a conta inteira.
 */
export function useAgendadas<T extends Agendada>(doServidor: T[], contatoId?: string): Agendada[] {
  const agora = useSyncExternalStore(
    assinar,
    () => estado,
    () => estado,
  )
  const ids = new Set(doServidor.map((a) => a.id))
  const vivas: Agendada[] = doServidor.filter((a) => !agora.canceladas.has(a.id))
  for (const criada of agora.criadas) {
    if (ids.has(criada.id) || agora.canceladas.has(criada.id)) continue
    if (contatoId && criada.contatoId !== contatoId) continue
    vivas.push(criada)
  }
  return vivas.sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))
}

/** Põe a agendada na tela já; devolve quem troca o id provisório ou desfaz. */
export function criarAgendada(sem: Omit<Agendada, 'id'>) {
  const provisoria: Agendada = { ...sem, id: `provisoria-${Date.now()}` }
  trocar({ ...estado, criadas: [...estado.criadas, provisoria] })
  return {
    confirmar: (doBanco: MensagemAgendada) =>
      trocar({
        ...estado,
        criadas: estado.criadas.map((a) =>
          a.id === provisoria.id ? { ...doBanco, nomeDoContato: provisoria.nomeDoContato } : a,
        ),
      }),
    desfazer: () =>
      trocar({ ...estado, criadas: estado.criadas.filter((a) => a.id !== provisoria.id) }),
  }
}

/** Depois do "ok" do servidor: some de todas as listas. */
export function marcarCancelada(id: string) {
  trocar({ ...estado, canceladas: new Set(estado.canceladas).add(id) })
}

/** Id que ainda não chegou ao banco: cancelar espera o id de verdade. */
export const ehProvisoria = (id: string) => id.startsWith('provisoria-')
