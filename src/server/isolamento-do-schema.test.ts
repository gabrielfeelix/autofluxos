import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'

/**
 * O que `anon` e `authenticated` alcançam em `public`, conferido no catálogo.
 *
 * **Por que este arquivo existe.** A T9.1 (item 5) auditou o isolamento na
 * produção e encontrou três das 31 funções de `public` executáveis por `anon`:
 * `concluir_processo`, `resolver_continuidade` (0072) e `reabrir_ao_receber`
 * (0049). Nenhum dado vazou, porque o `grant` de tabela da 0041 barrou na
 * camada seguinte, mas a defesa em profundidade tinha sido perdida sem ninguém
 * notar por semanas. A 0087 fechou as três.
 *
 * **A causa é a armadilha da 0026, e ela vai voltar.** `revoke execute ... from
 * anon, authenticated` **não fecha função**: o Postgres concede `EXECUTE` a
 * `PUBLIC` na criação, e os dois papéis herdam de lá o que se revoga deles. A
 * forma certa inclui `public` na lista. Escrever o revoke "errado" é o caminho
 * natural de quem está pensando nos dois papéis, e foi o que aconteceu duas
 * vezes em migrations diferentes.
 *
 * Por isso a guarda é **uma contagem no catálogo, e não uma lista de nomes**:
 * uma lista só pegaria a função que alguém lembrasse de acrescentar aqui, e o
 * problema é exatamente a que ninguém lembra.
 *
 * **Por que `has_function_privilege` e não `information_schema`.** É a lição
 * escrita no §6 do `docs/BANCO-COMPARTILHADO.md`: o `information_schema` mostra
 * concessão direta ao papel, e o `EXECUTE` herdado de `PUBLIC` não aparece
 * nela. Foi assim que a 0026 passou por fechada por meses. `has_function_privilege`
 * pergunta o que vale de verdade, somando o que vem de `PUBLIC`.
 */
const temBanco = Boolean(process.env.DATABASE_URL)

let pool: Pool | null = null
function banco(): Pool {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  return pool
}

afterAll(async () => {
  await pool?.end()
  pool = null
})

describe.skipIf(!temBanco)('o que anon e authenticated alcançam em public', () => {
  it('nenhuma função de public é executável por anon ou authenticated', async () => {
    const { rows } = await banco().query<{ nome: string; retorno: string }>(`
      select p.proname as nome, pg_get_function_result(p.oid) as retorno
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
       order by p.proname
    `)

    // A mensagem nomeia as funções em vez de dizer só "esperava 0": quem
    // quebrar isto precisa saber *qual* migration esqueceu o `public` no
    // revoke, e a lista responde na hora.
    expect(rows.map((r) => r.nome)).toEqual([])
  })

  it('nenhuma tabela ou view de public é alcançável por anon ou authenticated', async () => {
    const { rows } = await banco().query<{ nome: string }>(`
      select distinct table_name as nome
        from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee in ('anon', 'authenticated')
       order by 1
    `)

    expect(rows.map((r) => r.nome)).toEqual([])
  })

  it('service_role continua alcançando o que a aplicação usa', async () => {
    // O contraponto que impede o teste acima de passar por um banco vazio ou
    // por um revoke largo demais: fechar para todo mundo também passaria nos
    // dois casos acima, e derrubaria o produto inteiro.
    const { rows } = await banco().query<{ ok: boolean }>(`
      select has_function_privilege(
        'service_role',
        'public.concluir_processo(uuid,uuid,text,numeric,text,text,text,text)',
        'EXECUTE') as ok
    `)

    expect(rows[0]?.ok).toBe(true)
  })

  it('o gatilho de reabrir conversa continua disparando depois do revoke', async () => {
    // A pergunta que a 0087 precisava responder antes de ser aplicada:
    // revogar o EXECUTE de `reabrir_ao_receber` quebra o gatilho?
    //
    // Não quebra, e o motivo é que o Postgres executa função de gatilho com os
    // privilégios do dono da tabela, e não com os de quem fez o `insert`. Mas
    // "não quebra em teoria" não é evidência, então aqui está o insert de
    // verdade: contato `resolvida` que volta a `aberta` ao receber mensagem.
    const cliente = await banco().connect()
    try {
      await cliente.query('begin')
      const conta = await cliente.query<{ id: string }>(
        `insert into public.clients (nome, slug) values ($1, $2) returning id`,
        ['zz isolamento', `zz-isolamento-${Math.random().toString(36).slice(2, 8)}`],
      )
      const contaId = conta.rows[0]?.id
      expect(contaId).toBeTruthy()

      const contato = await cliente.query<{ id: string }>(
        `insert into public.contacts (client_id, wa_id, estado)
         values ($1, $2, 'resolvida') returning id`,
        [contaId, `55449${Math.floor(Math.random() * 100_000_000)}`],
      )
      const contatoId = contato.rows[0]?.id
      expect(contatoId).toBeTruthy()

      await cliente.query(
        `insert into public.messages (contact_id, direcao, ts, historico)
         values ($1, 'entrada', now(), false)`,
        [contatoId],
      )

      const depois = await cliente.query<{ estado: string }>(
        `select estado from public.contacts where id = $1`,
        [contatoId],
      )
      expect(depois.rows[0]?.estado).toBe('aberta')
    } finally {
      // Desfaz sempre, inclusive quando a asserção falha: este teste roda
      // contra o mesmo banco dos outros, e deixar conta órfã suja a contagem
      // de quem vier depois.
      await cliente.query('rollback')
      cliente.release()
    }
  })
})
