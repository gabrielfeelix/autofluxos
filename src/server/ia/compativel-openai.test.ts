import { afterEach, describe, expect, it, vi } from 'vitest'
import { compativelOpenai, enderecoDo } from './compativel-openai'

describe('o endereço de cada provedor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('usa o endereço fixo de quem não precisa de conta', () => {
    expect(enderecoDo('groq')).toBe('https://api.groq.com/openai/v1/chat/completions')
  })

  it('põe o id da conta no endereço do Cloudflare', () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'abc123')
    expect(enderecoDo('cloudflare')).toBe(
      'https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1/chat/completions',
    )
  })

  it('sem o id da conta, o Cloudflare não tem endereço', () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    expect(enderecoDo('cloudflare')).toBeNull()
  })

  it('sem o id da conta, falha para a cadeia seguir, sem chamar a rede', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    const rede = vi.fn()
    vi.stubGlobal('fetch', rede)
    const r = await compativelOpenai({ provedor: 'cloudflare', chave: 'x' }).responder({
      mensagem: 'oi',
      contexto: '',
      historico: [],
    } as never)
    expect(r).toMatchObject({ tipo: 'nao_sei', falhou: true })
    expect(rede).not.toHaveBeenCalled()
  })
})
