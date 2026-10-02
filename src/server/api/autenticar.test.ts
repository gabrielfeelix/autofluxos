import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi, registrarUsoDaChave } from '@/server/repos/chaves-de-api'
import { autenticarChave, lerCorpo } from './autenticar'

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))

const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`
const CLIENTE = '11111111-1111-1111-1111-111111111111'

function pedir(cabecalhos: Record<string, string> = { authorization: `Bearer ${CHAVE}` }) {
  return new Request('http://localhost/api/v1/contatos', { method: 'POST', headers: cabecalhos })
}

async function codigo(resposta: Response) {
  return ((await resposta.json()) as { erro: { codigo: string } }).erro.codigo
}

describe('autenticarChave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(consumirLimite).mockResolvedValue(true)
    vi.mocked(recusaDoPlano).mockResolvedValue(null)
    vi.mocked(conferirChaveDeApi).mockResolvedValue({
      chaveId: 'c1',
      clienteId: CLIENTE,
      publico: 'ABCDEFGHIJKL',
      escopos: ['contatos:escrever'],
    })
  })

  it('chave certa, escopo certo e plano com API passam, e o cliente vem da chave', async () => {
    const r = await autenticarChave(pedir(), 'contatos:escrever')
    expect(r).toEqual({ clienteId: CLIENTE, chaveId: 'c1', publico: 'ABCDEFGHIJKL' })
    expect(consumirLimite).toHaveBeenCalledWith('api:ABCDEFGHIJKL', 120, 60)
    expect(conferirChaveDeApi).toHaveBeenCalledWith('ABCDEFGHIJKL', 's'.repeat(43))
    expect(registrarUsoDaChave).toHaveBeenCalledWith('c1')
  })

  it('corpo declarado acima de 64 KB é 413 antes de tudo', async () => {
    const r = (await autenticarChave(pedir({ authorization: `Bearer ${CHAVE}`, 'content-length': '70000' }), 'contatos:escrever')) as Response
    expect(r.status).toBe(413)
    expect(consumirLimite).not.toHaveBeenCalled()
  })

  it('sem cabeçalho ou com forma errada é 401 sem ir ao banco', async () => {
    const casos: Record<string, string>[] = [{}, { authorization: 'Bearer qualquer' }, { authorization: `Basic ${CHAVE}` }]
    for (const cabecalhos of casos) {
      const r = (await autenticarChave(pedir(cabecalhos), 'contatos:escrever')) as Response
      expect(r.status).toBe(401)
      expect(await codigo(r)).toBe('nao_autenticado')
    }
    expect(consumirLimite).not.toHaveBeenCalled()
    expect(conferirChaveDeApi).not.toHaveBeenCalled()
  })

  it('limite estourado é 429 com Retry-After, antes de conferir a chave', async () => {
    vi.mocked(consumirLimite).mockResolvedValue(false)
    const r = (await autenticarChave(pedir(), 'contatos:escrever')) as Response
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('60')
    expect(conferirChaveDeApi).not.toHaveBeenCalled()
  })

  it('chave inexistente, errada ou revogada é 401, e a mensagem não repete a chave', async () => {
    vi.mocked(conferirChaveDeApi).mockResolvedValue(null)
    const r = (await autenticarChave(pedir(), 'contatos:escrever')) as Response
    expect(r.status).toBe(401)
    expect(JSON.stringify(await r.json())).not.toContain('s'.repeat(10))
  })

  it('escopo que a chave não tem é 403 escopo_insuficiente', async () => {
    const r = (await autenticarChave(pedir(), 'fluxos:disparar')) as Response
    expect(r.status).toBe(403)
    expect(await codigo(r)).toBe('escopo_insuficiente')
    expect(recusaDoPlano).not.toHaveBeenCalled()
  })

  it('plano sem API é 403 plano_sem_api com a frase do plano', async () => {
    vi.mocked(recusaDoPlano).mockResolvedValue('O plano Essencial não inclui API para desenvolvedores.')
    const r = (await autenticarChave(pedir(), 'contatos:escrever')) as Response
    expect(r.status).toBe(403)
    expect(await codigo(r)).toBe('plano_sem_api')
    expect(recusaDoPlano).toHaveBeenCalledWith(CLIENTE, 'api')
    expect(registrarUsoDaChave).not.toHaveBeenCalled()
  })

  it('banco fora do ar fecha a porta com 500', async () => {
    vi.mocked(conferirChaveDeApi).mockRejectedValue(new Error('caiu'))
    const r = (await autenticarChave(pedir(), 'contatos:escrever')) as Response
    expect(r.status).toBe(500)
  })
})

describe('lerCorpo', () => {
  it('JSON inválido é 400 e corpo grande é 413', async () => {
    const invalido = await lerCorpo(new Request('http://x', { method: 'POST', body: '{' }))
    expect(invalido.ok).toBe(false)
    if (!invalido.ok) expect(invalido.resposta.status).toBe(400)

    const grande = await lerCorpo(new Request('http://x', { method: 'POST', body: 'a'.repeat(70 * 1024) }))
    expect(grande.ok).toBe(false)
    if (!grande.ok) expect(grande.resposta.status).toBe(413)
  })
})
