import { describe, expect, it, vi } from 'vitest'
import { lerOcorrencias, numeroDoPedidoValido, rastrearNaFreteRapido } from './frete-rapido'

const OCORRENCIAS = [
  {
    codigo: 0,
    nome: 'Aguardando coleta',
    data_ocorrencia: '2026-09-28 10:00:00',
    razao_social_transportadora: 'JADLOG LOGISTICA S.A',
    data_prevista_entrega: '2026-10-03',
  },
  {
    codigo: 1,
    nome: 'Em trânsito',
    data_ocorrencia: '2026-09-29 14:32:00',
    descricao_ocorrencia: 'Saiu do centro de distribuição de Maringá',
    codigo_volume: 'JD123456789BR',
  },
]

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('numeroDoPedidoValido', () => {
  it('aceita só dígitos, com ou sem #', () => {
    expect(numeroDoPedidoValido('#000012345')).toBe('000012345')
    expect(numeroDoPedidoValido(' 12345 ')).toBe('12345')
  })

  it('recusa o que mexeria no caminho da URL', () => {
    expect(numeroDoPedidoValido('../12345')).toBeNull()
    expect(numeroDoPedidoValido('123/cancel')).toBeNull()
    expect(numeroDoPedidoValido('123?token=x')).toBeNull()
    expect(numeroDoPedidoValido('')).toBeNull()
  })
})

describe('lerOcorrencias', () => {
  it('resume a última situação, a transportadora e a previsão', () => {
    const r = lerOcorrencias(OCORRENCIAS)
    expect(r).toEqual({
      transportadora: 'JADLOG LOGISTICA S.A',
      codigo: 'JD123456789BR',
      previsao: '03/10/2026',
      ultima: { situacao: 'Em trânsito', quando: '29/09 14:32', detalhe: 'Saiu do centro de distribuição de Maringá' },
      ocorrencias: [
        { situacao: 'Aguardando coleta', quando: '28/09 10:00', detalhe: '' },
        { situacao: 'Em trânsito', quando: '29/09 14:32', detalhe: 'Saiu do centro de distribuição de Maringá' },
      ],
    })
  })

  it('lista vazia ou embrulhada', () => {
    expect(lerOcorrencias([])).toBeNull()
    expect(lerOcorrencias({ occurrences: OCORRENCIAS })?.codigo).toBe('JD123456789BR')
  })
})

describe('rastrearNaFreteRapido', () => {
  it('faz só GET, no endereço fixo, com o token na query', async () => {
    const buscar = vi.fn(async () => resposta(200, OCORRENCIAS))
    await rastrearNaFreteRapido('#000012345', 'tok en', buscar)
    expect(buscar).toHaveBeenCalledTimes(1)
    const [url, init] = buscar.mock.calls[0] as unknown as [string, { method: string }]
    expect(init.method).toBe('GET')
    expect(url).toBe('https://freterapido.com/api/external/embarcador/v1/quotes/000012345/occurrences?token=tok%20en')
  })

  it('número inválido não chama ninguém', async () => {
    const buscar = vi.fn()
    expect(await rastrearNaFreteRapido('../x', 't', buscar)).toEqual({ ok: true, valor: null })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('404 é pedido sem frete; 401 é token recusado, sem o token na mensagem', async () => {
    expect(await rastrearNaFreteRapido('1', 't', async () => resposta(404, {}))).toEqual({ ok: true, valor: null })
    const recusado = await rastrearNaFreteRapido('1', 'segredo', async () => resposta(401, {}))
    expect(recusado).toEqual({ ok: false, motivo: 'a Frete Rápido recusou o token' })
  })

  it('falha de rede não vaza a URL', async () => {
    const r = await rastrearNaFreteRapido('1', 'segredo', async () => {
      throw new Error('fetch failed https://freterapido.com/...?token=segredo')
    })
    expect(JSON.stringify(r)).not.toContain('segredo')
  })
})
