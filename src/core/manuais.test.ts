import { describe, expect, it } from 'vitest'
import {
  cardDosDownloads,
  legendaDoManual,
  lerBuscaDeDownloads,
  lerDownloads,
  linkDaBuscaDeDownloads,
  linkDaPaginaDeDownloads,
  manualEmPdf,
  nomeDoArquivoDoManual,
} from './manuais'

/** A consulta `drivers` do site novo da PCYES, 26/out/2026. */
const BUSCA = {
  data: {
    drivers: {
      items: [
        { id: 13538, name: 'Mouse PCYES Gamer  Basaran Black Vulcan', category_name: 'Mouse' },
        { id: 13539, name: 'Mouse PCYES Gamer Basaran White Ghost', category_name: 'Mouse' },
        { id: 13538, name: 'repetido', category_name: 'Mouse' },
      ],
    },
  },
}

const PAGINA = {
  data: {
    driver: {
      id: 13538,
      name: 'Mouse PCYES Gamer Basaran Black Vulcan',
      image: 'https://cdn.oderco.com.br/produtos/199399/3F2E',
      link_driver: 'https://cdn.oderco.com.br/produtos/199399/attachments/1-driver.exe',
      link_manual: 'https://cdn.oderco.com.br/produtos/199399/attachments/2-manual.pdf',
    },
  },
}

describe('busca da página de downloads', () => {
  it('lê id, nome e categoria de cada card, sem repetir', () => {
    expect(lerBuscaDeDownloads(BUSCA)).toEqual([
      { manualId: '13538', nome: 'Mouse PCYES Gamer Basaran Black Vulcan', categoria: 'Mouse' },
      { manualId: '13539', nome: 'Mouse PCYES Gamer Basaran White Ghost', categoria: 'Mouse' },
    ])
  })

  it('consulta sem item nenhum é lista vazia, não erro', () => {
    expect(lerBuscaDeDownloads({ data: { drivers: { items: [] } } })).toEqual([])
    expect(lerBuscaDeDownloads(null)).toEqual([])
  })
})

describe('página de um produto', () => {
  it('separa driver de manual e pega o formato pela extensão', () => {
    const lida = lerDownloads(PAGINA)
    expect(lida?.nome).toBe('Mouse PCYES Gamer Basaran Black Vulcan')
    expect(lida?.foto).toBe('https://cdn.oderco.com.br/produtos/199399/3F2E')
    expect(lida?.arquivos.map((a) => [a.secao, a.formato])).toEqual([
      ['driver', 'exe'],
      ['manual', 'pdf'],
    ])
  })

  it('o manual anexado é o PDF da seção de manuais', () => {
    expect(manualEmPdf(lerDownloads(PAGINA)!.arquivos)?.url).toBe(
      'https://cdn.oderco.com.br/produtos/199399/attachments/2-manual.pdf',
    )
  })

  it('link vazio ou sem https fica de fora; produto que não existe é null', () => {
    const soManual = lerDownloads({ data: { driver: { id: 1, name: 'Teclado', link_driver: '', link_manual: 'http://x/y.pdf' } } })
    expect(soManual?.arquivos).toEqual([])
    expect(lerDownloads({ data: { driver: null } })).toBeNull()
  })

  it('id que não é número não vira caminho de URL', () => {
    expect(linkDaPaginaDeDownloads('https://loja.com.br', '../admin')).toBeNull()
    expect(linkDaPaginaDeDownloads('https://loja.com.br/', '13538')).toBe('https://loja.com.br/drivers-e-manuais/13538')
    expect(linkDaBuscaDeDownloads('https://loja.com.br', ' rasec ')).toBe('https://loja.com.br/drivers-e-manuais?q=rasec')
  })

  it('nome do arquivo e legenda', () => {
    expect(nomeDoArquivoDoManual('Mouse / Basaran: "X"')).toBe('Manual Mouse Basaran X.pdf')
    const legenda = legendaDoManual('Mouse Basaran', 'https://loja.com.br/drivers-e-manuais/1', true)
    expect(legenda).toContain('*Manual: Mouse Basaran*')
    expect(legenda).toContain('Driver e outros arquivos:\nhttps://loja.com.br/drivers-e-manuais/1')
  })
})

describe('card da página de downloads', () => {
  it('driver e manual sem PDF: lista os dois e o botão leva aos downloads', () => {
    // O cooler Duley da PCYES em 06/out/2026: driver .exe, manual .doc.
    const card = cardDosDownloads('Cooler PCYES DULEY', [
      { secao: 'driver', nome: 'Driver', url: 'https://x/a.exe', formato: 'exe' },
      { secao: 'manual', nome: 'Manual', url: 'https://x/b.doc', formato: 'doc' },
    ])
    expect(card?.rotulo).toBe('Ver downloads')
    expect(card?.texto).toContain('*Cooler PCYES DULEY*')
    expect(card?.texto).toContain('Driver')
    expect(card?.texto).toContain('Manual')
    expect(card?.texto).not.toContain('https://')
  })

  it('só driver: botão de baixar driver; nada: sem card', () => {
    expect(cardDosDownloads('Mouse', [{ secao: 'driver', nome: 'D', url: 'https://x/a.exe', formato: 'exe' }])?.rotulo).toBe(
      'Baixar driver',
    )
    expect(cardDosDownloads('Mouse', [])).toBeNull()
  })
})
