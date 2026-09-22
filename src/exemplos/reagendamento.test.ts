import { describe, expect, it, vi } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Resultado, type Sessao } from '@/core/engine/types'
import { acharPreset } from '@/core/presets'
import { varsIniciais } from '@/core/contatos/vars-iniciais'
import { varsDeData } from '@/core/datas'
import { reagendamento } from './reagendamento'

vi.mock('./rede', () => ({ conferirEndereco: vi.fn() }))
vi.mock('undici', () => ({ request: vi.fn(), Agent: vi.fn() }))
const { extrair } = await import('@/server/efeitos/http')
const { formatarValor } = await import('@/core/flow/formatos')

/**
 * O reagendamento, rodado de ponta a ponta.
 *
 * Existe por causa da correção que quem opera pediu: *"ele pergunta: pra que
 * dia? como se o aluno pudesse escolher quando quiser. Aí ele fala dia 14 e n
 * tem, e o bot fala q n tem"*. Uma pergunta de data aberta oferece 365
 * respostas das quais meia dúzia funciona, e recusa as outras 359.
 *
 * Conferir isso lendo o grafo não bastaria: o que importa é **o que a pessoa
 * lê e o que a API recebe**, e esses dois só aparecem rodando.
 */

const ACHOU = { total: 1, pessoas: [{ pessoaId: '77c0', nome: 'Marina Alves' }] }

const UMA_REPOSICAO = {
  nome: 'Marina Alves',
  proximas: [],
  reposicoesAbertas: [
    { participacaoId: 'r1', data: '2026-08-21', hora: '07:00', servico: 'Pilates solo' },
  ],
  horariosFixos: [],
  situacao: 'ativa',
  regraDeCancelamento: { porExtenso: '2h' },
}

/** Dois dias com vaga, um deles com dois horários: o menu não pode repetir. */
const DIAS = {
  livres: [
    { data: '2026-08-21', hora: '07:00' },
    { data: '2026-08-21', hora: '10:00' },
    { data: '2026-08-23', hora: '09:00' },
  ],
}

const SEM_DIA = { livres: [] }

/** O mapeamento **com o formato**, como `resolverHttp` faz no servidor. */
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

const urlChamada = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'chamar_http' ? [a.url] : []))

/*
 * A conversa nasce com as datas da conta, como `receber-mensagem.ts` monta.
 * Sem elas, `{{semana_de}}` chega vazio e a faixa vira um intervalo em branco.
 */
const comeco = (): Sessao => ({
  ...sessaoNova(),
  vars: {
    ...varsIniciais({ waId: '5544998887766' }),
    ...varsDeData('America/Sao_Paulo'),
  },
})

const responder = (r: Resultado, presetId: string, json: unknown): Resultado =>
  executar(reagendamento, r.sessao, {
    tipo: 'http_respondeu',
    valores: valoresDoPreset(presetId, json),
  })

/** Do "oi" até a pergunta da faixa, para quem tem uma reposição em aberto. */
const ateAFaixa = (): Resultado => {
  let r = executar(reagendamento, comeco(), { tipo: 'inicio' })
  r = responder(r, 'verandi-quem-e', ACHOU)
  return responder(r, 'verandi-minha-agenda', UMA_REPOSICAO)
}

describe('o aluno nunca digita uma data', () => {
  it('a pergunta do dia virou faixa, e não teclado', () => {
    const r = ateAFaixa()

    expect(opcoesDe(r.acoes)).toEqual([
      '📅 Esta semana',
      '🗓️ Semana que vem',
      '⏳ Mais pra frente',
    ])
    // A frase que pedia data sumiu: era ela que convidava ao dia 14 inexistente.
    expect(textos(r.acoes).join(' ')).not.toContain('Me manda a data')
  })

  /*
   * A faixa vira intervalo antes da busca. As datas saem de `core/datas.ts`,
   * com o fuso da conta, e não são calculadas no modelo.
   */
  it('escolher a faixa monta o intervalo e consulta a agenda', () => {
    let r = ateAFaixa()
    r = executar(reagendamento, r.sessao, { tipo: 'opcao', opcaoId: 'esta' })

    const datas = varsDeData('America/Sao_Paulo')
    expect(r.sessao.vars.data_de).toBe(datas.semana_de)
    expect(r.sessao.vars.data_ate).toBe(datas.semana_ate)
    expect(urlChamada(r.acoes)[0]).toContain(`de=${datas.semana_de}`)
  })

  /*
   * O par que faz o menu prestar: a pessoa lê o dia da semana, a API recebe
   * ISO. Um só para os dois papéis significaria ou pedir que ela escolha entre
   * datas ISO, ou mandar "sexta 21/08" no `?de=` da agenda.
   */
  it('o menu mostra o dia da semana e manda a data que a API entende', () => {
    let r = ateAFaixa()
    r = executar(reagendamento, r.sessao, { tipo: 'opcao', opcaoId: 'esta' })
    r = responder(r, 'verandi-dias', DIAS)

    // Dois dias, e não três: o mesmo dia com dois horários é uma opção só.
    expect(opcoesDe(r.acoes)).toEqual(['sexta 21/08', 'domingo 23/08'])

    r = executar(reagendamento, r.sessao, { tipo: 'opcao', opcaoId: 'd1' })
    expect(r.sessao.vars.dia).toBe('2026-08-21')
    expect(r.sessao.vars.dia_escrito).toBe('sexta 21/08')
    expect(urlChamada(r.acoes)[0]).toContain('de=2026-08-21')
  })

  // Faixa sem vaga nenhuma: oferece outro período, em vez de abrir um menu
  // vazio ou morrer numa pergunta sem resposta possível.
  it('período sem vaga oferece outro, e não um menu vazio', () => {
    let r = ateAFaixa()
    r = executar(reagendamento, r.sessao, { tipo: 'opcao', opcaoId: 'esta' })
    r = responder(r, 'verandi-dias', SEM_DIA)

    expect(textos(r.acoes).join(' ')).toContain('Não achei vaga nesse período')
    expect(opcoesDe(r.acoes)).toEqual(['📅 Ver outro período', '💬 Chamar a recepção'])
  })
})
