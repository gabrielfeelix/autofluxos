'use client'

import { useSyncExternalStore } from 'react'
import type { Lead } from '@/server/repos/leads'

/**
 * A fila ao vivo: as linhas que mudaram depois que o servidor desenhou a tela.
 *
 * Antes, mensagem de outra conversa fazia `router.refresh()`: a página inteira
 * de novo no servidor, a fila piscando, a rolagem pulando. Era o "F5 sozinho"
 * que quem atende via a cada mensagem. Agora o pulso pede ao servidor só as
 * linhas que mudaram (`/inbox/fila?desde=`), e elas entram aqui. A fila junta
 * isto com o que o servidor desenhou, linha por linha, como o WhatsApp.
 *
 * Mora fora do React, como `conversa-local.ts`, para sobreviver a remontagens:
 * guardar num `useRef` perderia tudo no primeiro redesenho.
 */

type Estado = {
  linhas: ReadonlyMap<string, Lead>
  naoLidas: ReadonlyMap<string, number>
}

let estado: Estado = { linhas: new Map(), naoLidas: new Map() }
/** O último pulso que a tela já mostra, venha do servidor ou daqui. */
let pulsoVisto: string | null = null
const assinantes = new Set<() => void>()

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

export function useFilaViva(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => estado,
  )
}

/** O instante de um pulso (`<ts>|<arquivos>`), em milissegundos. */
function instante(pulso: string | null): number {
  if (!pulso) return 0
  const t = Date.parse(pulso.split('|')[0] ?? '')
  return Number.isNaN(t) ? 0 : t
}

/**
 * O pulso que a tela já mostra: o maior entre o que o servidor desenhou e o que
 * chegou por aqui. Sem isto, o pulso novo seria comparado sempre contra o da
 * página, que não muda mais, e toda batida do stream buscaria de novo.
 */
export function pulsoDaTela(doServidor: string | null): string | null {
  return instante(pulsoVisto) > instante(doServidor) ? pulsoVisto : doServidor
}

/**
 * Busca as linhas que mudaram desde o pulso da tela e aplica.
 *
 * Devolve `false` quando não deu, ou quando mudou coisa demais para caber na
 * resposta: aí quem chama redesenha a página, que é o plano B de sempre.
 */
export async function buscarMudancas(clienteId: string, desdePulso: string | null): Promise<boolean> {
  const desde = instante(desdePulso)
  if (!desde) return false
  try {
    const resposta = await fetch(
      `/api/clientes/${clienteId}/inbox/fila?desde=${encodeURIComponent(new Date(desde).toISOString())}`,
      { cache: 'no-store', credentials: 'same-origin' },
    )
    if (!resposta.ok) return false
    const dados = (await resposta.json()) as {
      leads: Lead[]
      naoLidas: Record<string, number>
      pulso: string | null
      completo: boolean
    }

    const linhas = new Map(estado.linhas)
    const naoLidas = new Map(estado.naoLidas)
    for (const lead of dados.leads) {
      linhas.set(lead.contatoId, lead)
      naoLidas.set(lead.contatoId, dados.naoLidas[lead.contatoId] ?? 0)
    }
    estado = { linhas, naoLidas }
    if (instante(dados.pulso) > instante(pulsoVisto)) pulsoVisto = dados.pulso
    assinantes.forEach((assinante) => assinante())
    return dados.completo
  } catch {
    return false
  }
}

/** A linha mais nova entre a do servidor e a que chegou ao vivo. */
function maisNova(doServidor: Lead, viva: Lead | undefined): Lead {
  if (!viva) return doServidor
  const a = doServidor.ultimaEm ? Date.parse(doServidor.ultimaEm) : 0
  const b = viva.ultimaEm ? Date.parse(viva.ultimaEm) : 0
  return b >= a ? viva : doServidor
}

/**
 * Junta o que o servidor desenhou com o que chegou ao vivo.
 *
 * `acrescentar` só no modo local, em que a fila inteira está no navegador e
 * uma conversa nova tem lugar certo na lista: lá ela entra no topo, e os
 * filtros e a ordem da tela cuidam do resto. No modo paginado a linha nova não
 * tem página conhecida, então só as que já estão à vista são trocadas.
 */
export function juntarComVivas(base: Lead[], vivas: ReadonlyMap<string, Lead>, acrescentar: boolean): Lead[] {
  if (vivas.size === 0) return base
  const vistos = new Set<string>()
  const juntas = base.map((lead) => {
    vistos.add(lead.contatoId)
    return maisNova(lead, vivas.get(lead.contatoId))
  })
  if (!acrescentar) return juntas
  const novas = [...vivas.values()].filter((lead) => !vistos.has(lead.contatoId))
  return novas.length ? [...novas, ...juntas] : juntas
}

/** As não lidas, com as que chegaram ao vivo por cima das do servidor. */
export function naoLidasVivas(
  doServidor: ReadonlyMap<string, number>,
  vivas: ReadonlyMap<string, number>,
): Map<string, number> {
  if (vivas.size === 0) return doServidor as Map<string, number>
  const juntas = new Map(doServidor)
  for (const [id, n] of vivas) juntas.set(id, n)
  return juntas
}
