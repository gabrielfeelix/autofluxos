import 'server-only'
import { lookup } from 'node:dns/promises'

/**
 * Quem pode ser chamado pelo nó de API.
 *
 * Uma URL que alguém digita e o nosso servidor executa é SSRF por construção:
 * quem edita o fluxo passa a poder fazer o servidor emitir requisição para
 * qualquer endereço alcançável a partir dele — incluindo o serviço de metadados
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
 * O padrão ingênuo — resolver, conferir, e deixar o cliente HTTP resolver de
 * novo na hora de conectar — tem uma janela: quem controla o domínio devolve um
 * IP público na conferência e o endereço de metadados da nuvem na conexão. O
 * `undici` (que é o que está por baixo do `fetch` no Node) **ignora o `agent` do
 * Node e re-resolve o DNS ao conectar**, então a janela existe de verdade.
 *
 * Não é teoria: é a mesma classe da CVE do Budibase (GHSA-v42f-v8xc-j435), que
 * é um low-code com nó de REST — o mesmo produto que este aqui.
 *
 * Por isso o veredito positivo carrega o endereço aprovado. Quem chama fixa a
 * conexão nele (ver `http.ts`), e não sobra segunda resolução para trocar.
 */

export type Veredito =
  | {
      ok: true
      /**
       * O endereço aprovado, para quem for conectar **fixar nele** em vez de
       * resolver de novo. É o que fecha a janela do rebinding.
       */
      endereco: string
      /** 4 ou 6, que o `lookup` do undici precisa devolver junto. */
      familia: 4 | 6
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

  // Devolve o primeiro, que é o que será fixado na conexão. Todos já passaram —
  // aprovar a lista e conectar em outro endereço seria o mesmo furo de novo.
  const primeiro = enderecos[0]
  if (!primeiro) {
    return { ok: false, motivo: `"${alvo.hostname}" não resolveu para endereço nenhum` }
  }

  return {
    ok: true,
    endereco: primeiro.address,
    familia: primeiro.address.includes(':') ? 6 : 4,
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
  const semZona = endereco.split('%')[0] ?? ''
  if (semZona === '::' || semZona === '::1') return true
  // fc00::/7 (único local) e fe80::/10 (link-local).
  return /^f[cd]/.test(semZona) || /^fe[89ab]/.test(semZona)
}
