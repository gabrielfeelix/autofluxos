import 'server-only'
import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import { iguais } from '@/lib/segredo'

/**
 * O `state` do OAuth: o bilhete que amarra o retorno da Meta a quem começou.
 *
 * **Sem ele existe um ataque real, e não teórico.** A rota de retorno é pública
 * por obrigação, a Meta chama o navegador de quem autorizou, sem cookie
 * nosso garantido. Se ela aceitasse `?cliente=<uuid>` na lata, bastaria induzir
 * um administrador logado a abrir um link para ligar uma conta de Instagram
 * qualquer ao cliente errado, ou ligar a conta do atacante a um cliente de
 * verdade, e passar a receber os direct dele.
 *
 * O bilhete é assinado com segredo do servidor e vence rápido: um OAuth
 * inteiro leva menos de um minuto, e um bilhete que vale o dia todo é um
 * bilhete que dá para reaproveitar.
 *
 * **Não substitui a conferência de acesso.** A rota de retorno confere de novo
 * se quem está logado pode mexer naquele cliente. O bilhete prova qual cliente
 * a conexão começou; a sessão prova quem é. As duas coisas, sempre.
 */

/**
 * Trinta minutos, e os dez de antes eram pouco.
 *
 * Dez foi dimensionado para o OAuth do Instagram, que é uma tela e um clique.
 * O Embedded Signup do WhatsApp em coexistência é outro bicho: o cliente digita
 * o número, **espera chegar uma mensagem** da Conta Oficial do Facebook Business
 * no WhatsApp dele, sai do navegador para tocar em *Connect* e *Confirm* no
 * celular, volta, e cola o código. Na primeira vez, sem saber o que vem, isso
 * passa de dez minutos com facilidade, e o bilhete vencido derruba a conexão
 * bem no fim, depois de a Meta já ter dito "conectado".
 *
 * Alongar não enfraquece o que o bilhete faz: ele continua assinado, e o que
 * ele protege é a troca de cliente, não um segredo que envelhece. Trinta
 * minutos é folga para o fluxo mais lento e ainda fecha a janela muito antes de
 * um link esquecido num histórico virar problema.
 */
const VALIDADE_MS = 30 * 60 * 1_000

function segredo(): string {
  const valor = process.env.BETTER_AUTH_SECRET ?? process.env.PAINEL_SEGREDO
  if (!valor) {
    throw new Error('falta BETTER_AUTH_SECRET (ou PAINEL_SEGREDO) para assinar a conexão')
  }
  return valor
}

function assinar(carga: string): string {
  return createHmac('sha256', segredo()).update(carga).digest('base64url')
}

export function criarEstado(clienteId: string, agora: Date = new Date()): string {
  const carga = `${clienteId}.${agora.getTime()}`
  return `${carga}.${assinar(carga)}`
}

/**
 * Devolve o cliente que começou a conexão, ou `null`.
 *
 * `null` para tudo que não presta, assinatura errada, prazo vencido, formato
 * estranho. Distinguir os casos na resposta contaria a quem está testando qual
 * parte ele acertou.
 */
export function lerEstado(estado: string | null, agora: Date = new Date()): string | null {
  if (!estado) return null

  const partes = estado.split('.')
  if (partes.length !== 3) return null

  const [clienteId, carimbo, assinatura] = partes as [string, string, string]
  if (!iguais(assinatura, assinar(`${clienteId}.${carimbo}`))) return null

  const nascido = Number(carimbo)
  if (!Number.isFinite(nascido)) return null
  if (agora.getTime() - nascido > VALIDADE_MS) return null
  // Bilhete do futuro é relógio torto ou bilhete forjado; nos dois casos, não.
  if (nascido > agora.getTime() + 60_000) return null

  return clienteId
}

/**
 * O cookie que amarra o bilhete ao navegador que começou a conexão.
 *
 * **O bilhete sozinho era um bilhete ao portador** (auditoria de 28/set/2026).
 * Ele prova qual cliente começou, mas não quem está voltando, e a rota de
 * retorno, sem sessão garantida, confiava só nele. O ataque: alguém cria conta
 * aqui, clica em "conectar Instagram" na conta dele, para na tela de
 * autorização da Meta e manda esse link para a vítima ("conecta aqui para
 * ganhar X"). A vítima autoriza, a Meta a devolve para cá com o bilhete do
 * atacante, e o Instagram, o WhatsApp, os anúncios ou a loja **da vítima**
 * caem na conta do atacante, que passa a ler e responder as conversas dela.
 *
 * A defesa é o padrão do OAuth: o mesmo bilhete fica guardado num cookie do
 * navegador que começou, e a volta só vale se os dois baterem. O link
 * repassado chega a outro navegador, que não tem o cookie.
 *
 * `SameSite=None` e não `Lax`, porque a volta é uma navegação que começa em
 * facebook.com (ou na Nuvemshop), às vezes depois de um POST lá dentro, e é
 * exatamente o caso em que `Lax` deixa o cookie para trás (ver o comentário
 * de `PREFIXOS_ABERTOS` em `proxy.ts`). O cookie não autoriza nada sozinho: é
 * só a metade de uma comparação cuja outra metade é assinada pelo servidor.
 */
const COOKIE_DA_CONEXAO = 'af_conexao'

/** Cria o bilhete e o guarda no navegador. Só funciona dentro de Server Action. */
export async function iniciarConexao(clienteId: string): Promise<string> {
  const estado = criarEstado(clienteId)
  ;(await cookies()).set(COOKIE_DA_CONEXAO, estado, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/',
    maxAge: VALIDADE_MS / 1_000,
  })
  return estado
}

/**
 * O cliente do bilhete, se ele é válido **e** é o mesmo que este navegador
 * guardou ao começar. `null` em qualquer outro caso.
 */
export async function concluirConexao(estado: string | null): Promise<string | null> {
  const guardado = (await cookies()).get(COOKIE_DA_CONEXAO)?.value
  if (!estado || !guardado || !iguais(guardado, estado)) return null
  return lerEstado(estado)
}
