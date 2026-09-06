import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumirLimite } from '@/server/limite'
import { tratarEvento } from '@/server/receber-evento'
import { marcarChamada, segredosAtivos } from '@/server/repos/webhooks-de-entrada'
import { POST } from './route'

/**
 * As defesas da rota pública (0044).
 *
 * O que se prova aqui é **quem consegue entrar**, e por isso o banco é mockado:
 * a pergunta é sobre assinatura, teto e limite, não sobre o que o evento faz
 * depois. O caminho do evento até a conversa é provado contra o Supabase de
 * verdade em `receber-evento.test.ts`.
 */
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/receber-evento', () => ({ tratarEvento: vi.fn() }))
vi.mock('@/server/repos/webhooks-de-entrada', () => ({
  segredosAtivos: vi.fn(),
  marcarChamada: vi.fn(),
}))
vi.mock('@/server/alertar', () => ({ alertar: vi.fn() }))
// `after()` roda depois da resposta; no teste ele executa na hora, que é o que
// permite conferir o que a rota mandou processar.
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const SEGREDO = 'segredo-do-teste'

function assinar(corpo: string, segredo = SEGREDO) {
  return `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`
}

function pedir(
  corpo: unknown,
  opcoes: { assinatura?: string | null; contentLength?: string } = {},
) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const assinatura =
    opcoes.assinatura === undefined ? assinar(texto) : opcoes.assinatura
  if (assinatura !== null) headers['x-autofluxos-assinatura'] = assinatura
  if (opcoes.contentLength) headers['content-length'] = opcoes.contentLength

  return POST(
    new Request(`http://localhost/api/webhook/entrada/${CLIENTE}`, {
      method: 'POST',
      headers,
      body: texto,
    }),
    { params: Promise.resolve({ clienteId: CLIENTE }) },
  )
}

describe('POST /api/webhook/entrada/[clienteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(consumirLimite).mockResolvedValue(true)
    vi.mocked(segredosAtivos).mockResolvedValue([{ id: 'wh1', segredo: SEGREDO }])
    vi.mocked(tratarEvento).mockResolvedValue('aberto')
    vi.mocked(marcarChamada).mockResolvedValue(undefined)
  })

  it('assinatura certa processa o evento', async () => {
    const resposta = await pedir({ evento: 'vaga.aberta', telefone: '5511999998888' })

    expect(resposta.status).toBe(200)
    expect(tratarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: CLIENTE, evento: 'vaga.aberta' }),
    )
  })

  it('assinatura errada devolve 401 e não processa nada', async () => {
    const corpo = JSON.stringify({ evento: 'vaga.aberta', telefone: '5511999998888' })
    const resposta = await pedir(corpo, { assinatura: assinar(corpo, 'outro-segredo') })

    expect(resposta.status).toBe(401)
    expect(tratarEvento).not.toHaveBeenCalled()
  })

  it('sem cabeçalho de assinatura devolve 401', async () => {
    const resposta = await pedir(
      { evento: 'vaga.aberta', telefone: '5511999998888' },
      { assinatura: null },
    )
    expect(resposta.status).toBe(401)
    expect(tratarEvento).not.toHaveBeenCalled()
  })

  it('assinatura de tamanho errado devolve 401 em vez de estourar', async () => {
    // `timingSafeEqual` lança com buffers de tamanhos diferentes. Sem a
    // conferência de comprimento, isto viraria 500 numa rota pública — ou seja,
    // uma forma de derrubar a rota com um cabeçalho de dois caracteres.
    const resposta = await pedir(
      { evento: 'vaga.aberta', telefone: '5511999998888' },
      { assinatura: 'sha256=ab' },
    )
    expect(resposta.status).toBe(401)
  })

  it('o corpo assinado é o corpo cru: mexer num byte invalida', async () => {
    const corpo = JSON.stringify({ evento: 'vaga.aberta', telefone: '5511999998888' })
    const assinatura = assinar(corpo)
    // Mesma assinatura, corpo trocado — é o ataque que a assinatura existe para
    // barrar.
    const adulterado = JSON.stringify({ evento: 'vaga.aberta', telefone: '5511000000000' })

    const resposta = await POST(
      new Request(`http://localhost/api/webhook/entrada/${CLIENTE}`, {
        method: 'POST',
        headers: { 'x-autofluxos-assinatura': assinatura },
        body: adulterado,
      }),
      { params: Promise.resolve({ clienteId: CLIENTE }) },
    )
    expect(resposta.status).toBe(401)
  })

  it('conta sem webhook nenhum devolve 401, sem dizer que não tem', async () => {
    // Respostas diferentes para "não tem webhook" e "assinatura não bate"
    // entregariam quais contas têm integração ligada.
    vi.mocked(segredosAtivos).mockResolvedValue([])
    const resposta = await pedir({ evento: 'vaga.aberta', telefone: '5511999998888' })
    expect(resposta.status).toBe(401)
  })

  it('corpo grande devolve 413 antes de ler qualquer coisa', async () => {
    const resposta = await pedir(
      { evento: 'vaga.aberta', telefone: '5511999998888' },
      { contentLength: String(65 * 1024) },
    )
    expect(resposta.status).toBe(413)
    // Nem o cofre foi consultado: recusar depois de já ter lido não defende.
    expect(segredosAtivos).not.toHaveBeenCalled()
  })

  it('corpo grande de verdade devolve 413 mesmo mentindo no content-length', async () => {
    const gordo = { evento: 'x', telefone: '5511999998888', dados: { a: 'z'.repeat(70 * 1024) } }
    const resposta = await pedir(gordo, { contentLength: '10' })
    expect(resposta.status).toBe(413)
  })

  it('estourar o limite devolve 429 sem ir ao cofre', async () => {
    vi.mocked(consumirLimite).mockResolvedValue(false)
    const resposta = await pedir({ evento: 'vaga.aberta', telefone: '5511999998888' })

    expect(resposta.status).toBe(429)
    expect(segredosAtivos).not.toHaveBeenCalled()
    // O limite é **por cliente**, e não por endereço: vários clientes são
    // servidos pelo mesmo servidor de fora, e chavear por IP faria o volume de
    // um calar o webhook de outro.
    expect(consumirLimite).toHaveBeenCalledWith(`webhook-entrada:${CLIENTE}`, 120, 60)
  })

  it('corpo assinado mas sem telefone devolve 400, e não 200', async () => {
    // Aqui a assinatura já conferiu: quem manda é parceiro legítimo com o corpo
    // errado, e ele precisa saber. 200 faria o defeito virar silêncio dos dois
    // lados.
    const resposta = await pedir({ evento: 'vaga.aberta' })
    expect(resposta.status).toBe(400)
    expect(tratarEvento).not.toHaveBeenCalled()
  })

  it('JSON quebrado assinado devolve 400', async () => {
    const resposta = await pedir('{isto não é json')
    expect(resposta.status).toBe(400)
  })

  it('evento sem gatilho ainda devolve 200 — o outro lado não deve reenfileirar', async () => {
    vi.mocked(tratarEvento).mockResolvedValue('sem_gatilho')
    const resposta = await pedir({ evento: 'nao.assinado', telefone: '5511999998888' })
    expect(resposta.status).toBe(200)
  })

  it('falha no processamento não vira erro para quem chamou', async () => {
    vi.mocked(tratarEvento).mockRejectedValue(new Error('banco fora'))
    const resposta = await pedir({ evento: 'vaga.aberta', telefone: '5511999998888' })
    // Já respondemos 200 antes do `after()`. O erro vira alerta do nosso lado.
    expect(resposta.status).toBe(200)
  })
})
