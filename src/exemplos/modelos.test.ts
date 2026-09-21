import { describe, expect, it } from 'vitest'
import { validar } from '@/core/flow/validar'
import { lembrete } from './lembrete'
import { naoComparecimento } from './nao-comparecimento'
import { MODELOS } from './modelos'
import { reagendamento } from './reagendamento'

/**
 * **Todo modelo tem que publicar.**
 *
 * Um modelo que produz um fluxo inválido é pior do que não existir: a pessoa
 * escolhe, acha que resolveu, e a primeira coisa que vê ao clicar em Publicar é
 * uma lista de erros sobre um desenho que ela não fez.
 */
describe('os modelos de fluxo', () => {
  it.each(MODELOS.map((modelo) => modelo.id))('%s nasce válido', (id) => {
    const modelo = MODELOS.find((m) => m.id === id)!
    const conferido = validar(modelo.grafo, { iaHabilitada: false, conexoes: [] })

    expect(conferido.ok, JSON.stringify(conferido.ok ? [] : conferido.erros)).toBe(true)
  })

  it('nenhum usa IA — ela é plano à parte e o validador recusaria', () => {
    for (const modelo of MODELOS) {
      expect(modelo.grafo.nodes.some((no) => no.type === 'ia')).toBe(false)
    }
  })

  it('todos têm saída para uma pessoa', () => {
    // É a regra que `publicar()` cobra, e a que impede um fluxo de virar um
    // beco onde alguém fica preso conversando com um robô.
    for (const modelo of MODELOS) {
      expect(modelo.grafo.nodes.some((no) => no.type === 'handoff')).toBe(true)
    }
  })
})

/**
 * Os dois fluxos que quem opera descreveu falando.
 *
 * O teste de validade acima já prova que eles publicam. O que falta provar é
 * que fazem **o que foi pedido** — e cada caso abaixo é uma frase do pedido
 * virada em conferência, porque é o tipo de coisa que se perde na primeira
 * refatoração que "arruma" o desenho.
 */
describe('o reagendamento faz o que quem opera descreveu', () => {
  const nos = new Map(reagendamento.nodes.map((no) => [no.id, no]))

  it('a saudação diz o nome e o número de reposições na mesma mensagem', () => {
    const ola = nos.get('ola')
    if (ola?.type !== 'mensagem') throw new Error('sumiu a saudação')

    const texto = (ola.data.partes ?? [])
      .map((p) => (p.tipo === 'texto' ? p.texto : ''))
      .join(' ')

    // "Ele já identificou o nome do aluno" + "você tem x aulas para repor".
    expect(texto).toContain('{{nome_na_agenda}}')
    expect(texto).toContain('{{quantas_reposicoes}}')
  })

  /*
   * A saudação vem **depois** das duas chamadas.
   *
   * É o defeito que quem opera viu na tela: uma mensagem que chega antes do
   * dado sai com o nome vazio. Conferir a ordem aqui é o que impede alguém de
   * "simplificar" o desenho movendo a saudação para o começo.
   */
  it('a saudação só sai depois de reconhecer e de ler a ficha', () => {
    const ate = (alvo: string) => {
      const passos: string[] = []
      let atual: string | undefined = reagendamento.inicio
      while (atual && atual !== alvo && passos.length < 20) {
        passos.push(atual)
        const saida: { target: string } | undefined = reagendamento.edges.find(
          (e) => e.source === atual && (e.sourceHandle ?? '') !== 'falso',
        )
        atual = saida?.target
      }
      return passos
    }

    const antes = ate('ola')
    expect(antes).toContain('reconhecer')
    expect(antes).toContain('ficha')
  })

  it('mais de uma reposição sai da automação e vai para uma pessoa', () => {
    const alvo = reagendamento.edges.find(
      (e) => e.source === 'mais-de-uma' && e.sourceHandle === 'verdadeiro',
    )?.target
    expect(nos.get(alvo ?? '')?.type).toBe('handoff')
  })

  it('nenhuma reposição vira conversa, e não menu vazio', () => {
    const alvo = reagendamento.edges.find(
      (e) => e.source === 'tem-reposicao' && e.sourceHandle === 'verdadeiro',
    )?.target
    expect(alvo).toBe('sem-reposicao')
  })

  it('a agenda só é escrita depois de a pessoa confirmar', () => {
    const antesDeMarcar = reagendamento.edges
      .filter((e) => e.target === 'marcar')
      .map((e) => e.source)
    expect(antesDeMarcar).toEqual(['confere'])
  })

  it('a confirmação repete nome, dia e hora', () => {
    const fim = nos.get('confirmado')
    if (fim?.type !== 'mensagem') throw new Error('sumiu a confirmação')

    const texto = (fim.data.partes ?? [])
      .map((p) => (p.tipo === 'texto' ? p.texto : ''))
      .join(' ')
    expect(texto).toContain('{{nome_na_agenda}}')
    expect(texto).toContain('{{dia_escrito}}')
    expect(texto).toContain('{{horario}}')
  })
})

describe('o lembrete não faz mais do que lembrar', () => {
  const nos = new Map(lembrete.nodes.map((no) => [no.id, no]))

  it('avisar que não vem desmarca de verdade, e devolve a vaga', () => {
    const alvo = lembrete.edges.find(
      (e) => e.source === 'vem-ou-nao' && e.sourceHandle === 'nao-vou',
    )?.target
    const no = nos.get(alvo ?? '')
    if (no?.type !== 'http') throw new Error('avisar que não vem tinha que desmarcar')
    expect(no.data.metodo).toBe('DELETE')
  })

  /*
   * **Silêncio não desmarca.** É a decisão mais importante deste fluxo: quem
   * não respondeu pode estar dirigindo, e liberar a vaga de quem ia aparecer é
   * pior do que a vaga ociosa de quem faltou.
   */
  it('não responder não cancela nada', () => {
    const alvo = lembrete.edges.find(
      (e) => e.source === 'vem-ou-nao' && e.sourceHandle === 'timeout',
    )?.target
    expect(nos.get(alvo ?? '')?.type).toBe('handoff')
  })

  it('remarcar tem dono, e não vira outro fluxo por conta própria', () => {
    const alvo = lembrete.edges.find(
      (e) => e.source === 'vem-ou-nao' && e.sourceHandle === 'remarcar',
    )?.target
    expect(nos.get(alvo ?? '')?.type).toBe('handoff')
  })

  it('quem não tem aula marcada ouve isso, em vez de um menu vazio', () => {
    const alvo = lembrete.edges.find(
      (e) => e.source === 'qual-aula' && e.sourceHandle === 'vazio',
    )?.target
    expect(alvo).toBe('nada-marcado')
  })
})

/*
 * O fluxo que o áudio de quem opera descreveu, ponto a ponto.
 *
 * A regra do prazo é da conta, e mora na Verandi. O que estes testes protegem é
 * que ela continue morando lá: o dia em que alguém escrever "2h" neste grafo, a
 * frase passa a mentir para todo estúdio que configurar outra coisa.
 */
describe('avisar que não vai à aula', () => {
  const nos = new Map(naoComparecimento.nodes.map((no) => [no.id, no]))

  it('o prazo não está escrito no fluxo, em lugar nenhum', () => {
    const texto = JSON.stringify(naoComparecimento)
    // nem o número do MGM, nem "horas de antecedência" redigido à mão
    expect(texto).not.toMatch(/\b2\s?h\b/i)
    expect(texto).not.toMatch(/duas horas/i)
  })

  it('a frase de fora do prazo vem da agenda, e não do grafo', () => {
    const no = nos.get('confirma-fora-do-prazo')
    if (no?.type !== 'pergunta') throw new Error('o aviso tinha que ser uma pergunta')
    // o texto inteiro é a variável: quem escreve a frase é a Verandi
    expect(no.data.texto).toBe('{{aviso_do_prazo}}')
  })

  it('quem avisa em cima da hora cancela do mesmo jeito', () => {
    // a vaga abre para quem está na fila; o que se perde é a reposição, e
    // recusar o cancelamento faria a pessoa só não aparecer
    const alvo = naoComparecimento.edges.find(
      (e) => e.source === 'confirma-fora-do-prazo' && e.sourceHandle === 'sim',
    )?.target
    const no = nos.get(alvo ?? '')
    if (no?.type !== 'http') throw new Error('confirmar fora do prazo tinha que desmarcar')
    expect(no.data.metodo).toBe('DELETE')
  })

  it('o veredito de cada aula vem com o id dela no pedido', () => {
    const no = nos.get('confere-prazo')
    if (no?.type !== 'http') throw new Error('o fluxo tinha que perguntar pela aula escolhida')
    expect(no.data.url).toContain('{{participacao_id}}')
  })

  /*
   * O desfecho lê o que a agenda gravou, e não o ramo que trouxe até aqui: a
   * pessoa pode ter passado do prazo enquanto decidia, e "sua reposição fica
   * guardada" seria uma promessa que a agenda não vai cumprir.
   */
  it('a mensagem final vem do que a agenda gravou', () => {
    const no = nos.get('teve-credito')
    if (no?.type !== 'condicao') throw new Error('faltou conferir o que foi gravado')
    expect(no.data.variavel).toBe('situacao')
    expect(no.data.valor).toBe('falta_avisada')
  })

  it('silêncio não cancela, em nenhuma das duas confirmações', () => {
    for (const origem of ['confirma-no-prazo', 'confirma-fora-do-prazo']) {
      const alvo = naoComparecimento.edges.find(
        (e) => e.source === origem && e.sourceHandle === 'timeout',
      )?.target
      expect(nos.get(alvo ?? '')?.type, origem).toBe('handoff')
    }
  })

  it('quem não tem aula marcada ouve isso, em vez de um menu vazio', () => {
    const alvo = naoComparecimento.edges.find(
      (e) => e.source === 'qual-aula' && e.sourceHandle === 'vazio',
    )?.target
    expect(alvo).toBe('nada-marcado')
  })
})
