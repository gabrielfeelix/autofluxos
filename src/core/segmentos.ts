/**
 * Segmentos: a árvore de condições que a lista, a contagem e o CSV
 * compartilham (T6.1, RB-35 a RB-37).
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, que é o ponto inteiro desta fase
 * ---------------------------------------------------------------------------
 *
 * Hoje há **duas** superfícies com **duas** definições de "quem é este grupo":
 *
 *   - `leads/page.tsx` filtra por nível **em memória, sobre a página já
 *     carregada** (`leads.filter(...)`). A contagem ao lado diz "3 de 50",
 *     que é 3 daquela página e não 3 da base;
 *   - `api/.../leads/csv/route.ts` é outro caminho, que **nem conhece** o
 *     filtro de nível: quem filtra por Ouro e exporta recebe todo mundo.
 *
 * A RB-37 exige o contrário: lista, contagem, paginação, exportação e seleção
 * em lote usam **a mesma definição no servidor**, e os filtros são calculados
 * **antes** de paginar.
 *
 * ---------------------------------------------------------------------------
 * Por que uma árvore tipada e não uma string
 * ---------------------------------------------------------------------------
 *
 * O plano é explícito: "compilar somente operadores e campos permitidos, sem
 * aceitar SQL ou identificador arbitrário vindo do cliente". Isto não é
 * paranoia de estilo: `service_role` ignora RLS, e o `or()` do PostgREST é uma
 * string em que vírgula e parêntese têm significado. Um campo vindo da tela
 * interpolado ali não quebra a consulta, ele **vira** consulta.
 *
 * Então o cliente manda dados, nunca código: um campo só pode ser um dos
 * `CAMPOS`, um operador só pode ser um dos permitidos **para aquele tipo**, e
 * quem traduz isso em `where` é `server/consultas/contatos.ts`.
 *
 * Puro e sem rede.
 */

// ---------------------------------------------------------------------------
// Os campos que se pode filtrar, e o tipo de cada um
// ---------------------------------------------------------------------------

export type TipoDoCampo = 'texto' | 'numero' | 'data' | 'opcao' | 'booleano'

export type DefinicaoDeCampo = {
  chave: string
  rotulo: string
  tipo: TipoDoCampo
  /**
   * Exige `ler_valores` para ser usado.
   *
   * Dado financeiro oculto por permissão **não pode ser inferível** por
   * contagem, faixa ou exportação (proposta §10.3). Sem esta marca, quem não
   * pode ver dinheiro descobriria o valor de um cliente por tentativa e erro,
   * estreitando um filtro de "valor maior que X" até a contagem mudar.
   */
  sensivel?: boolean
  /** Para `opcao`: os valores aceitos. Qualquer outro é recusado. */
  opcoes?: readonly string[]
}

export const CAMPOS = [
  { chave: 'nome', rotulo: 'nome', tipo: 'texto' },
  { chave: 'telefone', rotulo: 'telefone', tipo: 'texto' },
  { chave: 'estagio', rotulo: 'estágio', tipo: 'opcao', opcoes: ['novo', 'lead', 'cliente', 'perdido', 'inativo'] },
  { chave: 'responsavel', rotulo: 'responsável', tipo: 'texto' },
  { chave: 'ultima_mensagem_em', rotulo: 'última interação', tipo: 'data' },
  { chave: 'criado_em', rotulo: 'primeiro contato', tipo: 'data' },
  // Os comerciais. Ver `sensivel`.
  { chave: 'valor_conhecido', rotulo: 'valor conhecido', tipo: 'numero', sensivel: true },
  { chave: 'compras', rotulo: 'compras registradas', tipo: 'numero' },
  { chave: 'ultima_compra_em', rotulo: 'última compra', tipo: 'data' },
  { chave: 'produto_comprado', rotulo: 'produto comprado', tipo: 'texto' },
  // Da oportunidade. Ver `MESMA_OCORRENCIA`.
  { chave: 'oportunidade_temperatura', rotulo: 'temperatura da oportunidade', tipo: 'opcao', opcoes: ['frio', 'morno', 'quente'] },
  { chave: 'oportunidade_situacao', rotulo: 'situação da oportunidade', tipo: 'opcao', opcoes: ['aberta', 'ganha', 'perdida'] },
  { chave: 'oportunidade_quadro', rotulo: 'processo da oportunidade', tipo: 'texto' },
] as const satisfies readonly DefinicaoDeCampo[]

export type ChaveDeCampo = (typeof CAMPOS)[number]['chave']

export function acharCampo(chave: string): DefinicaoDeCampo | null {
  return (CAMPOS as readonly DefinicaoDeCampo[]).find((campo) => campo.chave === chave) ?? null
}

/**
 * Os campos que descrevem **a mesma oportunidade** (RB-36).
 *
 * "Oportunidade fria E aberta no processo X" tem que ser satisfeito por uma
 * única negociação. Juntar a temperatura de uma com o estado de outra
 * devolveria gente que não corresponde ao que a pessoa pediu, e o erro é
 * invisível: a lista vem preenchida, só que errada.
 *
 * O mesmo vale para "comprou o produto X nos últimos 90 dias": tem que ser a
 * mesma venda. Por isso os dois conjuntos são declarados aqui, e a compilação
 * os trata como um `exists` único em vez de condições soltas.
 */
export const MESMA_OCORRENCIA: Record<string, readonly ChaveDeCampo[]> = {
  oportunidade: ['oportunidade_temperatura', 'oportunidade_situacao', 'oportunidade_quadro'],
  venda: ['produto_comprado', 'ultima_compra_em'],
}

/**
 * Os campos que **só** existem dentro da ocorrência.
 *
 * A distinção existe por um defeito que o teste pegou, e que vale registrar
 * porque ele é do tipo silencioso: a regra "um grupo de ocorrência só vale com
 * duas condições ou mais" está certa para `ultima_compra_em`, que também é
 * campo do contato (a view sabe a última compra de cada um), e **errada** para
 * `oportunidade_situacao`, que não tem coluna nenhuma no contato.
 *
 * Sem esta lista, uma condição de oportunidade sozinha caía num `switch` sem
 * caso correspondente e simplesmente **não filtrava**: a consulta devolvia a
 * base inteira, sem erro, com cara de resultado. Filtro que não filtra é pior
 * que filtro que recusa.
 */
export const SO_DA_OCORRENCIA: readonly ChaveDeCampo[] = [
  'oportunidade_temperatura',
  'oportunidade_situacao',
  'oportunidade_quadro',
  'produto_comprado',
]

// ---------------------------------------------------------------------------
// Os operadores, por tipo
// ---------------------------------------------------------------------------

export const OPERADORES = [
  'igual',
  'diferente',
  'contem',
  'maior',
  'menor',
  'entre',
  'preenchido',
  'nao_informado',
  'ha_mais_de_dias',
  'ha_menos_de_dias',
] as const

export type Operador = (typeof OPERADORES)[number]

/** Quais operadores cada tipo aceita. Fora disso é recusa, não adaptação. */
export const OPERADORES_POR_TIPO: Record<TipoDoCampo, readonly Operador[]> = {
  texto: ['igual', 'diferente', 'contem', 'preenchido', 'nao_informado'],
  numero: ['igual', 'diferente', 'maior', 'menor', 'entre', 'preenchido', 'nao_informado'],
  data: [
    'maior',
    'menor',
    'entre',
    'preenchido',
    'nao_informado',
    'ha_mais_de_dias',
    'ha_menos_de_dias',
  ],
  opcao: ['igual', 'diferente', 'preenchido', 'nao_informado'],
  booleano: ['igual'],
}

/** Operadores que não levam valor: o valor seria ignorado, e mandar um é erro. */
export const SEM_VALOR: readonly Operador[] = ['preenchido', 'nao_informado']

export type Condicao = {
  campo: string
  operador: Operador
  /** Ausente para `preenchido`/`nao_informado`. */
  valor?: string | null
  /** Só para `entre`. */
  ate?: string | null
}

export type Juncao = 'todas' | 'qualquer'

/**
 * O grupo de condições.
 *
 * **Sem aninhamento arbitrário na primeira versão**, e é escolha da proposta:
 * um editor que permite grupos dentro de grupos produz regras que ninguém
 * consegue ler de volta, e o produto ainda não tem quem precise disso.
 */
export type Segmento = {
  juncao: Juncao
  condicoes: Condicao[]
}

export const SEGMENTO_VAZIO: Segmento = { juncao: 'todas', condicoes: [] }

// ---------------------------------------------------------------------------
// A validação: o que entra é dado, nunca código
// ---------------------------------------------------------------------------

export type Validacao =
  | { ok: true; segmento: Segmento }
  | { ok: false; motivo: string }

/**
 * O segmento é válido, e esta pessoa pode usá-lo?
 *
 * `podeLerValores` entra aqui, e não na tela: esconder o campo no editor não
 * impede ninguém de mandar a condição direto, que é literalmente o A19.
 */
export function validarSegmento(
  bruto: unknown,
  opcoes: { podeLerValores: boolean },
): Validacao {
  if (typeof bruto !== 'object' || bruto === null) {
    return { ok: false, motivo: 'segmento inválido' }
  }

  const entrada = bruto as { juncao?: unknown; condicoes?: unknown }
  const juncao = entrada.juncao === 'qualquer' ? 'qualquer' : 'todas'

  if (!Array.isArray(entrada.condicoes)) {
    return { ok: false, motivo: 'segmento inválido' }
  }
  if (entrada.condicoes.length > LIMITE_DE_CONDICOES) {
    return { ok: false, motivo: `um segmento cabe em ${LIMITE_DE_CONDICOES} condições` }
  }

  const condicoes: Condicao[] = []

  for (const cru of entrada.condicoes) {
    const conferida = validarCondicao(cru, opcoes)
    if (!conferida.ok) return conferida
    condicoes.push(conferida.condicao)
  }

  return { ok: true, segmento: { juncao, condicoes } }
}

/**
 * Quantas condições cabem num segmento.
 *
 * O teto não é estético: cada condição de oportunidade ou venda vira um
 * `exists` próprio, e uma regra com cinquenta delas seria uma consulta que
 * ninguém consegue prever nem explicar.
 */
export const LIMITE_DE_CONDICOES = 12

type ValidacaoDeCondicao =
  | { ok: true; condicao: Condicao }
  | { ok: false; motivo: string }

function validarCondicao(
  bruto: unknown,
  opcoes: { podeLerValores: boolean },
): ValidacaoDeCondicao {
  if (typeof bruto !== 'object' || bruto === null) {
    return { ok: false, motivo: 'condição inválida' }
  }

  const entrada = bruto as { campo?: unknown; operador?: unknown; valor?: unknown; ate?: unknown }

  if (typeof entrada.campo !== 'string') return { ok: false, motivo: 'condição sem campo' }

  // A porta: só o que está em CAMPOS passa. Não há caminho para um
  // identificador arbitrário chegar ao SQL.
  const campo = acharCampo(entrada.campo)
  if (!campo) return { ok: false, motivo: `campo desconhecido: ${entrada.campo}` }

  if (campo.sensivel && !opcoes.podeLerValores) {
    return { ok: false, motivo: `você não tem permissão para filtrar por ${campo.rotulo}` }
  }

  if (typeof entrada.operador !== 'string') {
    return { ok: false, motivo: 'condição sem operador' }
  }
  const operador = entrada.operador as Operador
  if (!(OPERADORES as readonly string[]).includes(operador)) {
    return { ok: false, motivo: `operador desconhecido: ${entrada.operador}` }
  }

  // O operador tem que fazer sentido **para aquele tipo**: "contém" numa data
  // não é uma consulta mais frouxa, é uma pergunta sem resposta.
  if (!OPERADORES_POR_TIPO[campo.tipo].includes(operador)) {
    return { ok: false, motivo: `${campo.rotulo} não aceita esse operador` }
  }

  if (SEM_VALOR.includes(operador)) {
    return { ok: true, condicao: { campo: campo.chave, operador } }
  }

  const valor = entrada.valor
  if (typeof valor !== 'string' || valor.trim() === '') {
    return { ok: false, motivo: `informe o valor de ${campo.rotulo}` }
  }
  if (valor.length > LIMITE_DO_VALOR) {
    return { ok: false, motivo: `o valor de ${campo.rotulo} é longo demais` }
  }

  if (campo.tipo === 'opcao' && campo.opcoes && !campo.opcoes.includes(valor)) {
    return { ok: false, motivo: `${valor} não é um valor de ${campo.rotulo}` }
  }

  if (campo.tipo === 'numero' && !Number.isFinite(Number(valor))) {
    return { ok: false, motivo: `${campo.rotulo} precisa de um número` }
  }

  if (
    (operador === 'ha_mais_de_dias' || operador === 'ha_menos_de_dias') &&
    (!Number.isFinite(Number(valor)) || Number(valor) < 0)
  ) {
    return { ok: false, motivo: 'a quantidade de dias precisa ser um número' }
  }

  if (operador === 'entre') {
    const ate = entrada.ate
    if (typeof ate !== 'string' || ate.trim() === '') {
      return { ok: false, motivo: `informe o fim do intervalo de ${campo.rotulo}` }
    }
    return { ok: true, condicao: { campo: campo.chave, operador, valor, ate } }
  }

  return { ok: true, condicao: { campo: campo.chave, operador, valor } }
}

export const LIMITE_DO_VALOR = 200

// ---------------------------------------------------------------------------
// A explicação: por que esta pessoa entrou
// ---------------------------------------------------------------------------

/**
 * A condição, em português, para a prévia (RB-36: "mostrar na prévia o motivo
 * de inclusão").
 *
 * Existe porque um segmento que devolve 340 pessoas sem dizer por quê é um
 * número que ninguém confere, e confiar nele é como se manda mensagem para
 * quem não devia.
 */
export function explicar(condicao: Condicao): string {
  const campo = acharCampo(condicao.campo)
  const rotulo = campo?.rotulo ?? condicao.campo

  switch (condicao.operador) {
    case 'igual':
      return `${rotulo} é ${condicao.valor}`
    case 'diferente':
      return `${rotulo} não é ${condicao.valor}`
    case 'contem':
      return `${rotulo} contém ${condicao.valor}`
    case 'maior':
      return `${rotulo} é maior que ${condicao.valor}`
    case 'menor':
      return `${rotulo} é menor que ${condicao.valor}`
    case 'entre':
      return `${rotulo} está entre ${condicao.valor} e ${condicao.ate}`
    case 'preenchido':
      return `${rotulo} está preenchido`
    case 'nao_informado':
      // A semântica explícita do null, que a RB-35 exige: "não informado" é um
      // grupo próprio, e não se funde com "zero" nem com "faz muito tempo".
      return `${rotulo} não foi informado`
    case 'ha_mais_de_dias':
      return `${rotulo} há mais de ${condicao.valor} dias`
    case 'ha_menos_de_dias':
      return `${rotulo} há menos de ${condicao.valor} dias`
  }
}

export function explicarSegmento(segmento: Segmento): string {
  if (segmento.condicoes.length === 0) return 'todos os contatos'
  const ligacao = segmento.juncao === 'todas' ? ' e ' : ' ou '
  return segmento.condicoes.map(explicar).join(ligacao)
}

// ---------------------------------------------------------------------------
// A faixa de valor vira condição de servidor
// ---------------------------------------------------------------------------

/**
 * O filtro de nível da tela de contatos, traduzido em condições.
 *
 * **É isto que tira o `filter()` da memória.** A tela filtrava por nível sobre
 * a página já carregada, e o CSV nem conhecia o filtro; agora os dois montam a
 * mesma condição e mandam para o servidor, que a aplica antes de paginar.
 *
 * `sem_compra` é o caso que ensina o resto: ele **não** é "valor igual a
 * zero", é `valor_conhecido nao_informado`. Quem nunca comprou não tem linha
 * em `vendas`, então o total dele é nulo, e tratar nulo como zero misturaria o
 * desconhecido com o cliente que gastou R$ 0,00, dois grupos que a RB-35 manda
 * manter separados.
 */
export function condicoesDoNivel(
  nivel: 'ouro' | 'prata' | 'bronze' | 'sem_compra',
  faixas: { ouro: number; prata: number },
): Condicao[] {
  switch (nivel) {
    case 'ouro':
      return [{ campo: 'valor_conhecido', operador: 'maior', valor: String(faixas.ouro - 0.01) }]
    case 'prata':
      return [
        { campo: 'valor_conhecido', operador: 'entre', valor: String(faixas.prata), ate: String(faixas.ouro - 0.01) },
      ]
    case 'bronze':
      return [
        { campo: 'valor_conhecido', operador: 'maior', valor: '0' },
        { campo: 'valor_conhecido', operador: 'menor', valor: String(faixas.prata) },
      ]
    case 'sem_compra':
      // Nunca comprou: o total é nulo, e nulo não é zero.
      return [{ campo: 'valor_conhecido', operador: 'nao_informado' }]
  }
}

// ---------------------------------------------------------------------------
// Os motivos de exclusão do envio (RB-39)
// ---------------------------------------------------------------------------

/**
 * Por que alguém que **está** no segmento não vai receber.
 *
 * Mora em `core/` porque as duas pontas precisam dele: o serviço que decide
 * (`server/servicos/elegibilidade.ts`) e a prévia que explica, que é
 * componente de cliente. Deixá-lo no serviço obrigaria a tela a importar de um
 * módulo `server-only`, hoje o build aceita, porque só o tipo e a constante
 * atravessam, e é exatamente o tipo de dependência que quebra sem aviso na
 * primeira vez que alguém acrescentar uma linha com banco ali dentro.
 */
export const MOTIVOS_DA_EXCLUSAO = [
  'sem_telefone',
  'janela_fechada_sem_modelo',
  'nunca_escreveu',
] as const

export type MotivoDaExclusao = (typeof MOTIVOS_DA_EXCLUSAO)[number]

export const FRASE_DO_MOTIVO: Record<MotivoDaExclusao, string> = {
  sem_telefone: 'sem número de WhatsApp',
  janela_fechada_sem_modelo: 'fora da janela de 24h, e o envio é de texto livre',
  nunca_escreveu: 'nunca escreveu para este número',
}
