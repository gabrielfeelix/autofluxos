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
 * **O que esta conferência NÃO cobre: DNS rebinding.**
 *
 * Entre resolver o nome aqui e o `fetch` resolver de novo, a resposta do DNS
 * pode mudar. Quem controla um domínio consegue devolver um IP público na
 * primeira consulta e `169.254.169.254` na segunda, e aí a requisição sai para
 * o endereço que este arquivo existe para bloquear. É uma janela de tempo, não
 * um furo na lógica — o padrão "conferir e depois chamar" tem essa brecha por
 * construção.
 *
 * Fechar de verdade exige fixar o IP já resolvido no momento da conexão (um
 * `dispatcher` do undici com `lookup` próprio), o que muda como o `fetch` é
 * montado e precisa conviver com o `fetch` que o Next embrulha.
 *
 * Fica registrado como risco aceito, e não como coisa esquecida: hoje só o
 * operador escreve endereço de fluxo, então quem exploraria isso é quem já tem
 * acesso ao editor. **Isto muda no dia em que o cliente ganhar acesso**
 * (BRIEF-UI §6) — nesse dia, o rebinding sai de teórico e este comentário vira
 * tarefa.
 */

export type Veredito = { ok: true } | { ok: false; motivo: string }

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

  let enderecos: { address: string }[]
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

  return { ok: true }
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
