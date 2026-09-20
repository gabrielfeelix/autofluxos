import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * As contagens das abas de Automações (T7.1, item 5).
 *
 * ---------------------------------------------------------------------------
 * O que foi medido, e por que a medida é a contagem de consultas
 * ---------------------------------------------------------------------------
 *
 * A página de automações fazia **14 idas ao banco em toda visita**, qualquer que
 * fosse a aba aberta. Medido lendo quais variáveis cada bloco `{aba === ...}`
 * usa de verdade:
 *
 *   fluxos      -> fluxos, canais, execucoes, etiquetas, pastas   (5 de 14)
 *   templates   -> nenhuma: a galeria é constante em `exemplos/`  (0 de 14)
 *   palavras    -> fluxos, execucoes, gatilhos                    (3 de 14)
 *   eventos     -> fluxos, execucoes, gatilhosDeEvento, webhooks   (4 de 14)
 *   campanhas   -> fluxos, execucoes, campanhas, contatosDaCampanha (4 de 14)
 *   sequencias  -> fluxos, sequencias, inscricoes, etiquetas, templates (5 de 14)
 *
 * **O plano manda medir antes de otimizar, e a medida honesta aqui é essa.** Não
 * é tempo: o Postgres local está vazio, e cronometrar consulta sobre zero linha
 * mediria a rede do Docker, não o produto. A contagem de idas ao banco é
 * estrutural: ela não depende do volume, e 14 para desenhar uma galeria estática
 * é errado em qualquer tamanho de base.
 *
 * ---------------------------------------------------------------------------
 * A armadilha: a barra de abas mostra a contagem de TODAS as abas
 * ---------------------------------------------------------------------------
 *
 * Carregar só o que a aba aberta usa parece a correção óbvia e **quebraria a
 * barra**: as pastilhas com o número ao lado de cada rótulo precisam de todas as
 * seis contagens, sempre. Trocar `listarX().length` por lazy sem olhar isso faria
 * as pastilhas sumirem ou zerarem, e uma aba com "0" ao lado é uma aba que a
 * pessoa deixa de abrir.
 *
 * Então o desenho é: **uma consulta de contagem, barata, para a barra** (`head:
 * true` não traz linha nenhuma, só o número), e a lista inteira só da aba que
 * está aberta.
 */

export type ContagensDeAutomacao = {
  fluxos: number
  palavras: number
  eventos: number
  campanhas: number
  sequencias: number
}

/**
 * Quantos de cada coisa, para as pastilhas da barra.
 *
 * `head: true` com `count: 'exact'` pede ao PostgREST só o cabeçalho do total:
 * nenhuma linha atravessa a rede. É a diferença entre trazer duzentas sequências
 * para chamar `.length` e pedir "quantas são".
 *
 * Erro vira zero em vez de exceção, e é deliberado: a pastilha é enfeite
 * informativo, e a página inteira não pode cair porque um contador não respondeu.
 * A aba aberta continua carregando pelo caminho dela, que sim reclama de erro.
 */
export async function contagensDeAutomacao(clienteId: string): Promise<ContagensDeAutomacao> {
  const contar = async (tabela: string): Promise<number> => {
    const { count, error } = await db()
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)

    if (ehIdInvalido(error) || error) return 0
    return count ?? 0
  }

  const [fluxos, palavras, eventos, campanhas, sequencias] = await Promise.all([
    contar('fluxos'),
    contar('gatilhos'),
    contar('gatilhos_de_evento'),
    contar('campanhas'),
    contar('sequencias'),
  ])

  return { fluxos, palavras, eventos, campanhas, sequencias }
}
