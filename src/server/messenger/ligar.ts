import 'server-only'
import { cookies } from 'next/headers'
import { db } from '../db'
import { salvarPaginaDoMessenger } from '../repos/canais-messenger'
import { inscreverPagina, type PaginaComToken } from './conexao'

/**
 * Liga uma página: inscreve o webhook e só então grava o canal.
 *
 * Nessa ordem porque página gravada sem inscrição é o pior estado, o de
 * parecer ligada e nunca receber nada.
 */
export async function ligarPagina(clienteId: string, pagina: PaginaComToken): Promise<void> {
  await inscreverPagina(pagina.id, pagina.token)
  await salvarPaginaDoMessenger({ clienteId, pageId: pagina.id, nome: pagina.nome || null, token: pagina.token })
}

/**
 * Quem liberou mais de uma página escolhe uma na tela.
 *
 * Entre o retorno e a escolha, o token do usuário espera no Vault, e o
 * navegador guarda só a referência (cookie `httpOnly`, 15 minutos). Token
 * nenhum passa pela URL nem pelo HTML.
 */
const COOKIE_DA_ESCOLHA = 'af_messenger_escolha'

export async function guardarEscolhaPendente(clienteId: string, tokenDoUsuario: string): Promise<void> {
  await descartarEscolhaPendente()
  const { data, error } = await db().rpc('criar_segredo', {
    valor: tokenDoUsuario,
    apelido: `messenger_escolha_${crypto.randomUUID()}`,
  })
  if (error) throw new Error(`não foi possível guardar a escolha: ${error.message}`)
  ;(await cookies()).set(COOKIE_DA_ESCOLHA, `${clienteId}:${data as string}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  })
}

/** O token do usuário guardado para esta conta, se a escolha ainda vale. */
export async function lerEscolhaPendente(clienteId: string): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_DA_ESCOLHA)?.value
  const [dono, ref] = valor?.split(':') ?? []
  if (!ref || dono !== clienteId) return null
  const { data, error } = await db().rpc('ler_segredo', { alvo: ref })
  if (error || typeof data !== 'string') return null
  return data
}

/** Apaga o token do Vault e o cookie. Só pode ser chamada de Server Action ou rota. */
export async function descartarEscolhaPendente(): Promise<void> {
  const jarra = await cookies()
  const ref = jarra.get(COOKIE_DA_ESCOLHA)?.value?.split(':')[1]
  if (ref) await db().rpc('apagar_segredo', { alvo: ref })
  jarra.delete(COOKIE_DA_ESCOLHA)
}
