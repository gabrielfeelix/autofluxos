import 'server-only'
import { z } from 'zod'
import type { Conciliacao, ContatoConhecido } from '@/core/contatos/planilha'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { TIPOS_DE_MIDIA, type TipoDeMidia } from '@/core/flow/schema'
import { db, ehIdInvalido } from '../db'
import { contatosComEtiqueta as contatosComEtiquetaManual, etiquetasDeContatos, type Etiqueta } from './etiquetas'

/**
 * Um lead é um contato visto pelo lado de quem vende: o que ele respondeu, se
 * alguém precisa assumir a conversa, e quando ele falou pela última vez.
 *
 * Nada aqui é tabela. É a view `leads` (0004), que junta `contacts`,
 * `messages` e `handoffs` — as duas últimas são agregações e o banco faz isso
 * melhor do que nós.
 */
export type Lead = {
  contatoId: string
  waId: string
  /**
   * O que a tela mostra: o nome corrigido quando existe, o do perfil quando
   * não. A precedência é resolvida aqui e não no banco de propósito — num
   * gatilho, a próxima mensagem do WhatsApp desfaria a correção de uma pessoa,
   * que é exatamente o defeito que a correção existe para consertar.
   */
  nome: string | null
  /** O nome do perfil do WhatsApp, sempre. É o que a pessoa escolheu para si. */
  nomeDoPerfil: string | null
  /** Corrigido por gente ou vindo da planilha. Vazio = ninguém corrigiu. */
  nomeReal: string
  /** Anotação de quem atende. Não vai para o WhatsApp nem para automação. */
  notas: string
  /** O que o fluxo coletou. As chaves mudam de fluxo para fluxo. */
  campos: Record<string, string>
  ultimaEm: string | null
  /**
   * A última mensagem **da pessoa**, que é de onde a janela de 24h conta.
   *
   * Diferente de `ultimaEm`, que é a última de qualquer lado: com o bot
   * respondendo depois, `ultimaEm` é a hora da resposta dele, e a conta da
   * janela sairia errada **para mais** — a tela diria que dá tempo quando já
   * não dá, que é o pior lado do erro.
   */
  ultimaEntradaEm: string | null
  ultimaDirecao: Direcao | null
  ultimoTexto: string | null
  /**
   * O `type` que a Meta mandou na última mensagem — `audio`, `image`,
   * `sticker`, `document`... Nulo quando a última foi nossa (saída não tem
   * `type` da Meta) ou quando o payload não trouxe.
   *
   * Existe para a prévia da fila parar de dizer "mídia ou mensagem sem texto"
   * para foto, áudio, figurinha e PDF igualmente: quatro coisas com urgências
   * diferentes, e quem decide o que abrir primeiro decidia no escuro.
   */
  ultimoTipo: string | null
  /** `false` quando a última saída não teve confirmação do canal. */
  ultimaEntregue: boolean | null
  /** Pausa persistente do bot para este contato. */
  automacaoAtiva: boolean
  /** Handoff sem `resolvido_em`. `null` = ninguém esperando. */
  aguardando: { motivo: string; desde: string } | null
  /** Quem assumiu este contato. `null` = ninguém. */
  atribuidoA: string | null
  /** Ver a 0049. `estadoEfetivo` já considera o prazo de um adiamento vencido. */
  estado: 'aberta' | 'adiada' | 'resolvida'
  estadoEfetivo: 'aberta' | 'adiada' | 'resolvida'
  adiadaAte: string | null
  adiadaNota: string | null
  /** Sinais derivados do histórico; nunca são gravados de volta no contato. */
  etiquetas: EtiquetaDeLead[]
  /** As que uma pessoa criou e aplicou (0025). Estas são linha no banco. */
  etiquetasManuais: Etiqueta[]
  criadoEm: string
}

export type Direcao = 'entrada' | 'saida'

export const ETIQUETAS_DE_LEAD = [
  'abriu_com_midia',
  'foi_para_pessoa',
  'nao_respondeu',
] as const

export type EtiquetaDeLead = (typeof ETIQUETAS_DE_LEAD)[number]

/** O arquivo de uma mensagem, quando ela tem um. `texto` é a legenda. */
export type AnexoDaMensagem = {
  midia: TipoDeMidia
  url: string
  nomeArquivo?: string
}

export type MensagemDoLead = {
  id: string
  direcao: Direcao
  texto: string | null
  ts: string
  /** Saídas que ainda não tiveram confirmação do canal não são entrega certa. */
  entregue: boolean
  /**
   * Ausente na esmagadora maioria das linhas.
   *
   * Sem isto, a conversa mostraria só a legenda — e um arquivo entregue viraria
   * linha em branco no histórico, que é pior do que não ter mandado nada: quem
   * atende não descobre que a foto do plano já foi.
   */
  anexo?: AnexoDaMensagem
}

export type Conversa = {
  mensagens: MensagemDoLead[]
  /** `true` = a conversa é maior que o teto e o começo dela ficou de fora. */
  cortada: boolean
}

/** O mínimo que o navegador precisa para avisar uma nova fila humana. */
export type AlertaDeHandoff = {
  /** Inclui o instante do handoff para uma segunda fila do mesmo lead avisar de novo. */
  id: string
  contatoId: string
  nome: string | null
  motivo: string
  desde: string
}

/** Teto de mensagens numa tela só. Quem estoura isso é avisado, não enganado. */
export const TETO_DE_MENSAGENS = 500

const direcaoSchema = z.enum(['entrada', 'saida'])

type Linha = {
  contact_id: string
  wa_id: string
  nome: string | null
  campos: unknown
  criado_em: string
  ultima_em: string | null
  ultima_entrada_em: string | null
  ultima_direcao: string | null
  atribuido_a: string | null
  estado?: string | null
  estado_efetivo?: string | null
  adiada_ate?: string | null
  adiada_nota?: string | null
  ultimo_texto: string | null
  ultima_entregue: boolean | null
  automacao_ativa: boolean
  handoff_motivo: string | null
  handoff_em: string | null
  nome_real: string
  notas: string
  ultimo_tipo: string | null
}

// Numa linha só, e não concatenado: o supabase-js lê esta string no nível de
// tipo para saber o formato do retorno, e concatenação vira `string` genérica —
// aí o tipo do `data` desanda e o `tsc` acusa.
const COLUNAS =
  'contact_id, client_id, wa_id, nome, nome_real, notas, campos, criado_em, ultima_em, ultima_entrada_em, ultima_direcao, ultimo_texto, ultimo_tipo, handoff_motivo, handoff_em, ultima_entregue, automacao_ativa, atribuido_a, estado, estado_efetivo, adiada_ate, adiada_nota'

/**
 * `campos` é `jsonb`: o banco aceita qualquer coisa ali. Hoje só o motor
 * escreve, e sempre string — mas a tela de leads é justamente onde um dado
 * torto apareceria, e ela não pode ser a parte que quebra.
 *
 * Por isso a leitura é tolerante de propósito, ao contrário do grafo em
 * `fluxos.ts`: lá um rascunho inválido tem que estourar, porque o motor ia
 * executar aquilo. Aqui ninguém executa nada — é texto numa célula. Valor que
 * não é string vira JSON legível em vez de sumir; sumir seria perder o lead.
 */
const camposSchema = z.record(z.string(), z.unknown())

function paraCampos(bruto: unknown, waId: string): Record<string, string> {
  const analise = camposSchema.safeParse(bruto ?? {})
  if (!analise.success) {
    throw new Error(
      `os campos do contato ${waId} não são um objeto no banco: ${analise.error.issues[0]?.message}`,
    )
  }

  return Object.fromEntries(
    Object.entries(analise.data).map(([chave, valor]) => [
      chave,
      typeof valor === 'string' ? valor : JSON.stringify(valor),
    ]),
  )
}

function paraLead(linha: Linha): Lead {
  const direcao = direcaoSchema.safeParse(linha.ultima_direcao)

  const nomeReal = (linha.nome_real ?? '').trim()

  return {
    contatoId: linha.contact_id,
    waId: linha.wa_id,
    nome: nomeReal !== '' ? nomeReal : linha.nome,
    nomeDoPerfil: linha.nome,
    nomeReal,
    notas: linha.notas ?? '',
    campos: paraCampos(linha.campos, linha.wa_id),
    ultimaEm: linha.ultima_em,
    ultimaEntradaEm: linha.ultima_entrada_em,
    ultimaDirecao: direcao.success ? direcao.data : null,
    ultimoTexto: linha.ultimo_texto,
    ultimoTipo: linha.ultimo_tipo,
    ultimaEntregue: linha.ultima_entregue,
    automacaoAtiva: linha.automacao_ativa,
    aguardando:
      linha.handoff_motivo && linha.handoff_em
        ? { motivo: linha.handoff_motivo, desde: linha.handoff_em }
        : null,
    atribuidoA: linha.atribuido_a,
    estado: (linha.estado ?? 'aberta') as 'aberta' | 'adiada' | 'resolvida',
    estadoEfetivo: (linha.estado_efetivo ?? linha.estado ?? 'aberta') as
      | 'aberta'
      | 'adiada'
      | 'resolvida',
    adiadaAte: (linha.adiada_ate ?? null) as string | null,
    adiadaNota: (linha.adiada_nota ?? null) as string | null,
    etiquetas: [],
    etiquetasManuais: [],
    criadoEm: linha.criado_em,
  }
}

function tipoDaMensagem(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null
  return typeof payload.type === 'string' ? payload.type : null
}

/**
 * Fila enxuta para o alerta do Inbox.
 *
 * Não reutiliza `COLUNAS`: o alerta só precisa de dados seguros para aparecer
 * na notificação e assim continua compatível enquanto uma migration de outra
 * tela ainda aguarda aplicação. A rota que a usa passa pelo `proxy`, que exige
 * a sessão do painel antes de chegar aqui.
 */
export async function listarAlertasDeHandoff(clienteId: string): Promise<AlertaDeHandoff[]> {
  const { data, error } = await db()
    .from('leads')
    .select('contact_id, nome, handoff_motivo, handoff_em')
    .eq('client_id', clienteId)
    .not('handoff_em', 'is', null)
    .order('handoff_em', { ascending: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler a fila de alertas: ${error.message}`)

  return (data as {
    contact_id: string
    nome: string | null
    handoff_motivo: string | null
    handoff_em: string | null
  }[]).flatMap((linha) => {
    if (!linha.handoff_motivo || !linha.handoff_em) return []
    return [{
      id: `${linha.contact_id}:${linha.handoff_em}`,
      contatoId: linha.contact_id,
      nome: linha.nome,
      motivo: linha.handoff_motivo,
      desde: linha.handoff_em,
    }]
  })
}

/**
 * Classifica pela história, não por uma cópia em `contacts.campos`.
 *
 * Assim uma resolução de handoff ou uma nova resposta muda o filtro na próxima
 * leitura sem sincronização. As consultas são por lote: o custo cresce em
 * linhas, não em uma ida ao banco por lead.
 */
async function classificar(leads: Lead[]): Promise<Lead[]> {
  if (leads.length === 0) return leads

  const contatos = leads.map((lead) => lead.contatoId)
  // As duas famílias juntas e em paralelo: a derivada sai do histórico, a
  // manual sai de `contato_etiquetas`, e a tela mostra as duas lado a lado.
  const [derivadas, manuais] = await Promise.all([
    etiquetasPorContato(contatos),
    etiquetasDeContatos(contatos),
  ])

  return leads.map((lead) => ({
    ...lead,
    etiquetas: derivadas.get(lead.contatoId) ?? [],
    etiquetasManuais: manuais.get(lead.contatoId) ?? [],
  }))
}

/**
 * As etiquetas de um lote de contatos.
 *
 * Separado de `classificar` porque o filtro por etiqueta precisa da mesma
 * conta **antes** de saber quais leads mostrar: com paginação, filtrar a página
 * já carregada daria contagem errada e página faltando.
 */
async function etiquetasPorContato(
  contatos: string[],
): Promise<Map<string, EtiquetaDeLead[]>> {
  const porContato = new Map<string, EtiquetaDeLead[]>()
  if (contatos.length === 0) return porContato

  const [entradas, sessoes] = await Promise.all([
    db()
      .from('messages')
      .select('id, contact_id, payload, ts')
      .in('contact_id', contatos)
      .eq('direcao', 'entrada')
      .order('ts', { ascending: true })
      .order('id', { ascending: true }),
    db().from('sessions').select('id, contact_id').in('contact_id', contatos),
  ])

  if (entradas.error) {
    throw new Error(`não deu para classificar as mensagens dos leads: ${entradas.error.message}`)
  }
  if (sessoes.error) {
    throw new Error(`não deu para classificar os atendimentos dos leads: ${sessoes.error.message}`)
  }

  const contagemDeEntradas = new Map<string, number>()
  const primeiraEntrada = new Map<string, unknown>()
  for (const mensagem of entradas.data as { contact_id: string; payload: unknown }[]) {
    contagemDeEntradas.set(
      mensagem.contact_id,
      (contagemDeEntradas.get(mensagem.contact_id) ?? 0) + 1,
    )
    if (!primeiraEntrada.has(mensagem.contact_id)) {
      primeiraEntrada.set(mensagem.contact_id, mensagem.payload)
    }
  }

  const contatoPorSessao = new Map(
    (sessoes.data as { id: string; contact_id: string }[]).map((sessao) => [
      sessao.id,
      sessao.contact_id,
    ]),
  )
  const sessoesIds = [...contatoPorSessao.keys()]
  const contatosComHandoff = new Set<string>()

  if (sessoesIds.length > 0) {
    const { data, error } = await db()
      .from('handoffs')
      .select('session_id')
      .in('session_id', sessoesIds)

    if (error) throw new Error(`não deu para classificar os handoffs dos leads: ${error.message}`)
    for (const handoff of data as { session_id: string }[]) {
      const contatoId = contatoPorSessao.get(handoff.session_id)
      if (contatoId) contatosComHandoff.add(contatoId)
    }
  }

  for (const contatoId of contatos) {
    const etiquetas: EtiquetaDeLead[] = []
    const tipoInicial = tipoDaMensagem(primeiraEntrada.get(contatoId))

    // É a mesma fronteira da entrada do motor: texto e resposta interativa são
    // conversa; áudio, imagem, localização e qualquer outro formato vão para
    // uma pessoa e contam como mídia aqui.
    if (tipoInicial && tipoInicial !== 'text' && tipoInicial !== 'interactive') {
      etiquetas.push('abriu_com_midia')
    }
    if (contatosComHandoff.has(contatoId)) etiquetas.push('foi_para_pessoa')
    if (contagemDeEntradas.get(contatoId) === 1) etiquetas.push('nao_respondeu')

    porContato.set(contatoId, etiquetas)
  }

  return porContato
}

/** Os leads do cliente, o mais recente primeiro. Quem nunca falou vai no fim. */
export async function listarLeads(clienteId: string): Promise<Lead[]> {
  const { data, error } = await db()
    .from('leads')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('ultima_em', { ascending: false, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os leads: ${error.message}`)
  return classificar((data as Linha[]).map(paraLead))
}

/** Quantos leads o cliente tem, sem trazer nenhum deles. */
export async function contarLeads(clienteId: string): Promise<number> {
  const { count, error } = await db()
    .from('leads')
    .select('contact_id', { count: 'exact', head: true })
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return 0
  if (error) throw new Error(`não deu para contar os leads: ${error.message}`)
  return count ?? 0
}

/** Quantos leads deste cliente esperam uma pessoa agora. */
export async function contarEsperandoPessoa(clienteId: string): Promise<number> {
  const { count, error } = await db()
    .from('leads')
    .select('contact_id', { count: 'exact', head: true })
    .eq('client_id', clienteId)
    .not('handoff_em', 'is', null)

  if (ehIdInvalido(error)) return 0
  if (error) throw new Error(`não deu para contar quem espera atendimento: ${error.message}`)
  return count ?? 0
}

/** Quantos leads cabem numa tela. Cinquenta é o combinado do plano mestre. */
export const LEADS_POR_PAGINA = 50

/** Nada de busca gigante: o campo é para nome e telefone, não para texto livre. */
const LIMITE_DA_BUSCA = 60

/**
 * Por quem a conversa está atribuída.
 *
 * `todos` não filtra; `sem-dono` traz o que ninguém assumiu — que é a fila de
 * verdade, a que precisa de gente; qualquer outro valor é o id de um usuário e
 * vira "os chats dele". É o rail `Atribuído` do Inbox.
 */
export type FiltroDeAtribuicao = 'todos' | 'sem-dono' | (string & {})

/**
 * Em que pé está a conversa — o eixo que o rail de atribuição não responde.
 *
 * `aberta` é o que a fila mostra por padrão: o que precisa de alguém hoje.
 * `adiada` é "volto nisso dia tal" e `resolvida` é "acabou". Ver a 0049.
 *
 * **A leitura usa `estado_efetivo`, não `estado`**: uma conversa adiada cujo
 * prazo venceu já é uma conversa aberta, e a view resolve isso para que nenhum
 * chamador precise lembrar de comparar a data.
 */
export type FiltroDeEstado = 'aberta' | 'adiada' | 'resolvida' | 'todas'

/**
 * Até quantas conversas a fila inteira vai para o navegador de uma vez.
 *
 * ---------------------------------------------------------------------------
 * Por que existe um teto, e por que ele é a condição de honestidade
 * ---------------------------------------------------------------------------
 *
 * Os dois rails do Inbox (estado e atribuição) filtram campos que **já vêm em
 * cada `Lead`** — `estadoEfetivo` e `atribuidoA`. Quando a fila inteira está
 * na mão do navegador, trocar de aba é trocar um `filter()`: instantâneo, sem
 * ida ao servidor.
 *
 * Isso só é verdade enquanto a lista **não está paginada**. Com 500 conversas
 * em páginas de 50, filtrar o que está carregado responde "Adiadas 40" e mostra
 * três, porque as outras 37 estão na página 2. Não é lentidão: é resposta
 * errada, que é pior.
 *
 * Daí o teto. Abaixo dele a fila vem inteira e os rails são locais; acima, o
 * servidor volta a filtrar e pagina como antes. A troca é automática e o
 * comportamento antigo continua inteiro do outro lado.
 *
 * **200 sai de medida, não de palpite**: um lead pesa ~490 bytes no banco
 * (média real em 13/set/2026), então 200 são ~100KB de JSON — menos que uma
 * foto de perfil. O gargalo não é o tamanho; é a honestidade do filtro.
 */
export const TETO_DA_FILA_LOCAL = 200

export type FiltroDeLeads = {
  /** Nome ou telefone, parcial. Vazio = sem busca. */
  busca?: string
  etiqueta?: EtiquetaDeLead | null
  /** Etiqueta manual (0025). Combina com `etiqueta` — as duas restringem. */
  etiquetaId?: string | null
  atribuicao?: FiltroDeAtribuicao
  /** Em que pé está. Ausente = `aberta`, que é o que a fila deve mostrar. */
  estado?: FiltroDeEstado
  /** Só quem espera uma pessoa. É o que a fila do Inbox olha primeiro. */
  soEsperando?: boolean
  /** Começa em 1. Fora da faixa, cai na primeira. */
  pagina?: number
  porPagina?: number
}

export type PaginaDeLeads = {
  leads: Lead[]
  /** Quantos leads o filtro inteiro tem, não quantos vieram nesta página. */
  total: number
  pagina: number
  paginas: number
}

/**
 * O que sobra de um termo de busca antes de virar filtro.
 *
 * **O `or` do PostgREST é uma string com vírgula, parêntese e `*` com
 * significado.** Um termo com esses caracteres não "quebra a consulta": ele
 * *vira* consulta, e passa a escolher linha por conta própria. Por isso a
 * limpeza é uma lista do que **entra** — letra, número, espaço e a pontuação
 * que aparece em nome e telefone — e não uma lista do que sai; lista do que sai
 * sempre esquece um caractere.
 *
 * `%` some junto: é curinga do `like` e transformaria uma busca em "traga
 * tudo". `+` também, e por outro motivo: `wa_id` é guardado sem o sinal
 * (`5544...`), então ele não acharia nada e ainda vira espaço ao ser codificado
 * na URL.
 */
export function limparBusca(bruto: string): string {
  return bruto
    .slice(0, LIMITE_DA_BUSCA)
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .trim()
}

/**
 * Uma página de leads do cliente.
 *
 * **Por que a etiqueta é resolvida antes e não depois.** Ela não é coluna: sai
 * do histórico de mensagens e handoffs. Filtrar a página já carregada daria
 * contagem errada ("3 de 50") e página faltando. Então, com etiqueta escolhida,
 * o caminho é achar os contatos que a têm e paginar dentro deles — é a leitura
 * mais cara daqui, e é por isso que ela só acontece quando alguém pede o filtro.
 */
export async function paginarLeads(
  clienteId: string,
  filtro: FiltroDeLeads = {},
): Promise<PaginaDeLeads> {
  const porPagina = filtro.porPagina ?? LEADS_POR_PAGINA
  const termo = limparBusca(filtro.busca ?? '')

  /**
   * Os dois filtros por etiqueta restringem, e por isso a interseção.
   *
   * `null` significa "sem restrição por etiqueta"; lista vazia significa
   * "nenhum contato passa", e as duas precisam ser distinguíveis — tratá-las
   * igual mostraria a lista inteira justo quando o filtro não achou ninguém.
   */
  let permitidos: string[] | null = null

  if (filtro.etiqueta) {
    permitidos = await contatosComEtiqueta(clienteId, filtro.etiqueta)
  }
  if (filtro.etiquetaId) {
    const manuais = await contatosComEtiquetaManual(clienteId, filtro.etiquetaId)
    permitidos = permitidos === null ? manuais : permitidos.filter((id) => manuais.includes(id))
  }
  if (permitidos !== null && permitidos.length === 0) {
    return { leads: [], total: 0, pagina: 1, paginas: 1 }
  }

  const consulta = () => {
    let q = db()
      .from('leads')
      .select(COLUNAS, { count: 'exact' })
      .eq('client_id', clienteId)
      .order('ultima_em', { ascending: false, nullsFirst: false })
      // Desempate estável: sem ele, dois leads com o mesmo instante podem
      // trocar de lugar entre páginas e um deles nunca aparece.
      .order('contact_id', { ascending: true })

    if (termo !== '') {
      // Buscar nos dois nomes, não só no do perfil: quem corrigiu "Rodrigão"
      // para "Rodrigo" vai procurar por Rodrigo, e antes disto não achava nada.
      const partes = [
        `nome.ilike.*${termo}*`,
        `nome_real.ilike.*${termo}*`,
        `wa_id.ilike.*${termo}*`,
      ]
      // E buscar pelas formas do telefone, não só pelo que foi digitado: quem
      // procura "(11) 98765-4321" não acha `551187654321` com `ilike`, e o nono
      // dígito faz o mesmo aparelho ter duas grafias. `chavesDoTelefone`
      // devolve as duas; sem isto, a busca por telefone só funciona quando a
      // pessoa digita exatamente como a Meta gravou.
      for (const chave of chavesDoTelefone(termo)) partes.push(`wa_id.eq.${chave}`)
      q = q.or(partes.join(','))
    }
    if (permitidos) q = q.in('contact_id', permitidos)

    // `sem-dono` é a fila que precisa de gente; um id vira "os chats dele".
    if (filtro.atribuicao === 'sem-dono') q = q.is('atribuido_a', null)
    else if (filtro.atribuicao && filtro.atribuicao !== 'todos') {
      q = q.eq('atribuido_a', filtro.atribuicao)
    }

    /*
     * O estado, por `estado_efetivo`.
     *
     * O default é `aberta` e não `todas` de propósito: uma fila que mostra
     * tudo é a fila que existia antes da 0049, onde a conversa resolvida
     * ontem disputa espaço com quem espera resposta agora. Quem quiser o
     * conjunto inteiro pede `todas` explicitamente.
     */
    const estado = filtro.estado ?? 'aberta'
    if (estado !== 'todas') q = q.eq('estado_efetivo', estado)

    if (filtro.soEsperando) q = q.not('handoff_em', 'is', null)

    return q
  }

  // Uma primeira ida só para saber o tamanho: quem digita "3" na página 9 e
  // apaga um dígito não pode receber uma página vazia sem explicação.
  const { count: bruto, error: erroDaContagem } = await consulta().range(0, 0)
  if (ehIdInvalido(erroDaContagem)) return { leads: [], total: 0, pagina: 1, paginas: 1 }
  if (erroDaContagem) throw new Error(`não deu para contar os leads: ${erroDaContagem.message}`)

  const total = bruto ?? 0
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const pagina = Math.min(Math.max(1, Math.floor(filtro.pagina ?? 1)), paginas)
  const inicio = (pagina - 1) * porPagina

  const { data, error } = await consulta().range(inicio, inicio + porPagina - 1)
  if (ehIdInvalido(error)) return { leads: [], total: 0, pagina: 1, paginas: 1 }
  if (error) throw new Error(`não deu para listar os leads: ${error.message}`)

  return {
    leads: await classificar((data as Linha[]).map(paraLead)),
    total,
    pagina,
    paginas,
  }
}

/**
 * O carimbo da mensagem mais recente da conta — o "tem coisa nova?" do Inbox.
 *
 * Existe para a tela se atualizar sozinha sem recarregar a página inteira a
 * cada poucos segundos. É de propósito a consulta mais barata do arquivo: uma
 * linha, uma coluna, ordenada por um índice que já existe. Quem chama compara
 * com o que tinha e só então pede o `refresh` — que aí sim custa.
 *
 * Vem por `contacts!inner` porque `messages` não guarda o cliente: o vínculo é
 * o contato. Sem o `inner`, mensagem de outra conta entraria na conta errada e
 * um Inbox piscaria por causa do movimento de outro.
 *
 * `null` quando a conta ainda não tem mensagem nenhuma — que é diferente de
 * erro, e quem chama trata como "nada novo".
 */
export async function pulsoDaConta(clienteId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('messages')
    .select('ts, contacts!inner(client_id)')
    .eq('contacts.client_id', clienteId)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o pulso da conta: ${error.message}`)
  return (data as { ts: string } | null)?.ts ?? null
}

/**
 * Os contatos deste cliente que têm uma etiqueta.
 *
 * Lê os ids do cliente e depois o histórico deles. É a consulta mais pesada do
 * arquivo — e é a mesma que a tela fazia em toda visita antes da paginação,
 * agora só quando alguém escolhe o filtro.
 */
async function contatosComEtiqueta(
  clienteId: string,
  etiqueta: EtiquetaDeLead,
): Promise<string[]> {
  const { data, error } = await db().from('contacts').select('id').eq('client_id', clienteId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os contatos do cliente: ${error.message}`)

  const ids = (data as { id: string }[]).map((linha) => linha.id)
  const porContato = await etiquetasPorContato(ids)
  return ids.filter((id) => porContato.get(id)?.includes(etiqueta))
}

/**
 * Um lead.
 *
 * Filtra por cliente **também**, e não só pelo id do contato: a URL é adivinhável
 * e um id de outro cliente não pode abrir só porque alguém o digitou.
 */
export async function acharLead(clienteId: string, contatoId: string): Promise<Lead | null> {
  const { data, error } = await db()
    .from('leads')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar o lead: ${error.message}`)
  if (!data) return null
  const [lead] = await classificar([paraLead(data as Linha)])
  return lead ?? null
}

/**
 * A conversa inteira, na ordem em que aconteceu.
 *
 * Lê do fim para o começo e devolve invertido: numa conversa longa o que
 * interessa é o que acabou de acontecer, não o "oi" de três meses atrás. Se
 * bater no teto, `cortada` avisa — teto silencioso mente dizendo que aquilo é
 * a conversa toda.
 */
export async function lerConversa(
  contatoId: string,
  teto: number = TETO_DE_MENSAGENS,
): Promise<Conversa> {
  const { data, error } = await db()
    .from('messages')
    .select('id, direcao, texto, ts, entregue, payload')
    .eq('contact_id', contatoId)
    .order('ts', { ascending: false })
    .limit(teto + 1)

  if (ehIdInvalido(error)) return { cortada: false, mensagens: [] }
  if (error) throw new Error(`não deu para ler a conversa: ${error.message}`)

  const linhas = data as {
    id: string
    direcao: string
    texto: string | null
    ts: string
    entregue: boolean
    payload: unknown
  }[]
  const cortada = linhas.length > teto

  return {
    cortada,
    mensagens: linhas
      .slice(0, teto)
      .reverse()
      .map((m) => {
        const anexo = anexoDoPayload(m.payload)
        return {
          id: m.id,
          direcao: direcaoSchema.parse(m.direcao),
          texto: m.texto,
          ts: m.ts,
          entregue: m.entregue,
          ...(anexo ? { anexo } : {}),
        }
      }),
  }
}

/**
 * O anexo guardado em `messages.payload`, quando há um.
 *
 * `payload` é `jsonb` e carrega coisas diferentes conforme a mensagem — opções
 * de uma pergunta, o `type` do que chegou do WhatsApp, e agora a mídia que
 * saiu. Ler defensivamente é o que impede uma linha antiga, de antes deste
 * campo existir, de derrubar a tela do lead.
 */
function anexoDoPayload(payload: unknown): AnexoDaMensagem | null {
  if (!payload || typeof payload !== 'object') return null
  const bruto = payload as Record<string, unknown>
  if (typeof bruto.midia !== 'string' || typeof bruto.url !== 'string') return null
  if (!(TIPOS_DE_MIDIA as readonly string[]).includes(bruto.midia)) return null

  return {
    midia: bruto.midia as TipoDeMidia,
    url: bruto.url,
    ...(typeof bruto.nomeArquivo === 'string' ? { nomeArquivo: bruto.nomeArquivo } : {}),
  }
}

/**
 * Corrige o nome do contato.
 *
 * Grava em `nome_real` e **não** em `nome`: o do perfil continua sendo
 * sobrescrito a cada mensagem que chega, e é ele que identifica a conta do
 * WhatsApp. Vazio limpa a correção e devolve a exibição para o perfil.
 *
 * O par `(contato, cliente)` é conferido na escrita pelo mesmo motivo das
 * escritas de fluxo: id de contato vindo da tela não prova de quem ele é.
 */
export async function corrigirNome(
  clienteId: string,
  contatoId: string,
  nome: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from('contacts')
    .update({ nome_real: nome.trim().slice(0, 120) })
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para corrigir o nome: ${error.message}`)
  return data !== null
}

// O teto mora em `core/flow/limites.ts` desde a 0044: o bloco de Anotação é
// editado no navegador, e este arquivo é `server-only`. Reexportado aqui para
// quem já o importava daqui não ter que saber que ele mudou de casa.
export { LIMITE_DA_NOTA }

export async function salvarNotas(
  clienteId: string,
  contatoId: string,
  notas: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from('contacts')
    .update({ notas: notas.trim().slice(0, LIMITE_DA_NOTA) })
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para salvar a anotação: ${error.message}`)
  return data !== null
}

/**
 * Acrescenta uma linha à anotação do contato — o bloco de Anotação (0044).
 *
 * **Acrescenta, e nunca substitui.** A anotação é onde a equipe escreve o que
 * sabe da pessoa; um bot que sobrescrevesse aquilo apagaria trabalho humano em
 * silêncio, e a primeira vez que alguém percebesse seria a vez em que a
 * informação fez falta. Por isso é leitura seguida de escrita, e não `update`
 * direto.
 *
 * **O cabeçalho com data e origem não é enfeite.** Quem abre a ficha e lê uma
 * frase precisa saber se foi um colega ou o bot que escreveu — sem isso, uma
 * anotação automática vira uma afirmação humana sobre o cliente. Ler "o texto
 * apareceu sozinho e ninguém confirmou" é a diferença entre um registro e um
 * boato.
 *
 * O teto é o mesmo do campo, e ele corta **pelo começo**: numa anotação que
 * encheu, o que interessa é o fim — o que aconteceu por último. Cortar pelo fim
 * apagaria justamente a linha que acabou de ser escrita.
 */
export async function acrescentarNota(
  clienteId: string,
  contatoId: string,
  texto: string,
  quando: Date = new Date(),
): Promise<boolean> {
  const limpo = texto.trim()
  if (limpo === '') return false

  const { data, error } = await db()
    .from('contacts')
    .select('notas')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para ler a anotação: ${error.message}`)
  if (!data) return false

  const anterior = ((data as { notas: string | null }).notas ?? '').trim()
  const dia = quando.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const linha = `[${dia} · automação] ${limpo}`
  const junto = anterior === '' ? linha : `${anterior}\n\n${linha}`

  const { error: erroAoSalvar } = await db()
    .from('contacts')
    .update({ notas: junto.slice(-LIMITE_DA_NOTA) })
    .eq('id', contatoId)
    .eq('client_id', clienteId)

  if (erroAoSalvar) throw new Error(`não deu para acrescentar a anotação: ${erroAoSalvar.message}`)
  return true
}

/** O que a conciliação precisa saber dos contatos deste cliente. */
export async function contatosConhecidos(clienteId: string): Promise<ContatoConhecido[]> {
  const { data, error } = await db()
    .from('contacts')
    .select('id, wa_id, nome, nome_real')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os contatos: ${error.message}`)

  return (data as { id: string; wa_id: string; nome: string | null; nome_real: string }[]).map(
    (linha) => ({
      contatoId: linha.id,
      waId: linha.wa_id,
      nomeAtual: (linha.nome_real ?? '').trim() !== '' ? linha.nome_real.trim() : linha.nome,
    }),
  )
}

export type ResultadoDaImportacao = {
  renomeados: number
  criados: number
  pendentes: { numero: number; nome: string; telefone: string; motivo: string }[]
}

/**
 * Aplica uma conciliação já decidida.
 *
 * **Só escreve `nome_real`, e só quando a planilha traz um nome.** Linha sem
 * nome existe para trazer o telefone, e sobrescrever com vazio apagaria a
 * correção que alguém já tinha feito à mão.
 *
 * As pendências voltam inteiras, com o número da linha, para a pessoa consertar
 * na planilha dela e importar de novo. Elas não viram nada no banco: um contato
 * sem telefone utilizável não tem como receber mensagem, e criá-lo só encheria
 * a lista de gente que o bot nunca vai alcançar.
 */
export async function aplicarImportacao(
  clienteId: string,
  conciliacoes: Conciliacao[],
): Promise<ResultadoDaImportacao> {
  let renomeados = 0
  let criados = 0
  const pendentes: ResultadoDaImportacao['pendentes'] = []

  for (const item of conciliacoes) {
    if (item.tipo === 'pendente') {
      pendentes.push({
        numero: item.linha.numero,
        nome: item.linha.nome,
        telefone: item.linha.telefone,
        motivo: item.motivo,
      })
      continue
    }

    const nome = item.linha.nome.trim()

    if (item.tipo === 'casou') {
      if (nome === '' || nome === (item.nomeAtual ?? '').trim()) continue
      if (await corrigirNome(clienteId, item.contatoId, nome)) renomeados += 1
      continue
    }

    // Contato novo: nasce só com o telefone e o nome de verdade. `nome` fica
    // vazio até a pessoa escrever pela primeira vez — é a Meta que preenche o
    // perfil, e inventar um aqui seria dizer que ela escolheu esse nome.
    const { error } = await db()
      .from('contacts')
      .insert({ client_id: clienteId, wa_id: item.waId, nome_real: nome.slice(0, 120) })

    // Corrida com uma mensagem que chegou entre a conciliação e o insert: o
    // contato passou a existir e a importação não deve estourar por isso.
    if (error?.code === '23505') continue
    if (error) throw new Error(`não deu para criar o contato: ${error.message}`)
    criados += 1
  }

  return { renomeados, criados, pendentes }
}

/**
 * Quantas conversas há em cada aba do rail `Atribuído`.
 *
 * **A contagem é o que faz o rail valer a pena.** Sem ela, escolher uma aba é
 * apostar: a pessoa clica em "sem dono" para descobrir se tem alguma coisa lá.
 * Com o número do lado, o rail vira o resumo da mesa antes de qualquer clique.
 *
 * Uma consulta só, contando na aplicação. São no máximo algumas centenas de
 * linhas por cliente e a alternativa seria um `group by` por PostgREST — que
 * não existe sem view nova, e view por causa de contagem é migration a mais
 * para manter.
 */
export async function contarPorAtribuicao(
  clienteId: string,
): Promise<{ total: number; semDono: number; porUsuario: Map<string, number> }> {
  const { data, error } = await db()
    .from('leads')
    .select('atribuido_a')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return { total: 0, semDono: 0, porUsuario: new Map() }
  if (error) throw new Error(`não deu para contar as atribuições: ${error.message}`)

  const linhas = data as { atribuido_a: string | null }[]
  const porUsuario = new Map<string, number>()
  let semDono = 0

  for (const linha of linhas) {
    if (!linha.atribuido_a) semDono++
    else porUsuario.set(linha.atribuido_a, (porUsuario.get(linha.atribuido_a) ?? 0) + 1)
  }

  return { total: linhas.length, semDono, porUsuario }
}

/**
 * Cria um contato à mão, sem esperar a pessoa escrever.
 *
 * **É o único caminho em que um `wa_id` entra no sistema digitado por gente**,
 * e por isso ele passa por `chavesDoTelefone`: o `wa_id` é a identidade da
 * pessoa no WhatsApp, e gravar `(11) 98765-4321` ali criaria um contato que
 * nunca casa com a conversa que chegar depois — dois cadastros da mesma pessoa,
 * um deles morto, e ninguém entendendo por quê.
 *
 * Número que não dá para normalizar com segurança é recusado em vez de
 * adivinhado. `98765-4321` sem DDD pode ser de onze estados, e chutar o DDD do
 * cliente casaria a conversa de uma pessoa com o cadastro de outra.
 */
export async function criarContato(
  clienteId: string,
  dados: { nome: string; telefone: string },
): Promise<{ ok: true; contatoId: string } | { ok: false; motivo: string }> {
  const nome = dados.nome.trim()
  const chaves = chavesDoTelefone(dados.telefone)

  if (chaves.length === 0) {
    return {
      ok: false,
      motivo: 'escreva o telefone com DDD — sem ele não dá para saber de qual estado é',
    }
  }

  // A primeira chave é a forma completa com DDI. As outras são as grafias
  // alternativas do mesmo aparelho, e servem para descobrir se ele já existe.
  const [waId] = chaves

  const { data: existente, error: erroDaBusca } = await db()
    .from('contacts')
    .select('id, wa_id')
    .eq('client_id', clienteId)
    .in('wa_id', chaves)
    .limit(1)
    .maybeSingle()

  if (erroDaBusca && !ehIdInvalido(erroDaBusca)) {
    throw new Error(`não deu para conferir o telefone: ${erroDaBusca.message}`)
  }
  if (existente) {
    return { ok: false, motivo: 'este telefone já está na lista de contatos' }
  }

  const { data, error } = await db()
    .from('contacts')
    .insert({ client_id: clienteId, wa_id: waId, nome_real: nome })
    .select('id')
    .single()

  if (error?.code === '23505') return { ok: false, motivo: 'este telefone já está na lista' }
  if (error) throw new Error(`não deu para criar o contato: ${error.message}`)
  return { ok: true, contatoId: data.id as string }
}

/* -------------------------------------------------------------------------- */
/* O estado da conversa (0049)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Adia a conversa: ela sai da fila e volta na data.
 *
 * **A volta não é agendada, é comparada.** Não há processo que devolva nada —
 * `estado_efetivo` na view já trata prazo vencido como aberta. É o que faz o
 * adiamento sobreviver a um servidor que ficou fora do ar no fim de semana.
 *
 * A nota é opcional e vale a pena: adiamento sem motivo vira reaparecimento
 * sem contexto, e quem retoma na terça não lembra por que adiou na sexta.
 */
export async function adiarConversa(
  clienteId: string,
  contatoId: string,
  ate: Date,
  nota: string | null,
): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .update({
      estado: 'adiada',
      adiada_ate: ate.toISOString(),
      adiada_nota: nota?.trim() ? nota.trim().slice(0, 280) : null,
      resolvida_em: null,
    })
    .eq('id', contatoId)
    .eq('client_id', clienteId)

  if (error) throw new Error(`não deu para adiar a conversa: ${error.message}`)
}

/**
 * Marca como resolvida, ou devolve para a fila.
 *
 * O mesmo caminho para os dois sentidos porque é o mesmo gesto — e porque
 * reabrir precisa limpar o adiamento junto: uma conversa que estava adiada e
 * foi reaberta à mão não pode voltar a sumir na data antiga.
 */
export async function definirEstadoDaConversa(
  clienteId: string,
  contatoId: string,
  estado: 'aberta' | 'resolvida',
): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .update({
      estado,
      adiada_ate: null,
      adiada_nota: null,
      resolvida_em: estado === 'resolvida' ? new Date().toISOString() : null,
    })
    .eq('id', contatoId)
    .eq('client_id', clienteId)

  if (error) throw new Error(`não deu para mudar o estado da conversa: ${error.message}`)
}

/**
 * Quantas conversas em cada estado, para o rail dizer o tamanho de cada aba.
 *
 * **Sem a contagem, escolher uma aba é apostar** — a pessoa clica em "Adiadas"
 * para descobrir se tem algo lá. É a mesma razão pela qual `contarPorAtribuicao`
 * existe.
 *
 * Lê `estado_efetivo`: o adiamento vencido conta como aberta, que é onde ele
 * de fato vai aparecer.
 */
export async function contarPorEstado(
  clienteId: string,
): Promise<{ aberta: number; adiada: number; resolvida: number }> {
  const { data, error } = await db()
    .from('leads')
    .select('estado_efetivo')
    .eq('client_id', clienteId)

  const vazio = { aberta: 0, adiada: 0, resolvida: 0 }
  if (ehIdInvalido(error)) return vazio
  if (error) throw new Error(`não deu para contar por estado: ${error.message}`)

  const contagem = { ...vazio }
  for (const linha of (data ?? []) as { estado_efetivo: string | null }[]) {
    const estado = linha.estado_efetivo ?? 'aberta'
    if (estado === 'adiada') contagem.adiada += 1
    else if (estado === 'resolvida') contagem.resolvida += 1
    else contagem.aberta += 1
  }
  return contagem
}

/**
 * A fila inteira de um cliente, **sem filtro de estado nem de dono**, para os
 * rails filtrarem no navegador.
 *
 * ---------------------------------------------------------------------------
 * O que ela devolve, e o que o `null` significa
 * ---------------------------------------------------------------------------
 *
 * `null` é a resposta para "esta conta é grande demais para isto". Não é erro
 * nem lista vazia: é o sinal de que a tela deve continuar pedindo página por
 * página ao servidor, como sempre fez. Ver {@link TETO_DA_FILA_LOCAL}.
 *
 * Conta antes de trazer: uma consulta de contagem é barata, e trazer 5.000
 * linhas para descobrir que são demais seria pagar exatamente o preço que o
 * teto existe para evitar.
 *
 * A **busca por texto continua no servidor** e por isso entra aqui como
 * filtro: ela casa telefone por formas normalizadas (`chavesDoTelefone`), e
 * repetir essa regra no navegador seria duplicar a parte que já erra sozinha —
 * quem procura "(11) 98765-4321" não acha `551187654321` com comparação de
 * texto crua.
 */
export async function filaInteira(
  clienteId: string,
  opcoes: { busca?: string } = {},
): Promise<Lead[] | null> {
  const termo = (opcoes.busca ?? '').trim()

  // Só o tamanho, primeiro. `head: true` não traz linha nenhuma.
  const { count, error: erroDaContagem } = await db()
    .from('leads')
    .select('contact_id', { count: 'exact', head: true })
    .eq('client_id', clienteId)

  if (ehIdInvalido(erroDaContagem)) return []
  if (erroDaContagem) throw new Error(`não deu para medir a fila: ${erroDaContagem.message}`)
  if ((count ?? 0) > TETO_DA_FILA_LOCAL) return null

  /*
   * Reusa `paginarLeads` com `estado: 'todas'` em vez de repetir a montagem da
   * consulta: é ela que sabe juntar etiquetas, aplicar a busca por telefone e
   * ordenar por última mensagem. Uma segunda versão daquilo seria uma segunda
   * versão para manter — e a que erra é sempre a que ninguém lembra que existe.
   */
  const pagina = await paginarLeads(clienteId, {
    estado: 'todas',
    atribuicao: 'todos',
    busca: termo,
    pagina: 1,
    porPagina: TETO_DA_FILA_LOCAL,
  })

  return pagina.leads
}
