import { describe, expect, it, vi } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Resultado, type Sessao } from '@/core/engine/types'
import { acharPreset } from '@/core/presets'
import { agendamento } from './agendamento'

/*
 * `extrair` mora ao lado do disparo HTTP, que é `server-only` e importa undici.
 * A conferência aqui é da regra pura, então o módulo entra com os dois vizinhos
 * dublados — igual faz `efeitos/http.test.ts`.
 */
vi.mock('./rede', () => ({ conferirEndereco: vi.fn() }))
vi.mock('undici', () => ({ request: vi.fn(), Agent: vi.fn() }))
const { extrair } = await import('@/server/efeitos/http')

/**
 * O modelo de agendamento, rodado de ponta a ponta.
 *
 * **Este teste existe porque os caminhos do mapeamento erram em silêncio.** Um
 * `livres[].hora` escrito `livre[].hora` publica, valida, e devolve variável
 * vazia para sempre; a conversa segue e o menu chega sem nenhuma opção. Só se
 * descobre com cliente conversando.
 *
 * Por isso as respostas abaixo são **as da documentação da Verandi**, copiadas
 * do formato que a API promete, e os caminhos são os dos presets — nada é
 * reescrito aqui. Se a agenda mudar a forma da resposta, é aqui que quebra.
 */

/** A resposta de `GET /pessoas?telefone=`, quando acha. */
const ACHOU = {
  total: 1,
  pessoas: [{ pessoaId: '77c0', nome: 'Marina Alves', telefone: '44998887766', ativa: true }],
}

/** A mesma rota quando não acha: 200, e não 404. */
const NAO_ACHOU = { total: 0, pessoas: [] }

/** `GET /disponibilidade` de um dia com dois horários livres. */
const DISPONIBILIDADE = {
  de: '2026-08-21',
  ate: '2026-08-21',
  livres: [
    {
      sessaoId: 'a41f', data: '2026-08-21', hora: '07:00', duracaoMin: 60,
      servico: 'Pilates solo', profissionalId: '2b7e', profissional: 'Marina',
      localId: '6d33', local: 'Sala 1', capacidade: 4, ocupadas: 2, livres: 2,
    },
    {
      sessaoId: 'b52g', data: '2026-08-21', hora: '10:00', duracaoMin: 60,
      servico: 'Pilates solo', profissionalId: '9c1d', profissional: 'Carol',
      localId: '6d33', local: 'Sala 1', capacidade: 4, ocupadas: 1, livres: 3,
    },
  ],
  cheios: [],
}

const SEM_VAGA = { de: '2026-08-22', ate: '2026-08-22', livres: [], cheios: [] }

/** `GET /catalogo` — o que a conta oferece, e quem atende. */
const CATALOGO = {
  profissionais: [
    { profissionalId: '2b7e', nome: 'Marina' },
    { profissionalId: '9c1d', nome: 'Carol' },
  ],
  servicos: [
    { servicoId: 'p1', nome: 'Pilates solo' },
    { servicoId: 'f2', nome: 'Fisioterapia' },
  ],
  locais: [{ localId: '6d33', nome: 'Sala 1' }],
  vocabulario: { servico: { singular: 'Aula' } },
}

const MARCOU = {
  participacaoId: '5e90', pessoaId: '77c0', sessaoId: 'a41f',
  origem: 'avulso', status: 'esperada',
}

/** Roda o mapeamento do preset contra a resposta, como o servidor faria. */
function valoresDoPreset(presetId: string, json: unknown): Record<string, string> {
  const preset = acharPreset(presetId)
  if (!preset) throw new Error(`preset ${presetId} sumiu`)

  const valores: Record<string, string> = {}
  // Os quatro argumentos, na mesma ordem que `resolverHttp` usa no servidor —
  // esquecer o `rotulo` aqui faria o teste passar com o menu errado.
  for (const { variavel, caminho, unicos, rotulo, quantos } of preset.dados.mapear) {
    valores[variavel] = extrair(json, caminho, unicos ?? false, rotulo, quantos ?? false)
  }
  return valores
}

/**
 * Tudo que a pessoa lê.
 *
 * Inclui a mensagem interativa: uma pergunta com botões sai como
 * `enviar_opcoes`, e o texto dela é tão lido quanto o de um `enviar_texto`.
 * Olhar só o segundo faria o teste dizer que o bot ficou mudo justamente onde
 * ele fez a pergunta.
 */
const textos = (acoes: Acao[]) =>
  acoes.flatMap((a) =>
    a.tipo === 'enviar_texto' || a.tipo === 'enviar_opcoes' ? [a.texto] : [],
  )

const opcoesDe = (acoes: Acao[]) =>
  acoes.flatMap((a) => (a.tipo === 'enviar_opcoes' ? a.opcoes : []))

/** A conversa começa com o telefone de quem escreveu, como o webhook entrega. */
const comeco = (telefone = '5544998887766'): Sessao => ({
  ...sessaoNova(),
  vars: { telefone },
})

describe('os caminhos do mapeamento batem com o que a API responde', () => {
  it('reconhecer traz o total, o id e o nome', () => {
    expect(valoresDoPreset('verandi-quem-e', ACHOU)).toEqual({
      encontrado: '1',
      pessoa_id: '77c0',
      nome_na_agenda: 'Marina Alves',
    })
  })

  it('não achar traz total 0 e o resto vazio — e isso é caminho normal', () => {
    expect(valoresDoPreset('verandi-quem-e', NAO_ACHOU)).toEqual({
      encontrado: '0',
      pessoa_id: '',
      nome_na_agenda: '',
    })
  })

  it('os horários e os ids saem na mesma ordem, que é o que amarra o menu', () => {
    expect(valoresDoPreset('verandi-horarios', DISPONIBILIDADE)).toEqual({
      // O rótulo diz a hora **e qual aula é** — "07:00" sozinho não responde a
      // pergunta que sempre vem em seguida.
      horarios: '07:00 · Pilates solo;10:00 · Pilates solo',
      horarios_id: 'a41f;b52g',
      horarios_prof: 'Marina;Carol',
      // Vazio aqui é "não há horário cheio", e é diferente de não haver horário.
      lotados: '',
      lotados_id: '',
    })
  })

  it('o menu de dias não repete a mesma data uma vez por horário', () => {
    expect(valoresDoPreset('verandi-dias', DISPONIBILIDADE)).toEqual({
      dias_livres: '2026-08-21',
    })
  })

  it('dia sem vaga devolve lista vazia, e a pergunta sai pela saída "veio vazia"', () => {
    expect(valoresDoPreset('verandi-horarios', SEM_VAGA).horarios).toBe('')
  })
})

describe('a conversa inteira, do "oi" ao horário marcado', () => {
  /** Responde a chamada de API que o motor acabou de pedir. */
  const responder = (r: Resultado, presetId: string, json: unknown) =>
    executar(agendamento, r.sessao, {
      tipo: 'http_respondeu',
      valores: valoresDoPreset(presetId, json),
    })

  /**
   * Do "oi" até a pergunta da data, para quem a agenda já conhece.
   *
   * O caminho ganhou dois passos que quem opera pediu — conferir o telefone e
   * escolher a modalidade —, e repeti-los em cinco testes esconderia o que cada
   * um está de fato conferindo.
   */
  const ateAData = (): Resultado => {
    let r = executar(agendamento, comeco(), { tipo: 'inicio' })
    r = responder(r, 'verandi-quem-e', ACHOU)
    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'sim' })
    r = responder(r, 'verandi-catalogo', CATALOGO)
    return executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'd1' })
  }

  it('quem já é aluna é chamada pelo nome e marca sem dizer quem é', () => {
    let r = executar(agendamento, comeco(), { tipo: 'inicio' })
    expect(r.acoes[0]?.tipo).toBe('chamar_http')

    r = responder(r, 'verandi-quem-e', ACHOU)
    expect(textos(r.acoes).join(' ')).toContain('Marina Alves')

    /*
     * O telefone é conferido antes de tudo.
     *
     * Pedido de quem opera, e não formalidade: quem escreve pelo aparelho de
     * outra pessoa marcaria a aula na ficha errada, e o erro só apareceria com
     * as duas no estúdio.
     */
    expect(textos(r.acoes).join(' ')).toContain('5544998887766')

    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'sim' })
    r = responder(r, 'verandi-catalogo', CATALOGO)

    // As modalidades saem do catálogo da conta, e não de botões escritos aqui.
    expect(opcoesDe(r.acoes).map((o) => o.rotulo)).toEqual([
      'Pilates solo',
      'Fisioterapia',
    ])

    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'd1' })
    expect(r.sessao.vars.servico_id).toBe('p1')
    expect(textos(r.acoes).join(' ')).toContain('21/08/2026')

    r = executar(agendamento, r.sessao, { tipo: 'texto', texto: '21/08/2026' })

    /*
     * **A busca vai filtrada pela modalidade.** Sem o `servico=`, o menu
     * ofereceria fisioterapia para quem escolheu pilates, e o erro só
     * apareceria com a pessoa já no estúdio.
     */
    const busca = r.acoes.find((a) => a.tipo === 'chamar_http')
    if (busca?.tipo !== 'chamar_http') throw new Error('faltou buscar horários')
    expect(busca.url).toContain('servico=p1')

    r = responder(r, 'verandi-horarios-da-modalidade', DISPONIBILIDADE)

    // O menu mostra o que a pessoa lê; os ids ficam guardados ao lado. Com a
    // modalidade já escolhida, o rótulo usa o professor para diferenciar.
    expect(opcoesDe(r.acoes).map((o) => o.rotulo)).toEqual([
      '07:00 · Marina',
      '10:00 · Carol',
    ])

    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'd1' })
    expect(r.sessao.vars.sessao_id).toBe('a41f')
    expect(r.sessao.vars.pessoa_id).toBe('77c0')

    // A confirmação repete modalidade, dia e hora antes de gravar qualquer coisa.
    const conferindo = textos(r.acoes).join(' ')
    expect(conferindo).toContain('Pilates solo')
    expect(conferindo).toContain('21/08/2026')
    expect(conferindo).toContain('07:00')

    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'sim' })

    // **A prova do modelo inteiro:** o `POST` sai com o id do horário, e não
    // com "07:00". Errar aqui é o defeito que valida, publica e não funciona.
    const chamada = r.acoes.find((a) => a.tipo === 'chamar_http')
    if (chamada?.tipo !== 'chamar_http') throw new Error('faltou a chamada de marcar')
    expect(chamada.metodo).toBe('POST')
    expect(chamada.corpo).toContain('"sessaoId": "a41f"')

    r = responder(r, 'verandi-marcar', MARCOU)
    // A confirmação usa a data como a pessoa escreveu, e não a padronizada.
    expect(textos(r.acoes).join(' ')).toContain('21/08/2026 às 07:00')
  })

  /*
   * O telefone de outra pessoa não vira agendamento sozinho.
   *
   * É o ramo que a pergunta de conferência existe para pegar: seguir aqui
   * marcaria a aula na ficha de quem não pediu.
   */
  it('telefone que não é da pessoa vai para a recepção, e não marca nada', () => {
    let r = executar(agendamento, comeco(), { tipo: 'inicio' })
    r = responder(r, 'verandi-quem-e', ACHOU)
    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'nao' })

    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
    expect(r.acoes.some((a) => a.tipo === 'chamar_http')).toBe(false)
  })

  it('quem é novo é cadastrado antes de escolher horário', () => {
    let r = executar(agendamento, comeco('5544911112222'), { tipo: 'inicio' })
    r = responder(r, 'verandi-quem-e', NAO_ACHOU)

    expect(textos(r.acoes).join(' ')).toContain('Como posso te chamar?')

    r = executar(agendamento, r.sessao, { tipo: 'texto', texto: 'Bia Nova' })
    const chamada = r.acoes.find((a) => a.tipo === 'chamar_http')
    if (chamada?.tipo !== 'chamar_http') throw new Error('faltou o cadastro')
    expect(chamada.corpo).toContain('"nome": "Bia Nova"')

    r = responder(r, 'verandi-cadastrar', { pessoaId: 'novo1', nome: 'Bia Nova' })
    expect(r.sessao.vars.pessoa_id).toBe('novo1')

    // Quem acabou de se cadastrar também escolhe a modalidade antes do dia.
    r = responder(r, 'verandi-catalogo', CATALOGO)
    expect(textos(r.acoes).join(' ')).toContain('Qual aula')
  })

  it('a data escrita errado é recusada com a frase do estúdio, sem sair da pergunta', () => {
    let r = ateAData()
    r = executar(agendamento, r.sessao, { tipo: 'texto', texto: 'sexta que vem' })

    expect(textos(r.acoes).join(' ')).toContain('citando dia / mês / ano')
    expect(r.sessao.noAtual).toBe('qual-dia')
  })

  it('dia sem vaga oferece outro dia, e voltar cai na mesma pergunta', () => {
    let r = ateAData()
    r = executar(agendamento, r.sessao, { tipo: 'texto', texto: '22/08/2026' })
    r = responder(r, 'verandi-horarios-da-modalidade', SEM_VAGA)

    // A frase agora diz **qual** modalidade não tem vaga: "não temos horário"
    // num dia cheio de outra aula é a informação errada.
    expect(textos(r.acoes).join(' ')).toContain('Pilates solo')

    // "Escolher outro dia" volta para a pergunta da data: duas setas chegando
    // no mesmo bloco, que é o desenho que todo "voltar ao menu" precisa.
    r = executar(agendamento, r.sessao, { tipo: 'opcao', opcaoId: 'outro-dia' })
    expect(r.sessao.noAtual).toBe('qual-dia')
  })

  it('a data padronizada é a que vai para a API, e a escrita é a que a pessoa lê', () => {
    let r = ateAData()
    r = executar(agendamento, r.sessao, { tipo: 'texto', texto: '21/08/2026' })

    expect(r.sessao.vars.dia).toBe('2026-08-21')
    expect(r.sessao.vars.dia_escrito).toBe('21/08/2026')

    const chamada = r.acoes.find((a) => a.tipo === 'chamar_http')
    if (chamada?.tipo !== 'chamar_http') throw new Error('faltou buscar horários')
    expect(chamada.url).toContain('de=2026-08-21')
  })
})
