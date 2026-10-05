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
  await banco.query(
    `delete from public.af_sessoes
      where "userId" = $1
        and "impersonatedBy" is null
        and id not in (
          select id from public.af_sessoes
           where "userId" = $1 and "impersonatedBy" is null and "expiresAt" > now()
           order by "createdAt" desc
           limit $2
        )`,
    [sessao.userId, APARELHOS_POR_PESSOA],
  )
}
