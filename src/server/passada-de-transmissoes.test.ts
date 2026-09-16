import { beforeEach, describe, expect, it, vi } from 'vitest'

const transmissoesVencidas = vi.fn()
const dispararTransmissao = vi.fn()

vi.mock('./repos/transmissoes', () => ({
  transmissoesVencidas: (...a: unknown[]) => transmissoesVencidas(...a),
}))
vi.mock('./disparar-transmissao', () => ({
  dispararTransmissao: (...a: unknown[]) => dispararTransmissao(...a),
}))

const { passadaDeTransmissoes, POR_CARONA, TRANSMISSOES_POR_PASSADA } = await import(
  './passada-de-transmissoes'
)

function resumo(id: string) {
  return {
    transmissaoId: id,
    tentados: 1,
    aceitos: 1,
    retidos: 0,
    falhas: 0,
    terminou: false,
    parou: null,
  }
}

describe('a passada que faz as transmissões andarem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dispararTransmissao.mockImplementation((id: string) => Promise.resolve(resumo(id)))
  })

  it('não faz nada quando não há transmissão vencida', async () => {
    transmissoesVencidas.mockResolvedValue([])

    const r = await passadaDeTransmissoes()

    expect(r.pegas).toBe(0)
    expect(dispararTransmissao).not.toHaveBeenCalled()
  })

  it('dispara cada transmissão vencida', async () => {
    transmissoesVencidas.mockResolvedValue([{ id: 't1' }, { id: 't2' }])

    const r = await passadaDeTransmissoes()

    expect(r.tocadas).toBe(2)
    expect(dispararTransmissao).toHaveBeenCalledWith('t1', {})
    expect(dispararTransmissao).toHaveBeenCalledWith('t2', {})
  })

  it('passa o orçamento pequeno da carona adiante', async () => {
    transmissoesVencidas.mockResolvedValue([{ id: 't1' }])

    await passadaDeTransmissoes({ porPassada: POR_CARONA })

    // O motor não pode rodar a passada inteira atrás do 200 que o webhook deve
    // à Meta. É o teto que faz a campanha andar sem estourar a função.
    expect(dispararTransmissao).toHaveBeenCalledWith('t1', { porPassada: POR_CARONA })
  })

  it('uma transmissão que estoura não derruba as outras', async () => {
    /*
     * O ponto do teste: são de CLIENTES diferentes. Um número desconectado numa
     * conta não pode impedir a campanha de outra de sair.
     */
    transmissoesVencidas.mockResolvedValue([{ id: 't1' }, { id: 't2' }, { id: 't3' }])
    dispararTransmissao.mockImplementation((id: string) =>
      id === 't2' ? Promise.reject(new Error('banco fora')) : Promise.resolve(resumo(id)),
    )

    const r = await passadaDeTransmissoes()

    expect(r.falhas).toBe(1)
    expect(r.tocadas).toBe(2)
    expect(dispararTransmissao).toHaveBeenCalledWith('t3', {})
  })

  it('não toca mais que o teto de transmissões por passada', async () => {
    const muitas = Array.from({ length: TRANSMISSOES_POR_PASSADA + 4 }, (_, i) => ({
      id: `t${i}`,
    }))
    transmissoesVencidas.mockResolvedValue(muitas)

    const r = await passadaDeTransmissoes()

    // Uma conta com muita campanha aberta não pode consumir o orçamento inteiro
    // e deixar as outras contas paradas.
    expect(r.pegas).toBe(TRANSMISSOES_POR_PASSADA)
    expect(dispararTransmissao).toHaveBeenCalledTimes(TRANSMISSOES_POR_PASSADA)
  })
})
