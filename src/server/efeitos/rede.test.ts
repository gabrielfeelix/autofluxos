import { describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup }))

const { conferirEndereco, ehInterno } = await import('./rede')

/** Faz o DNS responder o que o teste quiser, no formato de `lookup(h, {all})`. */
function dnsResponde(...enderecos: string[]) {
  lookup.mockResolvedValue(
    enderecos.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  )
}

describe('conferirEndereco', () => {
  it('aceita https que resolve para endereço público', async () => {
    dnsResponde('93.184.216.34')
    expect(await conferirEndereco('https://exemplo.com/x')).toEqual({ ok: true })
  })

  it('recusa http', async () => {
    dnsResponde('93.184.216.34')
    expect((await conferirEndereco('http://exemplo.com')).ok).toBe(false)
  })

  it('recusa http ANTES de consultar o DNS', async () => {
    lookup.mockClear()
    await conferirEndereco('http://exemplo.com')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('recusa URL que não dá para ler', async () => {
    expect((await conferirEndereco('não é uma url')).ok).toBe(false)
  })

  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.1.2.3', 'resto do loopback'],
    ['10.1.2.3', 'rede privada 10/8'],
    ['172.16.0.1', 'começo da faixa 172'],
    ['172.31.255.254', 'fim da faixa 172'],
    ['192.168.1.1', 'rede privada 192.168/16'],
    ['169.254.169.254', 'metadados da nuvem'],
    ['0.0.0.0', 'endereço nulo'],
    ['100.64.0.1', 'CGNAT'],
    ['239.1.1.1', 'multicast'],
  ])('recusa %s (%s)', async (ip) => {
    dnsResponde(ip)
    expect((await conferirEndereco('https://parece-inocente.com')).ok).toBe(false)
  })

  it('aceita 172.15 e 172.32, que estão FORA da faixa privada', async () => {
    dnsResponde('172.15.0.1')
    expect(await conferirEndereco('https://a.com')).toEqual({ ok: true })
    dnsResponde('172.32.0.1')
    expect(await conferirEndereco('https://a.com')).toEqual({ ok: true })
  })

  it.each([['::1'], ['::'], ['fc00::1'], ['fd12:3456::1'], ['fe80::1']])(
    'recusa o IPv6 %s',
    async (ip) => {
      dnsResponde(ip)
      expect((await conferirEndereco('https://a.com')).ok).toBe(false)
    },
  )

  it('aceita IPv6 público', async () => {
    dnsResponde('2606:4700:4700::1111')
    expect(await conferirEndereco('https://a.com')).toEqual({ ok: true })
  })

  it('recusa IPv4 disfarçado de IPv6', async () => {
    dnsResponde('::ffff:127.0.0.1')
    expect((await conferirEndereco('https://a.com')).ok).toBe(false)
  })

  it('basta UM endereço ruim para recusar', async () => {
    dnsResponde('93.184.216.34', '127.0.0.1')
    expect((await conferirEndereco('https://a.com')).ok).toBe(false)
  })

  it('recusa quando o DNS não resolve', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'))
    expect((await conferirEndereco('https://nao-existe.invalid')).ok).toBe(false)
  })

  it('recusa quando o DNS responde lista vazia', async () => {
    lookup.mockResolvedValue([])
    expect((await conferirEndereco('https://a.com')).ok).toBe(false)
  })

  it('o motivo da recusa não vaza o IP interno que foi descoberto', async () => {
    dnsResponde('10.0.0.7')
    const veredito = await conferirEndereco('https://a.com')
    if (veredito.ok) throw new Error('deveria ter recusado')
    expect(veredito.motivo).not.toContain('10.0.0.7')
  })
})

describe('ehInterno', () => {
  it('recusa o que não sabe interpretar', () => {
    // Endereço que não é IPv4 nem IPv6 reconhecível: recusar é a resposta
    // segura, porque aceitar significaria chamar um destino desconhecido.
    expect(ehInterno('999.1.1.1')).toBe(true)
    expect(ehInterno('')).toBe(true)
    expect(ehInterno('1.2.3')).toBe(true)
  })

  it('aceita endereço público comum', () => {
    expect(ehInterno('8.8.8.8')).toBe(false)
    expect(ehInterno('93.184.216.34')).toBe(false)
  })
})
