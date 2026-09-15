import {
  componentesParaMeta,
  statusDaMeta,
  type Categoria,
  type Componentes,
  type Exemplos,
  type StatusDoTemplate,
} from '@/core/templates'

/**
 * O nó `message_templates` da WABA — criar, listar e apagar modelo.
 *
 * ---------------------------------------------------------------------------
 * Um template por WABA. Não existe biblioteca compartilhada
 * ---------------------------------------------------------------------------
 *
 * O mesmo modelo lógico para 40 clientes são **40 criações, 40 aprovações e 40
 * ids diferentes**. A Meta não tem como compartilhar template entre contas, e
 * quem desenha achando que tem acaba com um id só, que funciona para um cliente
 * e dá 132001 ("não existe nesse idioma") para os outros 39.
 *
 * É por isso que a chave em `templates` é `(cliente_id, nome, idioma)` e o
 * `waba_template_id` é apenas o que a Meta devolveu para aquele cliente.
 *
 * ---------------------------------------------------------------------------
 * Nunca lança, como `marketing-api.ts`
 * ---------------------------------------------------------------------------
 *
 * Todo caminho de falha vira `{ ok: false }` com o código da Meta. O código é o
 * que permite distinguir "o nome já existe" de "o token venceu" de "estourou o
 * limite de 100 criações por hora" — três erros que pedem respostas opostas, e
 * que uma exceção genérica embaralharia.
 */

const VERSAO_PADRAO = 'v25.0'

/**
 * Vinte segundos.
 *
 * Mais que os dez da leitura de nome de anúncio e mais que os quinze do envio:
 * criar template é escrita, e repetir uma escrita que talvez tenha funcionado
 * cria template duplicado — que a Meta recusa com "nome já existe" e deixa a
 * tela mostrando erro para uma criação que deu certo.
 */
const TIMEOUT_MS = 20_000

/**
 * O teto da Meta: **100 criações por WABA por hora**.
 *
 * Não é conferido aqui — é fato para quem desenha o provisionamento. Cliente
 * novo que chega com 120 templates prontos não pode ser criado de forma
 * síncrona numa tela; tem que ser fila. Está escrito neste arquivo porque é
 * aqui que alguém vem procurar quando a Meta começar a responder 80007.
 */
export const CRIACOES_POR_HORA = 100

export type ErroDaMeta = {
  /** O código dela. 190 = token; 100 = parâmetro; 80007 = limite. */
  codigo: number | null
  mensagem: string
}

export type TemplateCriado = {
  wabaTemplateId: string
  status: StatusDoTemplate | 'desconhecido'
  /** A categoria que a Meta **decidiu**, que pode não ser a pedida. */
  categoria: string | null
}

export type RespostaDaCriacao = { ok: true; template: TemplateCriado } | { ok: false; erro: ErroDaMeta }

type CorpoDaMeta = {
  id?: unknown
  status?: unknown
  category?: unknown
  error?: { message?: unknown; code?: unknown; error_user_msg?: unknown } | null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function versaoGraph(escolhida?: string): string {
  return escolhida ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
}

/**
 * O erro da Meta, preferindo a mensagem que dá para mostrar a uma pessoa.
 *
 * `error_user_msg` é escrita para o usuário final e vem em português quando a
 * conta está em português; `message` é para quem programa e vem sempre em
 * inglês. Preferir a primeira é a diferença entre a tela dizer "esse nome já
 * está em uso" e dizer "(#100) Invalid parameter".
 */
function erroDoCorpo(corpo: CorpoDaMeta | null, status: number): ErroDaMeta {
  const codigo = corpo?.error?.code
  return {
    codigo: typeof codigo === 'number' ? codigo : null,
    mensagem:
      texto(corpo?.error?.error_user_msg) ||
      texto(corpo?.error?.message) ||
      `a Meta respondeu ${status}`,
  }
}

/**
 * Cria o template na Meta e devolve o id dela.
 *
 * **A categoria que volta pode não ser a que foi pedida.** A Meta reclassifica
 * sozinha quando acha o conteúdo promocional — e como a categoria muda o
 * **preço** da mensagem, quem chama tem que gravar o que ela respondeu, não o
 * que pediu. É por isso que `categoria` sai no retorno.
 *
 * O status inicial costuma ser `PENDING`, mas não sempre: template criado a
 * partir da Template Library sai aprovado quase na hora.
 */
export async function criarTemplateNaMeta(entrada: {
  wabaId: string
  token: string
  nome: string
  idioma: string
  categoria: Categoria
  componentes: Componentes
  exemplos?: Exemplos
  versaoGraph?: string
}): Promise<RespostaDaCriacao> {
  const url = `https://graph.facebook.com/${versaoGraph(entrada.versaoGraph)}/${entrada.wabaId}/message_templates`

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${entrada.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: entrada.nome,
        language: entrada.idioma,
        category: entrada.categoria,
        components: componentesParaMeta(entrada.componentes, entrada.exemplos),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const corpo = (await resposta.json().catch(() => null)) as CorpoDaMeta | null

    if (!resposta.ok || corpo?.error) {
      return { ok: false, erro: erroDoCorpo(corpo, resposta.status) }
    }

    const id = texto(corpo?.id)
    if (!id) {
      /*
       * 200 sem id não deveria acontecer. Se acontecer, tratar como sucesso
       * gravaria um template sem a chave que liga tudo — o webhook de status
       * nunca o encontraria e ele ficaria "pendente" para sempre.
       */
      return { ok: false, erro: { codigo: null, mensagem: 'a Meta não devolveu o id do template' } }
    }

    return {
      ok: true,
      template: {
        wabaTemplateId: id,
        status: statusDaMeta(texto(corpo?.status)),
        categoria: texto(corpo?.category) || null,
      },
    }
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : ''
    const detalhe =
      nome === 'TimeoutError' || nome === 'AbortError'
        ? `a Meta não respondeu em ${TIMEOUT_MS / 1000}s`
        : erro instanceof Error
          ? erro.message
          : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  }
}

export type TemplateNaMeta = {
  wabaTemplateId: string
  nome: string
  idioma: string
  status: StatusDoTemplate | 'desconhecido'
  categoria: string | null
  qualidade: string | null
  motivoRecusa: string | null
}

export type RespostaDaLista =
  | { ok: true; templates: TemplateNaMeta[] }
  | { ok: false; erro: ErroDaMeta }

/**
 * Lista os templates da WABA — a reconciliação.
 *
 * **Existe porque webhook perdido é questão de quando, não de se.** A Meta
 * entrega `message_template_status_update` uma vez; se a nossa função estiver
 * fora do ar naquele segundo, o template fica `pendente` no nosso banco para
 * sempre, e a pessoa vê "em análise" num modelo que já está aprovado há dias.
 *
 * `fields` explícito, como em toda Graph: sem ele vem o conjunto default, que
 * não traz `quality_score` nem `rejected_reason` — e aí alguém conclui que a
 * Meta não informa o motivo da recusa.
 */
export async function listarTemplatesDaMeta(entrada: {
  wabaId: string
  token: string
  limite?: number
  versaoGraph?: string
}): Promise<RespostaDaLista> {
  const url = new URL(
    `https://graph.facebook.com/${versaoGraph(entrada.versaoGraph)}/${entrada.wabaId}/message_templates`,
  )
  url.searchParams.set(
    'fields',
    'id,name,language,status,category,quality_score,rejected_reason',
  )
  url.searchParams.set('limit', String(entrada.limite ?? 200))

  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const corpo = (await resposta.json().catch(() => null)) as
      | ({ data?: unknown[] } & CorpoDaMeta)
      | null

    if (!resposta.ok || corpo?.error) {
      return { ok: false, erro: erroDoCorpo(corpo, resposta.status) }
    }

    const linhas = Array.isArray(corpo?.data) ? corpo.data : []

    return {
      ok: true,
      templates: linhas.flatMap((bruta) => {
        const linha = bruta as Record<string, unknown>
        const id = texto(linha.id)
        const nome = texto(linha.name)
        // Linha sem id nem nome não serve para casar com nada nossa. Sai da
        // lista em vez de virar um template fantasma.
        if (!id || !nome) return []

        const qualidade = linha.quality_score as { score?: unknown } | undefined

        return [
          {
            wabaTemplateId: id,
            nome,
            idioma: texto(linha.language) || 'pt_BR',
            status: statusDaMeta(texto(linha.status)),
            categoria: texto(linha.category) || null,
            qualidade: texto(qualidade?.score).toUpperCase() || null,
            motivoRecusa: texto(linha.rejected_reason) || null,
          },
        ]
      }),
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  }
}

export type RespostaSimples = { ok: true } | { ok: false; erro: ErroDaMeta }

/**
 * Apaga o template na Meta.
 *
 * **Apagar não devolve o nome na hora.** A Meta guarda o nome por 30 dias
 * antes de liberá-lo, e criar de novo antes disso responde erro. Quem oferece
 * "apagar e recriar" na tela tem que dizer isso, senão a pessoa apaga por
 * engano e fica um mês sem poder recriar.
 */
export async function apagarTemplateNaMeta(entrada: {
  wabaId: string
  token: string
  nome: string
  versaoGraph?: string
}): Promise<RespostaSimples> {
  const url = new URL(
    `https://graph.facebook.com/${versaoGraph(entrada.versaoGraph)}/${entrada.wabaId}/message_templates`,
  )
  url.searchParams.set('name', entrada.nome)

  try {
    const resposta = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const corpo = (await resposta.json().catch(() => null)) as CorpoDaMeta | null
    if (!resposta.ok || corpo?.error) {
      return { ok: false, erro: erroDoCorpo(corpo, resposta.status) }
    }
    return { ok: true }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  }
}
