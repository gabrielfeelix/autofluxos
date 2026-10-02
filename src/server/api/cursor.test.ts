import { describe, expect, it, vi } from 'vitest'
import { codificarCursor, lerCursor } from './contatos'

vi.mock('server-only', () => ({}))
vi.mock('../db', () => ({ db: vi.fn(), ehIdInvalido: vi.fn() }))
vi.mock('../quadro-de-entrada', () => ({ porNoQuadroPadrao: vi.fn() }))
vi.mock('../repos/campos', () => ({ gravarCampos: vi.fn() }))
vi.mock('../repos/contato-por-telefone', () => ({ acharContatoPeloTelefone: vi.fn() }))
vi.mock('../repos/etiquetas', () => ({ listarEtiquetas: vi.fn(), marcarContatos: vi.fn() }))
vi.mock('../repos/eventos', () => ({ anotar: vi.fn() }))
vi.mock('../sequencias', () => ({ inscreverNoEvento: vi.fn(), sairPelaEtiqueta: vi.fn() }))

const ID = '6f1c2a9e-0b7d-4c55-9a51-2f0f6f3f1d7a'

describe('cursor da listagem de contatos', () => {
  it('ida e volta guarda os microssegundos do banco', () => {
    const instante = '2026-10-02T13:20:41.512345+00:00'
    expect(lerCursor(codificarCursor(instante, ID))).toEqual({ criadoEm: instante, id: ID })
  })

  it('recusa o que não saiu daqui', () => {
    expect(lerCursor('nao-e-base64-json')).toBeNull()
    expect(lerCursor(Buffer.from(JSON.stringify(['ontem', ID])).toString('base64url'))).toBeNull()
    // Tentativa de injetar filtro no `or` do PostgREST.
    expect(lerCursor(Buffer.from(JSON.stringify(['2026-10-02T13:20:41Z),id.gt.0', ID])).toString('base64url'))).toBeNull()
    expect(lerCursor(Buffer.from(JSON.stringify(['2026-10-02T13:20:41Z', 'x,y'])).toString('base64url'))).toBeNull()
  })
})
