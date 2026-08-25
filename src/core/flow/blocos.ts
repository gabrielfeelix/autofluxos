import type { TipoNo } from './schema'

/**
 * Como cada bloco se chama, se desenha e se explica — **num lugar só**.
 *
 * Estava dentro de `components/editor/nos.tsx`, que é `'use client'` e importa o
 * React Flow inteiro. Enquanto o editor era o único lugar que dizia o nome de um
 * bloco isso não custava nada. A página de Ajuda mudou a conta: ela desenha os
 * mesmos dez blocos, e importar do editor arrastaria o React Flow para uma
 * página que não desenha grafo nenhum.
 *
 * A alternativa — repetir os dez nomes na Ajuda — é a forma conhecida de a
 * documentação passar a descrever um produto que não existe mais. Renomear
 * "API" para "Serviços externos" foi uma linha aqui; com duas cópias teria sido
 * uma linha e um esquecimento.
 *
 * Puro de propósito: sem React, sem `'use client'`, sem rede. Quem desenha
 * importa; quem escreve sobre o desenho importa a mesma coisa.
 */

/**
 * O nome que aparece no bloco, no catálogo e na Ajuda.
 *
 * `http` se chamava **"API"**, que é o nome da tecnologia, não o do trabalho.
 * Quem desenha o fluxo do estúdio de pilates não está procurando uma API: está
 * procurando "puxar a agenda", "mandar pro CRM", "consultar o sistema". Foi
 * exatamente o que o operador do concorrente apontou, e lá o bloco ainda se
 * chamava "Integração" — nós estávamos um degrau abaixo.
 */
export const NOMES: Record<TipoNo, string> = {
  mensagem: 'Mensagem',
  pergunta: 'Pergunta',
  condicao: 'Condição',
  'salvar-campo': 'Guardar',
  ia: 'IA',
  handoff: 'Falar com humano',
  http: 'Serviços externos',
  midia: 'Mídia',
  /**
   * "Etapa do quadro", e não "Kanban" nem "mover cartão".
   *
   * Quem desenha o fluxo pensa em "marcar que essa pessoa agendou a aula", não
   * em mover um cartão — o cartão é o desenho da coisa, não a coisa. É a mesma
   * correção que fez `http` deixar de se chamar "API".
   */
  etapa: 'Etapa do quadro',
  /**
   * "Ir para outra automação", e não "sub-fluxo" nem "chamar fluxo".
   *
   * "Chamar" promete volta, e não existe volta: quem salta termina no outro
   * desenho. O nome diz exatamente o que acontece com a conversa.
   */
  'ir-fluxo': 'Ir para outra automação',
}

export const ICONES: Record<TipoNo, string> = {
  mensagem: '↗',
  pergunta: '?',
  condicao: '⑂',
  'salvar-campo': '↓',
  ia: '✦',
  handoff: '♙',
  http: '⇄',
  midia: '▣',
  etapa: '▤',
  'ir-fluxo': '⇥',
}

/** A linha de baixo na barra de blocos: o que ele faz, em três palavras. */
export const DESCRICOES: Record<TipoNo, string> = {
  mensagem: 'Envia um texto',
  midia: 'Envia foto ou arquivo',
  pergunta: 'Pergunta e guarda',
  condicao: 'Divide o caminho',
  'salvar-campo': 'Registra no lead',
  etapa: 'Move no quadro',
  'ir-fluxo': 'Continua em outra',
  ia: 'Responde pelo contexto',
  handoff: 'Passa para uma pessoa',
  http: 'Chama um sistema',
}

/**
 * A cor da borda de cada bloco no desenho.
 *
 * Sai daqui, e não do editor, porque a Ajuda **desenha os mesmos blocos** e a
 * cor é como se reconhece um deles de longe. Uma pergunta verde na explicação e
 * roxa no editor obrigaria a reler o rótulo toda vez.
 */
export const CORES: Record<TipoNo, string> = {
  mensagem: 'border-sky-400/30',
  pergunta: 'border-emerald-400/30',
  condicao: 'border-violet-400/30',
  'salvar-campo': 'border-amber-300/30',
  ia: 'border-fuchsia-400/30',
  handoff: 'border-rose-400/30',
  http: 'border-cyan-400/30',
  midia: 'border-sky-400/30',
  etapa: 'border-teal-400/30',
  'ir-fluxo': 'border-indigo-400/30',
}
