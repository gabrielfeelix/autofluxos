import { createHash } from 'node:crypto'
import type { Pool } from 'pg'

/**
 * Quantos aparelhos a mesma pessoa usa ao mesmo tempo: celular, computador e
 * tablet. O quarto login encerra o mais antigo.
 *
 * **Por que limitar.** O usuário é da pessoa, e o plano é por usuário: um
 * login dividido entre a equipe inteira apaga quem fez o quê no histórico e
 * na distribuição. IP ou máquina não servem para isso (o IP muda no 4G, e o
 * escritório inteiro sai por um IP só); contar sessões é o que os SaaS fazem.
 *
 * **Quem fica de fora:** o administrador da plataforma (o suporte da 4YU, que
 * entra em várias contas o dia inteiro) e a sessão de suporte aberta "como" o
 * cliente (`impersonatedBy`), que não pode derrubar o cliente nem contar como
 * aparelho dele.
 */
export const APARELHOS_POR_PESSOA = 3

export async function limitarSessoes(
  banco: Pool,
  sessao: { userId: string; impersonatedBy?: string | null },
): Promise<void> {
  if (sessao.impersonatedBy) return

  const { rows } = await banco.query<{ role: string | null }>(
    'select role from public.af_usuarios where id = $1',
    [sessao.userId],
  )
  const papeis = (rows[0]?.role ?? '').split(',').map((papel) => papel.trim())
  if (papeis.includes('admin')) return

  // As mais novas ficam; vencida não conta como aparelho e sai junto.
  const { rows: derrubadas } = await banco.query<{ token: string; expiresAt: Date }>(
    `delete from public.af_sessoes
      where "userId" = $1
        and "impersonatedBy" is null
        and id not in (
          select id from public.af_sessoes
           where "userId" = $1 and "impersonatedBy" is null and "expiresAt" > now()
           order by "createdAt" desc
           limit $2
        )
      returning token, "expiresAt"`,
    [sessao.userId, APARELHOS_POR_PESSOA],
  )

  /*
   * A marca de "saiu porque entrou em outro aparelho". O navegador derrubado
   * ainda tem o cookie com o token velho; sem a marca, ele cai na tela de
   * entrar sem saber por quê, e acha que é defeito. Vai na tabela de
   * verificações do próprio login, e só o hash: o token não fica guardado.
   * Vence junto com a sessão que ela explica.
   */
  const vivas = derrubadas.filter((linha) => new Date(linha.expiresAt).getTime() > Date.now())
  if (vivas.length === 0) return
  await banco.query(
    `insert into public.af_verificacoes (identifier, value, "expiresAt")
     select unnest($1::text[]), 'outro-aparelho', unnest($2::timestamptz[])`,
    [vivas.map((linha) => marcaDaDerrubada(linha.token)), vivas.map((linha) => linha.expiresAt)],
  )
}

/** O identificador da marca, pelo token da sessão derrubada. */
export function marcaDaDerrubada(token: string): string {
  return `sessao-derrubada:${createHash('sha256').update(token).digest('hex')}`
}

/**
 * O cookie deste navegador é de uma sessão que o limite derrubou? Lê o token
 * do cookie (o valor é `token.assinatura`) e procura a marca.
 */
export async function foiDerrubada(banco: Pool, valorDoCookie: string | undefined): Promise<boolean> {
  const token = valorDoCookie?.split('.')[0]
  if (!token) return false
  const { rows } = await banco.query(
    `select 1 from public.af_verificacoes where identifier = $1 and "expiresAt" > now() limit 1`,
    [marcaDaDerrubada(decodeURIComponent(token))],
  )
  return rows.length > 0
}
