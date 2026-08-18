import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { apagarAcervoDoCliente, apagarDoAcervo, guardarNoAcervo, listarAcervo } from './acervo'
import { apagarCliente, criarCliente } from './clientes'

const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-acervo-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroId = ''

/** Um PNG de 1x1 de verdade — o bucket confere o MIME, não a extensão. */
function png(nome: string): File {
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    ),
    (c) => c.charCodeAt(0),
  )
  return new File([bytes], nome, { type: 'image/png' })
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  outroId = (await criarCliente(`${marca} outro`)).id
})

afterAll(async () => {
  if (!temCredencial) return
  for (const id of [clienteId, outroId]) {
    if (id) await apagarCliente(id)
  }
})

describe.skipIf(!temCredencial)('acervo de mídia', () => {
  it('cliente sem arquivo nenhum devolve lista vazia, não erro', async () => {
    // Pasta que nunca recebeu arquivo não existe no Storage. Se isso virasse
    // exceção, a tela de Ajustes quebraria para todo cliente novo.
    expect(await listarAcervo(outroId)).toEqual([])
  })

  it('guarda o arquivo e devolve um endereço público que o WhatsApp alcança', async () => {
    const arquivo = await guardarNoAcervo(clienteId, png('Foto da Sala.png'))

    expect(arquivo.midia).toBe('imagem')
    expect(arquivo.caminho.startsWith(`${clienteId}/`)).toBe(true)

    const resposta = await fetch(arquivo.url)
    expect(resposta.status).toBe(200)
  })

  it('normaliza acento e espaço no nome, que virariam %20 na URL', async () => {
    const arquivo = await guardarNoAcervo(clienteId, png('Sessão de Fotos.png'))
    expect(arquivo.nome).toMatch(/^sessao-de-fotos-[a-z0-9]{6}\.png$/)
  })

  it('dois arquivos de mesmo nome convivem em vez de um sobrescrever o outro', async () => {
    // Sobrescrever trocaria o arquivo de um fluxo já publicado sem ninguém
    // pedir — o grafo aponta para uma URL e ela não pode mudar de conteúdo.
    const a = await guardarNoAcervo(clienteId, png('plano.png'))
    const b = await guardarNoAcervo(clienteId, png('plano.png'))

    expect(a.caminho).not.toBe(b.caminho)
    const caminhos = (await listarAcervo(clienteId)).map((x) => x.caminho)
    expect(caminhos).toContain(a.caminho)
    expect(caminhos).toContain(b.caminho)
  })

  it('recusa tipo que o WhatsApp não envia', async () => {
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })
    await expect(guardarNoAcervo(clienteId, svg)).rejects.toThrow(/não envia/)
  })

  it('não apaga arquivo de outro cliente pelo caminho', async () => {
    const doOutro = await guardarNoAcervo(outroId, png('alheio.png'))

    await expect(apagarDoAcervo(clienteId, doOutro.caminho)).rejects.toThrow(/não é deste cliente/)
    expect((await listarAcervo(outroId)).map((a) => a.caminho)).toContain(doOutro.caminho)
  })

  it('não escapa da pasta com caminho relativo', async () => {
    await expect(apagarDoAcervo(clienteId, `${clienteId}/../${outroId}/x.png`)).rejects.toThrow()
  })

  it('apagar o cliente leva o acervo junto — cascata não alcança o Storage', async () => {
    const efemero = await criarCliente(`${marca} efêmero`)
    const arquivo = await guardarNoAcervo(efemero.id, png('some-junto.png'))
    expect(await listarAcervo(efemero.id)).toHaveLength(1)

    await apagarCliente(efemero.id)

    expect(await listarAcervo(efemero.id)).toEqual([])
    // E o endereço público para de responder — o arquivo saiu mesmo do bucket.
    expect((await fetch(arquivo.url)).status).toBe(400)
  })

  it('limpar o acervo de quem não tem nada não estoura', async () => {
    await expect(apagarAcervoDoCliente(outroId)).resolves.toBeUndefined()
    await db().from('clients').select('id').eq('id', outroId).maybeSingle()
  })
})
