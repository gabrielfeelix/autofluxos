import 'server-only'
import { Agent, request } from 'undici'
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

/**
 * A credencial já resolvida, do jeito que ela entra na requisição.
 *
 * O formato bate com `repos/conexoes.ts` de propósito, mas este arquivo não
 * importa nada de lá: quem dispara requisição não precisa saber que existe
 * tabela, cofre ou cliente.
 */
export type CredencialDaChamada = {
  tipo: 'bearer' | 'cabecalho' | 'query'
  campo: string | null
  valor: string
}

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
  { deTeste, credencial }: { deTeste: boolean; credencial?: CredencialDaChamada | null },
): Promise<RespostaHttp> {
  // Um prazo para a chamada inteira, saltos incluídos. Os tempos do undici são
  // de **inatividade**: um servidor pingando um byte por segundo nunca os
  // dispara, e sozinhos eles deixariam a função estourar o `maxDuration` do
  // webhook e morrer antes de gravar o handoff.
  const prazo = AbortSignal.timeout(TIMEOUT_MS * (MAX_SALTOS + 1))

  /** Agents abertos nesta chamada. Sem fechar, sobra socket keep-alive vivo. */
  const agents: Agent[] = []
  const fechar = async () => {
    await Promise.allSettled(agents.map((a) => a.close()))
  }

  let urlBase = pedido.url
  let resposta: Awaited<ReturnType<typeof request>>

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
    // A credencial vale só na origem que o operador escreveu. Depois de um
    // redirecionamento para outro host ela fica para trás, pela mesma razão
    // dos cabeçalhos: quem responde um 302 não ganha o token de outro serviço.
    const mesmaOrigem = origemDe(urlBase) === origemInicial
    const credencialValida = mesmaOrigem ? (credencial ?? null) : null

    const url = comCredencialNaConsulta(urlBase, credencialValida)

    const veredito = await conferirEndereco(url)
    if (!veredito.ok) {
      await fechar()
      return { ok: false, motivo: veredito.motivo }
    }

    let cabecalhos: Record<string, string>
    try {
      // Nome ou valor inválido lança aqui dentro. Fora do `try` isso escaparia
      // até o `after()` do webhook, a sessão nunca seria salva, a mensagem já
      // foi deduplicada e a pessoa ficaria sem resposta nenhuma — sem nem a
      // Meta reenviar. Falhar aqui vira handoff, que é o certo.
      cabecalhos = montarCabecalhos(pedido, deTeste, mesmaOrigem, credencialValida)
    } catch {
      await fechar()
      return { ok: false, motivo: 'um dos cabeçalhos configurados é inválido' }
    }

    try {
      resposta = await request(url, {
        method: metodo,
        headers: cabecalhos,
        body: metodo === 'POST' ? corpo : undefined,
        // `request` do undici **não segue redirecionamento** por padrão, e é
        // isso que a gente quer: seguir sozinho pularia a conferência de
        // endereço no destino, que é exatamente por onde o ataque entraria —
        // um host público que responde 302 apontando para a rede interna.
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
        // Aqui mora a defesa contra rebinding: conecta no endereço que
        // `conferirEndereco` já aprovou, sem consultar o DNS de novo.
        signal: prazo,
        dispatcher: agenteFixadoEm(veredito.enderecos, agents),
      })
    } catch (erro) {
      await fechar()
      const nome = erro instanceof Error ? erro.name : ''
      const porTempo =
        nome === 'HeadersTimeoutError' ||
        nome === 'BodyTimeoutError' ||
        nome === 'TimeoutError' ||
        nome === 'AbortError'
      return {
        ok: false,
        motivo: porTempo
          ? `a chamada passou de ${TIMEOUT_MS / 1000}s sem responder`
          : 'a chamada não completou',
      }
    }

    const destino =
      resposta.statusCode >= 300 && resposta.statusCode < 400 ? cabecalho(resposta, 'location') : null

    if (!destino) break

    // O corpo do 3xx não interessa, mas precisa ser lido: um stream pausado que
    // o undici destrói depois vira exceção sem dono.
    await descartar(resposta)

    // A conta fica aqui, e não no topo do laço, porque só aqui se sabe que vai
    // haver outro salto. `salto` começa em 0, então isto permite MAX_SALTOS
    // redirecionamentos e MAX_SALTOS + 1 chamadas.
    if (salto >= MAX_SALTOS) {
      await fechar()
      return { ok: false, motivo: 'a chamada redirecionou vezes demais' }
    }

    let proxima: URL
    try {
      proxima = new URL(destino, url)
    } catch {
      await fechar()
      return { ok: false, motivo: 'a chamada redirecionou para um endereço ilegível' }
    }

    // 301, 302 e 303 viram GET sem corpo — é o que a norma manda e o que todo
    // navegador faz. 307 e 308 preservam o método, e aí o corpo só continua se
    // o destino for a mesma origem: ele carrega o lead inteiro, e entregá-lo a
    // quem respondeu o redirecionamento é o mesmo vazamento que os cabeçalhos.
    if (
      resposta.statusCode === 301 ||
      resposta.statusCode === 302 ||
      resposta.statusCode === 303
    ) {
      metodo = 'GET'
      corpo = undefined
    } else if (proxima.origin !== origemInicial) {
      corpo = undefined
    }

    urlBase = proxima.toString()
  }

  if (resposta.statusCode < 200 || resposta.statusCode >= 300) {
    // Mesmo motivo dos outros `descartar`: uma resposta 500 com corpo grande
    // deixaria o stream pendurado e a exceção cairia dentro do `after()`.
    await descartar(resposta)
    await fechar()
    return { ok: false, motivo: `a chamada respondeu ${resposta.statusCode}` }
  }

  // Sem mapeamento, o que voltou não interessa: é o webhook disparado e
  // esquecido, que é metade do valor deste nó. O corpo ainda precisa ser
  // consumido — deixar pendurado segura a conexão até o timeout.
  if (pedido.mapear.length === 0) {
    await descartar(resposta)
    await fechar()
    return { ok: true, valores: {} }
  }

  let json: unknown
  try {
    json = await resposta.body.json()
  } catch {
    await fechar()
    return { ok: false, motivo: 'a resposta não é JSON, e o bloco pede campos dela' }
  } finally {
    await fechar()
  }

  const valores: Record<string, string> = {}
  for (const { variavel, caminho } of pedido.mapear) {
    valores[variavel] = extrair(json, caminho)
  }

  return { ok: true, valores }
}

/**
 * Um `dispatcher` que não resolve nome nenhum: conecta direto no endereço que
 * já passou pela conferência.
 *
 * O `Host` e o `servername` do TLS continuam sendo o hostname original — sem
 * isso o certificado não bateria e todo https quebraria. O undici cuida disso
 * sozinho porque a URL continua com o hostname; só o `lookup` é que mente.
 */
function agenteFixadoEm(
  enderecos: { address: string; family: 4 | 6 }[],
  registro: Agent[],
): Agent {
  const primeiro = enderecos[0] as { address: string; family: 4 | 6 }

  const agent = new Agent({
    connect: {
      lookup(_hostname, opcoes, callback) {
        // A lista inteira quando pedem `all`, para o Node poder cair no A
        // quando o AAAA não conecta. Nenhum deles resolve nada: todos já
        // passaram pela recusa antes de chegar aqui.
        if (opcoes.all) {
          callback(null, enderecos as never)
          return
        }
        callback(null, primeiro.address as never, primeiro.family as never)
      },
    },
  })

  registro.push(agent)
  return agent
}

/** Lê e joga fora o corpo, para o stream não ficar pendurado. */
async function descartar(resposta: { body: { dump: () => Promise<void> } }): Promise<void> {
  try {
    await resposta.body.dump()
  } catch {
    // Corpo já consumido ou conexão morta. Não há o que fazer, e estourar aqui
    // seria trocar um vazamento de socket por uma exceção sem dono.
  }
}

/** Lê um cabeçalho da resposta, que no undici pode vir como lista. */
function cabecalho(resposta: { headers: Record<string, string | string[] | undefined> }, nome: string): string | null {
  const valor = resposta.headers[nome]
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor ?? null
}

/** A origem de uma URL, ou string vazia se ela não der para ler. */
function origemDe(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/**
 * Credencial do tipo `query` entra na URL, e é refeita a cada salto: o destino
 * de um redirecionamento não carrega os parâmetros da chamada anterior.
 */
function comCredencialNaConsulta(url: string, credencial: CredencialDaChamada | null): string {
  if (!credencial || credencial.tipo !== 'query' || !credencial.campo) return url
  try {
    const alvo = new URL(url)
    alvo.searchParams.set(credencial.campo, credencial.valor)
    return alvo.toString()
  } catch {
    return url
  }
}

function montarCabecalhos(
  pedido: PedidoHttp,
  deTeste: boolean,
  mesmaOrigem: boolean,
  credencial: CredencialDaChamada | null,
): Record<string, string> {
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

  // A credencial vem depois, e por isso ganha de um cabeçalho escrito à mão com
  // o mesmo nome. Se as duas coisas existem, a que o cofre guarda é a boa.
  if (credencial) {
    if (credencial.tipo === 'bearer') {
      cabecalhos.set('authorization', `Bearer ${credencial.valor}`)
    } else if (credencial.tipo === 'cabecalho' && credencial.campo) {
      cabecalhos.set(credencial.campo.trim(), credencial.valor)
    }
  }

  if (pedido.metodo === 'POST' && !cabecalhos.has('content-type')) {
    cabecalhos.set('content-type', 'application/json')
  }

  if (deTeste) cabecalhos.set(CABECALHO_TESTE, '1')

  return Object.fromEntries(cabecalhos.entries())
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
