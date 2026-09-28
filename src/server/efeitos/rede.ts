import 'server-only'
import { lookup } from 'node:dns/promises'

/**
 * Quem pode ser chamado pelo nó de API.
 *
 * Uma URL que alguém digita e o nosso servidor executa é SSRF por construção:
 * quem edita o fluxo passa a poder fazer o servidor emitir requisição para
 * qualquer endereço alcançável a partir dele, incluindo o serviço de metadados
 * da nuvem, que entrega credencial a quem perguntar.
 *
 * Hoje só o operador edita fluxo, mas o BRIEF-UI §6 já prevê o cliente com
 * acesso, e essa porta não pode estar aberta quando ele chegar.
 *
 * A conferência é feita sobre o **endereço resolvido**, nunca sobre o nome: um
 * domínio público pode apontar para 127.0.0.1, e é exatamente assim que esse
 * ataque costuma ser escrito.
 *
 * Isto mora no servidor, e não no editor, pelo mesmo motivo que `publicar()`
 * revalida o fluxo: recusa de tela é conveniência, e a recusa de verdade
 * precisa valer venha a chamada de onde vier.
 */

/**
 * **DNS rebinding está fechado, e é por isso que esta função devolve o IP.**
 *
 * O padrão ingênuo, resolver, conferir, e deixar o cliente HTTP resolver de
 * novo na hora de conectar, tem uma janela: quem controla o domínio devolve um
 * IP público na conferência e o endereço de metadados da nuvem na conexão. O
 * `undici` (que é o que está por baixo do `fetch` no Node) **ignora o `agent` do
 * Node e re-resolve o DNS ao conectar**, então a janela existe de verdade.
 *
 * Não é teoria: é a mesma classe da CVE do Budibase (GHSA-v42f-v8xc-j435), que
 * é um low-code com nó de REST, o mesmo produto que este aqui.
 *
 * Por isso o veredito positivo carrega o endereço aprovado. Quem chama fixa a
 * conexão nele (ver `http.ts`), e não sobra segunda resolução para trocar.
 */

export type Veredito =
  | {
      ok: true
      /**
       * **Todos** os endereços aprovados, para quem for conectar fixar neles em
       * vez de resolver de novo. É o que fecha a janela do rebinding.
       *
       * A lista inteira, e não só o primeiro: um host de pilha dupla resolve
       * para AAAA e A, o Node devolve na ordem do servidor, e ficar só com o
       * primeiro tornaria o host inalcançável quando o ambiente não tem IPv6.
       * Todos já passaram pela recusa, então entregar a lista não afrouxa nada.
       */
      enderecos: { address: string; family: 4 | 6 }[]
    }
  | { ok: false; motivo: string }

export async function conferirEndereco(url: string): Promise<Veredito> {
  let alvo: URL
  try {
    alvo = new URL(url)
  } catch {
    return { ok: false, motivo: 'o endereço não é uma URL válida' }
  }

  // Antes do DNS: uma URL `http://` não merece nem a consulta.
  if (alvo.protocol !== 'https:') {
    return { ok: false, motivo: 'só https é aceito' }
  }

  let enderecos: { address: string; family: number }[]
  try {
    enderecos = await lookup(alvo.hostname, { all: true })
  } catch {
    return { ok: false, motivo: `não foi possível resolver "${alvo.hostname}"` }
  }

  if (enderecos.length === 0) {
    return { ok: false, motivo: `"${alvo.hostname}" não resolveu para endereço nenhum` }
  }

  // Basta um endereço ruim: um nome que resolve para vários é justamente o
  // jeito de esconder o alvo interno atrás de um público.
  for (const { address } of enderecos) {
    if (ehInterno(address)) {
      // O motivo não diz qual endereço foi descoberto. Ele aparece na tela e no
      // painel de leads, e confirmar "10.0.0.7 existe" é mapa de rede interna
      // entregue de graça a quem estiver sondando.
      return { ok: false, motivo: `"${alvo.hostname}" aponta para um endereço interno` }
    }
  }

  return {
    ok: true,
    enderecos: enderecos.map(({ address }) => ({
      address,
      family: address.includes(':') ? (6 as const) : (4 as const),
    })),
  }
}

/**
 * `true` para tudo que não deveria ser alcançável a partir de um fluxo.
 *
 * O padrão é recusar: endereço que este código não sabe interpretar volta
 * `true`. Aceitar o desconhecido significaria deixar passar exatamente a forma
 * que ninguém previu, que é a que interessa a quem ataca.
 */
export function ehInterno(endereco: string): boolean {
  const limpo = endereco.trim().toLowerCase()

  // IPv4 disfarçado de IPv6 (`::ffff:127.0.0.1`): mesma rede, outro nome.
  const mapeado = limpo.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapeado?.[1]) return ehInterno(mapeado[1])

  if (limpo.includes(':')) return ehIpv6Interno(limpo)

  const partes = limpo.split('.')
  if (partes.length !== 4) return true

  const numeros = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN))
  if (numeros.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true

  const [a = 0, b = 0] = numeros

  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // privada
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, e os metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true // privada
  if (a === 192 && b === 168) return true // privada
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast e reservado

  return false
}

function ehIpv6Interno(endereco: string): boolean {
  const grupos = expandirIpv6(endereco.split('%')[0] ?? '')
  // Forma que não se sabe ler: recusa, como no IPv4.
  if (!grupos) return true

  const [g0, g1, g2, g3, g4, g5, g6, g7] = grupos as [number, number, number, number, number, number, number, number]
  const ipv4 = (alto: number, baixo: number) => `${alto >> 8}.${alto & 0xff}.${baixo >> 8}.${baixo & 0xff}`

  // Um IPv4 escondido dentro do IPv6 vale o que o IPv4 vale. Sem isso,
  // `::ffff:7f00:1`, `::7f00:1` (compatível, obsoleto), `64:ff9b::7f00:1`
  // (NAT64) e `2002:7f00:1::` (6to4) passavam por externos.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0xffff || g5 === 0) {
      if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true // :: e ::1
      return ehInterno(ipv4(g6, g7))
    }
  }
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) return ehInterno(ipv4(g6, g7))
  if (g0 === 0x64 && g1 === 0xff9b) return ehInterno(ipv4(g6, g7))
  if (g0 === 0x2002) return ehInterno(ipv4(g1, g2))

  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7, único local
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10, link-local
  if ((g0 & 0xffc0) === 0xfec0) return true // fec0::/10, site-local (obsoleto)
  if ((g0 & 0xff00) === 0xff00) return true // ff00::/8, multicast
  return false
}

/** Os 8 grupos de 16 bits de um IPv6, aceitando `::` e IPv4 no fim. `null` se não é IPv6. */
function expandirIpv6(texto: string): number[] | null {
  let s = texto.trim().toLowerCase()
  const final = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (final?.[1] && final[2]) {
    const n = final[2].split('.').map(Number)
    if (n.some((x) => x > 255)) return null
    s = `${final[1]}${((n[0]! << 8) | n[1]!).toString(16)}:${((n[2]! << 8) | n[3]!).toString(16)}`
  }
  const metades = s.split('::')
  if (metades.length > 2) return null
  const ler = (parte: string) => (parte === '' ? [] : parte.split(':'))
  const esquerda = ler(metades[0] ?? '')
  const direita = metades.length === 2 ? ler(metades[1] ?? '') : []
  const faltam = 8 - esquerda.length - direita.length
  if (metades.length === 2 ? faltam < 1 : faltam !== 0) return null
  const todos = [...esquerda, ...Array(Math.max(faltam, 0)).fill('0'), ...direita]
  if (todos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return todos.map((g) => parseInt(g, 16))
}
