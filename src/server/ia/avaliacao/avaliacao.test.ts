import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { lojaMagento } from '@/loja/magento'
import type { Modelo, Turno as TurnoDaIa } from '../types'
import { CASOS, type Caso, type Registro, type Turno } from './casos-pcyes'

/**
 * A avaliação do vendedor da PCYES: o bloco publicado, a loja de verdade e o
 * Gemini de verdade, caso a caso.
 *
 * Existe para mexer no prompt sem perder comportamento: roda antes, roda
 * depois, compara. Por isso não falha no primeiro caso ruim; cada caso é um
 * teste, e o relatório em JSON (`AVALIACAO_SAIDA`) guarda o que saiu.
 *
 * **Não roda sozinho**: precisa de `AVALIACAO=1`, da chave e do arquivo que
 * `scripts/avaliacao/exportar.mjs` gera (fora do git: o repositório é público).
 *
 *   set -a && . ./.env && set +a
 *   AVALIACAO=1 AVALIACAO_SAIDA=/tmp/antes.json npm run avaliacao
 */

const DADOS = new URL('../../../../scripts/avaliacao/.dados/pcyes.json', import.meta.url)
const chave = process.env.GEMINI_API_KEY
const ligado = Boolean(process.env.AVALIACAO && chave && existsSync(DADOS))

vi.mock('../../recursos-do-plano', () => ({ recursoLiberado: async () => true }))
vi.mock('../politica', () => ({ lerPoliticas: async () => new Map(), politicaDe: () => 'automatico' }))
vi.mock('../../repos/ia-chamadas', () => ({ registrarChamada: async () => {} }))
vi.mock('../../repos/materiais', () => ({ listarMateriais: async () => [] }))
vi.mock('../../repos/conexoes', () => ({ lerCredencial: async () => null }))
vi.mock('../../alertar', () => ({ alertar: async () => {} }))
vi.mock('../../adaptador-da-loja', () => ({
  lojaAtivaDaConta: async () => {
    const { loja } = JSON.parse(readFileSync(DADOS, 'utf8'))
    return lojaMagento(loja)
  },
}))

const { AVISO_DE_FALHA_DA_IA, executarComEfeitos } = await import('../../efeitos/resolver')
const { gemini } = await import('../gemini')
const { RECUSA_FORA_DO_ASSUNTO } = await import('../prompt')

const CLIENTE = '00000000-0000-0000-0000-0000000000a1'
const PAUSA_MS = Number(process.env.AVALIACAO_PAUSA_MS ?? 4_000)

function paraHistorico(turnos: Turno[]): TurnoDaIa[] {
  return turnos.map((t): TurnoDaIa => {
    if (t[0] === 'cards') {
      return {
        de: 'ferramenta',
        nome: 'loja_mostrar',
        texto: JSON.stringify({ ja_mostrado_em_card: t[1].map((nome) => ({ nome })) }),
      }
    }
    return { de: t[0], texto: t[1] }
  })
}

/** O modelo de verdade, anotando o que ele pediu. */
function anotando(modelo: Modelo, registro: Registro, falhas: string[]): Modelo {
  return {
    async responder(pedido) {
      const r = await modelo.responder(pedido)
      registro.resultados = (pedido.historico ?? []).flatMap((t) => (t.de === 'ferramenta' ? [`${t.nome}: ${t.texto.slice(0, 1500)}`] : []))
      if (r.tipo === 'usar_ferramenta') {
        registro.chamadas.push({ nome: r.nome, argumentos: r.argumentos })
        if (r.nome === 'concluir_conversa') registro.concluiu = r.argumentos.resumo ?? ''
      }
      if (r.tipo === 'nao_sei' && r.falhou) falhas.push(r.motivo)
      return r
    },
  }
}

async function rodar(caso: Caso, fluxo: Fluxo, contexto: string) {
  const registro: Registro = { texto: '', cards: [], chamadas: [], concluiu: null, transferiu: false }
  const falhas: string[] = []
  const historico = [...paraHistorico(caso.historico ?? []), { de: 'pessoa' as const, texto: caso.mensagem }]
  const sessao: Sessao = { noAtual: fluxo.inicio, vars: {}, tentativas: 0, status: 'ativa' }

  const r = await executarComEfeitos(fluxo, sessao, { tipo: 'texto', texto: caso.mensagem }, {
    modelo: anotando(gemini({ chave: chave! }), registro, falhas),
    contextoNegocio: contexto,
    historico,
    perguntaDaPessoa: caso.mensagem,
    clienteId: CLIENTE,
    origem: 'whatsapp',
    hoje: '2026-10-07',
  } as Parameters<typeof executarComEfeitos>[3])

  registro.texto = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : [])).join('\n')
  registro.cards = r.acoes.flatMap((a) => (a.tipo === 'enviar_produtos' ? a.produtos.map((p) => p.nome) : []))
  registro.transferiu = r.acoes.some((a) => a.tipo === 'transferir_humano')
  return { registro, falhas }
}

/** O provedor caiu e a pessoa leu só o aviso de falha: não é nota do prompt. */
function caiu(t: { registro: Registro; falhas: string[] }): boolean {
  return t.falhas.length > 0 && (t.registro.texto === '' || t.registro.texto === AVISO_DE_FALHA_DA_IA)
}

const relatorio: Record<string, unknown>[] = []

describe.skipIf(!ligado)('avaliação do vendedor da PCYES', () => {
  const dados = ligado ? JSON.parse(readFileSync(DADOS, 'utf8')) : null
  const fluxo = ligado
    ? ({ inicio: dados.no.id, nodes: [{ ...dados.no, position: { x: 0, y: 0 } }], edges: [] } as Fluxo)
    : (null as never)

  for (const caso of CASOS) {
    it(caso.id, { timeout: 240_000 }, async () => {
      let tentativa = await rodar(caso, fluxo, dados.contextoNegocio)
      // Pico do Google não é nota do prompt: espera e roda de novo, até duas vezes.
      for (let i = 0; i < 2 && caiu(tentativa); i++) {
        await new Promise((ok) => setTimeout(ok, 20_000))
        tentativa = await rodar(caso, fluxo, dados.contextoNegocio)
      }
      const { registro, falhas } = tentativa
      const resultado = caso.confere.map((c) => ({ conferencia: c.descricao, passou: c.passou(registro) }))
      // Pergunta de loja recusada como "fora do assunto" é a pior resposta possível (06/out, VESA).
      if (!caso.recusaEsperada) {
        resultado.push({ conferencia: 'não recusou como fora do assunto', passou: !registro.texto.includes(RECUSA_FORA_DO_ASSUNTO) })
      }
      relatorio.push({ caso: caso.id, origem: caso.origem, versao: dados.versao, resultado, registro, falhas })
      if (process.env.AVALIACAO_SAIDA) writeFileSync(process.env.AVALIACAO_SAIDA, JSON.stringify(relatorio, null, 2))
      await new Promise((ok) => setTimeout(ok, PAUSA_MS))

      expect(caiu(tentativa) ? 'infra' : 'ok', 'o provedor caiu nas três tentativas').toBe('ok')
      expect(resultado.filter((x) => !x.passou).map((x) => x.conferencia)).toEqual([])
    })
  }
})
