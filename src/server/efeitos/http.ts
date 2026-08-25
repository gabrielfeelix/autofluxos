import 'server-only'
import { Agent, request } from 'undici'
import type { Acao } from '@/core/engine/types'
import { MARCA_DE_LISTA, SEPARADOR_DE_LISTA } from '@/core/flow/schema'
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
  for (const { variavel, caminho, unicos, rotulo } of pedido.mapear) {
    valores[variavel] = extrair(json, caminho, unicos ?? false, rotulo)
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
export function extrair(
  json: unknown,
  caminho: string,
  unicos = false,
  rotulo?: string,
): string {
  const [antes, depois] = separarNaLista(caminho)

  if (depois === null) return comoTexto(descer(json, antes))

  /*
   * O caminho percorre uma lista.
   *
   * **Era a peça que faltava para o bot marcar horário.** Toda agenda e todo CRM
   * devolvem lista, e o mapeamento só sabia campo raso: dez horários chegavam na
   * resposta e não havia como virar menu. O contorno seria mandar o cliente
   * achatar do lado dele — ou seja, mandar ele usar n8n, que é a resposta que
   * este produto não dá.
   */
  const lista = descer(json, antes)
  if (!Array.isArray(lista)) return ''

  const modelo = (rotulo ?? '').trim()
  const itens: string[] = []
  for (const item of lista) {
    /*
     * Com modelo, o item inteiro é a fonte e os campos entre chaves montam a
     * linha: `{hora} · {servico}` vira "07:00 · Pilates solo".
     *
     * **Sem isto o menu só sabia mostrar um campo por item**, e há pergunta que
     * não fecha assim: duas aulas no mesmo dia viram duas linhas idênticas, e
     * "qual aula é essa?" não tem onde aparecer.
     */
    const bruto = modelo !== '' ? montar(modelo, item) : depois === '' ? item : descer(item, depois)
    if (bruto === null || bruto === undefined) continue

    /*
     * O separador não pode aparecer dentro de um item.
     *
     * Um nome com ponto e vírgula viraria dois itens no menu — e o menu é
     * pareado por posição com a lista de valores, então um item a mais desloca
     * todos os valores seguintes. Trocar por vírgula perde menos do que
     * desalinhar tudo.
     */
    const texto = (typeof bruto === 'object' ? JSON.stringify(bruto) : String(bruto))
      .replaceAll(SEPARADOR_DE_LISTA, ',')
      .trim()

    if (texto === '') continue
    if (unicos && itens.includes(texto)) continue
    itens.push(texto)
  }

  return cortar(itens.join(SEPARADOR_DE_LISTA))
}

/**
 * Monta a linha de um item a partir do modelo.
 *
 * Campo que não existe vira vazio, pela mesma razão que `{{variavel}}`
 * desconhecida vira vazio numa mensagem: um menu com `{servico}` literal é pior
 * do que um menu com um espaço a mais. Espaço sobrando nas pontas sai fora.
 */
function montar(modelo: string, item: unknown): string {
  return modelo
    .replace(/\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}/g, (_, campo: string) => {
      const valor = descer(item, campo)
      if (valor === null || valor === undefined) return ''
      return typeof valor === 'object' ? '' : String(valor)
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Quebra `livres[].hora` em `["livres", "hora"]`. Sem `[]`, o segundo é `null`. */
function separarNaLista(caminho: string): [string, string | null] {
  const marca = caminho.indexOf(MARCA_DE_LISTA)
  if (marca === -1) return [caminho, null]

  const antes = caminho.slice(0, marca)
  // O ponto depois do `[]` é separador de nível, não parte do nome do campo.
  const depois = caminho.slice(marca + MARCA_DE_LISTA.length).replace(/^\./, '')
  return [antes, depois]
}

/** Anda pelo caminho de pontos. Qualquer degrau que não existe devolve nada. */
function descer(json: unknown, caminho: string): unknown {
  if (caminho === '') return json

  let atual: unknown = json
  for (const parte of caminho.split('.')) {
    if (atual === null || atual === undefined) return undefined
    if (typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[parte]
  }
  return atual
}

function comoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return cortar(typeof valor === 'object' ? JSON.stringify(valor) : String(valor))
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
