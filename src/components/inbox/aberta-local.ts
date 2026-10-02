'use client'

import { useSyncExternalStore } from 'react'
import type { CanalId } from '@/core/canais'
import type { ConversaAberta } from '@/server/conversa-aberta'
import type { Lead } from '@/server/repos/leads'

/**
 * Qual conversa está aberta, e as que já vieram do servidor.
 *
 * ---------------------------------------------------------------------------
 * Por que trocar de conversa não navega mais
 * ---------------------------------------------------------------------------
 *
 * Clicar numa linha da fila era um `Link`: o Inbox inteiro de novo no
 * servidor (fila, contagens, fixadas, não lidas) para mudar só a coluna do
 * meio. O WhatsApp Web abre a conversa sem tocar na lista, e é o que isto
 * faz: o endereço muda por `history.pushState` (o Next 16 sincroniza o
 * roteador com ele), a conversa já guardada aparece no mesmo quadro, e a
 * fresca vem de `inbox/aberta` por trás.
 *
 * Mora fora do React, como `fila-viva.ts`, para sobreviver a remontagens.
 */

/** O que a linha da fila já sabe, para a coluna não nascer em branco. */
export type Previa = { lead: Lead; canal: CanalId }

type Estado = {
  /** `false` até a página semear: antes disso quem manda são as props. */
  iniciada: boolean
  id: string | null
  dados: ConversaAberta | null
  previa: Previa | null
  falhou: boolean
}

const VAZIO: Estado = { iniciada: false, id: null, dados: null, previa: null, falhou: false }

/** Quantas conversas ficam guardadas. Passou disso, sai a mais antiga. */
const GUARDADAS = 40
/** Abaixo disto a cópia guardada vale sem perguntar de novo. */
const FRESCA_MS = 4_000

let estado: Estado = VAZIO
let clienteAtual: string | null = null
const guardadas = new Map<string, ConversaAberta>()
const buscando = new Map<string, Promise<void>>()
const falhas = new Set<string>()
const assinantes = new Set<() => void>()

function avisar() {
  const id = estado.id
  estado = {
    ...estado,
    dados: id ? (guardadas.get(id) ?? null) : null,
    falhou: id ? falhas.has(id) : false,
  }
  assinantes.forEach((assinante) => assinante())
}

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

export function useAberta(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => VAZIO,
  )
}

/** Guarda a cópia mais nova; a de antes do clique não apaga a de depois. */
function guardar(dados: ConversaAberta) {
  const id = dados.lead.contatoId
  const antes = guardadas.get(id)
  if (antes && antes.lidaEm > dados.lidaEm) return
  guardadas.delete(id)
  guardadas.set(id, dados)
  falhas.delete(id)
  while (guardadas.size > GUARDADAS) {
    const maisAntiga = guardadas.keys().next().value
    if (maisAntiga === undefined || maisAntiga === estado.id) break
    guardadas.delete(maisAntiga)
  }
}

function trocarDeCliente(clienteId: string) {
  if (clienteAtual === clienteId) return
  clienteAtual = clienteId
  guardadas.clear()
  buscando.clear()
  falhas.clear()
}

function buscar(clienteId: string, contatoId: string): Promise<void> {
  const emCurso = buscando.get(contatoId)
  if (emCurso) return emCurso
  const busca = (async () => {
    try {
      const resposta = await fetch(`/api/clientes/${clienteId}/inbox/aberta/${contatoId}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (clienteAtual !== clienteId) return
      if (!resposta.ok) {
        if (!guardadas.has(contatoId)) falhas.add(contatoId)
        return
      }
      guardar((await resposta.json()) as ConversaAberta)
    } catch {
      if (!guardadas.has(contatoId)) falhas.add(contatoId)
    } finally {
      buscando.delete(contatoId)
      avisar()
    }
  })()
  buscando.set(contatoId, busca)
  return busca
}

function precisaBuscar(contatoId: string): boolean {
  const guardada = guardadas.get(contatoId)
  return !guardada || Date.now() - guardada.lidaEm > FRESCA_MS
}

/**
 * A página desenhou (ou redesenhou): a conversa dela entra na guarda, e passa a
 * ser a aberta quando o servidor trocou de conversa, que é o caso de quem
 * chegou por um link de notificação, de outra tela ou do botão voltar.
 */
export function semearAberta(
  clienteId: string,
  dados: ConversaAberta | null,
  servidorTrocou: boolean,
) {
  trocarDeCliente(clienteId)
  if (dados) guardar(dados)
  if (!estado.iniciada || servidorTrocou) {
    estado = { ...estado, iniciada: true, id: dados?.lead.contatoId ?? null, previa: null }
  }
  avisar()
}

/** O clique na linha: abre na hora, com a cópia guardada ou com a prévia. */
export function abrirConversa(clienteId: string, previa: Previa, endereco: string) {
  trocarDeCliente(clienteId)
  const id = previa.lead.contatoId
  if (estado.id !== id) {
    window.history.pushState(null, '', endereco)
    estado = { ...estado, iniciada: true, id, previa }
    falhas.delete(id)
    avisar()
  }
  if (precisaBuscar(id)) void buscar(clienteId, id)
}

/** O ponteiro chegou na linha: o clique, se vier, encontra a conversa pronta. */
export function preCarregarConversa(clienteId: string, contatoId: string) {
  trocarDeCliente(clienteId)
  if (precisaBuscar(contatoId)) void buscar(clienteId, contatoId)
}

/**
 * O Inbox saiu da tela. As cópias guardadas ficam (voltar ao Inbox reabre
 * rápido), mas qual está aberta volta a ser decidido pela página: sem isto,
 * voltar de outra tela mostraria por um quadro a conversa da visita anterior.
 */
export function encerrarAberta() {
  estado = VAZIO
  assinantes.forEach((assinante) => assinante())
}

/*
 * Voltar e avançar do navegador entre conversas abertas por `pushState`: o
 * endereço já mudou, a coluna acompanha. Instalado uma vez, no navegador.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (!estado.iniciada || !clienteAtual) return
    const id = new URLSearchParams(window.location.search).get('conversa')
    if (!id || id === estado.id) return
    estado = { ...estado, id, previa: null }
    avisar()
    if (precisaBuscar(id)) void buscar(clienteAtual, id)
  })
}
