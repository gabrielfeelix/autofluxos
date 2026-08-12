import 'server-only'
import type { Acao } from '@/core/engine/types'
import { conferirEndereco } from './rede'

/**
 * O disparo da chamada do nó de API.
 *
 * O que este arquivo **não** faz: decidir o que a conversa vira depois. Ele
 * devolve "deu certo, com estes valores" ou "falhou, por isto" — quem
 * transforma isso em handoff ou em continuação é o resolvedor, porque isso é
 * decisão de fluxo, não de rede.
 */

export type PedidoHttp = Extract<Acao, { tipo: 'chamar_http' }>

export type RespostaHttp =
  | { ok: true; valores: Record<string, string> }
  | { ok: false; motivo: string }

/**
 * O processamento roda dentro de `after()`, então o corte de 20s da Meta não se
 * aplica aqui. O limite real é a paciência de quem está esperando no WhatsApp.
 */
export const TIMEOUT_MS = 10_000

/** Marca o disparo que veio da aba Testar, para o outro lado poder filtrar. */
export const CABECALHO_TESTE = 'X-AutoFluxos-Teste'

/** Quantos redirecionamentos seguir. Cada salto é reconferido. */
const MAX_SALTOS = 3

export async function chamarHttp(
  pedido: PedidoHttp,
  { deTeste }: { deTeste: boolean },
): Promise<RespostaHttp> {
  let url = pedido.url
  let resposta: Response

  // A origem do endereço original. Um redirecionamento para outro host não pode
  // levar os cabeçalhos configurados junto: o `Authorization` que o operador
  // escreveu para o sistema do cliente iria parar em quem respondeu o 302.
  let origemInicial: string
  try {
    origemInicial = new URL(pedido.url).origin
  } catch {
    return { ok: false, motivo: 'o endereço não é uma URL válida' }
  }

  // Método e corpo mudam ao longo dos saltos: o corpo carrega o lead inteiro e
  // não pode acompanhar um redirecionamento para fora da origem original.
  let metodo: PedidoHttp['metodo'] = pedido.metodo
  let corpo: string | undefined = pedido.corpo

  for (let salto = 0; ; salto++) {
    const veredito = await conferirEndereco(url)
    if (!veredito.ok) return { ok: false, motivo: veredito.motivo }

    if (salto > MAX_SALTOS) {
      return { ok: false, motivo: 'a chamada redirecionou vezes demais' }
    }

    let cabecalhos: Headers
    try {
      // `Headers.set` lança com nome ou valor inválido. Fora do `try` isso
      // escapa até o `after()` do webhook, a sessão nunca é salva, a mensagem
      // já foi deduplicada e a pessoa fica sem resposta nenhuma — sem nem a
      // Meta reenviar. Falhar aqui dentro vira handoff, que é o certo.
      cabecalhos = montarCabecalhos(pedido, deTeste, new URL(url).origin === origemInicial)
    } catch {
      return { ok: false, motivo: 'um dos cabeçalhos configurados é inválido' }
    }

    try {
      resposta = await fetch(url, {
        method: metodo,
        headers: cabecalhos,
        body: metodo === 'POST' ? corpo : undefined,
        // Seguir sozinho pularia a conferência de endereço no destino, que é
        // exatamente por onde o ataque entraria: um host público que responde
        // 302 apontando para a rede interna.
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (erro) {
      const motivo =
        erro instanceof Error && erro.name === 'TimeoutError'
          ? `a chamada passou de ${TIMEOUT_MS / 1000}s sem responder`
          : 'a chamada não completou'
      return { ok: false, motivo }
    }

    const destino =
      resposta.status >= 300 && resposta.status < 400 ? resposta.headers.get('location') : null

    if (!destino) break

    let proxima: URL
    try {
      proxima = new URL(destino, url)
    } catch {
      return { ok: false, motivo: 'a chamada redirecionou para um endereço ilegível' }
    }

    // 301, 302 e 303 viram GET sem corpo — é o que a norma manda e o que todo
    // navegador faz. 307 e 308 preservam o método, e aí o corpo só continua se
    // o destino for a mesma origem: ele carrega o lead inteiro, e entregá-lo a
    // quem respondeu o redirecionamento é o mesmo vazamento que os cabeçalhos.
    if (resposta.status === 301 || resposta.status === 302 || resposta.status === 303) {
      metodo = 'GET'
      corpo = undefined
    } else if (proxima.origin !== origemInicial) {
      corpo = undefined
    }

    url = proxima.toString()
  }

  if (!resposta.ok) {
    return { ok: false, motivo: `a chamada respondeu ${resposta.status}` }
  }

  // Sem mapeamento, o que voltou não interessa: é o webhook disparado e
  // esquecido, que é metade do valor deste nó.
  if (pedido.mapear.length === 0) return { ok: true, valores: {} }

  let json: unknown
  try {
    json = await resposta.json()
  } catch {
    return { ok: false, motivo: 'a resposta não é JSON, e o bloco pede campos dela' }
  }

  const valores: Record<string, string> = {}
  for (const { variavel, caminho } of pedido.mapear) {
    valores[variavel] = extrair(json, caminho)
  }

  return { ok: true, valores }
}

function montarCabecalhos(pedido: PedidoHttp, deTeste: boolean, mesmaOrigem: boolean): Headers {
  const cabecalhos = new Headers()

  // Só na origem que o operador escreveu. Depois de um redirecionamento para
  // outro host, os cabeçalhos configurados ficam para trás — quem responde um
  // 302 não pode ganhar a credencial destinada a outro serviço.
  if (mesmaOrigem) {
    for (const { chave, valor } of pedido.cabecalhos) {
      // Nome vazio faz o `Headers` lançar. Um cabeçalho pela metade no editor é
      // rascunho, não motivo para a conversa morrer.
      if (chave.trim() !== '') cabecalhos.set(chave.trim(), valor)
    }
  }

  if (pedido.metodo === 'POST' && !cabecalhos.has('content-type')) {
    cabecalhos.set('content-type', 'application/json')
  }

  if (deTeste) cabecalhos.set(CABECALHO_TESTE, '1')

  return cabecalhos
}

/**
 * Lê `pedido.status` ou `itens.0.nome` de dentro do JSON.
 *
 * Deliberadamente não é JSONPath: quase todo caso real é campo raso, e o que
 * não for o cliente achata do lado dele. JSONPath seria uma linguagem inteira
 * para manter, testar e explicar.
 *
 * Tudo sai como texto porque é só isso que as variáveis da sessão guardam — e
 * caminho que não existe vira string vazia, igual `interpolar()` faz com
 * variável ausente. O validador é quem cobra o caminho certo, no editor.
 */
export function extrair(json: unknown, caminho: string): string {
  let atual: unknown = json

  for (const parte of caminho.split('.')) {
    if (atual === null || atual === undefined) return ''
    if (typeof atual !== 'object') return ''
    atual = (atual as Record<string, unknown>)[parte]
  }

  if (atual === null || atual === undefined) return ''
  return cortar(typeof atual === 'object' ? JSON.stringify(atual) : String(atual))
}

/**
 * Teto para um valor mapeado.
 *
 * Um caminho que cai num objeto grande — ou uma API que devolve muito mais do
 * que se esperava — viraria uma variável enorme, e ela acaba dentro de uma
 * mensagem de WhatsApp. A Cloud API corta em 4096 caracteres e recusa acima
 * disso, e a recusa aconteceria em `aplicar()`, depois da sessão já ter
 * avançado. 1000 é folgado para um campo e seguro para o limite.
 */
const LIMITE_VALOR = 1000

function cortar(valor: string): string {
  return valor.length <= LIMITE_VALOR ? valor : `${valor.slice(0, LIMITE_VALOR)}…`
}
