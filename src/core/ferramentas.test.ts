import { describe, expect, it } from 'vitest'
import {
  FERRAMENTAS,
  acharFerramenta,
  ferramentasPermitidas,
  idsVistos,
  limparQueryVazia,
  nomesDeFerramenta,
  projetar,
} from './ferramentas'

/**
 * O catálogo que a IA enxerga.
 *
 * O que precisa ser provado aqui não é que os dados existem — é que as travas
 * são travas. Catálogo de ferramenta é a superfície por onde um modelo age no
 * sistema de um cliente; o teste que importa é o que tenta passar por ela.
 */

describe('o catálogo tem forma de catálogo', () => {
  it('não repete nome', () => {
    const nomes = nomesDeFerramenta()
    expect(new Set(nomes).size).toBe(nomes.length)
  })

  it('usa nome que um modelo consegue escrever sem errar', () => {
    // Acento e maiúscula viram fonte de erro silencioso: o modelo devolve
    // `agenda_horários`, o resolvedor não acha, e a conversa cai para humano
    // sem ninguém entender por quê.
    for (const nome of nomesDeFerramenta()) expect(nome).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('marca `escreve` de acordo com o verbo, sem exceção', () => {
    // O eixo que decide a política de aprovação não pode ser opinião de quem
    // escreveu a entrada do catálogo.
    for (const f of FERRAMENTAS) {
      expect(f.escreve).toBe(f.chamada.metodo !== 'GET')
    }
  })

  it('tem rótulo curto para a tela, diferente da descrição do modelo', () => {
    // Se alguém encher o rótulo com a argumentação do modelo, a lista de
    // caixinhas do editor vira três parágrafos por linha e ninguém lê.
    for (const f of FERRAMENTAS) {
      expect(f.rotulo.length).toBeGreaterThan(3)
      expect(f.rotulo.length).toBeLessThan(45)
      expect(f.rotulo).not.toBe(f.descricao)
    }
  })

  it('tem ferramenta dos dois lados do eixo ler/gravar', () => {
    // A tela separa em dois grupos. Um grupo vazio seria uma seção órfã, e
    // ninguém repara numa seção que some.
    expect(FERRAMENTAS.some((f) => f.escreve)).toBe(true)
    expect(FERRAMENTAS.some((f) => !f.escreve)).toBe(true)
  })

  it('descreve quando NÃO usar, e não só o que faz', () => {
    // É a metade que separa ferramentas parecidas. Sem ela o modelo escolhe a
    // primeira que soar perto, e erra em silêncio.
    for (const f of FERRAMENTAS) {
      expect(f.descricao.toLowerCase()).toMatch(/não (use|serve|há|chame)|nunca|somente|deixe vazio/)
    }
  })

  it('descreve todo argumento e diz o formato da data', () => {
    for (const f of FERRAMENTAS) {
      for (const a of f.argumentos) {
        expect(a.descricao.length).toBeGreaterThan(10)
        if (a.tipo === 'data') expect(a.descricao).toContain('AAAA-MM-DD')
      }
    }
  })

  it('não deixa o modelo preencher o que o servidor injeta', () => {
    // Se o mesmo nome estivesse nos dois lados, o catálogo estaria dizendo ao
    // modelo que ele pode escolher a identidade de quem sofre a ação.
    for (const f of FERRAMENTAS) {
      for (const injetado of f.injetados) {
        expect(f.argumentos.map((a) => a.nome)).not.toContain(injetado)
      }
    }
  })

  it('todo argumento e todo injetado aparece na chamada, e vice-versa', () => {
    // Argumento declarado que não é usado é argumento que o modelo preenche à
    // toa; marca na chamada sem declaração é chamada que sai com `{{x}}`
    // literal na URL.
    for (const f of FERRAMENTAS) {
      const declarados = new Set([...f.argumentos.map((a) => a.nome), ...f.injetados])
      const usados = new Set(
        [...`${f.chamada.url}${f.chamada.corpo}`.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map(
          (m) => m[1]!,
        ),
      )

      expect([...usados].sort()).toEqual([...declarados].sort())
    }
  })
})

describe('as travas do §4', () => {
  it('toda ferramenta que escreve age sobre quem está conversando, e não sobre um terceiro', () => {
    for (const f of FERRAMENTAS.filter((f) => f.escreve)) {
      // Ou o servidor injeta a identidade, ou o alvo é um id que só pode ter
      // vindo de uma leitura já escopada em quem conversa. Uma escrita que não
      // satisfaz nenhum dos dois aceita alvo escolhido pelo modelo.
      const injetaIdentidade = f.injetados.includes('pessoa_id')
      const alvoRastreado = f.argumentos.some((a) => a.obrigatorio && a.soDeResultadoAnterior)

      expect(injetaIdentidade || alvoRastreado).toBe(true)
    }
  })

  it('todo argumento do tipo `id` exige ter vindo de resultado anterior', () => {
    // Id não se inventa, se recebe. Um `id` sem a marca é um id que o modelo
    // pode alucinar — ou repetir de uma mensagem escrita por um estranho.
    for (const f of FERRAMENTAS) {
      for (const a of f.argumentos.filter((a) => a.tipo === 'id')) {
        expect(a.soDeResultadoAnterior).toBe(true)
      }
    }
  })

  it('nenhuma ferramenta consulta pessoa por nome', () => {
    // A regra escrita no PLANO-AGENDA §1, agora cobrada por teste:
    // `/pessoas?busca=` devolve nome e telefone de terceiros.
    for (const f of FERRAMENTAS) {
      expect(f.chamada.url).not.toContain('busca=')
    }
  })

  it('nenhuma projeção pede campo de ficha clínica', () => {
    // A API não devolve `observacao` hoje. O teste existe para o dia em que
    // alguém do outro lado resolver devolver: o catálogo continua não pedindo.
    const proibidos = ['observacao', 'observacoes', 'nascimento', 'cpf', 'telefone']
    for (const f of FERRAMENTAS) {
      for (const p of f.projecao) {
        for (const campo of p.campos ?? []) {
          expect(proibidos).not.toContain(campo.toLowerCase())
        }
      }
    }
  })

  it('toda lista projetada tem teto', () => {
    // Sem teto, um dia de agenda cheio afoga a pergunta no meio do contexto — e
    // é token pago em toda volta seguinte da conversa.
    for (const f of FERRAMENTAS) {
      for (const p of f.projecao) {
        if (p.campos !== undefined) expect(p.limite).toBeGreaterThan(0)
      }
    }
  })
})

describe('whitelist por nó', () => {
  it('devolve só o que foi pedido', () => {
    const permitidas = ferramentasPermitidas(['agenda_horarios', 'agenda_catalogo'])
    expect(permitidas.map((f) => f.nome)).toEqual(['agenda_horarios', 'agenda_catalogo'])
  })

  it('ignora nome que não existe em vez de estourar', () => {
    // Fluxo publicado é imutável. Uma conversa em andamento não pode morrer
    // porque o catálogo mudou embaixo dela.
    expect(ferramentasPermitidas(['agenda_catalogo', 'inventada']).map((f) => f.nome)).toEqual([
      'agenda_catalogo',
    ])
  })

  it('lista vazia devolve nada — que é a IA de hoje, texto puro', () => {
    expect(ferramentasPermitidas([])).toEqual([])
  })

  it('acharFerramenta devolve undefined para nome desconhecido', () => {
    expect(acharFerramenta('agenda_horarios')?.nome).toBe('agenda_horarios')
    expect(acharFerramenta('agenda_apagar_tudo')).toBeUndefined()
  })
})

describe('projetar recorta o que o modelo vê', () => {
  const resposta = {
    livres: [
      {
        sessaoId: 's1',
        data: '2026-09-10',
        hora: '07:00',
        servico: 'Pilates solo',
        profissional: 'Marina',
        // Campos que a API manda e que o catálogo não pede.
        capacidade: 6,
        observacao: 'lesão no ombro, não pode carga axial',
      },
      { sessaoId: 's2', data: '2026-09-10', hora: '10:00', servico: 'Yoga', profissional: 'Rita' },
    ],
    cheios: [{ data: '2026-09-10', hora: '08:00', servico: 'Pilates solo', sessaoId: 's3' }],
    naoPedido: 'isto não sai daqui',
  }

  const projecao = acharFerramenta('agenda_horarios')!.projecao

  it('mantém o par hora↔id dentro do mesmo objeto', () => {
    // É a razão de a projeção devolver objeto em vez de texto separado por `;`.
    // Achatado, o modelo repareia por posição — e marca a aula de outra pessoa.
    const saida = projetar(resposta, projecao) as { livres: Record<string, unknown>[] }

    expect(saida.livres[0]).toEqual({
      sessaoId: 's1',
      data: '2026-09-10',
      hora: '07:00',
      servico: 'Pilates solo',
      profissional: 'Marina',
    })
  })

  it('deixa de fora campo que a allow-list não pediu, mesmo quando a API manda', () => {
    const texto = JSON.stringify(projetar(resposta, projecao))

    expect(texto).not.toContain('observacao')
    expect(texto).not.toContain('carga axial')
    expect(texto).not.toContain('capacidade')
    expect(texto).not.toContain('naoPedido')
  })

  it('corta a lista no limite', () => {
    const muitos = { livres: Array.from({ length: 50 }, (_, i) => ({ sessaoId: `s${i}` })) }
    const saida = projetar(muitos, [{ caminho: 'livres', campos: ['sessaoId'], limite: 20 }]) as {
      livres: unknown[]
    }

    expect(saida.livres).toHaveLength(20)
  })

  it('omite o que não veio, em vez de mandar null', () => {
    // `null` gasta token e convida o modelo a comentar que não sabe daquilo.
    const saida = projetar({ livres: [{ sessaoId: 's1' }] }, projecao) as {
      livres: Record<string, unknown>[]
    }

    expect(saida.livres[0]).toEqual({ sessaoId: 's1' })
    expect(saida).not.toHaveProperty('cheios')
  })

  it('leva valor simples inteiro quando não há campos', () => {
    expect(projetar({ status: 'confirmada' }, [{ caminho: 'status' }])).toEqual({
      status: 'confirmada',
    })
  })

  it('desce por caminho com ponto e usa o último pedaço como chave', () => {
    expect(projetar({ conta: { vocabulario: { aula: 'sessão' } } }, [
      { caminho: 'conta.vocabulario' },
    ])).toEqual({ vocabulario: { aula: 'sessão' } })
  })

  it('não estoura quando o caminho não existe', () => {
    expect(projetar({}, projecao)).toEqual({})
    expect(projetar(null, projecao)).toEqual({})
  })
})

describe('idsVistos alimenta a trava de id', () => {
  it('acha id em lista e em objeto solto', () => {
    const vistos = idsVistos({
      livres: [{ sessaoId: 's1' }, { sessaoId: 's2' }],
      participacaoId: 'p9',
    })

    expect([...vistos].sort()).toEqual(['p9', 's1', 's2'])
  })

  it('não recolhe campo que não é id', () => {
    const vistos = idsVistos({ livres: [{ sessaoId: 's1', servico: 'Pilates', hora: '07:00' }] })

    expect([...vistos]).toEqual(['s1'])
  })

  it('acumula entre chamadas da mesma conversa', () => {
    const vistos = idsVistos({ servicos: [{ servicoId: 'x1' }] })
    idsVistos({ livres: [{ sessaoId: 's1' }] }, vistos)

    expect([...vistos].sort()).toEqual(['s1', 'x1'])
  })

  it('ignora id vazio', () => {
    // String vazia como id passaria em qualquer conferência e não identifica
    // nada — deixá-la entrar é abrir a trava por acidente.
    expect([...idsVistos({ sessaoId: '' })]).toEqual([])
  })
})

describe('limparQueryVazia faz o filtro opcional ser opcional', () => {
  it('tira o filtro que o modelo não informou', () => {
    expect(
      limparQueryVazia(
        'https://x/disponibilidade?de=2026-09-10&ate=2026-09-10&servico=&profissional=',
      ),
    ).toBe('https://x/disponibilidade?de=2026-09-10&ate=2026-09-10')
  })

  it('mantém o filtro que veio preenchido', () => {
    expect(limparQueryVazia('https://x/d?de=1&servico=&profissional=p1')).toBe(
      'https://x/d?de=1&profissional=p1',
    )
  })

  it('some com o `?` quando não sobra nada', () => {
    expect(limparQueryVazia('https://x/d?servico=&profissional=')).toBe('https://x/d')
  })

  it('não mexe em URL sem busca', () => {
    expect(limparQueryVazia('https://x/participacoes/abc')).toBe('https://x/participacoes/abc')
  })

  it('preserva valor em base64, que termina em `=` e não está vazio', () => {
    expect(limparQueryVazia('https://x/d?t=YWJj==&vazio=')).toBe('https://x/d?t=YWJj==')
  })
})
