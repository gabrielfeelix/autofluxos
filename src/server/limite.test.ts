import { describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('./db', () => ({
  db: () => ({ rpc }),
}))

import { chaveDeLimite, consumirLimite } from './limite'

describe('limite', () => {
  it('separa contadores por finalidade e usa o primeiro IP encaminhado', () => {
    expect(chaveDeLimite('login', new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe(
      'login:198.51.100.1',
    )
  })

  it('pede ao Postgres um consumo atômico', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await expect(consumirLimite('login:198.51.100.1', 5, 300)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('consumir_limite', {
      p_chave: 'login:198.51.100.1',
      p_janela_segundos: 300,
      p_teto: 5,
    })
  })

  it('não abre a porta quando o banco não consegue conferir', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'indisponível' } })

    await expect(consumirLimite('login:198.51.100.1', 5, 300)).resolves.toBe(false)
  })
})
