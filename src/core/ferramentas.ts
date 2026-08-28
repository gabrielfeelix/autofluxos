import { ENDERECO_DA_AGENDA } from './agenda'
import type { Cabecalho, Metodo } from './flow/schema'

/**
 * O que a IA pode chamar — e, mais importante, o que ela não pode.
 *
 * Este arquivo é o catálogo de **ferramentas**, que não é a lista de presets.
 * Preset é bloco pronto para alguém arrastar; ferramenta é chamada que um
 * modelo escolhe sozinho. As duas apontam para a mesma API e param de se
 * parecer aí.
 *
 * ## Por que não reaproveitar `presets.ts`
 *
 * **A descrição que serve para humano não serve para modelo.** O `resumo` de um
 * preset foi escrito para quem já sabe o que quer e está procurando o bloco. A
 * descrição de uma ferramenta é lida por quem está *decidindo*: ela precisa
 * dizer quando **não** usar, senão o modelo usa sempre a primeira que parecer
 * perto.
 *
 * **Cinco ferramentas com parâmetro, não treze sem.** A avaliação de tool
 * calling é consistente nisto: ferramentas com descrições parecidas degradam a
 * escolha, e o erro é silencioso — o modelo responde com confiança sobre o dado
 * errado. Os presets da agenda são o caso patológico, com cinco variações de
 * "horários livres" que só diferem no filtro. A rota `/disponibilidade` sempre
 * aceitou os quatro parâmetros; quem os separou em cinco blocos foi a tela, por
 * uma razão de tela. O modelo recebe **uma** ferramenta com filtros opcionais.
 *
 * **Preset e ferramenta divergem, e devem divergir.** `verandi-quem-e`,
 * `verandi-dados` e `verandi-cadastrar` continuam existindo como bloco e **não**
 * entram aqui: identidade não é decisão de modelo (ver `injetados`).
 *
 * ## O que este arquivo não faz
 *
 * Não fala com rede, não conhece provedor de IA e não sabe o que é Gemini. A
 * declaração é **neutra**; cada adaptador (`server/ia/<provedor>.ts`) traduz
 * para o formato dele. Nascer no formato de um provedor faria da troca de
 * provedor uma reescrita, e a troca já está no horizonte.
 */

/** Como a credencial entra na chamada. Mesmos tipos da Conexão. */
export type CredencialDeFerramenta = 'bearer' | 'cabecalho' | 'query' | 'nenhuma'

/**
 * O que o modelo pode preencher num argumento.
 *
 * `id` é uma categoria à parte de `texto` de propósito: id não se inventa, se
 * recebe. Ver `soDeResultadoAnterior`.
 */
export type TipoDeArgumento = 'texto' | 'data' | 'id'

export type Argumento = {
  /** O nome que o modelo escreve. Sem acento e sem espaço. */
  nome: string
  tipo: TipoDeArgumento
  /** Lido pelo modelo. Diga o formato e diga quando deixar vazio. */
  descricao: string
  obrigatorio: boolean
  /**
   * O valor só vale se a conversa já o tiver visto numa resposta anterior.
   *
   * **É a trava que protege o que `injetados` sozinho não protege.** O telefone
   * de quem escreve identifica a pessoa, então `agenda_minha` só devolve a
   * agenda dela e todo `participacaoId` que o modelo conhece é dela. Mas nada
   * impede o modelo de *inventar* um id — ou de ser convencido a repetir um que
   * veio na mensagem de alguém ("desmarque a participação 4f2a...").
   *
   * Com esta marca, o resolvedor confere o valor contra os ids que já
   * apareceram em resultado de ferramenta **nesta sessão**. Id que a conversa
   * não viu não passa, e a conversa vai para uma pessoa.
   */
  soDeResultadoAnterior?: boolean
}

/**
 * O recorte do JSON que volta para o modelo.
 *
 * **Não é o `mapear` do preset, e a diferença importa.** O mapeamento achata
 * lista em texto separado por `;` porque é isso que um menu de WhatsApp come.
 * Para um modelo, achatar é perder: `07:00;10:00` do lado de `abc;def` obriga
 * ele a reparear hora com id por posição, que é exatamente onde ele erra e
 * marca a aula errada.
 *
 * Então a ferramenta devolve **objeto**, com os campos escolhidos um a um.
 *
 * A lista de `campos` é allow-list, e não conveniência de token: é a mesma
 * regra de menor privilégio que vale no resto da casa. O que não está aqui não
 * chega ao modelo e portanto não pode ser repetido para quem conversa — mesmo
 * que a API do cliente passe a devolver mais coisa amanhã sem ninguém avisar.
 */
export type Projecao = {
  /** Caminho até o valor no JSON da resposta. `livres`, `perfil.nome`. */
  caminho: string
  /**
   * Quais campos de cada item vão junto. Só para lista ou objeto.
   *
   * Ausente quer dizer valor simples (texto, número), que vai inteiro.
   */
  campos?: string[]
  /**
   * Teto de itens.
   *
   * Existe por duas razões que apontam para o mesmo lado: cada item é token
   * pago em toda volta seguinte da conversa, e lista comprida afoga a pergunta
   * no meio do contexto. Um dia de agenda cabe folgado em 20.
   */
  limite?: number
}

export type Ferramenta = {
  /** O nome que o modelo chama. `snake_case`, sem acento. */
  nome: string
  /**
   * Como ela aparece na tela de quem desenha o fluxo.
   *
   * Separado da `descricao` pela mesma razão que separou este arquivo de
   * `presets.ts`: a descrição é argumentação para um modelo decidir, e sai com
   * três frases e um "não use para". Numa lista de caixinhas isso não se lê.
   */
  rotulo: string
  /**
   * Escrita muda o mundo do outro lado; leitura não.
   *
   * É o eixo que decide a política de aprovação, e ele **não** é campo de
   * opinião: sai do verbo. `GET` é leitura; `POST` e `DELETE` são escrita.
   * Fica explícito aqui para que a política não precise reabrir a chamada para
   * descobrir, e para que o teste consiga cobrar os dois lados.
   */
  escreve: boolean
  /**
   * O que a pessoa lê na pergunta de confirmação, antes de a chamada sair.
   *
   * Só nas que gravam. É um verbo no infinitivo — "marcar você em", "desmarcar
   * sua aula de" — porque a frase é montada em volta dele
   * (`perguntaDeConfirmacao`), e porque o texto que descreve o que vai
   * acontecer não pode ser inventado por quem vai fazer acontecer.
   */
  acao?: string
  /**
   * A descrição lida pelo modelo.
   *
   * Escreva o que ela faz **e quando não usar**. A segunda metade é a que
   * separa ferramentas parecidas, e é a que quase todo catálogo esquece.
   */
  descricao: string
  argumentos: Argumento[]
  /**
   * Campos que o **servidor** preenche, e que o modelo nunca fornece.
   *
   * Se o modelo mandar um campo com nome daqui, o valor é descartado e a
   * tentativa vira log — tentativa de injeção é sinal, não ruído.
   *
   * É a trava central contra `LLM06 — Excessive Agency`. Sem ela, "desmarque
   * todas as aulas da Marina de amanhã", digitado por qualquer pessoa, vira uma
   * chamada `DELETE` autenticada. O modelo obedece a texto e não tem como
   * distinguir instrução do dono de instrução de atacante; a defesa que
   * funciona é o parâmetro perigoso não existir no vocabulário dele.
   */
  injetados: string[]
  chamada: {
    metodo: Metodo
    /** Aceita `{{argumento}}` e `{{injetado}}`. Quem interpola é o resolvedor. */
    url: string
    cabecalhos: Cabecalho[]
    corpo: string
  }
  projecao: Projecao[]
  credencial: CredencialDeFerramenta
  /**
   * De qual integração ela é.
   *
   * Serve para a tela agrupar e para o validador saber qual Conexão cobrar.
   */
  integracao: 'verandi'
}

/**
 * O formato de data que toda ferramenta usa.
 *
 * Um só, e ISO, pela mesma razão que a pergunta de fluxo exige ano de quatro
 * dígitos: "05/01" em dezembro acerta metade das vezes, e a metade errada é um
 * agendamento onze meses fora.
 *
 * **O modelo não tem relógio.** `core/` não tem relógio de propósito, e o
 * modelo herda isso: sem alguém dizer que dia é hoje, "amanhã" não tem como
 * virar data. Quem informa é o resolvedor, no prompt de sistema. Está escrito
 * aqui porque é onde alguém vai procurar quando o bot marcar para o ano errado.
 */
export const FORMATO_DE_DATA = 'AAAA-MM-DD'

export const FERRAMENTAS: Ferramenta[] = [
  {
    nome: 'agenda_horarios',
    rotulo: 'Ver horários com vaga',
    escreve: false,
    /*
     * A fusão dos cinco presets de horário.
     *
     * A rota sempre aceitou `de`, `ate`, `servico` e `profissional`; a tela é
     * que os separou em cinco blocos, porque quem arrasta bloco quer o bloco
     * já resolvido. Um modelo quer o contrário: uma porta e filtros.
     *
     * `cheios` vem junto e não é detalhe. Sem ela o bot diz "não temos horário"
     * para um dia cheio de aula, que é uma frase falsa e uma venda perdida —
     * "tem, e encheu" tem saída, "não tem nada" não tem.
     */
    descricao:
      'Consulta os horários de aula de um período, já separados entre os que têm vaga e os que estão lotados. ' +
      'Use sempre que a pessoa perguntar o que há disponível, em que dias há aula, ou quiser escolher um horário. ' +
      'Os filtros são opcionais: só informe `servico` ou `profissional` quando a pessoa tiver dito qual quer, ' +
      'e use os ids que vieram de `agenda_catalogo` — nunca o nome escrito por ela. ' +
      'Não use para ver os horários que a pessoa já marcou: para isso existe `agenda_minha`.',
    argumentos: [
      {
        nome: 'de',
        tipo: 'data',
        descricao: `Primeiro dia do período, no formato ${FORMATO_DE_DATA}.`,
        obrigatorio: true,
      },
      {
        nome: 'ate',
        tipo: 'data',
        descricao: `Último dia do período, no formato ${FORMATO_DE_DATA}. Para consultar um dia só, repita o valor de "de".`,
        obrigatorio: true,
      },
      {
        nome: 'servico',
        tipo: 'id',
        descricao:
          'Id da modalidade, vindo de `agenda_catalogo`. Deixe vazio para ver todas as modalidades.',
        obrigatorio: false,
        soDeResultadoAnterior: true,
      },
      {
        nome: 'profissional',
        tipo: 'id',
        descricao:
          'Id do profissional, vindo de `agenda_catalogo`. Deixe vazio para ver todos.',
        obrigatorio: false,
        soDeResultadoAnterior: true,
      },
    ],
    injetados: [],
    chamada: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{de}}&ate={{ate}}&servico={{servico}}&profissional={{profissional}}`,
      cabecalhos: [],
      corpo: '',
    },
    projecao: [
      {
        caminho: 'livres',
        campos: ['sessaoId', 'data', 'hora', 'servico', 'profissional'],
        limite: 20,
      },
      { caminho: 'cheios', campos: ['data', 'hora', 'servico'], limite: 20 },
    ],
    credencial: 'bearer',
    integracao: 'verandi',
  },

  {
    nome: 'agenda_catalogo',
    rotulo: 'Ver modalidades e profissionais',
    escreve: false,
    /*
     * O vocabulário vem junto de propósito.
     *
     * Cada conta chama as coisas do jeito dela — um estúdio diz "aula", uma
     * clínica diz "sessão". Um modelo que recebe essa palavra escreve na língua
     * do negócio sem ninguém reescrever mensagem por cliente, e é o que faz o
     * mesmo fluxo servir uma barbearia.
     */
    descricao:
      'Lista as modalidades e os profissionais do negócio, com os ids de cada um, e as palavras que este negócio usa para chamar as coisas. ' +
      'Chame antes de filtrar `agenda_horarios` por modalidade ou profissional — é daqui que saem os ids. ' +
      'Chame também quando a pessoa perguntar o que se oferece ou quem atende. ' +
      'Não use para saber se há vaga: o catálogo diz o que existe, nunca quando há lugar — isso é `agenda_horarios`.',
    argumentos: [],
    injetados: [],
    chamada: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/catalogo`,
      cabecalhos: [],
      corpo: '',
    },
    projecao: [
      { caminho: 'servicos', campos: ['servicoId', 'nome', 'duracaoMin'], limite: 30 },
      { caminho: 'profissionais', campos: ['profissionalId', 'nome'], limite: 30 },
      { caminho: 'vocabulario' },
    ],
    credencial: 'bearer',
    integracao: 'verandi',
  },

  {
    nome: 'agenda_minha',
    rotulo: 'Ver a agenda de quem está conversando',
    escreve: false,
    /*
     * `pessoaId` é injetado, e é o pilar de tudo.
     *
     * Ele sai do telefone de quem está escrevendo, resolvido antes do modelo
     * entrar em cena. Como o modelo não consegue trocá-lo, todo
     * `participacaoId` que ele vier a conhecer é de quem está na conversa — o
     * que torna `agenda_desmarcar` seguro por construção, e não por regra
     * escrita.
     */
    descricao:
      'Mostra a agenda da pessoa que está conversando: os horários fixos dela, as próximas aulas marcadas (com o id de cada uma) e quantas reposições ela tem em aberto. ' +
      'Use quando ela perguntar pelos próprios horários, quiser desmarcar, ou perguntar quantas aulas tem para repor. ' +
      'Não serve para consultar a agenda de outra pessoa, e não há como pedir isso.',
    argumentos: [],
    injetados: ['pessoa_id'],
    chamada: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/pessoas/{{pessoa_id}}`,
      cabecalhos: [],
      corpo: '',
    },
    projecao: [
      { caminho: 'nome' },
      { caminho: 'situacao' },
      {
        caminho: 'proximas',
        campos: ['participacaoId', 'data', 'hora', 'servico'],
        limite: 20,
      },
      {
        caminho: 'reposicoesAbertas',
        campos: ['participacaoId', 'data', 'hora', 'servico'],
        limite: 20,
      },
      { caminho: 'horariosFixos', campos: ['diaSemana', 'hora', 'servico'], limite: 20 },
    ],
    credencial: 'bearer',
    integracao: 'verandi',
  },

  {
    nome: 'agenda_marcar',
    rotulo: 'Marcar em um horário',
    escreve: true,
    acao: 'marcar você em',
    /*
     * A vaga é conferida na hora de gravar, não na hora em que a lista foi
     * lida. Entre uma coisa e outra alguém pode ter ocupado: a resposta é 409,
     * e 409 **é conversa normal**, não defeito.
     */
    descricao:
      'Marca a pessoa que está conversando em um horário. ' +
      'Use somente com um `sessao_id` que veio de `agenda_horarios` na lista dos que têm vaga, e somente depois de a pessoa ter dito qual horário quer. ' +
      'Nunca chame para "verificar se dá" — ela grava de verdade.',
    argumentos: [
      {
        nome: 'sessao_id',
        tipo: 'id',
        descricao: 'Id do horário, vindo do campo `sessaoId` de `agenda_horarios`.',
        obrigatorio: true,
        soDeResultadoAnterior: true,
      },
    ],
    injetados: ['pessoa_id'],
    chamada: {
      metodo: 'POST',
      url: `${ENDERECO_DA_AGENDA}/participacoes`,
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: '{\n  "pessoaId": "{{pessoa_id}}",\n  "sessaoId": "{{sessao_id}}"\n}',
    },
    projecao: [{ caminho: 'participacaoId' }, { caminho: 'status' }],
    credencial: 'bearer',
    integracao: 'verandi',
  },

  {
    nome: 'agenda_desmarcar',
    rotulo: 'Desmarcar uma aula',
    escreve: true,
    acao: 'avisar que você não vai em',
    /*
     * Apesar do verbo, nada é apagado do outro lado: a marcação vira falta
     * avisada, que libera a vaga e preserva o crédito de reposição.
     */
    descricao:
      'Avisa que a pessoa não vai a uma aula que ela já tinha marcado. A vaga volta a ser oferecida e o crédito de reposição é preservado. ' +
      'Use somente com um `participacao_id` que veio de `agenda_minha`. ' +
      'Se a pessoa quiser remarcar, desmarque primeiro e depois use `agenda_horarios` e `agenda_marcar`.',
    argumentos: [
      {
        nome: 'participacao_id',
        tipo: 'id',
        descricao: 'Id da marcação, vindo do campo `participacaoId` de `agenda_minha`.',
        obrigatorio: true,
        soDeResultadoAnterior: true,
      },
    ],
    injetados: [],
    chamada: {
      metodo: 'DELETE',
      url: `${ENDERECO_DA_AGENDA}/participacoes/{{participacao_id}}`,
      cabecalhos: [],
      corpo: '',
    },
    projecao: [{ caminho: 'status' }],
    credencial: 'bearer',
    integracao: 'verandi',
  },
]

/** Acha uma ferramenta pelo nome. `undefined` quando não existe. */
export function acharFerramenta(nome: string): Ferramenta | undefined {
  return FERRAMENTAS.find((f) => f.nome === nome)
}

/**
 * Só as ferramentas que este nó pode usar, na ordem do catálogo.
 *
 * **Nome desconhecido é ignorado, e isso é de propósito.** Fluxo publicado é
 * imutável; se uma ferramenta for renomeada ou sair do catálogo, a conversa em
 * andamento não pode estourar — ela segue com as que restaram, e se nenhuma
 * restar o nó de IA volta a ser o de sempre, texto puro, que continua honesto.
 * Quem cobra o nome errado é o `validar()`, na hora de publicar, que é onde dá
 * para consertar.
 */
export function ferramentasPermitidas(nomes: readonly string[]): Ferramenta[] {
  const pedidas = new Set(nomes)
  return FERRAMENTAS.filter((f) => pedidas.has(f.nome))
}

/** Os nomes que o catálogo conhece. Para a tela e para o validador. */
export function nomesDeFerramenta(): string[] {
  return FERRAMENTAS.map((f) => f.nome)
}

/**
 * Aplica a projeção sobre o JSON que a API devolveu.
 *
 * Puro, e por isso testável sem rede — é o mesmo motivo de `prompt.ts` morar
 * separado do adaptador. O que sai daqui é tudo o que o modelo verá; o que a
 * API mandou a mais morre aqui.
 *
 * Campo ausente vira ausente, e não `null`: `null` gasta token e convida o
 * modelo a comentar que não sabe daquilo.
 */
export function projetar(resposta: unknown, projecao: readonly Projecao[]): Record<string, unknown> {
  const saida: Record<string, unknown> = {}

  for (const parte of projecao) {
    const valor = descer(resposta, parte.caminho)
    if (valor === undefined || valor === null) continue

    const chave = ultimoPedaco(parte.caminho)

    if (Array.isArray(valor)) {
      const cortado = parte.limite === undefined ? valor : valor.slice(0, parte.limite)
      saida[chave] = cortado.map((item) => recortar(item, parte.campos))
      continue
    }

    saida[chave] = recortar(valor, parte.campos)
  }

  return saida
}

/**
 * Todo id que apareceu numa projeção, para a trava `soDeResultadoAnterior`.
 *
 * Vasculha valor de campo terminado em `Id` — `sessaoId`, `participacaoId`,
 * `servicoId`, `profissionalId` — que é a convenção da API da agenda. Uma
 * convenção é frágil como proteção sozinha, e não está sozinha: ela é a
 * segunda camada, atrás de `injetados`, e o custo de errar para o lado seguro
 * é uma conversa que vai para uma pessoa.
 */
export function idsVistos(projetado: unknown, achados: Set<string> = new Set()): Set<string> {
  if (Array.isArray(projetado)) {
    for (const item of projetado) idsVistos(item, achados)
    return achados
  }

  if (projetado !== null && typeof projetado === 'object') {
    for (const [chave, valor] of Object.entries(projetado as Record<string, unknown>)) {
      if (typeof valor === 'string' && /Id$/.test(chave) && valor !== '') achados.add(valor)
      else if (typeof valor === 'object') idsVistos(valor, achados)
    }
  }

  return achados
}

/**
 * Tira da URL os parâmetros de busca que ficaram vazios.
 *
 * **É o que faz um filtro opcional ser de fato opcional.** A URL da ferramenta
 * traz todos os filtros escritos; quando o modelo não informa um deles, a
 * interpolação deixa `?de=2026-09-10&ate=2026-09-10&servico=&profissional=`. Um
 * parâmetro presente e vazio não é a mesma coisa que ausente, e cada API decide
 * sozinha o que fazer com ele — a leitura razoável de `servico=` é "filtre pela
 * modalidade de nome vazio", e a resposta seria uma lista vazia com cara de
 * "não temos horário".
 *
 * Mexe só na parte de busca. Caminho vazio (`/participacoes//`) não é o mesmo
 * problema: ali o vazio é argumento obrigatório faltando, e quem barra isso é a
 * conferência de argumento, antes de montar chamada nenhuma.
 */
export function limparQueryVazia(url: string): string {
  const corte = url.indexOf('?')
  if (corte === -1) return url

  const base = url.slice(0, corte)
  const busca = url.slice(corte + 1)

  const mantidos = busca
    .split('&')
    .filter((par) => {
      if (par === '') return false
      const igual = par.indexOf('=')
      // Sem `=` é bandeira (`?debug`), e bandeira não está vazia. Com `=`, o
      // que decide é o **valor**, e não o fim do texto: valor em base64 termina
      // em `=` de padding e continua sendo valor.
      return igual === -1 || par.slice(igual + 1) !== ''
    })
    .join('&')

  return mantidos === '' ? base : `${base}?${mantidos}`
}

/**
 * Como cada id apareceu para a pessoa, em palavras.
 *
 * **Existe para a confirmação poder dizer o que vai acontecer.** O modelo pede
 * `agenda_marcar` com `sessao_id: "s7"`, e perguntar *"posso marcar você em
 * s7?"* é pedir um sim no escuro. A projeção já trouxe `data`, `hora` e
 * `servico` no mesmo objeto do id — juntar os três é o que transforma o id numa
 * frase que a pessoa reconhece.
 *
 * Monta a partir do que **já** voltou, e não de uma consulta nova: o rótulo tem
 * que descrever o que a conversa viu, e não o que a agenda diz agora.
 */
export function rotulosDeId(
  projetado: unknown,
  achados: Map<string, string> = new Map(),
): Map<string, string> {
  if (Array.isArray(projetado)) {
    for (const item of projetado) rotulosDeId(item, achados)
    return achados
  }

  if (projetado === null || typeof projetado !== 'object') return achados

  const campos = projetado as Record<string, unknown>
  const id = Object.entries(campos).find(
    ([chave, valor]) => /Id$/.test(chave) && typeof valor === 'string' && valor !== '',
  )?.[1] as string | undefined

  if (id !== undefined) {
    // Dia, hora e o que é. Nessa ordem porque é como se fala: "dia 10, sete da
    // manhã, pilates". Campo que não veio simplesmente não entra.
    const partes = ['data', 'hora', 'servico', 'nome'].flatMap((campo) => {
      const valor = campos[campo]
      return typeof valor === 'string' && valor !== '' ? [valor] : []
    })

    if (partes.length > 0) achados.set(id, partes.join(' '))
  }

  for (const valor of Object.values(campos)) {
    if (typeof valor === 'object' && valor !== null) rotulosDeId(valor, achados)
  }

  return achados
}

/** Desce por `a.b.c`. Não percorre lista — projeção é de um nível. */
function descer(raiz: unknown, caminho: string): unknown {
  let atual = raiz
  for (const pedaco of caminho.split('.')) {
    if (atual === null || typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[pedaco]
  }
  return atual
}

function ultimoPedaco(caminho: string): string {
  const pedacos = caminho.split('.')
  return pedacos[pedacos.length - 1] ?? caminho
}

function recortar(item: unknown, campos: readonly string[] | undefined): unknown {
  if (campos === undefined) return item
  if (item === null || typeof item !== 'object') return item

  const recorte: Record<string, unknown> = {}
  for (const campo of campos) {
    const valor = (item as Record<string, unknown>)[campo]
    if (valor !== undefined && valor !== null) recorte[campo] = valor
  }
  return recorte
}
