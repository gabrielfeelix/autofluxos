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

export type ContagemViva = { total: number; semDono: number; porUsuario: Map<string, number> }
export type PorEstadoVivo = { aberta: number; adiada: number; resolvida: number }

type Estado = {
  linhas: ReadonlyMap<string, Lead>
  naoLidas: ReadonlyMap<string, number>
  /**
   * Os contadores do topo, do último pulso. `null` enquanto nada chegou ou
   * depois que o servidor redesenhou a tela, que traz os dele, mais novos.
   */
  contagem: ContagemViva | null
  porEstado: PorEstadoVivo | null
}

let estado: Estado = { linhas: new Map(), naoLidas: new Map(), contagem: null, porEstado: null }
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
      contagem?: { total: number; semDono: number; porUsuario: Record<string, number> }
      porEstado?: PorEstadoVivo
    }

    const linhas = new Map(estado.linhas)
    const naoLidas = new Map(estado.naoLidas)
    for (const lead of dados.leads) {
      linhas.set(lead.contatoId, lead)
      naoLidas.set(lead.contatoId, dados.naoLidas[lead.contatoId] ?? 0)
    }
    estado = {
      linhas,
      naoLidas,
      contagem: dados.contagem
        ? { ...dados.contagem, porUsuario: new Map(Object.entries(dados.contagem.porUsuario)) }
        : estado.contagem,
      porEstado: dados.porEstado ?? estado.porEstado,
    }
    if (instante(dados.pulso) > instante(pulsoVisto)) pulsoVisto = dados.pulso
    assinantes.forEach((assinante) => assinante())
    return dados.completo
  } catch {
    return false
  }
}

/**
 * O servidor redesenhou a tela e trouxe contadores tão novos quanto os daqui,
 * ou mais: os vivos saem de cena até o próximo pulso.
 */
export function esquecerContadoresVivos() {
  if (!estado.contagem && !estado.porEstado) return
  estado = { ...estado, contagem: null, porEstado: null }
  assinantes.forEach((assinante) => assinante())
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

/**
 * O modo paginado: a página que o servidor desenhou, com o que chegou ao vivo.
 *
 * Na primeira página, sem busca, ela se comporta como a fila do WhatsApp:
 * conversa nova que cabe no filtro entra, e a página volta à ordem do
 * servidor, a mensagem mais recente em cima. Em qualquer outra página a linha
 * nova não tem lugar conhecido: só as que já estão à vista são trocadas, e
 * `novas` diz quantas esperam no topo, para a tela oferecer o caminho.
 */
export function juntarNaPagina(
  base: Lead[],
  vivas: ReadonlyMap<string, Lead>,
  cabe: (lead: Lead) => boolean,
  primeiraPagina: boolean,
): { leads: Lead[]; novas: number } {
  if (vivas.size === 0) return { leads: base, novas: 0 }
  const vistos = new Set(base.map((lead) => lead.contatoId))
  const juntas = base.map((lead) => maisNova(lead, vivas.get(lead.contatoId)))
  const novas = [...vivas.values()].filter((lead) => !vistos.has(lead.contatoId) && cabe(lead))
  if (!primeiraPagina) return { leads: juntas, novas: novas.length }
  const data = (lead: Lead) => (lead.ultimaEm ? Date.parse(lead.ultimaEm) : 0)
  return { leads: [...novas, ...juntas].sort((a, b) => data(b) - data(a)), novas: 0 }
}

/**
 * As não lidas, com as que chegaram ao vivo por cima das do servidor.
 *
 * Zero vivo tira a conversa do mapa: quem conta é o `size` ("Não lidas 3"), e
 * uma conversa que outra aba já leu não pode continuar somando.
 */
export function naoLidasVivas(
  doServidor: ReadonlyMap<string, number>,
  vivas: ReadonlyMap<string, number>,
): Map<string, number> {
  if (vivas.size === 0) return doServidor as Map<string, number>
  const juntas = new Map(doServidor)
  for (const [id, n] of vivas) {
    if (n > 0) juntas.set(id, n)
    else juntas.delete(id)
  }
  return juntas
}
