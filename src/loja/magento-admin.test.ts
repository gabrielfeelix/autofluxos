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
  return vi.fn(async (pedido: { url: string; metodo: string }) => {
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
        /^\/rest\/V1\/(inventory\/(get-product-salable-quantity|stock-resolver)\/|stockItems\/|products\/[^/]+\/media$)/,
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

  it('foto: a imagem principal ativa, com o endereço da mídia da loja', async () => {
    const chamar = rede({
      '/rest/V1/products/330107/media': json([
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

  it('foto: sem imagem ativa devolve null, e não placeholder', async () => {
    const chamar = rede({ '/rest/V1/products/330107/media': json([]) })
    expect(await lojaAdmin(dados, chamar).foto('330107')).toEqual({ ok: true, valor: null })
  })
})
