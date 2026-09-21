import { describe, expect, it } from 'vitest'
import { fluxoSchema } from './flow/schema'
import {
  MARCA_DO_ARQUIVO,
  lerArquivoDeFluxo,
  montarArquivoDeFluxo,
  nomeDoArquivoDeFluxo,
} from './arquivo-de-fluxo'

const comApi = fluxoSchema.parse({
  inicio: 'consulta',
  nodes: [
    {
      id: 'consulta',
      type: 'http',
      position: { x: 0, y: 0 },
      data: { url: 'https://e.com', conexaoId: 'con_1', mapear: [] },
    },
    { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
  ],
  edges: [{ id: 'a1', source: 'consulta', target: 'humano' }],
})

describe('exportar', () => {
  it('a credencial não vai no arquivo', () => {
    /*
     * A trava que importa. Um arquivo circula mais do que um link: ele vira
     * anexo, vai para o Drive e é repassado sem ninguém pensar duas vezes.
     * `conexaoId` aponta para uma linha de `connections` da conta de origem, e
     * não pode sair daqui nem como pista.
     */
    const arquivo = montarArquivoDeFluxo({ nome: 'Triagem', grafo: comApi })
    const no = arquivo.grafo.nodes.find((n) => n.id === 'consulta')

    expect(JSON.stringify(arquivo)).not.toContain('con_1')
    expect(no && 'conexaoId' in no.data).toBe(false)
    // O resto do bloco fica inteiro: fluxo sem URL não é fluxo exportado.
    expect(JSON.stringify(arquivo)).toContain('https://e.com')
  })

  it('o nome do arquivo não carrega acento, espaço nem maiúscula', () => {
    expect(nomeDoArquivoDeFluxo('Triagem Inicial  Ação!', 3)).toBe('triagem-inicial-acao-v3.json')
    expect(nomeDoArquivoDeFluxo('   ')).toBe('automacao.json')
  })
})

describe('importar', () => {
  it('lê o que a exportação escreveu', () => {
    const arquivo = montarArquivoDeFluxo({ nome: 'Triagem', grafo: comApi, versaoPublicada: 2 })
    const lido = lerArquivoDeFluxo(JSON.stringify(arquivo))

    expect(lido).toMatchObject({ ok: true, nome: 'Triagem' })
    expect(lido.ok && lido.grafo.nodes).toHaveLength(2)
  })

  it('aceita o grafo cru, sem envelope', () => {
    // Quem copiou só o `grafo` de dentro do arquivo tem um desenho válido na
    // mão. Recusar seria burocracia: a trava é o `fluxoSchema`, não a embalagem.
    const lido = lerArquivoDeFluxo(JSON.stringify(comApi))
    expect(lido.ok).toBe(true)
  })

  it('a credencial também não entra por importação', () => {
    // O arquivo pode ter sido escrito à mão. Limpar na saída e confiar na
    // entrada deixaria um `conexaoId` de outra conta ser gravado aqui dentro.
    const lido = lerArquivoDeFluxo(JSON.stringify({ formato: MARCA_DO_ARQUIVO, grafo: comApi }))
    expect(lido.ok && JSON.stringify(lido.grafo)).not.toContain('con_1')
  })

  it('recusa em uma frase de gente, e não em erro de schema', () => {
    expect(lerArquivoDeFluxo('não sou json')).toEqual({
      ok: false,
      erro: 'este arquivo não é um JSON válido',
    })
    expect(lerArquivoDeFluxo('{"formato":"outro.coisa","grafo":{}}')).toMatchObject({
      ok: false,
      erro: 'este arquivo é de outro sistema, não do AutoFluxos',
    })
    expect(lerArquivoDeFluxo('{"nodes":[]}')).toMatchObject({
      ok: false,
      erro: 'o desenho deste arquivo está incompleto ou corrompido',
    })
  })
})
