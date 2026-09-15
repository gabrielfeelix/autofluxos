import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientePelaPagina } from '@/server/repos/paginas-de-lead'
import { receberLeadsDoFormulario } from '@/server/receber-lead-do-formulario'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'
import { GET, POST } from './route'

/**
 * As defesas da rota de `leadgen`, e a regra que a molda.
 *
 * O banco é mockado de propósito: a pergunta aqui é **quem entra e o que a Meta
 * recebe de volta**, não o que o lead vira depois — isso é provado contra o
 * Supabase de verdade em `receber-lead-do-formulario.test.ts`.
 *
 * A regra que quase todo teste abaixo protege: **a Meta não reentrega depois de
 * um `200` e reentrega tudo depois de um erro.** Responder errado aqui não dá
 * erro visível — dá lead duplicado, ou lead perdido para sempre.
 */
vi.mock('@/server/repos/paginas-de-lead', () => ({ clientePelaPagina: vi.fn() }))
vi.mock('@/server/receber-lead-do-formulario', () => ({ receberLeadsDoFormulario: vi.fn() }))
vi.mock('@/server/token-de-anuncios', () => ({ tokenDeAnuncios: vi.fn() }))
vi.mock('@/server/alertar', () => ({ alertar: vi.fn() }))
// `after()` roda depois da resposta; aqui executa na hora, que é o que permite
// conferir o que a rota mandou processar.
/*
 * O callback é `async`, então o mock precisa **esperá-lo**: devolver a promessa
 * é o que faz o `await posta(...)` do teste só voltar depois do processamento.
 * Sem isso o teste conferia o espião antes de a rota ter chamado qualquer coisa
 * — e passava a impressão de que o código não rodava.
 */
const pendentes: Promise<unknown>[] = []
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    const r = fn()
    if (r instanceof Promise) pendentes.push(r)
  },
}))

/** Espera o que o `after()` deixou pendente. */
async function assentar() {
  await Promise.all(pendentes.splice(0))
}

const SEGREDO = 'segredo-do-app'
const CLIENTE = '11111111-1111-1111-1111-111111111111'

function assinar(corpo: string, segredo = SEGREDO) {
  return `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`
}

function posta(corpo: unknown, assinatura?: string) {
  const texto = JSON.stringify(corpo)
  return POST(
    new Request('https://exemplo/api/webhook/leadgen', {
      method: 'POST',
      body: texto,
      headers: { 'x-hub-signature-256': assinatura ?? assinar(texto) },
    }),
  )
}

function loteDeUmLead(pageId = 'page-1') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        changes: [
          {
            field: 'leadgen',
            value: { leadgen_id: 'l1', form_id: 'f1', ad_id: 'a1', page_id: pageId },
          },
        ],
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.META_APP_SECRET = SEGREDO
  process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-verificacao'
  vi.mocked(clientePelaPagina).mockResolvedValue(CLIENTE)
  vi.mocked(tokenDeAnuncios).mockResolvedValue('token-de-ads')
  vi.mocked(receberLeadsDoFormulario).mockResolvedValue({
    criados: 1,
    repetidos: 0,
    recusados: 0,
  })
})

describe('o handshake de verificação', () => {
  it('devolve o desafio em texto puro', async () => {
    const r = await GET(
      new Request(
        'https://exemplo/api/webhook/leadgen?hub.mode=subscribe&hub.verify_token=token-de-verificacao&hub.challenge=12345',
      ),
    )
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('12345')
  })

  it('recusa token errado', async () => {
    const r = await GET(
      new Request(
        'https://exemplo/api/webhook/leadgen?hub.mode=subscribe&hub.verify_token=outro&hub.challenge=1',
      ),
    )
    expect(r.status).toBe(403)
  })
})

describe('quem consegue entrar', () => {
  it('assinatura inválida é recusada', async () => {
    const r = await posta(loteDeUmLead(), 'sha256=00')
    expect(r.status).toBe(401)
    expect(receberLeadsDoFormulario).not.toHaveBeenCalled()
  })

  it('sem cabeçalho de assinatura, também', async () => {
    const texto = JSON.stringify(loteDeUmLead())
    const r = await POST(
      new Request('https://exemplo/api/webhook/leadgen', { method: 'POST', body: texto }),
    )
    expect(r.status).toBe(401)
  })

  it('assinatura boa passa e o lead é tratado', async () => {
    const r = await posta(loteDeUmLead())
    await assentar()
    expect(r.status).toBe(200)
    expect(receberLeadsDoFormulario).toHaveBeenCalledOnce()
  })
})

describe('o que a Meta recebe de volta', () => {
  /*
   * Corpo ilegível com 500 faria a Meta reentregar o mesmo lixo para sempre.
   */
  it('corpo que não é JSON ainda responde 200', async () => {
    const texto = 'isto não é json'
    const r = await POST(
      new Request('https://exemplo/api/webhook/leadgen', {
        method: 'POST',
        body: texto,
        headers: { 'x-hub-signature-256': assinar(texto) },
      }),
    )
    expect(r.status).toBe(200)
    expect(receberLeadsDoFormulario).not.toHaveBeenCalled()
  })

  it('webhook de outro objeto não vira lead, e não dá erro', async () => {
    const r = await posta({ object: 'whatsapp_business_account', entry: [] })
    expect(r.status).toBe(200)
    expect(receberLeadsDoFormulario).not.toHaveBeenCalled()
  })

  /*
   * Falha no processamento também responde 200: o lote já foi aceito, e a
   * reconciliação diária é quem recupera. Devolver erro traria tudo de novo.
   */
  it('falha ao tratar não vira erro para a Meta', async () => {
    vi.mocked(receberLeadsDoFormulario).mockRejectedValue(new Error('banco caiu'))
    const r = await posta(loteDeUmLead())
    await assentar()
    expect(r.status).toBe(200)
  })

  it('corpo grande demais é recusado antes de ser lido', async () => {
    const r = await POST(
      new Request('https://exemplo/api/webhook/leadgen', {
        method: 'POST',
        body: 'x',
        headers: { 'content-length': String(200 * 1024) },
      }),
    )
    expect(r.status).toBe(413)
  })
})

describe('de quem é o lead', () => {
  /*
   * A defesa central: a assinatura prova que a Meta mandou, não de quem é o
   * lead. Página desconhecida é descartada em vez de adivinhar a conta.
   */
  it('página não ligada a nenhuma conta é descartada', async () => {
    vi.mocked(clientePelaPagina).mockResolvedValue(null)
    const r = await posta(loteDeUmLead('page-desconhecida'))
    await assentar()
    expect(r.status).toBe(200)
    expect(receberLeadsDoFormulario).not.toHaveBeenCalled()
  })

  it('conta sem token de Ads não tenta buscar', async () => {
    vi.mocked(tokenDeAnuncios).mockResolvedValue(null)
    const r = await posta(loteDeUmLead())
    await assentar()
    expect(r.status).toBe(200)
    expect(receberLeadsDoFormulario).not.toHaveBeenCalled()
  })

  it('a conta usada é a da Página, e o token é o dela', async () => {
    await posta(loteDeUmLead('page-7'))
    await assentar()
    expect(clientePelaPagina).toHaveBeenCalledWith('page-7')
    expect(tokenDeAnuncios).toHaveBeenCalledWith(CLIENTE)
    expect(receberLeadsDoFormulario).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: CLIENTE, token: 'token-de-ads' }),
    )
  })

  /*
   * Um POST pode trazer leads de Páginas diferentes — contas diferentes. Cada
   * grupo tem de ir para a sua, com o token dela.
   */
  it('separa por página quando o lote tem mais de uma', async () => {
    vi.mocked(clientePelaPagina).mockImplementation(async (pageId: string) =>
      pageId === 'page-a' ? 'conta-a' : 'conta-b',
    )

    await posta({
      object: 'page',
      entry: [
        {
          changes: [
            { field: 'leadgen', value: { leadgen_id: 'l1', page_id: 'page-a', form_id: 'f', ad_id: 'a' } },
            { field: 'leadgen', value: { leadgen_id: 'l2', page_id: 'page-b', form_id: 'f', ad_id: 'a' } },
          ],
        },
      ],
    })
    await assentar()

    expect(receberLeadsDoFormulario).toHaveBeenCalledTimes(2)
    const contas = vi.mocked(receberLeadsDoFormulario).mock.calls.map((c) => c[0].clienteId)
    expect(contas.sort()).toEqual(['conta-a', 'conta-b'])
  })

  /* O exemplo oficial da Meta traz dois leads no mesmo POST. */
  it('trata o lote inteiro, e não só o primeiro lead', async () => {
    await posta({
      object: 'page',
      entry: [
        {
          changes: [
            { field: 'leadgen', value: { leadgen_id: 'l1', page_id: 'p', form_id: 'f', ad_id: 'a' } },
            { field: 'leadgen', value: { leadgen_id: 'l2', page_id: 'p', form_id: 'f', ad_id: 'a' } },
          ],
        },
      ],
    })
    await assentar()

    const avisos = vi.mocked(receberLeadsDoFormulario).mock.calls[0]?.[0].avisos
    expect(avisos?.map((a) => a.leadgenId)).toEqual(['l1', 'l2'])
  })
})
