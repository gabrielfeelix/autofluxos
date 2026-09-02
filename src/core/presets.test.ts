import { describe, expect, it } from 'vitest'
import { fluxoSchema, noHttpSchema } from './flow/schema'
import { validar } from './flow/validar'
import { PRESETS, acharPreset, exigeCredencial, presetDoBloco } from './presets'

/**
 * Os presets de integração (B6).
 *
 * **O que precisa ser provado é que o que eles preenchem publica.** Um preset
 * que produz um bloco inválido é pior do que não existir: a pessoa clica em
 * "aplicar", acha que resolveu, e descobre na hora de publicar que o desenho
 * não passa — com uma lista de erros sobre um bloco que ela não escreveu.
 */
describe('cada preset produz um bloco de API válido', () => {
  it.each(PRESETS.map((preset) => preset.id))('%s tem forma de bloco `http`', (id) => {
    const preset = acharPreset(id)!

    // O schema é o mesmo que o editor grava e o motor lê. Se o preset não
    // passar por aqui, ele nunca chegaria ao banco.
    const bloco = noHttpSchema.parse({
      id: 'api',
      type: 'http',
      position: { x: 0, y: 0 },
      data: preset.dados,
    })

    expect(bloco.data.url.startsWith('https://')).toBe(true)
    // Host vindo de `{{variavel}}` deixaria quem conversa escolher com qual
    // servidor o cliente fala. O validador recusa, e nenhum preset pode nascer
    // recusado.
    expect(/^https:\/\/[^/]*\{\{/.test(bloco.data.url)).toBe(false)
  })

  it.each(PRESETS.map((preset) => preset.id))('%s publica dentro de um fluxo', (id) => {
    const preset = acharPreset(id)!

    const fluxo = fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        { id: 'api', type: 'http', position: { x: 0, y: 0 }, data: preset.dados },
        {
          id: 'humano',
          type: 'handoff',
          position: { x: 0, y: 160 },
          data: { mensagem: 'já te passo', motivo: 'fim' },
        },
      ],
      edges: [{ id: 'e1', source: 'api', target: 'humano' }],
    })

    const conferido = validar(fluxo, { iaHabilitada: false, conexoes: [] })
    expect(conferido.ok, JSON.stringify(conferido.ok ? [] : conferido.erros)).toBe(true)
  })
})

describe('o que os presets escolhem, e por quê', () => {
  it('só quem apenas avisa um sistema segue em frente; o resto chama uma pessoa', () => {
    /**
     * **A régua não é o verbo, e por um tempo pareceu ser.**
     *
     * Enquanto os presets eram CRM e planilha, `GET` e `POST` separavam certo
     * por acidente: as leituras eram todas assunto da conversa e as escritas
     * eram todas avisos. A agenda quebrou a coincidência — `POST /participacoes`
     * é escrita, e falhar nela significa prometer um horário que ninguém marcou.
     *
     * A pergunta que decide é outra: **a conversa depende do resultado?**
     *
     * - **Não depende** — o lead já está no nosso banco, e o bloco só avisa a
     *   RD, a planilha ou um webhook. Não ter chegado lá é problema de
     *   sincronia, não de atendimento; handoff encheria a fila com conversas que
     *   não precisam de ninguém.
     * - **Depende** — consultar horário livre, reconhecer quem chegou, marcar,
     *   desmarcar, entrar na fila. Seguir em frente aqui entrega uma pergunta
     *   sem resposta possível, um cadastro duplicado, ou uma promessa que
     *   ninguém cumpre. Uma pessoa assume.
     */
    const SO_AVISAM = new Set(['rd-station-conversao', 'google-sheets-linha', 'webhook'])

    for (const preset of PRESETS) {
      const esperado = SO_AVISAM.has(preset.id) ? 'seguir' : 'humano'
      expect(preset.dados.aoFalhar, preset.id).toBe(esperado)
    }
  })

  it('nenhum deles carrega credencial no corpo, no endereço ou no cabeçalho', () => {
    // A credencial entra por `conexaoId`, resolvida no servidor. Um preset com
    // a chave escrita viraria segredo dentro de `flow_versions`, que é imutável
    // — não haveria como tirar depois.
    for (const preset of PRESETS) {
      const tudo = [
        preset.dados.url,
        preset.dados.corpo,
        ...preset.dados.cabecalhos.map((c) => `${c.chave}: ${c.valor}`),
      ].join('\n')

      expect(/api[_-]?key\s*[=:]\s*\S/i.test(tudo)).toBe(false)
      expect(/Bearer\s+\S/i.test(tudo)).toBe(false)
    }
  })

  it('a RD guarda o id do evento — é o que prova que a integração rodou', () => {
    const rd = acharPreset('rd-station-conversao')!
    expect(rd.dados.mapear).toEqual([{ variavel: 'rd_evento', caminho: 'event_uuid' }])
  })
})

/**
 * Reconhecer o preset que um bloco já usa.
 *
 * Existe para a gaveta fechada poder dizer o que o bloco é — quem monta fluxo
 * relatou que *"se essa tela é minimizada não conseguimos identificar se está
 * funcional"*. A conferência aqui é de que ela acerta e, mais importante, de
 * que ela **não** afirma preset onde não há.
 */
describe('qual preset um bloco já está usando', () => {
  it('acha pelo endereço, mesmo com a consulta preenchida', () => {
    const horarios = acharPreset('verandi-horarios')!
    const achado = presetDoBloco({
      metodo: 'GET',
      url: 'https://verandi.4yu.com.br/api/v1/disponibilidade?de=2026-08-21&ate=2026-08-21',
      mapear: horarios.dados.mapear,
    })
    expect(achado?.id).toBe('verandi-horarios')
  })

  /*
   * Duas integrações moram no mesmo endereço, e o que as separa é o que elas
   * guardam: "quais dias têm vaga" traz `dias_livres`, "quais horários deste
   * dia" traz o par `horarios` + `horarios_id`.
   */
  it('desempata pelo que o bloco guarda quando o endereço é o mesmo', () => {
    const dias = acharPreset('verandi-dias')!
    expect(
      presetDoBloco({ metodo: 'GET', url: dias.dados.url, mapear: dias.dados.mapear })?.id,
    ).toBe('verandi-dias')

    const horarios = acharPreset('verandi-horarios')!
    expect(
      presetDoBloco({ metodo: 'GET', url: horarios.dados.url, mapear: horarios.dados.mapear })?.id,
    ).toBe('verandi-horarios')
  })

  /*
   * Sem o mapeamento não dá para desempatar, e aí o certo é calar.
   *
   * Anunciar "quais dias têm vaga" num bloco que busca horário seria a tela
   * afirmando com confiança algo que ela não sabe — e quem lê a gaveta fechada
   * lê justamente para não precisar abrir.
   */
  it('empate sem mapeamento não anuncia preset nenhum', () => {
    expect(
      presetDoBloco({
        metodo: 'GET',
        url: 'https://verandi.4yu.com.br/api/v1/disponibilidade?de=x&ate=y',
      }),
    ).toBeUndefined()
  })

  it('o método faz parte da identidade — mesma rota com verbo diferente é outro bloco', () => {
    // `/participacoes` é POST no preset de marcar e DELETE no de desmarcar.
    expect(
      presetDoBloco({ metodo: 'POST', url: 'https://verandi.4yu.com.br/api/v1/participacoes' })?.id,
    ).toBe('verandi-marcar')
  })

  it('bloco montado à mão não vira preset nenhum', () => {
    expect(presetDoBloco({ metodo: 'GET', url: 'https://viacep.com.br/ws/01310100/json/' })).toBeUndefined()
  })

  it('bloco vazio não vira preset nenhum', () => {
    expect(presetDoBloco({ metodo: 'GET', url: '' })).toBeUndefined()
    expect(presetDoBloco({ metodo: 'GET', url: '   ' })).toBeUndefined()
  })

  /*
   * Cada preset se reconhece a partir dos próprios dados.
   *
   * Sem isto, um preset novo com rota parecida com a de outro passaria a ser
   * anunciado com o nome errado na gaveta fechada — e a tela estaria mentindo
   * com toda a confiança.
   */
  it.each(PRESETS.map((preset) => preset.id))('%s se reconhece', (id) => {
    const preset = acharPreset(id)!
    expect(
      presetDoBloco({
        metodo: preset.dados.metodo,
        url: preset.dados.url,
        mapear: preset.dados.mapear,
      })?.id,
    ).toBe(id)
  })
})

/**
 * O que a agenda passou a responder depois do pedido de quem opera.
 *
 * Os dois casos abaixo são citações de um pedido só: *"ao identificar o aluno,
 * ele conseguir salvar essa informação para que já possamos informar ao
 * aluno"*, e *"ele consulta primeiro a modalidade que a pessoa citou"*.
 */
describe('a agenda responde o que a conversa precisa dizer', () => {
  it('a ficha traz o número de reposições, e não só a lista delas', () => {
    const ficha = acharPreset('verandi-minha-agenda')!
    const contagem = ficha.dados.mapear.find((m) => m.variavel === 'quantas_reposicoes')

    expect(contagem?.quantos).toBe(true)
    // Contar exige `[]`: sem ele a variável viria `1` para todo mundo.
    expect(contagem?.caminho).toContain('[]')
  })

  it('a ficha traz o nome, para a saudação não sair com o nome vazio', () => {
    const ficha = acharPreset('verandi-minha-agenda')!
    expect(ficha.dados.mapear.some((m) => m.variavel === 'nome_na_agenda')).toBe(true)
  })

  it('a busca por modalidade filtra na origem, e não peneira aqui', () => {
    const filtrado = acharPreset('verandi-horarios-da-modalidade')!
    // Peneirar do nosso lado esbarraria no teto de 10 itens do menu, que
    // cortaria antes da peneira — escondendo os horários da modalidade pedida.
    expect(filtrado.dados.url).toContain('servico={{servico_id}}')
  })

  /*
   * O par que faz o menu virar agendamento não pode ter "sem repetir".
   *
   * Tirar um item de um lado desloca os valores do outro, e o agendamento vai
   * para o horário de outra pessoa. Vale para todo preset que monte um par.
   */
  it('nenhuma lista pareada com ids está marcada como "sem repetir"', () => {
    for (const preset of PRESETS) {
      const temPar = preset.dados.mapear.some((m) => m.variavel.endsWith('_id') && m.caminho.includes('[]'))
      if (!temPar) continue

      for (const item of preset.dados.mapear) {
        if (item.caminho.includes('[]')) {
          expect(item.unicos ?? false, `${preset.id} · ${item.variavel}`).toBe(false)
        }
      }
    }
  })
})

/**
 * A cobrança de credencial precisa estar certa **nas duas direções**.
 *
 * Quem montou o primeiro fluxo de agendamento encontrou os dois lados no mesmo
 * dia: um preset que exige chave e uma tela que não dizia onde cadastrar, e um
 * preset que não exige nenhuma sendo acusado de estar sem ela. O segundo é o
 * pior — um aviso que mente treina a ignorar o aviso que acerta.
 */
describe('quem exige credencial e quem não exige', () => {
  it('o sistema próprio do cliente não exige — o endereço dele pode ser aberto', () => {
    const meu = PRESETS.find((p) => p.nome === 'O meu próprio sistema')
    expect(meu).toBeDefined()
    expect(exigeCredencial(meu!)).toBe(false)
  })

  it('a agenda exige, porque a chave é o que separa um cliente do outro', () => {
    const reconhecer = acharPreset('verandi-quem-e')
    expect(reconhecer).toBeDefined()
    expect(exigeCredencial(reconhecer!)).toBe(true)
  })

  it('nenhum preset de agenda escapa da cobrança', () => {
    const agenda = PRESETS.filter((p) => p.grupo === 'agenda')
    expect(agenda.length).toBeGreaterThan(0)
    expect(agenda.every(exigeCredencial)).toBe(true)
  })
})
