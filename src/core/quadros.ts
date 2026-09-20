/**
 * Os quadros: em que etapa cada contato está (0032).
 *
 * Puro e sem rede, como todo `core/`. O que mora aqui é a régua — quantas
 * etapas cabem, como se ordena, e o cálculo de "parado há quanto tempo", que é
 * a única informação do quadro que faz alguém agir.
 */

/**
 * As etapas com que um quadro nasce.
 *
 * **Neutras de propósito.** O plano tem uma regra sobre isto, e ela veio de um
 * erro do produto de referência: o empty state deles é um mockup *de
 * imobiliária* ("Visita agendada", "R$600 mil") numa conta de estúdio de
 * pilates. Empty state ensina o negócio de quem está olhando.
 *
 * Estas três descrevem **atendimento**, não um ramo: servem à barbearia, à
 * clínica e ao estúdio igualmente, e a primeira coisa que se espera é que a
 * pessoa as renomeie. Zero etapas seria a outra forma de errar — um quadro que
 * abre morto e exige três cliques antes de mostrar qualquer coisa.
 */
export const ETAPAS_INICIAIS = ['Novo', 'Em conversa', 'Fechado'] as const

/**
 * Quantas etapas cabem num quadro.
 *
 * Oito, e o limite é de tela antes de ser de produto: acima disso as colunas
 * não cabem lado a lado e o quadro vira uma barra de rolagem horizontal, que é
 * exatamente a visão de conjunto que ele existe para dar. Funil com mais de oito
 * etapas também costuma ser dois funis.
 */
export const LIMITE_DE_ETAPAS = 8

/** Tamanho do nome de quadro e de etapa. Cabe no cabeçalho da coluna. */
export const LIMITE_DO_NOME = 32

export type Etapa = {
  id: string
  nome: string
  ordem: number
  /** Só para desempatar `ordem` igual. Ver a 0032 sobre não haver único. */
  criadoEm: string

  /**
   * O papel da etapa (0058).
   *
   * `normal` é coluna comum. Cair em `ganho` fecha a negociação e faz o contato
   * virar cliente; cair em `perdido` pede o motivo. Sem isso, "Fechado" é um
   * nome que só o humano entende — o sistema não pode agir a partir dele.
   */
  tipo?: TipoDeEtapa

  /**
   * A partir de quantos dias parado esta etapa acende o alerta.
   *
   * Por etapa porque a paciência é por etapa: três dias em "Aguardando
   * pagamento" é rotina, três dias em "Primeiro contato" é lead perdido. Null
   * usa o padrão do produto.
   */
  limiteDeDias?: number | null

  /**
   * A cor do cabeçalho da coluna (0069).
   *
   * `null` é "sem cor", e é o estado de todo funil que já existia. Ninguém
   * precisa pintar nada para o quadro continuar funcionando.
   */
  cor?: CorDaEtapa | null
}

export type TipoDeEtapa = 'normal' | 'ganho' | 'perdido'

/**
 * As cores que uma etapa pode ter.
 *
 * **Nome, e não hex.** O produto tem tema claro e escuro, e um `#fde047`
 * escolhido no escuro vira texto ilegível no claro — quem escolheu não vai
 * testar os dois. Guardando o nome, quem decide o tom exato é o CSS, que já sabe
 * em que tema está.
 *
 * Oito, e não uma paleta aberta: o funil tem no máximo oito etapas
 * (`LIMITE_DE_ETAPAS`), e cor demais é a mesma coisa que cor nenhuma — se toda
 * coluna é colorida, nenhuma se destaca.
 */
export const CORES_DA_ETAPA = [
  'cinza',
  'azul',
  'verde',
  'amarelo',
  'laranja',
  'vermelho',
  'roxo',
  'rosa',
] as const

export type CorDaEtapa = (typeof CORES_DA_ETAPA)[number]

/**
 * O que veio do banco é cor conhecida?
 *
 * O `check` da 0069 já barra o resto, mas o tipo do lado de cá vem de uma
 * consulta, e consulta devolve `string`. Sem esta porta, uma cor escrita por
 * versão futura viraria classe CSS inexistente e a coluna apareceria sem estilo
 * nenhum — melhor cair no cinza e continuar legível.
 */
export function ehCorDaEtapa(valor: unknown): valor is CorDaEtapa {
  return typeof valor === 'string' && (CORES_DA_ETAPA as readonly string[]).includes(valor)
}

/**
 * A bolinha da cor, no seletor e ao lado do nome da etapa.
 *
 * **As classes são escritas inteiras**, como em `core/etiquetas.ts`: o Tailwind
 * lê o texto do arquivo para decidir o que gerar, e `bg-${cor}-400` montado em
 * tempo de execução não existiria na folha de estilo — a bolinha ficaria
 * invisível, sem erro nenhum.
 *
 * Tom 400/500 e não 200: aqui a cor é o próprio objeto, não fundo de texto como
 * na etiqueta, e precisa aguentar aparecer sozinha nos dois temas.
 */
export const CLASSE_DA_COR: Record<CorDaEtapa, string> = {
  cinza: 'bg-slate-400',
  azul: 'bg-sky-500',
  verde: 'bg-emerald-500',
  amarelo: 'bg-amber-400',
  laranja: 'bg-orange-500',
  vermelho: 'bg-rose-500',
  roxo: 'bg-violet-500',
  rosa: 'bg-pink-500',
}

export type Cartao = {
  id: string
  contatoId: string
  colunaId: string
  nome: string
  telefone: string
  entrouNaColunaEm: string

  /**
   * A negociação dentro do cartão (0058).
   *
   * Opcionais porque cartão antigo não tem nada disso, e porque a maioria dos
   * cartões vivos também não vai ter: quem atende no WhatsApp anota valor quando
   * fecha, não quando a pessoa manda "oi". Campo obrigatório aqui viraria zero
   * na tela — e "R$ 0,00" em cada cartão é pior que nada escrito.
   */
  titulo?: string | null
  valor?: number | null
  situacao?: Situacao
  responsavelId?: string | null
  responsavelNome?: string | null

  /**
   * Quando essa pessoa falou pela última vez.
   *
   * É a informação de maior valor do cartão: a pergunta de quem abre o quadro é
   * "de quem estou devendo resposta", não "em que fase está o processo".
   */
  ultimaMensagemEm?: string | null

  /**
   * A avaliação humana **desta negociação** (0079).
   *
   * `null` é "ninguém avaliou", e é diferente de `morno`. A 0068 pôs
   * `contacts.temperatura` com default `'morno'`, que sempre significou
   * "ninguém opinou"; copiar aquele default para cá o transformaria em
   * opinião de alguém. Quem quiser a temperatura antiga lê o contato, e sabe
   * que está lendo legado.
   */
  temperatura?: Temperatura | null

  /** O interesse desta oportunidade (0079). `null` é "não informado". */
  produtoId?: string | null
  /** O nome do produto **hoje**. A venda guarda o nome da época em `venda_itens`. */
  produtoNome?: string | null
}

/** Ver `core/crm.ts`. Repetido aqui como tipo para o cartão não importar o CRM. */
export type Situacao = 'aberta' | 'ganha' | 'perdida'

/**
 * Ver `core/crm.ts`. Repetido aqui pelo mesmo motivo de `Situacao`: o cartão
 * não importa o CRM, para que o quadro continue funcionando sem ele.
 */
export type Temperatura = 'frio' | 'morno' | 'quente'

export function ehTemperaturaDoCartao(valor: unknown): valor is Temperatura {
  return valor === 'frio' || valor === 'morno' || valor === 'quente'
}

/**
 * O que acontece ao arrastar um cartão para uma etapa (RB-23).
 *
 * ---------------------------------------------------------------------------
 * O defeito que esta função existe para corrigir
 * ---------------------------------------------------------------------------
 *
 * `quadro.tsx` movia o cartão **otimista** e abria o modal de conclusão no
 * mesmo gesto. Cancelar o modal só fechava o modal: o cartão ficava na etapa
 * de ganho, visualmente concluído, com o servidor sabendo que ele foi movido e
 * ninguém sabendo que a conclusão não aconteceu.
 *
 * A RB-23 é explícita: "cancelar o modal restaura a posição" e "não mostrar
 * sucesso visual persistente antes da confirmação do servidor". Um cartão
 * parado em "Fechado" sem conclusão é precisamente esse sucesso visual.
 *
 * A regra fica aqui, e não dentro do componente, porque é regra e porque é
 * testável: mover para etapa comum é uma coisa, mover para conclusão é outra,
 * e a diferença decide se há posição a restaurar depois.
 */
export type GestoDeMover =
  | { tipo: 'mover' }
  | { tipo: 'concluir'; situacao: Exclude<Situacao, 'aberta'>; voltarPara: string }

export function aoArrastarPara(
  cartao: Pick<Cartao, 'colunaId'>,
  destino: Pick<Etapa, 'id' | 'tipo'>,
): GestoDeMover {
  if (destino.tipo === 'ganho' || destino.tipo === 'perdido') {
    return {
      tipo: 'concluir',
      situacao: destino.tipo === 'ganho' ? 'ganha' : 'perdida',
      // De onde ele saiu. É o que o cancelamento precisa para desfazer, e por
      // isso viaja junto com o gesto em vez de ser relido depois: quando o
      // modal fecha, o estado da tela já foi alterado pelo movimento otimista.
      voltarPara: cartao.colunaId,
    }
  }
  return { tipo: 'mover' }
}

/**
 * A ordem das etapas na tela.
 *
 * `ordem` não é única no banco de propósito — trocar duas de lugar com um índice
 * único exige valor temporário e coreografia. O empate é desempatado por
 * `criadoEm`, que é determinístico: duas leituras seguidas nunca devolvem
 * ordens diferentes, que é o que faria a coluna "pular" ao recarregar.
 */
export function etapasEmOrdem(etapas: Etapa[]): Etapa[] {
  return [...etapas].sort((a, b) => a.ordem - b.ordem || a.criadoEm.localeCompare(b.criadoEm))
}

/**
 * Onde uma etapa nova entra.
 *
 * No fim, sempre. Uma etapa nova é quase sempre um passo que faltava depois do
 * último, e inserir no começo empurraria o funil inteiro por causa de um
 * cadastro.
 */
export function proximaOrdem(etapas: Etapa[]): number {
  return etapas.reduce((maior, etapa) => Math.max(maior, etapa.ordem), -1) + 1
}

/**
 * As duas etapas que trocam de lugar quando alguém move uma para o lado.
 *
 * Devolve `null` quando não há para onde ir — é a ponta da lista, e o botão
 * fica desabilitado em vez de sumir. Só as **duas** trocam: renumerar a lista
 * inteira a cada clique reescreveria oito linhas para mover uma.
 */
export function trocaDeLugar(
  etapas: Etapa[],
  etapaId: string,
  direcao: 'esquerda' | 'direita',
): { a: Etapa; b: Etapa } | null {
  const ordenadas = etapasEmOrdem(etapas)
  const indice = ordenadas.findIndex((etapa) => etapa.id === etapaId)
  if (indice === -1) return null

  const vizinho = ordenadas[direcao === 'esquerda' ? indice - 1 : indice + 1]
  if (!vizinho) return null

  return { a: ordenadas[indice]!, b: vizinho }
}

/**
 * Há quantos dias este cartão está parado nesta etapa.
 *
 * Recebe o agora por parâmetro porque data calculada no navegador diverge do que
 * o servidor renderizou — é a divergência de hidratação que já mordeu este
 * projeto na lista de contatos.
 */
export function diasParado(entrouNaColunaEm: string, agora: number = Date.now()): number {
  const inicio = Date.parse(entrouNaColunaEm)
  if (Number.isNaN(inicio)) return 0
  return Math.max(0, Math.floor((agora - inicio) / 86_400_000))
}

/**
 * A partir de quantos dias parado o cartão fica marcado.
 *
 * Três, e o número é uma escolha de produto que vale explicar: dentro da janela
 * de 24h da Meta ainda dá para retomar em texto livre; passados três dias, a
 * conversa acabou e retomar exige um motivo novo. Marcar antes disso pintaria o
 * quadro inteiro de aviso no primeiro fim de semana, e aviso que aparece sempre
 * para de ser lido.
 */
export const DIAS_PARA_MARCAR_PARADO = 3

export function estaParado(
  entrouNaColunaEm: string,
  agora: number = Date.now(),
  /** O limite da etapa, quando ela tem um. Null usa o padrão do produto. */
  limiteDaEtapa?: number | null,
): boolean {
  return diasParado(entrouNaColunaEm, agora) >= (limiteDaEtapa ?? DIAS_PARA_MARCAR_PARADO)
}

/** "hoje", "há 1 dia", "há 6 dias" — já formatado no servidor. */
export function comoParado(entrouNaColunaEm: string, agora: number = Date.now()): string {
  const dias = diasParado(entrouNaColunaEm, agora)
  if (dias === 0) return 'hoje'
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

/**
 * A régua de uma etapa nova, antes de o banco ver qualquer coisa.
 *
 * Os índices da 0032 dizem o mesmo; isto existe para a recusa chegar como frase,
 * que é o que a pessoa lê.
 */
export function conferirEtapa(
  nome: string,
  jaExistentes: string[],
): { ok: true; nome: string } | { ok: false; motivo: string } {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'escreva o nome da etapa' }
  if (limpo.length > LIMITE_DO_NOME) {
    return { ok: false, motivo: `o nome cabe em ${LIMITE_DO_NOME} caracteres` }
  }
  if (jaExistentes.some((existente) => existente.trim().toLowerCase() === limpo.toLowerCase())) {
    return { ok: false, motivo: 'já existe uma etapa com este nome' }
  }
  if (jaExistentes.length >= LIMITE_DE_ETAPAS) {
    return {
      ok: false,
      motivo: `um quadro tem no máximo ${LIMITE_DE_ETAPAS} etapas — acima disso elas não cabem lado a lado, e funil maior que isso costuma ser dois funis`,
    }
  }
  return { ok: true, nome: limpo }
}

/** Os cartões de cada etapa, na ordem em que a coluna os mostra. */
export function cartoesPorEtapa(
  cartoes: Cartao[],
  /**
   * A ordem escolhida na barra. O padrão é o do produto — ver abaixo.
   *
   * As outras duas existem para perguntas diferentes da fila de trabalho:
   * "maior valor" é a do fim do mês, "mais recente" é a de quem quer ver o que
   * entrou hoje. Nenhuma das duas serve de padrão: as duas escondem o
   * esquecido no fim da coluna, que é quem o quadro existe para mostrar.
   */
  ordem: OrdemDoQuadro = 'espera',
): Map<string, Cartao[]> {
  const mapa = new Map<string, Cartao[]>()
  for (const cartao of cartoes) {
    const lista = mapa.get(cartao.colunaId) ?? []
    lista.push(cartao)
    mapa.set(cartao.colunaId, lista)
  }

  /**
   * **Quem está parado há mais tempo fica em cima.** A coluna é uma fila de
   * trabalho, e ordenar por chegada esconderia o esquecido no fim dela — que é
   * exatamente a pessoa que o quadro precisa mostrar.
   *
   * Antes disso, porém, **cartão fechado desce**. Ganho e perdido continuam no
   * quadro de propósito (é assim que o time vê o próprio resultado no fim do
   * mês), mas eles não são trabalho pendente — deixá-los disputando o topo da
   * coluna com quem espera resposta inverteria o sentido da tela.
   */
  for (const lista of mapa.values()) {
    lista.sort((a, b) => {
      // Cartão fechado desce em qualquer ordem: ele não é trabalho pendente.
      const fechadoA = a.situacao && a.situacao !== 'aberta' ? 1 : 0
      const fechadoB = b.situacao && b.situacao !== 'aberta' ? 1 : 0
      if (fechadoA !== fechadoB) return fechadoA - fechadoB

      if (ordem === 'valor') {
        // Sem valor anotado vai para o fim: zero e "não sei" não são a mesma
        // coisa, e misturá-los faria a coluna parecer cheia de venda de R$ 0.
        const valorA = a.valor ?? -1
        const valorB = b.valor ?? -1
        if (valorA !== valorB) return valorB - valorA
      }

      if (ordem === 'recente') return b.entrouNaColunaEm.localeCompare(a.entrouNaColunaEm)

      return a.entrouNaColunaEm.localeCompare(b.entrouNaColunaEm)
    })
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Filtrar e ordenar o quadro (a barra de ações)
// ---------------------------------------------------------------------------

/** O que a barra filtra por situação. `todas` inclui ganhas e perdidas. */
export type SituacaoFiltro = 'abertas' | 'ganhas' | 'perdidas' | 'todas'

/** Por onde a coluna é ordenada. `espera` é o padrão do produto. */
export type OrdemDoQuadro = 'espera' | 'valor' | 'recente'

export type FiltroDoQuadro = {
  busca: string
  /** `null` = qualquer um · `'ninguem'` = os sem dono · id = aquela pessoa. */
  responsavel: string | null
  situacao: SituacaoFiltro
}

export const FILTRO_VAZIO: FiltroDoQuadro = {
  busca: '',
  responsavel: null,
  situacao: 'abertas',
}

/**
 * Acento e maiúscula não podem separar ninguém da própria busca.
 *
 * Quem procura "jose" tem que achar "José", e quem digita com pressa não vai
 * voltar para pôr o acento — vai concluir que a pessoa não está no quadro.
 */
function comparavel(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * O cartão passa pelo filtro?
 *
 * A busca varre **nome, telefone e título da negociação** — as três coisas que
 * alguém tem na cabeça ao procurar ("a Ana", "o 98851", "o plano trimestral").
 * Só dígitos no telefone dos dois lados, senão procurar por "11 98851" não acha
 * o que está guardado como "5511988519314".
 */
export function passaNoFiltro(cartao: Cartao, filtro: FiltroDoQuadro): boolean {
  const situacao = cartao.situacao ?? 'aberta'
  if (filtro.situacao === 'abertas' && situacao !== 'aberta') return false
  if (filtro.situacao === 'ganhas' && situacao !== 'ganha') return false
  if (filtro.situacao === 'perdidas' && situacao !== 'perdida') return false

  if (filtro.responsavel === 'ninguem' && cartao.responsavelId) return false
  if (
    filtro.responsavel !== null &&
    filtro.responsavel !== 'ninguem' &&
    cartao.responsavelId !== filtro.responsavel
  ) {
    return false
  }

  const busca = filtro.busca.trim()
  if (busca === '') return true

  const alvo = comparavel(busca)
  const soDigitos = busca.replace(/\D/g, '')

  return (
    comparavel(cartao.nome).includes(alvo) ||
    comparavel(cartao.titulo ?? '').includes(alvo) ||
    (soDigitos.length >= 3 && cartao.telefone.replace(/\D/g, '').includes(soDigitos))
  )
}

export function filtrarCartoes(cartoes: Cartao[], filtro: FiltroDoQuadro): Cartao[] {
  return cartoes.filter((cartao) => passaNoFiltro(cartao, filtro))
}

/** Quantos cartões sobraram de fora do filtro. A barra precisa dizer isso. */
export function escondidosPeloFiltro(cartoes: Cartao[], filtro: FiltroDoQuadro): number {
  return cartoes.length - filtrarCartoes(cartoes, filtro).length
}
