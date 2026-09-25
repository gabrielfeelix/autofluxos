'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { COOKIE_DE_ESPIAR } from './espiar'
import { exigirHierarquia } from './pessoas'
import { registrar } from './repos/auditoria'
import { membrosDaConta } from './repos/usuarios'

const OITO_HORAS = 8 * 60 * 60

/** Entra no modo espiar na caixa de `usuarioId`. Ver `server/espiar.ts`. */
export async function acaoEspiar(
  clienteId: string,
  usuarioId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const ids = z.object({ clienteId: z.string().uuid(), usuarioId: z.string().min(1).max(100) }).safeParse({ clienteId, usuarioId })
  if (!ids.success) return { ok: false, erro: 'pessoa inválida' }

  const hierarquia = await exigirHierarquia(clienteId, usuarioId)
  if ('ok' in hierarquia) return { ok: false, erro: hierarquia.erro }
  const { ator } = hierarquia
  if (ator.usuarioId === usuarioId) return { ok: false, erro: 'a sua própria caixa você já vê' }

  ;(await cookies()).set(COOKIE_DE_ESPIAR, `${clienteId}:${usuarioId}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OITO_HORAS,
  })

  const nome = (await membrosDaConta(clienteId)).find((membro) => membro.id === usuarioId)?.nome ?? ''
  await registrar({
    acao: 'espiou_caixa',
    autorId: ator.usuarioId,
    autorEmail: ator.acesso.sessao.usuario.email ?? '',
    contaId: clienteId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: nome,
    impersonadoPor: ator.acesso.sessao.impersonadoPor ?? null,
  })
  return { ok: true }
}

/** Sai do modo espiar. Não confere nada: sair é sempre permitido. */
export async function acaoPararDeEspiar(): Promise<void> {
  // Com o mesmo `path` da gravação: sem ele o navegador apaga um cookie de
  // outro caminho e o de verdade continua lá.
  ;(await cookies()).delete({ name: COOKIE_DE_ESPIAR, path: '/' })
}
