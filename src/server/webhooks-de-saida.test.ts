import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from 'undici'
import { lerContatoDaApi } from './api/contatos'
import { lerDoCofre } from './cofre'
import { conferirEndereco } from './efeitos/rede'
import {
  assinantesDoEvento,
  destinoDoWebhook,
  enfileirarEntregas,
  pegarEntregas,
  registrarTentativa,
  somarFalha,
  zerarFalhas,
} from './repos/webhooks-de-saida'
import { assinar, emitirEvento, emitirPelaAnotacao, processarEntregas } from './webhooks-de-saida'

/**
 * O caminho do webhook de saída sem banco nem rede: quem recebe, o que vai no
 * corpo, a assinatura, e o que acontece depois de entregar ou falhar.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('undici', () => ({ request: vi.fn(), Agent: class {} }))
vi.mock('./efeitos/http', () => ({ agenteFixadoEm: () => ({ close: async () => undefined }) }))
vi.mock('./efeitos/rede', () => ({ conferirEndereco: vi.fn() }))
vi.mock('./cofre', () => ({ lerDoCofre: vi.fn() }))
vi.mock('./api/contatos', () => ({ lerContatoDaApi: vi.fn() }))
vi.mock('./repos/webhooks-de-saida', () => ({
  assinantesDoEvento: vi.fn(),
  destinoDoWebhook: vi.fn(),
  enfileirarEntregas: vi.fn(),
  pegarEntregas: vi.fn(),
  registrarTentativa: vi.fn(),
  somarFalha: vi.fn(),
  zerarFalhas: vi.fn(),
}))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const ENTREGA = { id: 'e1', webhookId: 'w1', clienteId: CLIENTE, evento: 'contato.criado', corpo: { id: 'x' }, tentativas: 0 }

function respondeu(status: number, texto = '') {
  vi.mocked(request).mockResolvedValue({ statusCode: status, body: { text: async () => texto } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(conferirEndereco).mockResolvedValue({ ok: true, enderecos: [{ address: '93.184.216.34', family: 4 }] })
  vi.mocked(lerDoCofre).mockResolvedValue('whsec_segredo')
  vi.mocked(destinoDoWebhook).mockResolvedValue({ url: 'https://exemplo.com/h', segredoId: 's1', ativo: true, falhasSeguidas: 3 })
  vi.mocked(pegarEntregas).mockResolvedValue([ENTREGA])
})

describe('emitir', () => {
  it('sem assinante, nada é lido nem enfileirado', async () => {
    vi.mocked(assinantesDoEvento).mockResolvedValue([])
    await emitirEvento(CLIENTE, 'contato.criado', 'c1')
    expect(lerContatoDaApi).not.toHaveBeenCalled()
    expect(enfileirarEntregas).not.toHaveBeenCalled()
  })

  it('enfileira um corpo por assinante, com o contato e os dados do evento', async () => {
    vi.mocked(assinantesDoEvento).mockResolvedValue([{ id: 'w1' }, { id: 'w2' }])
    vi.mocked(lerContatoDaApi).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(enfileirarEntregas).mockResolvedValue(['e1', 'e2'])
    await emitirEvento(CLIENTE, 'oportunidade.ganha', 'c1', { valor: 450 })
    const [cliente, evento, corpo, ids] = vi.mocked(enfileirarEntregas).mock.calls[0]!
    expect([cliente, evento, ids]).toEqual([CLIENTE, 'oportunidade.ganha', ['w1', 'w2']])
    expect(corpo).toMatchObject({ evento: 'oportunidade.ganha', organizacao_id: CLIENTE, dados: { contato: { id: 'c1' }, valor: 450 } })
  })

  it('falha ao emitir não derruba quem emitiu', async () => {
    vi.mocked(assinantesDoEvento).mockRejectedValue(new Error('banco fora'))
    await expect(emitirEvento(CLIENTE, 'contato.criado', 'c1')).resolves.toBeUndefined()
  })

  it('só chegou e mudou-de-etapa viram webhook pela linha do tempo', async () => {
    vi.mocked(assinantesDoEvento).mockResolvedValue([])
    await emitirPelaAnotacao(CLIENTE, 'c1', 'nota', {})
    expect(assinantesDoEvento).not.toHaveBeenCalled()
    await emitirPelaAnotacao(CLIENTE, 'c1', 'chegou', { origem: 'API' })
    await emitirPelaAnotacao(CLIENTE, 'c1', 'mudou-de-etapa', { cartaoId: 'k', de: 'A', para: 'B' })
    expect(vi.mocked(assinantesDoEvento).mock.calls.map((c) => c[1])).toEqual(['contato.criado', 'contato.etapa_mudou'])
  })
})

describe('enviar', () => {
  it('assina "timestamp.corpo" com o segredo', () => {
    const esperado = createHmac('sha256', 'whsec_x').update('1700000000.{"a":1}').digest('hex')
    expect(assinar('whsec_x', 1700000000, '{"a":1}')).toBe(`sha256=${esperado}`)
  })

  it('2xx é entregue e zera as falhas; cabeçalhos assinados', async () => {
    respondeu(204)
    expect(await processarEntregas()).toEqual({ enviadas: 1, falharam: 0 })
    expect(registrarTentativa).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'entregue', tentativas: 1, statusHttp: 204 }))
    expect(zerarFalhas).toHaveBeenCalledWith('w1')
    const cabecalhos = vi.mocked(request).mock.calls[0]![1]!.headers as Record<string, string>
    const corpo = vi.mocked(request).mock.calls[0]![1]!.body as string
    expect(cabecalhos['x-autofluxos-assinatura']).toBe(assinar('whsec_segredo', Number(cabecalhos['x-autofluxos-timestamp']), corpo))
  })

  it('falha agenda a próxima em 1 min e soma no webhook', async () => {
    respondeu(500, 'erro do servidor')
    const antes = Date.now()
    await processarEntregas()
    const dados = vi.mocked(registrarTentativa).mock.calls[0]![1]
    expect(dados).toMatchObject({ status: 'pendente', tentativas: 1, statusHttp: 500, resposta: 'erro do servidor' })
    expect(new Date(dados.proximaEm!).getTime() - antes).toBeGreaterThanOrEqual(59_000)
    expect(somarFalha).toHaveBeenCalledWith('w1', 3, 20)
  })

  it('redirecionamento é falha; a sexta falha desiste', async () => {
    respondeu(302)
    vi.mocked(pegarEntregas).mockResolvedValue([{ ...ENTREGA, tentativas: 5 }])
    await processarEntregas()
    expect(registrarTentativa).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'falhou', tentativas: 6 }))
  })

  it('endereço interno não recebe POST', async () => {
    vi.mocked(conferirEndereco).mockResolvedValue({ ok: false, motivo: 'aponta para um endereço interno' })
    await processarEntregas()
    expect(request).not.toHaveBeenCalled()
    expect(registrarTentativa).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'pendente', statusHttp: null }))
  })

  it('webhook desligado: a entrega falha sem envio', async () => {
    vi.mocked(destinoDoWebhook).mockResolvedValue({ url: 'https://exemplo.com/h', segredoId: 's1', ativo: false, falhasSeguidas: 0 })
    await processarEntregas()
    expect(request).not.toHaveBeenCalled()
    expect(registrarTentativa).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'falhou' }))
  })

  it('teste que falha não repete nem conta para a pausa', async () => {
    respondeu(404)
    vi.mocked(pegarEntregas).mockResolvedValue([{ ...ENTREGA, evento: 'webhook.teste' }])
    await processarEntregas()
    expect(registrarTentativa).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'falhou' }))
    expect(somarFalha).not.toHaveBeenCalled()
  })
})
