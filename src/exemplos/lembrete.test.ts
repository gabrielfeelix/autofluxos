import { describe, expect, it, vi } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Resultado, type Sessao } from '@/core/engine/types'
import { acharPreset } from '@/core/presets'
import { varsIniciais } from '@/core/contatos/vars-iniciais'
import { lembrete } from './lembrete'

/*
 * `extrair` mora ao lado do disparo HTTP, que é `server-only` e importa undici.
 * A conferência aqui é da regra pura, então o módulo entra com os dois vizinhos
 * dublados, igual faz `agendamento.test.ts`.
 */
vi.mock('./rede', () => ({ conferirEndereco: vi.fn() }))
vi.mock('undici', () => ({ request: vi.fn(), Agent: vi.fn() }))
const { extrair } = await import('@/server/efeitos/http')

/**
 * O lembrete, rodado de ponta a ponta.
 *
 * Os testes que existiam olhavam **arestas**: que "não vou poder" leva a um
 * `DELETE`, que o silêncio leva a gente. Nenhum rodava a conversa, e por isso
 * nenhum via o que a pessoa lê , foi assim que o menu de um botão só passou
 * despercebido: o desenho estava certo, a conversa é que não fazia sentido.
 *
 * As respostas abaixo são as da documentação da Verandi, e os caminhos são os
 * dos presets. Se a agenda mudar a forma da resposta, é aqui que quebra.
 */

const ACHOU = {
  total: 1,
  pessoas: [{ pessoaId: '77c0', nome: 'Marina Alves', telefone: '44998887766', ativa: true }],
}

/** A ficha de quem tem **uma** aula marcada: o caso mais comum de todos. */
const UMA_AULA = {
  nome: 'Marina Alves',
  proximas: [
    { participacaoId: 'p1', data: '2026-08-21', hora: '07:00', servico: 'Pilates solo' },
  ],
  reposicoesAbertas: [],
  horariosFixos: [],
  situacao: 'ativa',
  regraDeCancelamento: { porExtenso: '2h' },
}

/** Duas aulas: aqui a pergunta tem o que perguntar. */
const DUAS_AULAS = {
  ...UMA_AULA,
  proximas: [
    { participacaoId: 'p1', data: '2026-08-21', hora: '07:00', servico: 'Pilates solo' },
    { participacaoId: 'p2', data: '2026-08-23', hora: '10:00', servico: 'Pilates aparelho' },
  ],
}

/** Nenhuma: o lembrete não tem assunto. */
const SEM_AULA = { ...UMA_AULA, proximas: [] }

function valoresDoPreset(presetId: string, json: unknown): Record<string, string> {
  const preset = acharPreset(presetId)
  if (!preset) throw new Error(`preset ${presetId} sumiu`)

  const valores: Record<string, string> = {}
  for (const { variavel, caminho, unicos, rotulo, quantos } of preset.dados.mapear) {
    valores[variavel] = extrair(json, caminho, unicos ?? false, rotulo, quantos ?? false)
  }
  return valores
}

/** Tudo que a pessoa lê, incluindo o texto das perguntas com botão. */
const textos = (acoes: Acao[]) =>
  acoes.flatMap((a) =>
    a.tipo === 'enviar_texto' || a.tipo === 'enviar_opcoes' ? [a.texto] : [],
  )

const opcoesDe = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'enviar_opcoes' ? a.opcoes : []))

const comeco = (): Sessao => ({
  ...sessaoNova(),
  vars: varsIniciais({ waId: '5544998887766' }),
})

const responder = (r: Resultado, presetId: string, json: unknown): Resultado =>
  executar(lembrete, r.sessao, {
    tipo: 'http_respondeu',
    valores: valoresDoPreset(presetId, json),
  })

/** Do "oi" até o fluxo dizer alguma coisa, com a ficha que o teste escolher. */
const ateOLembrete = (ficha: unknown): Resultado => {
  let r = executar(lembrete, comeco(), { tipo: 'inicio' })
  r = responder(r, 'verandi-quem-e', ACHOU)
  return responder(r, 'verandi-minha-agenda', ficha)
}

describe('o lembrete fala de uma aula sem fazer a pessoa escolhê-la', () => {
  /*
   * O defeito que este arquivo veio consertar.
   *
   * Com uma aula marcada, o fluxo perguntava *"É sobre qual delas?"* e o
   * WhatsApp mostrava um botão sozinho: uma escolha sem escolha, no caso mais
   * comum de todos. A pessoa clicava para confirmar o que o bot já sabia.
   */
  it('uma aula só: o bot diz qual é, e não pergunta', () => {
    const r = ateOLembrete(UMA_AULA)
    const lido = textos(r.acoes).join(' ')

    expect(lido).not.toContain('qual delas')
    /*
     * A aula aparece, e já na pergunta que pede o gesto , **inteira**. O corte
     * de 20 caracteres é do rótulo de botão; em texto cabem 4096, e é por isso
     * que dizer a aula na frase é melhor do que oferecê-la como opção única.
     */
    expect(lido).toContain('sexta 21/08 07:00 · Pilates solo')
    expect(opcoesDe(r.acoes).map((o) => o.rotulo)).toEqual([
      '✅ Vou sim',
      '❌ Não vou poder',
      '🔄 Quero remarcar',
    ])
  })

  // E o id certo fica guardado, que é o que o DELETE do "não vou poder" usa.
  it('uma aula só: a participação guardada é a daquela aula', () => {
    const r = ateOLembrete(UMA_AULA)
    expect(r.sessao.vars.participacao_id).toBe('p1')
  })

  /*
   * Com duas, a pergunta volta a ter função: os rótulos do preset trazem dia,
   * hora e qual aula é, que é o que permite escolher entre elas.
   */
  it('duas aulas: aí sim pergunta qual, com as duas no menu', () => {
    const r = ateOLembrete(DUAS_AULAS)

    expect(textos(r.acoes).join(' ')).toContain('qual delas')
    /*
     * O rótulo diz o dia da semana, a hora e qual aula é, nos 20 caracteres
     * que a Cloud API permite. Com `{data}` cru saía `2026-08-21 07:00 · P`:
     * o ano gastava o espaço do nome da aula, que é justamente o que separa
     * uma opção da outra.
     */
    expect(opcoesDe(r.acoes).map((o) => o.rotulo)).toEqual([
      'sexta 21/08 07:00 · ',
      'domingo 23/08 10:00 ',
    ])
  })

  // Zero cai no ramo de "não é mais de uma" junto com o caso de uma, e os dois
  // não podem seguir juntos: sem isto, o bot lembraria de uma aula inexistente.
  it('nenhuma aula: diz isso, e não fala de aula nenhuma', () => {
    const r = ateOLembrete(SEM_AULA)
    const lido = textos(r.acoes).join(' ')

    expect(lido).toContain('Não vi nenhuma aula marcada')
    expect(lido).not.toContain('qual delas')
    expect(opcoesDe(r.acoes)).toEqual([])
  })
})
