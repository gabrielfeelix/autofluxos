import { describe, expect, it } from 'vitest'
import { ehAdminDaPlataforma, type SessaoAtual } from './sessao'

/**
 * O papel de plataforma vem como **lista separada por vírgula** — é o formato
 * do plugin `admin` do Better Auth (`role: 'admin,suporte'`).
 *
 * Comparar a string inteira com `'admin'` funciona hoje e dá falso no dia em
 * que alguém ganhar o segundo papel: o administrador perderia a área de
 * administração de repente, sem nada no código apontando para o motivo.
 */
function sessaoCom(papel: string | null, banido = false): SessaoAtual {
  return {
    usuario: {
      id: 'u1',
      nome: 'Fulano',
      email: 'fulano@exemplo.test',
      papelDePlataforma: papel,
      banido,
    },
    contaAtivaId: null,
    impersonadoPor: null,
  }
}

describe('quem administra a plataforma', () => {
  it('reconhece o papel sozinho', () => {
    expect(ehAdminDaPlataforma(sessaoCom('admin'))).toBe(true)
  })

  it('reconhece o papel no meio de uma lista', () => {
    expect(ehAdminDaPlataforma(sessaoCom('suporte,admin'))).toBe(true)
    expect(ehAdminDaPlataforma(sessaoCom('admin, financeiro'))).toBe(true)
  })

  it('não confunde papel que apenas começa igual', () => {
    // `administrativo` não é `admin`. Sem separar por vírgula e comparar item a
    // item, um `includes` de string diria que sim.
    expect(ehAdminDaPlataforma(sessaoCom('administrativo'))).toBe(false)
  })

  it('usuário comum e sem papel não administram nada', () => {
    expect(ehAdminDaPlataforma(sessaoCom('user'))).toBe(false)
    expect(ehAdminDaPlataforma(sessaoCom(null))).toBe(false)
  })

  it('sem sessão, não', () => {
    expect(ehAdminDaPlataforma(null)).toBe(false)
  })

  it('suspenso perde o papel — banir não pode deixar a chave na porta', () => {
    expect(ehAdminDaPlataforma(sessaoCom('admin', true))).toBe(false)
  })
})
