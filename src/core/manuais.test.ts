import { describe, expect, it } from 'vitest'
import {
  legendaDoManual,
  lerBuscaDeDownloads,
  lerPaginaDeDownloads,
  linkDaPaginaDeDownloads,
  manualEmPdf,
  nomeDoArquivoDoManual,
} from './manuais'

/** Recortes da página de downloads da PCYES, 25/set/2026. */
const BUSCA = `
<div class="products-grid">
  <a href="https://www.pcyes.com.br/drivers/index/view/id/13538/"
     class="product-card-link">
    <div class="product-card"><img src="x" alt="Mouse&#x20;PCYES&#x20;Gamer&#x20;Basaran&#x20;Black&#x20;Vulcan" />
      <span class="product-category-badge">
          Mouse                                        </span>
    </div>
  </a>
  <a href="https://www.pcyes.com.br/drivers/index/view/id/13539/" class="product-card-link">
    <img alt="Mouse PCYES Gamer Basaran White Ghost" /><span class="product-category-badge">Mouse</span>
  </a>
  <a href="https://www.pcyes.com.br/drivers/index/view/id/13538/" class="product-card-link"><img alt="repetido" /></a>
</div>`

const PAGINA = `
<title>Mouse PCYES Gamer Basaran Black Vulcan</title>
<div id="downloads" class="downloads-section container">
  <div class="download-column">
    <h2 class="download-section-title">Drivers</h2>
    <div class="download-card">
      <div class="download-name">Driver Mouse Basaran</div>
      <span class="file-type-badge pdf-badge">ZIP</span>
      <a href="https://cdn.oderco.com.br/produtos/199399/attachments/1-driver.exe" target="_blank">baixar</a>
    </div>
  </div>
  <div class="download-column">
    <h2 class="download-section-title">Manuais</h2>
    <div class="download-card">
      <div class="download-name">Manual Mouse Basaran</div>
      <a href="https://cdn.oderco.com.br/produtos/199399/attachments/2-manual.pdf" target="_blank">baixar</a>
    </div>
    <div class="download-card">
      <div class="download-name">Sem https</div>
      <a href="http://inseguro.com/x.pdf">baixar</a>
    </div>
  </div>
</div>`

describe('busca da página de downloads', () => {
  it('lê id, nome e categoria de cada card, sem repetir', () => {
    expect(lerBuscaDeDownloads(BUSCA)).toEqual([
      { manualId: '13538', nome: 'Mouse PCYES Gamer Basaran Black Vulcan', categoria: 'Mouse' },
      { manualId: '13539', nome: 'Mouse PCYES Gamer Basaran White Ghost', categoria: 'Mouse' },
    ])
  })

  it('página sem card nenhum é lista vazia, não erro', () => {
    expect(lerBuscaDeDownloads('<html>nada aqui</html>')).toEqual([])
  })
})

describe('página de um produto', () => {
  it('separa driver de manual e pega o formato pela extensão, não pelo selo', () => {
    const { nome, arquivos } = lerPaginaDeDownloads(PAGINA)
    expect(nome).toBe('Mouse PCYES Gamer Basaran Black Vulcan')
    expect(arquivos.map((a) => [a.secao, a.formato])).toEqual([
      ['driver', 'exe'],
      ['manual', 'pdf'],
    ])
  })

  it('o manual anexado é o PDF da seção de manuais', () => {
    expect(manualEmPdf(lerPaginaDeDownloads(PAGINA).arquivos)?.url).toBe(
      'https://cdn.oderco.com.br/produtos/199399/attachments/2-manual.pdf',
    )
  })

  it('id que não é número não vira caminho de URL', () => {
    expect(linkDaPaginaDeDownloads('https://loja.com.br', '../admin')).toBeNull()
    expect(linkDaPaginaDeDownloads('https://loja.com.br', '13538')).toBe('https://loja.com.br/drivers/index/view/id/13538/')
  })

  it('nome do arquivo e legenda', () => {
    expect(nomeDoArquivoDoManual('Mouse / Basaran: "X"')).toBe('Manual Mouse Basaran X.pdf')
    const legenda = legendaDoManual('Mouse Basaran', 'https://loja.com.br/drivers/index/view/id/1/', true)
    expect(legenda).toContain('*Manual: Mouse Basaran*')
    expect(legenda).toContain('Driver e outros arquivos:\nhttps://loja.com.br/drivers/index/view/id/1/')
  })
})
