import type { NomesDoAnuncio } from '@/core/anuncios'

/**
 * O nó `Ad` da Marketing API — só para descobrir nomes.
 *
 * ---------------------------------------------------------------------------
 * O que esta chamada é, e o que ela não é
 * ---------------------------------------------------------------------------
 *
 * É **leitura**, de três campos de texto. Não cria campanha, não altera
 * orçamento, não pausa anúncio, não lê métrica. O produto continua sendo uma
 * caixa de entrada: saber de qual campanha a pessoa veio é contexto do
 * atendimento, do mesmo tipo que o telefone e a data de chegada — não é
 * gerenciar mídia, que é outro produto (o Otimiza Gestor).
 *
 * Vale dizer por escrito porque a fronteira é fácil de cruzar sem perceber: o
 * mesmo token que lê o nome também leria gasto e resultado, e a tentação de
 * "já que temos o token" é exatamente como um inbox vira um painel de anúncios
 * pela metade.
 *
 * ---------------------------------------------------------------------------
 * Uma chamada, três nomes
 * ---------------------------------------------------------------------------
 *
 * A field expansion da Graph (`campaign{name}`) traz o conjunto e a campanha
 * junto do anúncio, então não há encadeamento de três requisições. Importa
 * porque o limite de chamadas da Meta é por Página e proporcional ao volume de
 * leads — gastar três onde uma serve encurta o teto de quem está começando.
 */

const VERSAO_PADRAO = 'v25.0'

/**
 * Dez segundos.
 *
 * Menos que os quinze do envio de mensagem, e de propósito: mandar uma resposta
 * ao cliente é o trabalho; descobrir o nome de uma campanha é enfeite de tela.
 * Se a Meta estiver lenta, o enfeite espera — a linha mostra o `headline`, que
 * já está no contato.
 */
const TIMEOUT_MS = 10_000

export type ErroDaMarketingApi = {
  /** O código da Meta, quando veio. 190 = token inválido; 80004 = limite. */
  codigo: number | null
  mensagem: string
}

export type RespostaDeNomes =
  | { ok: true; nomes: NomesDoAnuncio }
  | { ok: false; erro: ErroDaMarketingApi }

type CorpoDaMeta = {
  name?: unknown
  adset?: { name?: unknown } | null
  campaign?: { name?: unknown } | null
  error?: { message?: unknown; code?: unknown } | null
}

/** A Meta manda string; qualquer outra coisa vira vazio em vez de derrubar. */
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Lê nome do anúncio, do conjunto e da campanha de um `ad_id`.
 *
 * **Nunca lança.** Quem chama está desenhando uma tela de atendimento: uma
 * Graph fora do ar não pode derrubar o Inbox nem fazer um webhook responder
 * erro para a Meta. Todo caminho de falha vira `{ ok: false }` com o código,
 * que é o que permite distinguir "token venceu" de "estourou o limite" — os
 * dois erram parecido e pedem respostas opostas (reconectar vs. esperar).
 */
export async function lerNomesDoAnuncio(entrada: {
  adId: string
  token: string
  versaoGraph?: string
}): Promise<RespostaDeNomes> {
  const versao = entrada.versaoGraph ?? process.env.META_GRAPH_VERSAO ?? VERSAO_PADRAO
  const url = new URL(`https://graph.facebook.com/${versao}/${entrada.adId}`)
  /*
   * `fields` explícito, sempre. Sem ele a Graph devolve o conjunto default —
   * que é menor do que o disponível — e some com `campaign`/`adset` sem dizer
   * por quê. É o erro que faz alguém concluir "a Meta não manda o nome".
   */
  url.searchParams.set('fields', 'name,adset{name},campaign{name}')

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: controle.signal,
    })

    const corpo = (await resposta.json().catch(() => null)) as CorpoDaMeta | null

    if (!resposta.ok || corpo?.error) {
      const codigo = corpo?.error?.code
      return {
        ok: false,
        erro: {
          codigo: typeof codigo === 'number' ? codigo : null,
          mensagem: texto(corpo?.error?.message) || `a Meta respondeu ${resposta.status}`,
        },
      }
    }

    return {
      ok: true,
      nomes: {
        anuncio: texto(corpo?.name),
        conjunto: texto(corpo?.adset?.name),
        campanha: texto(corpo?.campaign?.name),
      },
    }
  } catch (erro) {
    /*
     * `AbortError` é o timeout acima; o resto é rede. Os dois dizem a mesma
     * coisa a quem chama — não deu para saber agora — e nenhum é motivo para
     * apagar o nome que já está guardado.
     */
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  } finally {
    clearTimeout(prazo)
  }
}
