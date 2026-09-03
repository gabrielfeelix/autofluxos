import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarEstado, lerEstado } from './estado'

/**
 * O `state` do OAuth é a peça de segurança da conexão do Instagram: sem ele,
 * um link forjado liga uma conta de Instagram ao cliente errado — ou liga a
 * conta de quem atacou a um cliente de verdade, e passa a receber os direct
 * dele. Estes testes são sobre isso, e não sobre o formato do texto.
 */

const CLIENTE = '4b1f2f7a-6d0e-4b7e-9a55-1d4e2c9f0b31'
const AGORA = new Date('2026-09-03T12:00:00.000Z')

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste-bem-comprido-1234567890')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('o bilhete do OAuth', () => {
  it('vai e volta com o mesmo cliente', () => {
    const estado = criarEstado(CLIENTE, AGORA)
    expect(lerEstado(estado, AGORA)).toBe(CLIENTE)
  })

  it('assinatura mexida não vale', () => {
    const estado = criarEstado(CLIENTE, AGORA)
    const [cliente, carimbo] = estado.split('.')

    expect(lerEstado(`${cliente}.${carimbo}.assinaturaInventada`, AGORA)).toBeNull()
  })

  /**
   * O ataque direto: trocar o uuid do cliente e torcer para a assinatura não
   * ser conferida. É por isso que ela cobre o par inteiro, e não só o carimbo.
   */
  it('trocar o cliente invalida o bilhete', () => {
    const estado = criarEstado(CLIENTE, AGORA)
    const [, carimbo, assinatura] = estado.split('.')
    const outro = '00000000-0000-4000-8000-000000000000'

    expect(lerEstado(`${outro}.${carimbo}.${assinatura}`, AGORA)).toBeNull()
  })

  it('vence depois de dez minutos', () => {
    const estado = criarEstado(CLIENTE, AGORA)

    const nove = new Date(AGORA.getTime() + 9 * 60 * 1_000)
    expect(lerEstado(estado, nove)).toBe(CLIENTE)

    const onze = new Date(AGORA.getTime() + 11 * 60 * 1_000)
    expect(lerEstado(estado, onze)).toBeNull()
  })

  /**
   * Bilhete com carimbo no futuro é relógio torto ou bilhete forjado para
   * nunca vencer. Nos dois casos a resposta é a mesma.
   */
  it('recusa carimbo do futuro', () => {
    const daquiAUmaHora = new Date(AGORA.getTime() + 60 * 60 * 1_000)
    const estado = criarEstado(CLIENTE, daquiAUmaHora)

    expect(lerEstado(estado, AGORA)).toBeNull()
  })

  it('texto sem forma de bilhete não estoura', () => {
    expect(lerEstado(null, AGORA)).toBeNull()
    expect(lerEstado('', AGORA)).toBeNull()
    expect(lerEstado('qualquer-coisa', AGORA)).toBeNull()
    expect(lerEstado('a.b', AGORA)).toBeNull()
    expect(lerEstado('a.b.c.d', AGORA)).toBeNull()
  })

  it('carimbo que não é número não vale', () => {
    // Assinado de verdade, para provar que a recusa é do carimbo e não da
    // assinatura — o caminho que passaria despercebido.
    const cru = `${CLIENTE}.ontem`
    const estado = criarEstado(CLIENTE, AGORA)
    const assinatura = estado.split('.')[2]

    expect(lerEstado(`${cru}.${assinatura}`, AGORA)).toBeNull()
  })

  /**
   * Segredo diferente, bilhete diferente. É o que faz um bilhete de um
   * ambiente não valer no outro — e o que faz trocar o segredo invalidar todos
   * os bilhetes em voo.
   */
  it('bilhete de outro segredo não é aceito', () => {
    const estado = criarEstado(CLIENTE, AGORA)

    vi.stubEnv('BETTER_AUTH_SECRET', 'outro-segredo-completamente-diferente')
    expect(lerEstado(estado, AGORA)).toBeNull()
  })
})
