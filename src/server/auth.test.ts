import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { autenticacao } from './auth'

/**
 * O login contra o banco de verdade.
 *
 * Não testa o Better Auth — testa **a nossa configuração dele**: que os nomes de
 * tabela que escolhemos são os que ele usa, que a senha sai como hash, e que a
 * impersonação grava quem entrou na conta de quem. Errar qualquer um desses
 * três só apareceria no primeiro login de um cliente de verdade.
 */
const temBanco = Boolean(process.env.DATABASE_URL)
const marca = `zz-auth-${Math.random().toString(36).slice(2, 8)}`
const email = (sufixo: string) => `${marca}-${sufixo}@exemplo.test`
const SENHA = 'senha-comprida-de-teste'

const criados: string[] = []

afterAll(async () => {
  if (!temBanco || criados.length === 0) return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  // Cascata em `af_contas` e `af_sessoes` leva sessão e credencial junto.
  await pool.query('delete from public.af_usuarios where email = any($1)', [criados])
  await pool.end()
})

async function criar(sufixo: string) {
  const endereco = email(sufixo)
  criados.push(endereco)
  const r = await autenticacao().api.signUpEmail({
    body: { email: endereco, password: SENHA, name: `Teste ${sufixo}` },
  })
  return { endereco, usuario: r.user }
}

describe.skipIf(!temBanco)('login por usuário', () => {
  it('cria usuário nas tabelas que nomeamos, e não em `user`', async () => {
    const { usuario } = await criar('nomes')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query('select "email" from public.af_usuarios where id = $1', [
        usuario.id,
      ])
      expect(rows).toHaveLength(1)
    } finally {
      await pool.end()
    }
  })

  it('guarda hash, nunca a senha', async () => {
    const { usuario } = await criar('hash')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select "password" from public.af_contas where "userId" = $1',
        [usuario.id],
      )
      const guardado = rows[0]?.password as string
      expect(guardado).toBeTruthy()
      expect(guardado).not.toContain(SENHA)
      expect(guardado.length).toBeGreaterThan(40)
    } finally {
      await pool.end()
    }
  })

  it('entra com a senha certa e recusa a errada', async () => {
    const { endereco } = await criar('entrar')

    const ok = await autenticacao().api.signInEmail({ body: { email: endereco, password: SENHA } })
    expect(ok.user.email).toBe(endereco)

    await expect(
      autenticacao().api.signInEmail({ body: { email: endereco, password: 'outra-coisa-qualquer' } }),
    ).rejects.toThrow()
  })

  it('recusa senha curta — o mínimo é 10', async () => {
    await expect(
      autenticacao().api.signUpEmail({
        body: { email: email('curta'), password: 'abc123', name: 'Curta' },
      }),
    ).rejects.toThrow()
  })

  it('não deixa dois usuários com o mesmo e-mail', async () => {
    const { endereco } = await criar('duplicado')

    await expect(
      autenticacao().api.signUpEmail({ body: { email: endereco, password: SENHA, name: 'Outro' } }),
    ).rejects.toThrow()
  })

  it('a sessão nasce sem `impersonatedBy` — quem entra pela senha é ele mesmo', async () => {
    const { endereco } = await criar('sessao')
    const entrada = await autenticacao().api.signInEmail({ body: { email: endereco, password: SENHA } })

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select "impersonatedBy", "expiresAt" from public.af_sessoes where "userId" = $1',
        [entrada.user.id],
      )
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.impersonatedBy).toBeNull()
      // Sete dias, como configurado. Um prazo que desandasse aqui só apareceria
      // como "o painel me desloga sozinho" semanas depois.
      const resta = new Date(rows[0]?.expiresAt as string).getTime() - Date.now()
      expect(resta).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    } finally {
      await pool.end()
    }
  })
})

describe.skipIf(!temBanco)('contas e papéis', () => {
  /** Abre uma sessão de verdade e devolve os cabeçalhos que a autenticam. */
  async function entrar(endereco: string) {
    const r = await autenticacao().api.signInEmail({
      body: { email: endereco, password: SENHA },
      returnHeaders: true,
    })
    const cookie = r.headers.get('set-cookie') ?? ''
    return { headers: new Headers({ cookie }), usuario: r.response.user }
  }

  async function apagarConta(id: string) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    await pool.query('delete from public.clients where id = $1', [id])
    await pool.end()
  }

  it('a conta criada é uma linha em `clients`, não uma tabela paralela', async () => {
    // É a decisão central da 0020: toda chave estrangeira do sistema aponta
    // para `clients`, e uma segunda tabela de conta divergiria dela.
    const { endereco } = await criar('dono')
    const { headers } = await entrar(endereco)

    const org = await autenticacao().api.createOrganization({
      headers,
      body: { name: 'zz Estúdio Teste', slug: `zz-teste-${Math.random().toString(36).slice(2, 8)}` },
    })
    const id = org!.id

    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
      const { rows } = await pool.query('select nome, slug from public.clients where id = $1', [id])
      await pool.end()

      expect(rows[0]?.nome).toBe('zz Estúdio Teste')
      // Uuid de verdade, não o id curto do Better Auth — é o que `generateId:
      // 'uuid'` garante e o que deixa a FK para `clients.id` funcionar.
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    } finally {
      await apagarConta(id)
    }
  })

  it('quem cria a conta nasce dono dela', async () => {
    const { endereco } = await criar('papel')
    const { headers, usuario } = await entrar(endereco)

    const org = await autenticacao().api.createOrganization({
      headers,
      body: { name: 'zz Papel', slug: `zz-papel-${Math.random().toString(36).slice(2, 8)}` },
    })

    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
      const { rows } = await pool.query(
        'select "role" from public.af_membros where "organizationId" = $1 and "userId" = $2',
        [org!.id, usuario.id],
      )
      await pool.end()
      expect(rows[0]?.role).toBe('owner')
    } finally {
      await apagarConta(org!.id)
    }
  })

  it('um usuário tem mais de uma companhia, e a sessão sabe em qual ele está', async () => {
    // É o `+ Adicionar nova companhia` do print 24. Sem isto, o dono de dois
    // negócios precisaria de dois logins.
    const { endereco } = await criar('multi')
    const { headers } = await entrar(endereco)

    const sufixo = Math.random().toString(36).slice(2, 8)
    const uma = await autenticacao().api.createOrganization({
      headers,
      body: { name: 'zz Estúdio', slug: `zz-a-${sufixo}` },
    })
    const outra = await autenticacao().api.createOrganization({
      headers,
      body: { name: 'zz Clínica', slug: `zz-b-${sufixo}` },
    })

    try {
      const lista = await autenticacao().api.listOrganizations({ headers })
      expect(lista.map((o) => o.id).sort()).toEqual([uma!.id, outra!.id].sort())

      await autenticacao().api.setActiveOrganization({ headers, body: { organizationId: outra!.id } })

      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
      const { rows } = await pool.query(
        'select "activeOrganizationId" from public.af_sessoes where "userId" = (select id from public.af_usuarios where email = $1) order by "createdAt" desc limit 1',
        [endereco],
      )
      await pool.end()
      // A conta ativa mora na sessão, não num cookie que o navegador escolhe.
      expect(rows[0]?.activeOrganizationId).toBe(outra!.id)
    } finally {
      await apagarConta(uma!.id)
      await apagarConta(outra!.id)
    }
  })

  it('apagar a conta leva membros e convites junto', async () => {
    const { endereco } = await criar('cascata')
    const { headers, usuario } = await entrar(endereco)
    const org = await autenticacao().api.createOrganization({
      headers,
      body: { name: 'zz Cascata', slug: `zz-casc-${Math.random().toString(36).slice(2, 8)}` },
    })

    await apagarConta(org!.id)

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    const { rows } = await pool.query(
      'select count(*)::int as n from public.af_membros where "userId" = $1',
      [usuario.id],
    )
    await pool.end()
    expect(rows[0]?.n).toBe(0)
  })
})

describe.skipIf(!temBanco)('entrar como', () => {
  /**
   * A impersonação é o recurso mais perigoso do painel, e o que o teste prova
   * são as três coisas que a tornam defensável: que a sessão nova é **marcada**
   * com quem a abriu, que ela **expira rápido**, e que quem não administra a
   * plataforma **não consegue** abri-la. Errar qualquer uma só apareceria no
   * dia em que alguém precisasse auditar o que a 4YU fez dentro da conta de um
   * cliente — que é tarde demais.
   */
  async function entrarComCabecalhos(endereco: string) {
    const r = await autenticacao().api.signInEmail({
      body: { email: endereco, password: SENHA },
      returnHeaders: true,
    })
    return { headers: new Headers({ cookie: r.headers.get('set-cookie') ?? '' }), usuario: r.response.user }
  }

  /** Promove por SQL, que é o mesmo caminho do primeiro administrador. */
  async function tornarAdministrador(id: string) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    await pool.query('update public.af_usuarios set "role" = $1 where id = $2', ['admin', id])
    await pool.end()
  }

  it('marca a sessão com quem entrou, e ela dura uma hora', async () => {
    const admin = await criar('admin')
    await tornarAdministrador(admin.usuario.id)
    const alvo = await criar('alvo')

    const { headers } = await entrarComCabecalhos(admin.endereco)
    await autenticacao().api.impersonateUser({ headers, body: { userId: alvo.usuario.id } })

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select "impersonatedBy", "expiresAt" from public.af_sessoes where "userId" = $1 and "impersonatedBy" is not null',
        [alvo.usuario.id],
      )
      expect(rows).toHaveLength(1)
      // Sem esta coluna a auditoria mente por omissão: não haveria como separar
      // "o cliente fez" de "a 4YU fez em nome do cliente".
      expect(rows[0]?.impersonatedBy).toBe(admin.usuario.id)

      const resta = new Date(rows[0]?.expiresAt as string).getTime() - Date.now()
      expect(resta).toBeGreaterThan(0)
      // Uma hora, e não os sete dias da sessão comum. Prazo curto é metade do
      // que torna o recurso aceitável.
      expect(resta).toBeLessThanOrEqual(60 * 60 * 1000 + 5_000)
    } finally {
      await pool.end()
    }
  })

  it('a sessão do administrador continua de pé para ele voltar', async () => {
    const admin = await criar('volta')
    await tornarAdministrador(admin.usuario.id)
    const alvo = await criar('volta-alvo')

    const { headers } = await entrarComCabecalhos(admin.endereco)
    await autenticacao().api.impersonateUser({ headers, body: { userId: alvo.usuario.id } })

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select count(*)::int as n from public.af_sessoes where "userId" = $1',
        [admin.usuario.id],
      )
      expect(rows[0]?.n).toBeGreaterThan(0)
    } finally {
      await pool.end()
    }
  })

  it('quem não administra a plataforma não entra como ninguém', async () => {
    const comum = await criar('comum')
    const alvo = await criar('comum-alvo')

    const { headers } = await entrarComCabecalhos(comum.endereco)
    await expect(
      autenticacao().api.impersonateUser({ headers, body: { userId: alvo.usuario.id } }),
    ).rejects.toThrow()
  })
})
