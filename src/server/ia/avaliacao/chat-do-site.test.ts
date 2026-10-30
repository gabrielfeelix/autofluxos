import { writeFileSync } from 'node:fs'
import { describe, it, vi } from 'vitest'
import type { Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { INSTRUCAO_COMERCIAL, SOBRE_O_PRODUTO } from '../../../../scripts/fluxos/textos-do-chat-4yu'

/**
 * A avaliação do consultor do chat do site do AutoFluxos: a instrução e o
 * "Sobre o AutoFluxos" de `scripts/fluxos/textos-do-chat-4yu.ts`, o Gemini de
 * verdade e um cliente fazendo as perguntas que um dono de negócio faz.
 *
 * Não confere nada sozinho: grava as respostas em `AVALIACAO_SAIDA` para ler
 * antes de publicar. O que é resposta boa de vendedor não cabe num `expect`.
 *
 *   set -a && . ./.env && set +a
 *   AVALIACAO_SITE=1 AVALIACAO_SAIDA=/tmp/site.json npx vitest run --config vitest.avaliacao.config.ts chat-do-site
 */
const ligado = Boolean(process.env.AVALIACAO_SITE && process.env.GEMINI_API_KEY)

vi.mock('../../recursos-do-plano', () => ({ recursoLiberado: async () => true }))
vi.mock('../politica', () => ({ lerPoliticas: async () => new Map(), politicaDe: () => 'automatico' }))
vi.mock('../../repos/ia-chamadas', () => ({ registrarChamada: async () => {} }))
vi.mock('../../repos/materiais', () => ({ listarMateriais: async () => [] }))
vi.mock('../../repos/conexoes', () => ({ lerCredencial: async () => null }))
vi.mock('../../alertar', () => ({ alertar: async () => {} }))

const { executarComEfeitos } = await import('../../efeitos/resolver')
const { gemini } = await import('../gemini')

const CONTEXTO = [
  'Conta de demonstração da 4YU (AutoFluxos): mostra, pelo WhatsApp, como o atendimento automático funciona em vários tipos de negócio.',
  SOBRE_O_PRODUTO,
].join('\n\n')

export const PERGUNTAS = [
  'é confiável?',
  'mas presta?',
  'quem é a 4YU?',
  'quanto custa?',
  'achei caro, 297 por mês é muito pra mim',
  'já uso o WhatsApp Business, por que eu mudaria?',
  'vou perder meu número?',
  'tenho uma pizzaria, como isso me ajuda?',
  'minha loja é na Nuvemshop, integra?',
  'funciona com Shopify?',
  'e se a IA falar besteira pros meus clientes?',
  'meus dados ficam seguros?',
  'tem fidelidade? posso cancelar quando quiser?',
  'quanto tempo leva pra começar a usar?',
  'vocês têm clientes de verdade? quem usa?',
  'qual a diferença de vocês pro botconversa?',
  'precisa de cartão pra testar?',
  'tenho 2 atendentes e uns 500 clientes por mês, qual plano?',
  'dá pra usar no instagram também?',
  'gostei, como eu faço?',
]

const fluxo: Fluxo = {
  inicio: 'ia',
  nodes: [
    {
      id: 'ia',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: { instrucao: INSTRUCAO_COMERCIAL, salvarEm: 'ultima_resposta', ferramentas: [], conversar: { maxTurnos: 12, concluir: { salvarEm: 'assunto_ia' } } },
    },
  ],
  edges: [],
} as Fluxo

const saida: { pergunta: string; resposta: string; concluiu: boolean; transferiu: boolean }[] = []

describe.skipIf(!ligado)('avaliação do consultor do chat do site', () => {
  for (const pergunta of PERGUNTAS) {
    it(pergunta, { timeout: 120_000 }, async () => {
      const sessao: Sessao = { noAtual: 'ia', vars: { nome: 'Carlos' }, tentativas: 0, status: 'ativa' }
      const r = await executarComEfeitos(fluxo, sessao, { tipo: 'texto', texto: pergunta }, {
        modelo: gemini({ chave: process.env.GEMINI_API_KEY! }),
        contextoNegocio: CONTEXTO,
        historico: [{ de: 'pessoa' as const, texto: pergunta }],
        perguntaDaPessoa: pergunta,
        clienteId: '00000000-0000-0000-0000-0000000000a2',
        origem: 'whatsapp',
        hoje: '2026-10-30',
      } as Parameters<typeof executarComEfeitos>[3])
      saida.push({
        pergunta,
        resposta: r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : [])).join('\n'),
        concluiu: r.sessao.vars.assunto_ia !== undefined,
        transferiu: r.acoes.some((a) => a.tipo === 'transferir_humano'),
      })
      if (process.env.AVALIACAO_SAIDA) writeFileSync(process.env.AVALIACAO_SAIDA, JSON.stringify(saida, null, 2))
      await new Promise((ok) => setTimeout(ok, 1500))
    })
  }
})
