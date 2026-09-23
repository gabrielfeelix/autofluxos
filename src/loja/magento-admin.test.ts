import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { lojaAdmin } from './magento-admin'

/**
 * O cliente do token de administrador.
 *
 * O token que o lojista cria pode, pela ACL do Magento, alterar produto. O que
 * impede isso é este cliente não saber pedir outra coisa, e é isso que o
 * primeiro teste cobra lendo o fonte.
 */

const dados = {
  endereco: 'https://www.pcyes.com.br',
  credencial: { tipo: 'bearer' as const, campo: null, valor: 'token-de-teste' },
}

type Resposta = { ok: true; valores: Record<string, string>; json: unknown } | { ok: false; motivo: string }

/** `chamar` falso: responde por caminho, e guarda cada pedido. */
function rede(porCaminho: Record<string, Resposta>) {
  // O segundo argumento é o que diz se o token foi junto; os testes o leem.
  return vi.fn(async (pedido: { url: string; metodo: string }, opcoes?: unknown) => {
    void opcoes
    const caminho = new URL(pedido.url).pathname
    return porCaminho[caminho] ?? { ok: false as const, motivo: 'a chamada respondeu 404' }
  })
}
const json = (valor: unknown): Resposta => ({ ok: true, valores: {}, json: valor })

describe('lojaAdmin', () => {
  it('o arquivo não sabe escrever', () => {
    const fonte = readFileSync('src/loja/magento-admin.ts', 'utf8')
    expect(fonte).not.toMatch(/['"](POST|PUT|PATCH|DELETE)['"]/)
    // O método é sempre o literal 'GET', nunca uma variável.
    for (const m of fonte.matchAll(/metodo:\s*([^,\n]+)/g)) expect(m[1]!.trim()).toBe("'GET'")
  })

  it('só alcança caminhos da lista, sempre com GET', async () => {
    const chamar = rede({})
    const admin = lojaAdmin(dados, chamar)
    await admin.descobrir('330107')
    await admin.quantidade('330107', 'msi', 2)
    await admin.quantidade('330107', 'legado', null)
    await admin.foto('330107')
    expect(chamar.mock.calls.length).toBeGreaterThan(0)
    for (const [pedido] of chamar.mock.calls) {
      expect(pedido.metodo).toBe('GET')
      expect(new URL(pedido.url).pathname).toMatch(
        /^\/rest\/V1\/(inventory\/(get-product-salable-quantity|stock-resolver)\/|stockItems\/|products\/[^/]+$)/,
      )
    }
  })

  it('sku com barra não escapa do caminho', async () => {
    const chamar = rede({})
    await lojaAdmin(dados, chamar).foto('A/../../customers')
    const url = chamar.mock.calls[0]![0].url
    expect(url).toContain('A%2F..%2F..%2Fcustomers')
    expect(new URL(url).pathname).not.toContain('/customers/')
  })

  it('token recusado vira motivo que a tela entende', async () => {
    const chamar = vi.fn(async () => ({ ok: false as const, motivo: 'a chamada respondeu 401' }))
    const r = await lojaAdmin(dados, chamar).descobrir('330107')
    expect(r).toEqual({ ok: false, motivo: 'o token foi recusado pela loja' })
  })

  it('loja com MSI: descobre o estoque do site e lê a quantidade vendável', async () => {
    const chamar = rede({
      '/rest/V1/inventory/stock-resolver/website/base': json({ stock_id: 2 }),
      '/rest/V1/inventory/get-product-salable-quantity/330107/2': json(7),
    })
    const admin = lojaAdmin(dados, chamar)
    expect(await admin.descobrir('330107')).toEqual({ ok: true, valor: { via: 'msi', estoqueId: 2 } })
    expect(await admin.quantidade('330107', 'msi', 2)).toEqual({ ok: true, valor: 7 })
  })

  it('loja sem MSI cai no legado', async () => {
    const chamar = rede({ '/rest/V1/stockItems/330107': json({ qty: 12, is_in_stock: true }) })
    const admin = lojaAdmin(dados, chamar)
    expect(await admin.descobrir('330107')).toEqual({ ok: true, valor: { via: 'legado', estoqueId: null } })
    expect(await admin.quantidade('330107', 'legado', null)).toEqual({ ok: true, valor: 12 })
  })

  it('quantidade negativa, fracionada ou texto é falha, nunca zero', async () => {
    for (const bruto of [-1, 2.5, '7', null]) {
      const chamar = rede({ '/rest/V1/inventory/get-product-salable-quantity/X/1': json(bruto) })
      expect((await lojaAdmin(dados, chamar).quantidade('X', 'msi', 1)).ok).toBe(false)
    }
  })

  const galeria = (entradas: unknown[]) => json({ sku: '330107', media_gallery_entries: entradas })

  it('foto: a imagem principal ativa, com o endereço da mídia da loja', async () => {
    const chamar = rede({
      '/rest/V1/products/330107': galeria([
        { file: '/c/m/escondida.jpg', disabled: true, media_type: 'image', types: ['image'] },
        { file: '/c/m/lateral.jpg', disabled: false, media_type: 'image', types: [] },
        { file: '/c/m/principal.jpg', disabled: false, media_type: 'image', types: ['image', 'small_image'] },
        { file: '/v/i/video.jpg', disabled: false, media_type: 'external-video', types: ['image'] },
      ]),
    })
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({
      ok: true,
      valor: 'https://www.pcyes.com.br/media/catalog/product/c/m/principal.jpg',
    })
  })

  // A forma real da PCYES em 23/set/2026: a foto mora num CDN, `types` vazio.
  it('foto: URL absoluta do CDN vai como está, e sem o token', async () => {
    const cdn = 'https://cdn.oderco.com.br/produtos/202394/401A241D79BE4FABE0630300A8C0903C'
    const chamar = rede({
      '/rest/V1/products/330107': galeria([
        { file: cdn, disabled: false, media_type: 'image', types: [], position: 0 },
        { file: `${cdn}X`, disabled: false, media_type: 'image', types: [], position: 1 },
      ]),
    })
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({ ok: true, valor: cdn })
    expect(chamar.mock.calls[0]![1]).toMatchObject({ credencial: null })
  })

  it('foto: CDN sem https não serve para o WhatsApp', async () => {
    const chamar = rede({
      '/rest/V1/products/330107': galeria([{ file: 'http://cdn.x/1.jpg', disabled: false, media_type: 'image', types: [] }]),
    })
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({ ok: true, valor: null })
  })

  it('foto: sem imagem ativa devolve null, e não placeholder', async () => {
    const chamar = rede({ '/rest/V1/products/330107': galeria([]) })
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({ ok: true, valor: null })
  })

  it('foto funciona sem token nenhum', async () => {
    const chamar = rede({ '/rest/V1/products/330107': galeria([{ file: '/a.jpg', disabled: false, media_type: 'image' }]) })
    const r = await lojaAdmin({ ...dados, credencial: null }, chamar).foto('330107')
    expect(r).toEqual({ ok: true, valor: 'https://www.pcyes.com.br/media/catalog/product/a.jpg' })
  })

  it('sem token, estoque nem sai para a rede', async () => {
    const chamar = rede({})
    const r = await lojaAdmin({ ...dados, credencial: null }, chamar).quantidade('X', 'msi', 1)
    expect(r.ok).toBe(false)
    expect(chamar).not.toHaveBeenCalled()
  })

  it('conferir pelo caminho de estoque, que é o que exige o token', async () => {
    const msi = '/rest/V1/inventory/stock-resolver/website/base'
    expect(await lojaAdmin(dados, rede({ [msi]: json({ stock_id: 1 }) })).conferir('msi')).toBe('ok')
    expect(await lojaAdmin(dados, rede({ [msi]: { ok: false, motivo: 'a API respondeu 401' } })).conferir('msi')).toBe(
      'recusado',
    )
    expect(await lojaAdmin(dados, rede({ [msi]: { ok: false, motivo: 'a API respondeu 503' } })).conferir('msi')).toBe(
      'sem_resposta',
    )
    // Legado: SKU que não existe dá 404 com token bom (a rede falsa responde 404).
    expect(await lojaAdmin(dados, rede({})).conferir('legado')).toBe('ok')
  })

  it('foto: loja fechada para anônimo, havendo token, pede de novo com ele', async () => {
    const chamar = vi.fn(async (_pedido: { url: string }, opcoes?: { credencial?: unknown }) =>
      opcoes?.credencial
        ? json({ media_gallery_entries: [{ file: '/a.jpg', disabled: false, media_type: 'image' }] })
        : ({ ok: false, motivo: 'a API respondeu 401' } as Resposta),
    )
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({
      ok: true,
      valor: 'https://www.pcyes.com.br/media/catalog/product/a.jpg',
    })
    expect(chamar).toHaveBeenCalledTimes(2)
  })
})
