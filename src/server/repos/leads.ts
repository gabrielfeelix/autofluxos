import 'server-only'
import { z } from 'zod'
import type { Conciliacao, ContatoConhecido } from '@/core/contatos/planilha'
import { chavesDoTelefone, digitos } from '@/core/contatos/telefone'
import { padraoSemAcento } from '@/core/atividades'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import {
  cartoesDoPayload,
  casarToques,
  localDoPayload,
  menuDoPayload,
  toqueDoPayload,
  motivoDoNaoSuportado,
  type CartaoDeContato,
  type LocalDaMensagem,
  type MenuDoBot,
} from '@/core/payload-da-mensagem'
import { autorDoPayload, comoChamarOAutor } from '@/core/autor-da-mensagem'
import { ehArquivoGuardado, midiaDoTipo } from '@/core/midia-recebida'
import { urlsAssinadas } from './midia-recebida'
import { TIPOS_DE_MIDIA, type TipoDeMidia } from '@/core/flow/schema'
import { casarReacoes } from '@/core/reacoes'
import { linhasDoCard, type ProdutoDaLoja } from '@/core/loja'
import { db, ehIdInvalido } from '../db'
import type { AlcanceDeConversas } from '@/core/permissoes'

/**
 * Restringe uma consulta da view `leads` ao alcance de quem pergunta.
 *
 * Entra **na consulta**, nunca depois: filtrar a página já montada deixaria o
 * total e a paginação contando conversa de outra pessoa. Os donos são uuids
 * lidos do banco (`responsaveisDoEscopo`), nunca texto vindo da tela, e é isso
 * que permite montá-los dentro do `or`.
 */
function noAlcance<Q extends { or: (f: string) => Q; is: (c: string, v: null) => Q }>(q: Q, alcance: AlcanceDeConversas | undefined): Q {
  if (!alcance || alcance.tipo === 'tudo') return q
  if (alcance.tipo === 'nada' || alcance.donos.length === 0) return q.is('atribuido_a', null)
  return q.or(`atribuido_a.is.null,atribuido_a.in.(${alcance.donos.join(',')})`)
}
import { contatosComEtiqueta as contatosComEtiquetaManual, etiquetasDeContatos, type Etiqueta } from './etiquetas'

/**
 * Um lead é um contato visto pelo lado de quem vende: o que ele respondeu, se
 * alguém precisa assumir a conversa, e quando ele falou pela última vez.
 *
 * Nada aqui é tabela. É a view `leads` (0004), que junta `contacts`,
 * `messages` e `handoffs`, as duas últimas são agregações e o banco faz isso
 * melhor do que nós.
 */
export type Lead = {
  contatoId: string
  waId: string
  /**
   * O que a tela mostra: o nome corrigido quando existe, o do perfil quando
   * não. A precedência é resolvida aqui e não no banco de propósito, num
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
   * janela sairia errada **para mais**, a tela diria que dá tempo quando já
   * não dá, que é o pior lado do erro.
   */
  ultimaEntradaEm: string | null
  /**
   * Quando este contato chegou por anúncio, se chegou. Abre a janela de 72h
   * gratuita da Meta, e anda junto de `ultimaEntradaEm` em toda conta de prazo.
   * Ver `channels/janela.ts`. `null` quer dizer 24h e pago.
   */
  portaDeEntradaEm: string | null
  ultimaDirecao: Direcao | null
  ultimoTexto: string | null
  /**
   * O `type` que a Meta mandou na última mensagem, `audio`, `image`,
   * `sticker`, `document`... Nulo quando a última foi nossa (saída não tem
   * `type` da Meta) ou quando o payload não trouxe.
   *
   * Existe para a prévia da fila parar de dizer "mídia ou mensagem sem texto"
   * para foto, áudio, figurinha e PDF igualmente: quatro coisas com urgências
   * diferentes, e quem decide o que abrir primeiro decidia no escuro.
   */
  ultimoTipo: string | null
  /**
   * Quem mandou a última mensagem, quando ela saiu daqui.
   *
   * `null` nos dois quando não dá para saber, e isso **não é raro**: o eco da
   * coexistência (a pessoa respondeu pelo celular) chega pelo webhook sem
   * passar por `registrarSaida`, então não tem autor nenhum.
   */
  ultimoAutorTipo: string | null
  ultimoAutorNome: string | null
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

/** Um produto do card que saiu, só o que a bolha desenha. */
/**
 * Um card de produto como a pessoa viu no WhatsApp: foto, nome, a linha de
 * preço e o botão da loja. `titulo` e `detalhe` saem de `linhasDoCard`, a mesma
 * função que monta o corpo do `cta_url`, para a Inbox dizer o que o cliente leu.
 */
export type ProdutoNaMensagem = { nome: string; foto: string; titulo: string; detalhe: string; link: string | null }

/** O arquivo de uma mensagem, quando ela tem um. `texto` é a legenda. */
export type AnexoDaMensagem = {
  midia: TipoDeMidia
  url: string
  nomeArquivo?: string
}

// Os dois moram em `core/` porque são regra sobre dados, sem banco e sem rede,
// o mesmo motivo de `core/reacoes.ts`. Reexportados para as telas, que já
// pegam o resto dos tipos da conversa daqui.
export type { CartaoDeContato, LocalDaMensagem }

/** Uma reação grudada numa mensagem. `de` diz de que lado ela veio. */
export type ReacaoNaMensagem = {
  emoji: string
  de: Direcao
  /** O id **nosso** da linha da reação, para poder desfazê-la. */
  id: string
}

/** A mensagem citada, resumida ao que a bolha da citação mostra. */
export type Citada = {
  /** Ausente quando a citada não está no nosso histórico. Ver `citadaDoHistorico`. */
  id?: string
  texto: string | null
  direcao?: Direcao
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
   * Sem isto, a conversa mostraria só a legenda, e um arquivo entregue viraria
   * linha em branco no histórico, que é pior do que não ter mandado nada: quem
   * atende não descobre que a foto do plano já foi.
   */
  anexo?: AnexoDaMensagem
  /**
   * As fotos do card de produto que saiu (bot ou pessoa). O card grava o
   * produto inteiro em `payload.produtos`, e não `{ midia, url }`: sem isto a
   * conversa mostrava só o texto do card, e quem atende não via o que o
   * cliente recebeu no WhatsApp.
   */
  produtos?: ProdutoNaMensagem[]
  /**
   * O lugar que ela mandou. Ausente em quase toda linha.
   *
   * Sem isto, "📍 localização" aparecia na fila e a bolha ficava **vazia**,
   * quem abria a conversa via que algo tinha chegado e não via o quê. O dado
   * sempre esteve no `payload`; faltava desenhar.
   */
  /**
   * O arquivo que a pessoa mandou, já com URL assinada para a tela.
   *
   * Reusa `AnexoDaMensagem` de propósito: a bolha já sabe desenhar imagem,
   * vídeo, áudio e documento, e um tipo novo obrigaria a desenhar duas vezes a
   * mesma coisa. A diferença mora em quem produz a `url`, na saída ela é
   * pública e permanente; aqui é assinada e morre em cinco minutos.
   */
  recebido?: AnexoDaMensagem
  /**
   * Chegou arquivo e **não temos cópia**: passou do teto de 16 MB, ou o
   * download falhou, ou a mensagem é anterior à `0055`.
   *
   * Existe para a bolha dizer isso em vez de ficar vazia. "Sumiu minha foto" é
   * a reclamação mais comum do mercado neste recurso, ver
   * `docs/PLANO-MIDIA-RECEBIDA.md` , e a diferença entre um produto honesto e
   * um quebrado é uma frase.
   */
  semCopia?: true
  /**
   * A Meta disse `unsupported`: existe uma mensagem ali e ela **não vem** para
   * a API.
   *
   * É o caso de "ver uma vez", enquete, pagamento, evento e alguns cartões,
   * coisas que o WhatsApp entrega ao celular e não ao número de negócio. Não é
   * mídia sem cópia e não é mensagem vazia: os dois já tinham desenho próprio e
   * nenhum dos dois descreve isto.
   */
  naoSuportada?: true
  /** O que era o `unsupported`, quando a Meta disse. Ver `motivoDoNaoSuportado`. */
  motivoNaoSuportada?: string
  /**
   * A pessoa tocou num botão ou numa linha de lista, em vez de escrever.
   *
   * A bolha pinta diferente: "Reagendar aula" tocado e "reagendar aula"
   * digitado dizem coisas diferentes a quem atende. O primeiro é resposta
   * pronta, o segundo é a pessoa com as próprias palavras.
   */
  toque?: true
  /**
   * Os botões ou a lista que o bot mandou junto desta mensagem, e qual deles a
   * pessoa tocou. Sem isto o Inbox mostrava a pergunta e escondia as
   * respostas possíveis, e um menu que expirou sem toque parecia conversa
   * cortada.
   */
  menu?: MenuDoBot
  /**
   * Quem produziu esta mensagem, já escrito para a tela: "Gabriel Barbosa" ou
   * "automação". Ausente = não sabemos, e aí a bolha mostra só a hora.
   *
   * Só faz sentido em saída. Na entrada, quem escreveu é a pessoa cujo nome
   * está no cabeçalho da conversa, repeti-lo embaixo de cada bolha era ruído
   * numa tela que só tem duas vozes.
   */
  autor?: string
  /**
   * O que o áudio diz, quando alguém já pediu para transcrever.
   *
   * Ausente = ninguém pediu, e a bolha mostra o botão. Guardado, ele some:
   * transcrever de novo produziria o mesmo texto e mais uma chamada a modelo.
   */
  transcricao?: string
  local?: LocalDaMensagem
  /** Os cartões de contato encaminhados, pelo mesmo motivo do `local`. */
  cartoes?: CartaoDeContato[]
  /**
   * O id da mensagem na Meta.
   *
   * Sobe até a tela porque **reagir exige o id da Meta, não o nosso**, e
   * porque é por ele que reação e citação se ligam. Ausente em saída ainda não
   * confirmada: a Meta só devolve o id depois de aceitar.
   */
  waMessageId?: string
  /**
   * As reações nesta mensagem, se houver.
   *
   * Lista e não uma só: a conversa tem dois lados, e os dois podem reagir à
   * mesma frase. Cada lado tem no máximo uma, reagir de novo troca, e quem
   * garante isso é `casarReacoes`, que fica com a mais recente.
   */
  reacoes?: ReacaoNaMensagem[]
  /** A mensagem que esta cita, quando ela cita alguma. */
  cita?: Citada
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
  porta_de_entrada_em: string | null
  ultima_direcao: string | null
  atribuido_a: string | null
  estado?: string | null
  estado_efetivo?: string | null
  adiada_ate?: string | null
  adiada_nota?: string | null
  ultimo_texto: string | null
  ultimo_autor_tipo: string | null
  ultimo_autor_nome: string | null
  ultima_entregue: boolean | null
  automacao_ativa: boolean
  handoff_motivo: string | null
  handoff_em: string | null
  nome_real: string
  notas: string
  ultimo_tipo: string | null
}

// Numa linha só, e não concatenado: o supabase-js lê esta string no nível de
// tipo para saber o formato do retorno, e concatenação vira `string` genérica,
// aí o tipo do `data` desanda e o `tsc` acusa.
const COLUNAS =
  'contact_id, client_id, wa_id, nome, nome_real, notas, campos, criado_em, ultima_em, ultima_entrada_em, ultima_direcao, ultimo_texto, ultimo_tipo, ultimo_autor_tipo, ultimo_autor_nome, handoff_motivo, handoff_em, ultima_entregue, automacao_ativa, atribuido_a, estado, estado_efetivo, adiada_ate, adiada_nota, porta_de_entrada_em'

/**
 * `campos` é `jsonb`: o banco aceita qualquer coisa ali. Hoje só o motor
 * escreve, e sempre string, mas a tela de leads é justamente onde um dado
 * torto apareceria, e ela não pode ser a parte que quebra.
 *
 * Por isso a leitura é tolerante de propósito, ao contrário do grafo em
 * `fluxos.ts`: lá um rascunho inválido tem que estourar, porque o motor ia
 * executar aquilo. Aqui ninguém executa nada, é texto numa célula. Valor que
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
    portaDeEntradaEm: linha.porta_de_entrada_em,
    ultimaDirecao: direcao.success ? direcao.data : null,
    ultimoTexto: linha.ultimo_texto,
    ultimoTipo: linha.ultimo_tipo,
    ultimoAutorTipo: linha.ultimo_autor_tipo,
    ultimoAutorNome: linha.ultimo_autor_nome,
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
 * `todos` não filtra; `sem-dono` traz o que ninguém assumiu, que é a fila de
 * verdade, a que precisa de gente; qualquer outro valor é o id de um usuário e
 * vira "os chats dele". É o rail `Atribuído` do Inbox.
 */
export type FiltroDeAtribuicao = 'todos' | 'sem-dono' | (string & {})

/**
 * Em que pé está a conversa, o eixo que o rail de atribuição não responde.
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
 * cada `Lead`**, `estadoEfetivo` e `atribuidoA`. Quando a fila inteira está
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
 * (média real em 13/set/2026), então 200 são ~100KB de JSON, menos que uma
 * foto de perfil. O gargalo não é o tamanho; é a honestidade do filtro.
 */
export const TETO_DA_FILA_LOCAL = 200

export type FiltroDeLeads = {
  /** Nome ou telefone, parcial. Vazio = sem busca. */
  busca?: string
  etiqueta?: EtiquetaDeLead | null
  /** Etiqueta manual (0025). Combina com `etiqueta`, as duas restringem. */
  etiquetaId?: string | null
  atribuicao?: FiltroDeAtribuicao
  /** Em que pé está. Ausente = `aberta`, que é o que a fila deve mostrar. */
  estado?: FiltroDeEstado
  /** Só quem espera uma pessoa. É o que a fila do Inbox olha primeiro. */
  soEsperando?: boolean
  /** Começa em 1. Fora da faixa, cai na primeira. */
  pagina?: number
  porPagina?: number
  /**
   * Restringe a estes contatos, e **antes de paginar** (T6.1, RB-37).
   *
   * É por onde o filtro de faixa de valor entra: quem decide quem está em
   * "Ouro" é `consultas/contatos.ts`, olhando a conta inteira, e o resultado
   * chega aqui como lista de ids. `null` é "sem restrição"; lista vazia é
   * "ninguém passa", e as duas precisam ser distinguíveis, tratá-las igual
   * mostraria a base inteira justo quando o filtro não achou ninguém.
   */
  contatos?: string[] | null
  /** Quem a pessoa pode ver. Ausente = a conta inteira (rotinas do sistema). */
  alcance?: AlcanceDeConversas
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
 * limpeza é uma lista do que **entra**, letra, número, espaço e a pontuação
 * que aparece em nome e telefone, e não uma lista do que sai; lista do que sai
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
 * o caminho é achar os contatos que a têm e paginar dentro deles, é a leitura
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
   * "nenhum contato passa", e as duas precisam ser distinguíveis, tratá-las
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
  // O filtro de contatos (faixa de valor) restringe junto com as etiquetas: as
  // três são exigências, e quem passa nelas é a interseção.
  if (filtro.contatos !== null && filtro.contatos !== undefined) {
    permitidos =
      permitidos === null
        ? filtro.contatos
        : permitidos.filter((id) => filtro.contatos!.includes(id))
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
      //
      // Os nomes vão por regex com as classes de acento (`padraoSemAcento`, a
      // mesma da agenda): "marcia" acha "Márcia" sem a extensão `unaccent`, que
      // é global ao banco dividido. O telefone vai pelos dígitos, que é o que
      // faz "9990 1021" achar `5544999010 21` com os espaços no meio.
      const padrao = padraoSemAcento(termo)
      const numeros = digitos(termo)
      const partes = [`wa_id.ilike.*${termo}*`]
      if (padrao.trim() !== '') partes.push(`nome.imatch.${padrao}`, `nome_real.imatch.${padrao}`)
      if (numeros.length >= 4) partes.push(`wa_id.like.*${numeros}*`)
      // E buscar pelas formas do telefone, não só pelo que foi digitado: quem
      // procura "(11) 98765-4321" não acha `551187654321` com `ilike`, e o nono
      // dígito faz o mesmo aparelho ter duas grafias. `chavesDoTelefone`
      // devolve as duas; sem isto, a busca por telefone só funciona quando a
      // pessoa digita exatamente como a Meta gravou.
      for (const chave of chavesDoTelefone(termo)) partes.push(`wa_id.eq.${chave}`)
      q = q.or(partes.join(','))
    }
    if (permitidos) q = q.in('contact_id', permitidos)
    q = noAlcance(q, filtro.alcance)

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
 * Quantas mensagens do fim da conversa entram no pulso.
 *
 * Uma só não bastava, ver o defeito do arquivo que chega atrasado, logo
 * abaixo. Cinco cobre a rajada: figurinha atrás de figurinha, foto e legenda,
 * o áudio seguido do "escuta isso". Acima disso a consulta começa a pagar por
 * um caso que não acontece.
 */
const MENSAGENS_NO_PULSO = 5

/**
 * O carimbo do fim da conversa da conta, o "tem coisa nova?" do Inbox.
 *
 * Existe para a tela se atualizar sozinha sem recarregar a página inteira a
 * cada poucos segundos. É de propósito uma das consultas mais baratas do
 * arquivo: cinco linhas, duas colunas, ordenadas por um índice que já existe.
 * Quem chama compara com o que tinha e só então pede o `refresh`, que aí sim
 * custa.
 *
 * Vem por `contacts!inner` porque `messages` não guarda o cliente: o vínculo é
 * o contato. Sem o `inner`, mensagem de outra conta entraria na conta errada e
 * um Inbox piscaria por causa do movimento de outro.
 *
 * `null` quando a conta ainda não tem mensagem nenhuma, que é diferente de
 * erro, e quem chama trata como "nada novo".
 *
 * ---------------------------------------------------------------------------
 * Por que o arquivo entra no pulso, e não só o carimbo
 * ---------------------------------------------------------------------------
 *
 * **Este é o conserto de um defeito visto em produção**: o dono mandou duas
 * figurinhas seguidas e a primeira, a animada, de 438 KB, ficou para sempre
 * dizendo "arquivo recebido, sem cópia guardada", enquanto a segunda, estática
 * e menor, apareceu inteira. O arquivo das duas estava no bucket.
 *
 * A causa é uma corrida. A mensagem é gravada primeiro e a mídia baixa depois
 * (`guardarMidiaRecebida`, que é assim de propósito: gravar a conversa não pode
 * esperar um download). O pulso era `max(ts)`, e `ts` não muda quando o arquivo
 * chega, então a tela que se atualizou no instante entre as duas coisas
 * desenhava a bolha sem arquivo **e nunca mais tinha motivo para redesenhar**.
 * Quanto maior o arquivo, mais certo o defeito: GIF animado, vídeo e áudio
 * longo perdem essa corrida sempre.
 *
 * Somar ao carimbo um dígito por mensagem, tem arquivo? faz o pulso mudar no
 * instante em que a mídia desce, sem coluna nova e sem migration. O formato é
 * opaco de propósito: quem compara só pergunta se é igual (`precisaAtualizar`),
 * e ninguém deve tentar ler data daqui.
 */
export async function pulsoDaConta(clienteId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('messages')
    .select('ts, arquivo, contacts!inner(client_id)')
    .eq('contacts.client_id', clienteId)
    .order('ts', { ascending: false })
    .limit(MENSAGENS_NO_PULSO)

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o pulso da conta: ${error.message}`)

  const linhas = (data ?? []) as { ts: string; arquivo: unknown }[]
  const ultima = linhas[0]
  if (!ultima) return null

  const arquivos = linhas.map((linha) => (ehArquivoGuardado(linha.arquivo) ? '1' : '0')).join('')
  return `${ultima.ts}|${arquivos}`
}

/**
 * Os contatos deste cliente que têm uma etiqueta.
 *
 * Lê os ids do cliente e depois o histórico deles. É a consulta mais pesada do
 * arquivo, e é a mesma que a tela fazia em toda visita antes da paginação,
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
export async function acharLead(
  clienteId: string,
  contatoId: string,
  alcance?: AlcanceDeConversas,
): Promise<Lead | null> {
  // Fora do alcance é "não existe", e não "sem permissão": dizer que existe
  // já conta a quem pergunta que aquele contato é de outra pessoa.
  const { data, error } = await noAlcance(
    db().from('leads').select(COLUNAS).eq('client_id', clienteId).eq('contact_id', contatoId),
    alcance,
  ).maybeSingle()

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
 * bater no teto, `cortada` avisa, teto silencioso mente dizendo que aquilo é
 * a conversa toda.
 */
/**
 * A mensagem a que alguém quer reagir, conferindo que ela é desta conversa.
 *
 * Existe separada de `lerConversa` porque a pergunta é outra: não é "o que
 * aconteceu aqui", é "este id é mesmo desta conversa, e quando ele foi?". A
 * segunda parte é o que decide o prazo de 30 dias.
 *
 * O par `(contato, cliente)` vai na consulta pelo mesmo motivo do resto do
 * repo: id vindo da tela não prova de quem ele é, e uma reação disparada para o
 * número errado é uma mensagem nossa aparecendo na conversa de outra pessoa.
 *
 * `null` quando não é desta conversa, ou não existe, que para quem chama dá no
 * mesmo.
 */
export async function acharMensagemParaReagir(
  clienteId: string,
  contatoId: string,
  waMessageId: string,
): Promise<{ ts: string } | null> {
  const { data: contato, error: erroDoContato } = await db()
    .from('contacts')
    .select('id')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoContato)) return null
  if (erroDoContato) throw new Error(`não deu para achar o contato: ${erroDoContato.message}`)
  if (!contato) return null

  const { data, error } = await db()
    .from('messages')
    .select('ts')
    .eq('contact_id', contatoId)
    .eq('wa_message_id', waMessageId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para achar a mensagem: ${error.message}`)
  if (!data) return null

  return { ts: (data as { ts: string }).ts }
}

export async function lerConversa(
  contatoId: string,
  teto: number = TETO_DE_MENSAGENS,
): Promise<Conversa> {
  const { data, error } = await db()
    .from('messages')
    .select(
      'id, direcao, texto, ts, entregue, payload, wa_message_id, reagiu_a, reacao, cita, arquivo, transcricao',
    )
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
    wa_message_id: string | null
    reagiu_a: string | null
    reacao: string | null
    cita: string | null
    arquivo: unknown
    transcricao: string | null
  }[]
  const cortada = linhas.length > teto

  const visiveis = linhas.slice(0, teto).reverse()

  /*
   * Duas passadas, e não uma.
   *
   * A reação pode chegar **antes** na ordem de leitura da mensagem que ela
   * comenta? Não, mas a citação pode citar uma mensagem que veio muito antes,
   * e os dois casamentos precisam do conjunto inteiro já em mãos. Montar os
   * índices primeiro é o que evita um `find` por linha, que numa conversa no
   * teto de 500 seria quadrático.
   */
  const porWaId = new Map<string, (typeof visiveis)[number]>()
  for (const m of visiveis) if (m.wa_message_id) porWaId.set(m.wa_message_id, m)

  /*
   * A direção é validada aqui, e não confiada como veio do banco.
   *
   * A coluna é `text` com `check`, então o Postgres já garante, mas o tipo
   * que o supabase-js devolve é `string` cru, e `casarReacoes` agrupa **por
   * lado**. Fazer o `parse` na entrada do casamento é o que mantém "uma reação
   * por lado" sendo uma garantia do tipo, e não uma esperança.
   */
  const reacoesPorAlvo = casarReacoes(
    visiveis.map((m) => ({
      id: m.id,
      direcao: direcaoSchema.parse(m.direcao),
      reagiu_a: m.reagiu_a,
      reacao: m.reacao,
    })),
  )

  /*
   * As URLs são assinadas **em lote e aqui**, não numa por bolha.
   *
   * Uma conversa com trinta fotos faria trinta chamadas ao Storage se cada
   * bolha assinasse a sua. E assinar aqui, e não gravar no banco, é a regra que
   * não se dobra: URL assinada guardada em coluna é link público com um passo a
   * mais, ela viaja em log e em backup e continua valendo até expirar.
   */
  const toques = casarToques(visiveis)

  const caminhos = visiveis
    .map((m) => (ehArquivoGuardado(m.arquivo) ? m.arquivo.caminho : null))
    .filter((caminho): caminho is string => caminho !== null)
  const assinadas = await urlsAssinadas(caminhos)

  return {
    cortada,
    mensagens: visiveis
      /*
       * **A reação some da lista como linha própria.** Ela já foi grudada na
       * mensagem que comenta, e deixá-la também solta no fim da conversa é
       * exatamente o defeito que a 0054 conserta.
       *
       * Reação removida (`reacao === ''`) some junto e não gruda em nada:
       * `casarReacoes` já a descartou.
       */
      .filter((m) => m.reagiu_a === null)
      .map((m) => {
        const anexo = anexoDoPayload(m.payload)
        const produtos = produtosDoPayload(m.payload)
        const local = localDoPayload(m.payload)
        const cartoes = cartoesDoPayload(m.payload)

        /*
         * Três estados, e a bolha precisa distinguir os três: temos o arquivo e
         * a assinatura saiu; temos o registro mas a assinatura falhou; e chegou
         * arquivo do qual nunca houve cópia, grande demais, download falhado,
         * ou mensagem anterior à `0055`.
         *
         * Os dois últimos viram o mesmo aviso na tela, porque para quem lê dão
         * no mesmo: o arquivo não está aqui.
         */
        const autor = comoChamarOAutor(autorDoPayload(m.payload))
        const guardado = ehArquivoGuardado(m.arquivo) ? m.arquivo : null
        const assinada = guardado ? assinadas.get(guardado.caminho) : undefined
        const recebido =
          guardado && assinada
            ? {
                midia: guardado.midia,
                url: assinada,
                ...(guardado.nomeArquivo ? { nomeArquivo: guardado.nomeArquivo } : {}),
              }
            : null
        const tipoDaMeta = (m.payload as { type?: string } | null)?.type
        const semCopia = !recebido && midiaDoTipo(tipoDaMeta) !== null
        /*
         * `unsupported` é uma resposta da Meta, não uma falha nossa, e a bolha
         * precisa dizer isso com essa palavra. Antes ela caía no genérico
         * "(áudio, imagem ou documento)", que é um chute sobre o que havia
         * ali, e parecia defeito do painel.
         */
        const naoSuportada = tipoDaMeta === 'unsupported'
        const motivo = naoSuportada ? motivoDoNaoSuportado(m.payload) : null
        const menuCru = m.direcao === 'saida' ? menuDoPayload(m.payload) : null
        const escolhida = toques.get(m.id)
        const menu = menuCru ? { ...menuCru, ...(escolhida ? { escolhida } : {}) } : null
        const reacoes = m.wa_message_id ? reacoesPorAlvo.get(m.wa_message_id) : undefined
        /*
         * Toque não mostra citação. A Meta pendura `context` no toque apontando
         * o menu, que já está logo acima com a opção marcada; repetir a
         * pergunta dentro da bolha, ou pior, "mensagem original" quando o menu
         * foi gravado sem id, é ruído na bolha mais comum de uma triagem.
         */
        const toque = m.direcao === 'entrada' && toqueDoPayload(m.payload) !== null
        const cita = m.cita && !toque ? citadaDoHistorico(m.cita, porWaId) : null
        return {
          id: m.id,
          direcao: direcaoSchema.parse(m.direcao),
          texto: m.texto,
          ts: m.ts,
          entregue: m.entregue,
          ...(anexo ? { anexo } : {}),
          ...(produtos.length ? { produtos } : {}),
          ...(recebido ? { recebido } : {}),
          ...(semCopia ? { semCopia: true as const } : {}),
          ...(naoSuportada ? { naoSuportada: true as const } : {}),
          ...(motivo ? { motivoNaoSuportada: motivo } : {}),
          ...(menu ? { menu } : {}),
          ...(toque ? { toque: true as const } : {}),
          ...(autor ? { autor } : {}),
          ...(m.transcricao ? { transcricao: m.transcricao } : {}),
          ...(local ? { local } : {}),
          ...(cartoes.length ? { cartoes } : {}),
          ...(m.wa_message_id ? { waMessageId: m.wa_message_id } : {}),
          ...(reacoes?.length ? { reacoes } : {}),
          ...(cita ? { cita } : {}),
        }
      }),
  }
}

/**
 * A mensagem citada, quando ela está no histórico que carregamos.
 *
 * **O caso de não estar é normal, não é erro.** A conversa é cortada no teto de
 * 500, a Meta deixa citar mensagem antiga, e `context` também chega quando
 * alguém responde a um anúncio ou encaminha algo, nesses dois a citada nunca
 * esteve aqui. Devolver a citação sem texto, em vez de `null`, é o que faz a
 * bolha mostrar "mensagem original" em cinza em vez de esconder que houve
 * citação: quem lê precisa saber que aquela resposta comenta outra coisa.
 */
function citadaDoHistorico(
  waId: string,
  porWaId: Map<string, { id: string; direcao: string; texto: string | null }>,
): Citada {
  const alvo = porWaId.get(waId)
  if (!alvo) return { texto: null }
  return { id: alvo.id, texto: alvo.texto, direcao: direcaoSchema.parse(alvo.direcao) }
}

/**
 * O anexo guardado em `messages.payload`, quando há um.
 *
 * `payload` é `jsonb` e carrega coisas diferentes conforme a mensagem, opções
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

/** As fotos do card de produto em `payload.produtos`; só `https`, só com foto. */
function produtosDoPayload(payload: unknown): ProdutoNaMensagem[] {
  const lista = (payload as { produtos?: unknown } | null)?.produtos
  if (!Array.isArray(lista)) return []
  return lista.flatMap((item) => {
    const p = item as { nome?: unknown; foto?: unknown; link?: unknown } | null
    if (typeof p?.foto !== 'string' || !p.foto.startsWith('https://')) return []
    const nome = typeof p.nome === 'string' ? p.nome : 'produto'
    const { titulo, detalhe } = linhasDoCard({ ...(item as ProdutoDaLoja), nome })
    const link = typeof p.link === 'string' && p.link.startsWith('https://') ? p.link : null
    return [{ nome, foto: p.foto, titulo, detalhe, link }]
  })
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
 * Acrescenta uma linha à anotação do contato, o bloco de Anotação (0044).
 *
 * **Acrescenta, e nunca substitui.** A anotação é onde a equipe escreve o que
 * sabe da pessoa; um bot que sobrescrevesse aquilo apagaria trabalho humano em
 * silêncio, e a primeira vez que alguém percebesse seria a vez em que a
 * informação fez falta. Por isso é leitura seguida de escrita, e não `update`
 * direto.
 *
 * **O cabeçalho com data e origem não é enfeite.** Quem abre a ficha e lê uma
 * frase precisa saber se foi um colega ou o bot que escreveu, sem isso, uma
 * anotação automática vira uma afirmação humana sobre o cliente. Ler "o texto
 * apareceu sozinho e ninguém confirmou" é a diferença entre um registro e um
 * boato.
 *
 * O teto é o mesmo do campo, e ele corta **pelo começo**: numa anotação que
 * encheu, o que interessa é o fim, o que aconteceu por último. Cortar pelo fim
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
    // vazio até a pessoa escrever pela primeira vez, é a Meta que preenche o
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
 * linhas por cliente e a alternativa seria um `group by` por PostgREST, que
 * não existe sem view nova, e view por causa de contagem é migration a mais
 * para manter.
 */
export async function contarPorAtribuicao(
  clienteId: string,
  alcance?: AlcanceDeConversas,
): Promise<{ total: number; semDono: number; porUsuario: Map<string, number> }> {
  const { data, error } = await noAlcance(
    db().from('leads').select('atribuido_a').eq('client_id', clienteId),
    alcance,
  )

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
 * nunca casa com a conversa que chegar depois, dois cadastros da mesma pessoa,
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
      motivo: 'escreva o telefone com DDD, sem ele não dá para saber de qual estado é',
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
 * **A volta não é agendada, é comparada.** Não há processo que devolva nada,
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
 * O mesmo caminho para os dois sentidos porque é o mesmo gesto, e porque
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
 * **Sem a contagem, escolher uma aba é apostar**, a pessoa clica em "Adiadas"
 * para descobrir se tem algo lá. É a mesma razão pela qual `contarPorAtribuicao`
 * existe.
 *
 * Lê `estado_efetivo`: o adiamento vencido conta como aberta, que é onde ele
 * de fato vai aparecer.
 */
export async function contarPorEstado(
  clienteId: string,
  alcance?: AlcanceDeConversas,
): Promise<{ aberta: number; adiada: number; resolvida: number }> {
  const { data, error } = await noAlcance(
    db().from('leads').select('estado_efetivo').eq('client_id', clienteId),
    alcance,
  )

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
 * repetir essa regra no navegador seria duplicar a parte que já erra sozinha,
 * quem procura "(11) 98765-4321" não acha `551187654321` com comparação de
 * texto crua.
 */
export async function filaInteira(
  clienteId: string,
  opcoes: { busca?: string; alcance?: AlcanceDeConversas } = {},
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
   * versão para manter, e a que erra é sempre a que ninguém lembra que existe.
   */
  const pagina = await paginarLeads(clienteId, {
    estado: 'todas',
    atribuicao: 'todos',
    busca: termo,
    pagina: 1,
    porPagina: TETO_DA_FILA_LOCAL,
    alcance: opcoes.alcance,
  })

  return pagina.leads
}

/**
 * Destes ids, quais são mesmo contatos desta conta.
 *
 * Existe porque id vindo da tela não prova de quem ele é, e as marcações do
 * atendente (fixar, marcar como não lida) recebem id solto, sem esta peneira,
 * um id de outra conta entraria numa tabela que não tem `cliente_id` para
 * corrigir depois.
 *
 * **Falha fechado**: o que não voltar da consulta simplesmente não está na
 * resposta, e quem chama age só sobre o que sobrou.
 */
export async function contatosDaConta(clienteId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []

  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('id', ids)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para conferir os contatos: ${error.message}`)

  return ((data ?? []) as { id: string }[]).map((linha) => linha.id)
}

/**
 * Os leads destes contatos, para a fila paginada poder mostrar os fixados.
 *
 * **Sem isto o alfinete mentiria no modo paginado.** Acima de
 * `TETO_DA_FILA_LOCAL` a lista é uma página de cinquenta, e uma conversa fixada
 * que caiu na página 4 não apareceria no topo da página 1, o que é o oposto do
 * que o gesto promete. Como são no máximo `TETO_DE_FIXADAS` ids, buscá-los
 * inteiros a cada página é barato.
 */
export async function leadsPorContatos(clienteId: string, ids: string[]): Promise<Lead[]> {
  if (ids.length === 0) return []

  const { data, error } = await db()
    .from('leads')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .in('contact_id', ids)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para buscar os leads fixados: ${error.message}`)

  return classificar((data as Linha[]).map(paraLead))
}

/**
 * Quantas conversas **abertas** cada pessoa tem nesta conta.
 *
 * Existe separada de `contarPorAtribuicao`, que conta tudo o que já foi
 * atribuído alguma vez. As duas perguntas são diferentes e a diferença é o que
 * torna a distribuição justa: quem atendeu quatrocentas pessoas em dois anos e
 * tem duas conversas abertas agora está com a mão mais livre que o colega novo
 * com nove. Carga é o que está aberto, não o histórico.
 *
 * `estado_efetivo` e não `estado`: adiamento vencido já volta a contar como
 * aberta, e é a view que sabe disso (ver a 0049).
 */
export async function contarAbertasPorAtendente(clienteId: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('leads')
    .select('atribuido_a')
    .eq('client_id', clienteId)
    .eq('estado_efetivo', 'aberta')
    .not('atribuido_a', 'is', null)

  const porUsuario = new Map<string, number>()
  if (ehIdInvalido(error)) return porUsuario
  if (error) throw new Error(`não deu para contar as conversas abertas: ${error.message}`)

  for (const linha of data as { atribuido_a: string }[]) {
    porUsuario.set(linha.atribuido_a, (porUsuario.get(linha.atribuido_a) ?? 0) + 1)
  }
  return porUsuario
}

/** Quem é o dono da conversa agora. `undefined` quando o contato não é desta conta. */
export async function donoDoContato(
  clienteId: string,
  contatoId: string,
): Promise<string | null | undefined> {
  const { data, error } = await db()
    .from('contacts')
    .select('atribuido_a')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return undefined
  if (error) throw new Error(`não deu para saber de quem é a conversa: ${error.message}`)
  if (!data) return undefined
  return (data as { atribuido_a: string | null }).atribuido_a
}

/**
 * Os dois números de Conversas na barra lateral: abertas comigo e abertas sem
 * ninguém (plano de navegação, seção 3).
 *
 * Contam o mesmo que a fila mostra ao abrir `?de=minhas` e `?de=sem-dono`: o
 * estado padrão da fila é `aberta`, e número de menu que não bate com a tela
 * que ele abre ensina a pessoa a não confiar no número. Duas contagens `head`,
 * sem trazer linha nenhuma.
 */
export async function contarConversasDaBarra(
  clienteId: string,
  usuarioId: string,
): Promise<{ minhas: number; semDono: number }> {
  const abertas = () =>
    db()
      .from('leads')
      .select('contact_id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .or('estado_efetivo.is.null,estado_efetivo.eq.aberta')
  const [minhas, semDono] = await Promise.all([
    abertas().eq('atribuido_a', usuarioId),
    abertas().is('atribuido_a', null),
  ])
  if (ehIdInvalido(minhas.error) || ehIdInvalido(semDono.error)) return { minhas: 0, semDono: 0 }
  if (minhas.error) throw new Error(`não deu para contar as conversas: ${minhas.error.message}`)
  if (semDono.error) throw new Error(`não deu para contar as conversas: ${semDono.error.message}`)
  return { minhas: minhas.count ?? 0, semDono: semDono.count ?? 0 }
}
