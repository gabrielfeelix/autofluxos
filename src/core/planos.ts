/**
 * Os planos: preço, faixa de conversa, e o que cada um libera.
 *
 * **Este arquivo é o único lugar do repositório onde preço existe.** A landing
 * page lê daqui e a tela de assinatura lê daqui, e a razão é a falha que a
 * duplicação causa: duas listas de preço é como o site passa a anunciar o que o
 * sistema não cobra, e ninguém descobre isso por revisão de código, descobre
 * por cliente reclamando.
 *
 * Puro, sem banco e sem React, pelo mesmo motivo de `core/nps.ts`: é dado e
 * aritmética, e dado tem que dar para testar sem subir servidor.
 *
 * As decisões que este arquivo materializa estão em
 * `docs/PLANO-16-SET-PRODUTO-E-PRECO.md`. As três que importam para quem ler só
 * o código:
 *
 * 1. **A unidade é conversa, e atendente é ilimitado nos três.** O produto
 *    existe para o cliente precisar de menos gente atendendo; cobrar por
 *    atendente é cobrar pela métrica que o produto promete reduzir.
 * 2. **O eixo que separa as faixas é custo, não recurso.** O que é software
 *    puro vai em todos; o que custa dinheiro por uso sobe de plano. Recurso
 *    barato preso no plano alto só faz o cliente pequeno achar o produto
 *    capado.
 * 3. **A tarifa da Meta não está em preço nenhum daqui**, e é de propósito: ela
 *    é repassada a custo, em linha separada. Ver `TARIFA_DA_META`.
 */

/**
 * O identificador do plano, e o que vai na coluna `clients.plano`.
 *
 * Texto e não número: `'essencial'` sobrevive a uma faixa nova no meio da
 * tabela, e `2` vira mentira no dia em que a ordem mudar.
 */
export type IdDoPlano = 'essencial' | 'operacao' | 'escala'

export type Plano = {
  id: IdDoPlano
  nome: string
  /** Em reais por mês, sem centavos porque nenhuma faixa tem. */
  preco: number
  /**
   * Quantas conversas cabem no mês.
   *
   * **É hipótese, e está escrito aqui para quem for mexer saber disso.** As
   * faixas foram desenhadas antes de existir um mês de medição real, e o item 2
   * do handoff de 16/set mede exatamente contra elas. Quando o número real
   * chegar, este é o lugar de corrigir, e é uma linha.
   */
  conversas: number
  /** Para quem é, em uma frase, na landing. */
  resumo: string
  /** O que o card mostra. A primeira linha é sempre a franquia de conversa. */
  itens: string[]
}

/**
 * A ordem aqui é a ordem na tela, e é crescente de propósito: a tabela de preço
 * se lê da esquerda para a direita, e o plano do meio é o que se destaca.
 */
export const PLANOS: Plano[] = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 297,
    conversas: 1000,
    resumo: 'Para quem atende sozinho e quer parar de repetir horário e preço.',
    itens: [
      'Até 1.000 conversas por mês',
      'Atendentes ilimitados',
      '1 número de WhatsApp',
      'Fluxos, Inbox e CRM completos',
      'Etiquetas, respostas rápidas e horário de atendimento',
      'Suporte por WhatsApp',
    ],
  },
  {
    id: 'operacao',
    nome: 'Operação',
    preco: 597,
    conversas: 3000,
    resumo: 'Para quem já tem gente atendendo junto e perde conversa no meio.',
    itens: [
      'Até 3.000 conversas por mês',
      'Atendentes ilimitados',
      'Tudo do Essencial',
      'Respostas com IA',
      'Transcrição de áudio',
      'Transmissões e modelos da Meta',
      'Conexão com seus sistemas',
    ],
  },
  {
    id: 'escala',
    nome: 'Escala',
    preco: 1197,
    conversas: 8000,
    resumo: 'Para operação com mais de um número, volume alto e dado sensível.',
    itens: [
      'Até 8.000 conversas por mês',
      'Atendentes ilimitados',
      'Tudo da Operação',
      'Múltiplos números e unidades',
      'Sua própria chave de IA, e a conversa não vai para treino',
      'Webhook de entrada e auditoria',
      'Acompanhamento dedicado',
    ],
  },
]

/**
 * O plano em que uma conta nova nasce, e o default da coluna no banco.
 *
 * Existe como constante, e não escrito à mão na migration e outra vez no
 * TypeScript, porque é exatamente o tipo de número que diverge em silêncio.
 */
export const PLANO_DE_ENTRADA: IdDoPlano = 'essencial'

/**
 * O plano que a tela marca como "mais escolhido".
 *
 * É posição na tabela, não medição: ninguém ainda escolheu nada, porque nada
 * foi vendido. O dia em que houver venda, este valor vira medição ou some.
 */
export const PLANO_EM_DESTAQUE: IdDoPlano = 'operacao'

/**
 * A linha da tarifa da Meta, dita do mesmo jeito em todo lugar.
 *
 * **Aparece no card, e não em nota de rodapé**, e isso é uma decisão de venda,
 * não de layout: num mercado em que a concorrência esconde markup dentro de
 * "créditos", repassar a custo é diferenciação real, e esconder a frase no
 * rodapé desperdiça o argumento.
 *
 * Sem valor em reais aqui, porque não temos o rate card da Meta em BRL. Escrever
 * um número que ninguém conferiu é pior do que não escrever nenhum.
 */
export const TARIFA_DA_META =
  'A tarifa da Meta vem à parte, pelo valor que a Meta cobra, sem acréscimo nosso.'

/**
 * O que conta como conversa, dito para o cliente.
 *
 * **A definição é interação bidirecional**, e é a mesma que Wati, Respond.io e
 * SleekFlow escrevem. A razão é prática e vale a pena estar na tabela de preços
 * em vez de no contrato: se o disparo contasse, a conta do cliente explodiria no
 * mês de campanha, que é justamente quando ele mais precisa da ferramenta.
 */
export const O_QUE_E_CONVERSA =
  'Conversa é contato que trocou mensagem nos dois sentidos no mês. Disparo que ninguém respondeu não conta.'

export function acharPlano(id: IdDoPlano): Plano {
  const plano = PLANOS.find((p) => p.id === id)
  /*
   * Cair no plano de entrada, e não estourar, porque quem chama isto é tela: uma
   * conta com plano desconhecido no banco (migration futura, dado escrito à mão)
   * precisa continuar abrindo o painel. O valor errado aparece como o plano mais
   * barato, que é o lado seguro de errar.
   */
  return plano ?? PLANOS.find((p) => p.id === PLANO_DE_ENTRADA)!
}

/**
 * Quanto do plano já foi usado, de 0 a 1, para a barra da tela.
 *
 * Passa de 1 quando a conta estourou a faixa, e **isso é de propósito**: quem
 * estourou precisa ver que estourou. Quem desenhar a barra é que decide parar de
 * crescer em 100%.
 */
export function fracaoUsada(usadas: number, plano: Plano): number {
  if (plano.conversas <= 0) return 0
  return usadas / plano.conversas
}

/**
 * Bytes como gente lê.
 *
 * Mora aqui, e não na tela, porque é a mesma conta em três lugares (o consumo da
 * conta, a lista de quem opera a 4YU, e o que vier depois), e porque conta de
 * arredondamento sem teste é onde "0 MB" aparece para um arquivo que existe.
 *
 * Base 1024 e não 1000: é a que o resto do repositório usa para falar de teto de
 * arquivo (`repos/acervo.ts`, `transcrever-audio.ts`), e duas bases para a mesma
 * grandeza fariam a tela discordar do limite que ela mesma anuncia.
 */
export function comoTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'

  const emMega = bytes / (1024 * 1024)
  if (emMega < 1024) {
    /*
     * Uma casa decimal abaixo de 10 MB e nenhuma acima: "3,4 MB" informa, e
     * "731,2 MB" só faz o olho tropeçar num dígito que não muda decisão nenhuma.
     * Arquivo pequeno vira "0,1 MB" em vez de "0 MB", porque zero para um
     * arquivo que existe parece defeito.
     */
    const casas = emMega < 10 ? 1 : 0
    return `${emMega.toFixed(casas).replace('.', ',')} MB`
  }

  return `${(emMega / 1024).toFixed(1).replace('.', ',')} GB`
}
