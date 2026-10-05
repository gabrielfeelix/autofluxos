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
 * `docs/PLANO-16-SET-PRODUTO-E-PRECO.md` e `docs/PLANO-PRECOS-05-OUT.md`. As
 * três que importam para quem ler só o código:
 *
 * 1. **A unidade é conversa, e atendente conta desde 05/out/2026.** Até ali o
 *    atendente era ilimitado, com o argumento de que cobrar por atendente é
 *    cobrar pela métrica que o produto promete reduzir. Caiu porque o custo de
 *    uma equipe grande não aparece na conversa: cada Inbox aberto consulta o
 *    banco uma vez por segundo, e 200 pessoas no plano de entrada são 200
 *    consultas por segundo pagas por R$ 297. Cada plano inclui uma equipe
 *    (`atendentes`), e quem passa paga `precoAtendenteExtra` por pessoa. Não
 *    bloqueia: avisa o custo antes de dar o acesso.
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
 * tabela, e `2` vira mentira no dia em que a ordem mudar. Desde a 0102 (A8) a
 * administração cria plano, então o id é qualquer texto no formato de
 * `ehIdDePlano`, amarrado a `planos.id` por chave estrangeira.
 */
export type IdDoPlano = string

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
  /**
   * A promessa do plano, na landing. A primeira frase é o título do card
   * (Organizar / Automatizar / Decidir, 05/out/2026); o resto é o subtítulo.
   */
  resumo: string
  /**
   * O que o card mostra.
   *
   * **Nos planos de cima, a primeira linha é a herança**, "Tudo do Essencial",
   * "Tudo da Operação" , e só depois vem a franquia de conversa e o que é novo.
   * Ela estava na terceira posição, abaixo de duas linhas repetidas de um card
   * para o outro, e assim ninguém a lia: quem compara três colunas parecidas
   * desiste na primeira diferença que não acha. Dizer primeiro que este plano
   * contém o anterior é o que transforma três listas soltas numa escada.
   *
   * O Essencial não tem essa linha porque não herda de ninguém, e ali a
   * franquia continua sendo a primeira.
   */
  itens: string[]
  /** Quantos números de WhatsApp o plano comporta. */
  numeros: number
  /** Reais por conversa acima de `conversas`, na fatura seguinte (0102). */
  precoExcedente: number
  /**
   * Reais **por ano** no pagamento anual (0110). `null` = sem opção anual.
   *
   * O valor de partida é 10 vezes o mensal, "pague 10 meses, leve 12": é o
   * desconto mais comum no mercado (cerca de 17%), fácil de dizer numa frase, e
   * foi a escolha de 26/set (`docs/IDEIAS-26-SET-DA-CONVERSA.md`, item 4). A
   * administração muda na tela Planos.
   */
  precoAnual: number | null
  /** O que o plano libera, na lista fechada de `RECURSOS_DO_PLANO`. */
  recursos: RecursoDoPlano[]
  /**
   * Quantos atendentes o preço já inclui (0128). Atendente é quem tem acesso à
   * organização, menos o suporte da 4YU. Passar daqui não trava: cada pessoa a
   * mais custa `precoAtendenteExtra` por mês.
   */
  atendentes: number
  /** Reais por mês por atendente acima de `atendentes`. */
  precoAtendenteExtra: number
  /**
   * Respostas de IA em 30 dias corridos, somando transcrição de áudio (0128).
   * Só vale para a chave da 4YU: quem usa chave própria paga a IA e não tem
   * teto. Antes era 5 por real de mensalidade; virou número do plano porque o
   * Essencial passou a ter IA e a conta por real deixava de dizer a verdade.
   */
  tetoIa: number
  /** Envios de transmissão por mês. `null` = sem teto. */
  tetoTransmissoes: number | null
}

/**
 * O que um plano pode liberar, com o nome que a tela escreve.
 *
 * Lista fechada pelo mesmo motivo das capacidades (`core/permissoes.ts`):
 * texto livre viraria `ia` num lugar e `IA` noutro. Hoje ela descreve o
 * plano; a cobrança por recurso, quando existir, lê daqui.
 */
export const RECURSOS_DO_PLANO = [
  { chave: 'crm', rotulo: 'Fluxos, Inbox e CRM' },
  { chave: 'ia', rotulo: 'Respostas com IA' },
  { chave: 'transcricao', rotulo: 'Transcrição de áudio' },
  { chave: 'transmissoes', rotulo: 'Transmissões e modelos da Meta' },
  { chave: 'ia_ferramentas', rotulo: 'IA que consulta e age: agenda, loja, pedido' },
  { chave: 'sequencias', rotulo: 'Sequências de acompanhamento' },
  { chave: 'integracoes', rotulo: 'Conexão com outros sistemas' },
  { chave: 'varios_numeros', rotulo: 'Vários números e unidades' },
  { chave: 'chave_propria', rotulo: 'Chave de IA própria' },
  { chave: 'webhook', rotulo: 'Webhook de entrada e auditoria' },
  { chave: 'api', rotulo: 'API para desenvolvedores' },
] as const

export type RecursoDoPlano = (typeof RECURSOS_DO_PLANO)[number]['chave']

export function ehRecursoDoPlano(valor: string): valor is RecursoDoPlano {
  return RECURSOS_DO_PLANO.some((recurso) => recurso.chave === valor)
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
    numeros: 1,
    precoExcedente: 0.4,
    precoAnual: 2964,
    recursos: ['crm', 'ia', 'transcricao', 'transmissoes'],
    atendentes: 3,
    precoAtendenteExtra: 69,
    tetoIa: 1500,
    tetoTransmissoes: 2000,
    resumo: 'Organize sua operação comercial. Centralize contatos, atendimento, funil e atividades em um único lugar.',
    itens: [
      'Até 1.000 conversas por mês',
      '3 atendentes inclusos',
      'Leitores ilimitados, sem custo',
      '1 número de WhatsApp e chat do site',
      'CRM com funil, etiquetas e atividades',
      'Robôs ilimitados, com modelos prontos do seu ramo',
      'IA que conversa e transcreve áudio',
      'Transmissões: 2.000 envios por mês',
    ],
  },
  {
    id: 'operacao',
    nome: 'Operação',
    preco: 597,
    conversas: 3000,
    numeros: 2,
    precoExcedente: 0.3,
    precoAnual: 5964,
    recursos: ['crm', 'ia', 'transcricao', 'transmissoes', 'ia_ferramentas', 'sequencias', 'integracoes', 'varios_numeros', 'api'],
    atendentes: 10,
    precoAtendenteExtra: 59,
    tetoIa: 3000,
    tetoTransmissoes: null,
    resumo: 'Automatize o que hoje depende da equipe. Use chatbot, IA, sequências e automações para ganhar velocidade e consistência.',
    itens: [
      'Tudo do Essencial',
      'Até 3.000 conversas por mês',
      '10 atendentes inclusos',
      '2 números de WhatsApp',
      'IA que consulta e age: agenda, catálogo e pedido',
      'Sequências de acompanhamento',
      'Transmissões sem limite',
      'Origem de cada cliente por anúncio',
      'Distribuição automática e análise de vendas',
      'Integrações prontas e API',
    ],
  },
  {
    id: 'escala',
    nome: 'Escala',
    preco: 1197,
    conversas: 8000,
    numeros: 5,
    precoExcedente: 0.2,
    precoAnual: 11964,
    recursos: ['crm', 'ia', 'transcricao', 'transmissoes', 'ia_ferramentas', 'sequencias', 'integracoes', 'varios_numeros', 'chave_propria', 'webhook', 'api'],
    atendentes: 25,
    precoAtendenteExtra: 49,
    tetoIa: 6000,
    tetoTransmissoes: null,
    resumo: 'Transforme dados em decisões. Gerencie múltiplos canais, permissões, integrações e inteligência com mais controle.',
    itens: [
      'Tudo da Operação',
      'Até 8.000 conversas por mês',
      '25 atendentes inclusos',
      'Até 5 números de WhatsApp',
      'Loja conectada: frete, pedido e cupom no chat',
      'Sua própria chave de IA, sem teto de respostas',
      'Webhooks e acesso por pessoa',
      'Suporte prioritário',
    ],
  },
]

/**
 * Acima disto a conta é Enterprise: a tela não oferece mais atendente extra e
 * pede para falar com a 4YU. É onde preço por pessoa deixa de ser a conversa
 * certa, e onde a carga no banco pede olhar caso a caso.
 */
export const LIMITE_DE_ATENDENTES_SEM_CONTRATO = 50

/** O que a tabela diz do Enterprise. Sem preço fechado: é contrato. */
export const ENTERPRISE = {
  nome: 'Enterprise',
  aPartirDe: 2500,
  resumo: 'Para operação acima de 50 atendentes ou com integração sob medida.',
  itens: [
    'Conversas, números e atendentes sob medida',
    'Integração com o seu sistema',
    'Robôs montados pela 4YU',
    'Gerente de conta',
  ],
} as const

/**
 * Quanto a equipe custa além do plano, em reais por mês.
 *
 * Zero até `atendentes`; acima, cada pessoa a mais custa o extra do plano.
 * `enterprise` liga quando a equipe passa do que se vende sem contrato.
 */
export function custoDaEquipe(
  plano: Pick<Plano, 'atendentes' | 'precoAtendenteExtra'>,
  pessoas: number,
): { extras: number; valor: number; enterprise: boolean } {
  const extras = Math.max(0, pessoas - plano.atendentes)
  return {
    extras,
    valor: Math.round(extras * plano.precoAtendenteExtra * 100) / 100,
    enterprise: pessoas > LIMITE_DE_ATENDENTES_SEM_CONTRATO,
  }
}

/** Duração do teste grátis, em dias, e o teto de conversa dele. */
export const DIAS_DE_TESTE = 14
export const CONVERSAS_NO_TESTE = 100
/** O plano liberado durante o teste. */
export const PLANO_DO_TESTE: IdDoPlano = 'operacao'

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

export function acharPlano(id: IdDoPlano | string): Plano {
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
 * Quantas respostas de IA a conta pode dar em 30 dias corridos, somando
 * transcrição de áudio.
 *
 * **É produto e trava de custo ao mesmo tempo.** Cada resposta com a chave da
 * 4YU é paga pela 4YU, e qualquer pessoa pode mandar mensagem para o WhatsApp
 * de um cliente: sem teto, um robô trocando de número a noite inteira é conta
 * sem fundo (OWASP LLM10). Até 05/out o teto era 5 por real de mensalidade e
 * ninguém via; agora é número do plano (`tetoIa`), anunciado na tabela.
 *
 * Quem usa chave própria não tem teto: quem chama passa `chavePropria`.
 */
export function tetoDeIaDaConta(plano: Pick<Plano, 'tetoIa'>, chavePropria = false): number | null {
  if (chavePropria) return null
  return plano.tetoIa
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

/** O formato do id de plano, o mesmo do `check` `planos_id_formato` (0102). */
export function ehIdDePlano(valor: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(valor)
}

/**
 * O id de um plano novo, a partir do nome: "Operação Plus" vira
 * `operacao-plus`. Nasce do nome e não muda depois, porque `clients.plano`
 * guarda o id.
 */
export function idDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/**
 * Quanto sai por mês no anual, arredondado ao real, e quantos por cento de
 * desconto isso é sobre doze mensalidades. `null` quando o plano não tem anual,
 * ou quando o anual não sai mais barato (aí anunciar "desconto" seria mentira).
 */
/** Como a organização paga o plano. O pedido de troca leva o ciclo escolhido. */
export type CicloDeCobranca = 'mensal' | 'anual'

export function ehCicloDeCobranca(valor: unknown): valor is CicloDeCobranca {
  return valor === 'mensal' || valor === 'anual'
}

export function anualDoPlano(plano: Pick<Plano, 'preco' | 'precoAnual'>): { porMes: number; porAno: number; desconto: number } | null {
  if (plano.precoAnual === null || plano.preco <= 0) return null
  const desconto = Math.round((1 - plano.precoAnual / (plano.preco * 12)) * 100)
  if (desconto <= 0) return null
  return { porMes: Math.round(plano.precoAnual / 12), porAno: plano.precoAnual, desconto }
}
