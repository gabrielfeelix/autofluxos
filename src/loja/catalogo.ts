import { paginaDaBusca, type ProdutoDaLoja } from '@/core/loja'
import { normalizar } from '@/core/engine/interpolar'
import { estaAtivo, type Produto } from '@/core/produtos'
import type { Loja } from './types'

/**
 * O catálogo da própria conta (`public.produtos`) visto como `Loja`.
 *
 * É o que a conta sem Magento usa: o dono cadastra ou importa os itens, e o
 * bot busca e manda o card deles pelo mesmo caminho da loja on-line. Quem
 * escolhe entre os dois é `server/adaptador-da-loja.ts`.
 *
 * Recebe a leitura do catálogo em vez de ir ao banco, para o teste não
 * precisar de banco. A busca é em memória: catálogo manual tem dezenas ou
 * centenas de itens (a importação para em 2000), e trazer tudo de uma vez
 * custa menos que uma consulta por palavra.
 *
 * O que ele não tem, e diz que não tem:
 *
 *  - estoque: `emEstoque` é sempre `true` e `semControleDeEstoque` avisa o
 *    card para não escrever "em estoque";
 *  - "combina com": vazio;
 *  - página de busca: vazio, e o resolvedor não oferece link nenhum.
 */
export function lojaCatalogo(listar: () => Promise<Produto[]>): Loja {
  async function ativos(): Promise<{ ok: true; valor: Produto[] } | { ok: false; motivo: string }> {
    try {
      return { ok: true, valor: (await listar()).filter(estaAtivo) }
    } catch (e) {
      return { ok: false, motivo: `não deu para ler o catálogo: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  return {
    async buscar(termo, opcoes) {
      const lidos = await ativos()
      if (!lidos.ok) return lidos
      const palavras = normalizar(termo).split(/\s+/).filter(Boolean)
      if (palavras.length === 0) return { ok: true, valor: [] }

      const pontuados = lidos.valor
        .map((p) => {
          const texto = normalizar([p.nome, p.sku ?? '', p.descricao ?? ''].join(' '))
          return { p, acertos: palavras.filter((w) => texto.includes(w)).length }
        })
        .filter((x) => x.acertos > 0)

      // Quem tem todas as palavras ganha sozinho. Sem ninguém assim, vale
      // quem tem alguma, o que tem mais primeiro: "cadeira azul" num catálogo
      // sem cadeira azul ainda mostra as cadeiras.
      const todas = pontuados.filter((x) => x.acertos === palavras.length)
      const escolhidos = todas.length > 0 ? todas : pontuados.sort((a, b) => b.acertos - a.acertos)
      const { pagina, porPagina } = paginaDaBusca(opcoes)
      const inicio = (pagina - 1) * porPagina
      return { ok: true, valor: escolhidos.slice(inicio, inicio + porPagina).map((x) => paraProdutoDaLoja(x.p)) }
    },

    async combinaCom() {
      return { ok: true, valor: [] }
    },

    async lerPorSku(skus) {
      const lidos = await ativos()
      if (!lidos.ok) return lidos
      return {
        ok: true,
        valor: skus.flatMap((pedido) => {
          const chave = pedido.trim().toLowerCase()
          const p = lidos.valor.find((x) => x.id === pedido || x.sku?.trim().toLowerCase() === chave)
          return p ? [paraProdutoDaLoja(p)] : []
        }),
      }
    },

    linkDaBusca() {
      return ''
    },

    async lerConfig() {
      return { ok: true, valor: { codigoDaLoja: null, moeda: 'BRL', sufixo: '' } }
    },
  }
}

/**
 * O item do catálogo no formato da loja.
 *
 * O `produtoId` é o SKU quando existe, porque é o que quem atende reconhece
 * se ler o log; senão, o id da linha. `lerPorSku` aceita os dois.
 *
 * Campo vazio fica **ausente**, e não `null` nem zero: preço ausente é o que
 * impede o card de anunciar R$ 0,00 para item que ninguém precificou.
 */
function paraProdutoDaLoja(p: Produto): ProdutoDaLoja {
  return {
    produtoId: p.sku ?? p.id,
    nome: p.nome,
    ...(p.preco !== null ? { preco: p.preco } : {}),
    ...(p.descricao ? { descricao: p.descricao } : {}),
    emEstoque: true,
    semControleDeEstoque: true,
    ...(p.foto ? { foto: p.foto } : {}),
    link: p.link ?? '',
  }
}
