import { describe, expect, it } from 'vitest'
import { conferirDestinoDeTeste } from './db'

/**
 * A guarda que impede a suíte de escrever no banco de produção.
 *
 * Ela existe porque a outra guarda — a de `test/ambiente-local.ts` — protege só
 * o caminho do config de integração, e havia um segundo caminho: o
 * `vitest.config.ts` padrão, que carregava o `.env` de produção.
 */
describe('conferirDestinoDeTeste', () => {
  const remoto = 'https://xxxynoshwirupkdzwxbj.supabase.co'

  it('recusa endereço remoto quando o Vitest está no comando', () => {
    expect(() => conferirDestinoDeTeste({ VITEST: 'true', SUPABASE_URL: remoto })).toThrow(
      /host remoto/,
    )
  })

  it('não imprime a URL inteira na recusa, só o host', () => {
    try {
      conferirDestinoDeTeste({ VITEST: 'true', SUPABASE_URL: `${remoto}/rest/v1` })
      expect.unreachable('devia ter recusado')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      expect(mensagem).toContain('xxxynoshwirupkdzwxbj.supabase.co')
      expect(mensagem).not.toContain('/rest/v1')
    }
  })

  it('deixa passar o banco local', () => {
    expect(() =>
      conferirDestinoDeTeste({ VITEST: 'true', SUPABASE_URL: 'http://127.0.0.1:54321' }),
    ).not.toThrow()
  })

  /** Host que só *começa* com o nome conhecido continua sendo remoto. */
  it('não cai no truque do host parecido', () => {
    expect(() =>
      conferirDestinoDeTeste({ VITEST: 'true', SUPABASE_URL: 'https://localhost.evil.com' }),
    ).toThrow(/host remoto/)
  })

  it('fora do teste não opina: quem decide o endereço é a aplicação', () => {
    expect(() => conferirDestinoDeTeste({ SUPABASE_URL: remoto })).not.toThrow()
  })
})
