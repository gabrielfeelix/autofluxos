import { describe, expect, it, vi } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Resultado, type Sessao } from '@/core/engine/types'
import { acharPreset } from '@/core/presets'
import { varsIniciais } from '@/core/contatos/vars-iniciais'
import { alunoInativo } from './aluno-inativo'

vi.mock('./rede', () => ({ conferirEndereco: vi.fn() }))
vi.mock('undici', () => ({ request: vi.fn(), Agent: vi.fn() }))
const { extrair } = await import('@/server/efeitos/http')
const { formatarValor } = await import('@/core/flow/formatos')

/**
 * O fluxo de quem parou de vir, rodado de ponta a ponta.
 *
 * O que importa aqui não é o desenho, é **o que a recepção recebe**: o valor
 * deste fluxo é chegar na fila com o motivo já escrito, em vez de um "oi" que
 * alguém terá que destrinchar. Isso só aparece rodando.
 */

const ACHOU = { total: 1, pessoas: [{ pessoaId: '77c0', nome: 'Marina Alves' }] }

const fichaCom = (situacao: string) => ({
  nome: 'Marina Alves',
  proximas: [],
  reposicoesAbertas: [],
  horariosFixos: [],
  situacao,
  regraDeCancelamento: { porExtenso: '2h' },
})

function valoresDoPreset(presetId: string, json: unknown): Record<string, string> {
  const preset = acharPreset(presetId)
  if (!preset) throw new Error(`preset ${presetId} sumiu`)

  const valores: Record<string, string> = {}
  for (const { variavel, caminho, unicos, rotulo, quantos, formato } of preset.dados.mapear) {
    const cru = extrair(json, caminho, unicos ?? false, rotulo, quantos ?? false)
    valores[variavel] = quantos ? cru : formatarValor(cru, formato)
  }
  return valores
}

const textos = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'enviar_texto' || a.tipo === 'enviar_opcoes' ? [a.texto] : []))

const opcoesDe = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'enviar_opcoes' ? a.opcoes.map((o) => o.rotulo) : []))

/** O motivo que chega na fila do Inbox, que é o produto deste fluxo. */
const motivos = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'transferir_humano' ? [a.motivo] : []))

const comeco = (): Sessao => ({
  ...sessaoNova(),
  vars: varsIniciais({ waId: '5544998887766' }),
})

const responder = (r: Resultado, presetId: string, json: unknown): Resultado =>
  executar(alunoInativo, r.sessao, {
    tipo: 'http_respondeu',
    valores: valoresDoPreset(presetId, json),
  })

const ateOMenu = (situacao = 'licenca'): Resultado => {
  let r = executar(alunoInativo, comeco(), { tipo: 'inicio' })
  r = responder(r, 'verandi-quem-e', ACHOU)
  return responder(r, 'verandi-minha-agenda', fichaCom(situacao))
}

describe('quem parou de vir recebe a conversa de quem parou de vir', () => {
  it('as boas-vindas são próprias, e não o menu de quem está ativo', () => {
    const r = ateOMenu()

    expect(textos(r.acoes).join(' ')).toContain('Que bom te ver por aqui de novo')
    expect(opcoesDe(r.acoes)).toEqual([
      '💪 Voltar às aulas',
      '📄 Falar do contrato',
      '🚪 Cancelar contrato',
      '💬 Outro assunto',
    ])
  })

  /*
   * A ficha diz "trancado", "inadimplente", "licenca". Devolver isso na
   * saudação é constranger alguém com o rótulo interno do sistema logo no
   * "oi" , o dado serve à recepção, no motivo, não à pessoa.
   */
  it('a situação não é dita para a pessoa, e vai no motivo', () => {
    let r = ateOMenu('inadimplente')
    expect(textos(r.acoes).join(' ')).not.toContain('inadimplente')

    r = executar(alunoInativo, r.sessao, { tipo: 'opcao', opcaoId: 'voltar' })
    expect(motivos(r.acoes)[0]).toContain('inadimplente')
  })

  /*
   * O produto do fluxo: a recepção abre a fila e já sabe o assunto. Sem isto,
   * as quatro opções produziriam o mesmo "oi" na fila e o bot não teria feito
   * nada além de atrasar a conversa.
   */
  it('cada escolha chega na fila com o motivo escrito', () => {
    const casos: [string, string][] = [
      ['voltar', 'quer voltar às aulas'],
      ['contrato', 'dúvida de contrato'],
      ['cancelar', 'quer cancelar o contrato'],
      ['outro', 'assunto não listado'],
    ]

    for (const [opcao, esperado] of casos) {
      const r = executar(alunoInativo, ateOMenu().sessao, { tipo: 'opcao', opcaoId: opcao })
      expect(motivos(r.acoes)[0]).toContain(esperado)
      expect(motivos(r.acoes)[0]).toContain('Marina Alves')
    }
  })

  /*
   * Cancelar não é escondido atrás de retenção, e o bot não promete como será.
   * A hipótese do presencial foi levantada e não fechada; uma frase dessas no
   * fluxo viraria regra sem ninguém ter decidido.
   */
  it('cancelar vai direto para uma pessoa, sem perguntar "tem certeza"', () => {
    const r = executar(alunoInativo, ateOMenu().sessao, { tipo: 'opcao', opcaoId: 'cancelar' })

    expect(opcoesDe(r.acoes)).toEqual([])
    expect(textos(r.acoes).join(' ')).toContain('sempre com uma pessoa da equipe')
    expect(textos(r.acoes).join(' ')).not.toContain('presencial')
  })

  /*
   * Situação nova inventada pela conta do cliente cai no ramo cuidadoso. Um
   * fluxo que listasse as inativas trataria "suspenso" como ativo, que é
   * justamente o caso em que errar é pior.
   */
  it('situação desconhecida é tratada como inativa, e não como ativa', () => {
    const r = ateOMenu('suspenso_por_convenio')
    expect(textos(r.acoes).join(' ')).toContain('Que bom te ver por aqui de novo')
  })

  it('quem está ativa não cai neste fluxo', () => {
    const r = ateOMenu('ativa')
    expect(opcoesDe(r.acoes)).toEqual([])
    expect(motivos(r.acoes)[0]).toContain('aluno ativo escreveu no fluxo de inativos')
  })

  // Silêncio não é desinteresse: quem sumiu e escreveu de novo já deu o passo
  // difícil, e deixar morrer devolveria a pessoa ao estado em que ela estava.
  it('não responder deixa o contato com a recepção, com aviso', () => {
    const r = executar(alunoInativo, ateOMenu().sessao, { tipo: 'timeout' })

    expect(motivos(r.acoes)[0]).toContain('não respondeu o menu')
    expect(textos(r.acoes).join(' ')).toContain('deixar seu contato com a recepção')
  })
})
