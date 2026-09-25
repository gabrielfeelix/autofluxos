import { ULTIMAS_UNIDADES, type ProdutoDaLoja } from '@/core/loja'
import type { ResultadoDaLoja, ViaDeEstoque } from './types'

/**
 * Foto real e quantidade exata por cima do resultado público, quando há token.
 *
 * **Nada aqui pode piorar a resposta da fase 1.** Token recusado, loja lenta,
 * foto ausente: o produto volta exatamente como a busca pública o trouxe. O
 * token é um ganho, nunca uma dependência.
 *
 * O prazo é da rodada inteira, não de cada chamada: são até dez chamadas em
 * paralelo, e a pessoa está esperando no WhatsApp.
 */

/** O pedaço de `LojaAdmin` que isto usa. Separado para o teste não montar rede. */
export type Complemento = {
  quantidade(sku: string, via: ViaDeEstoque, estoqueId: number | null): Promise<ResultadoDaLoja<number>>
  foto(sku: string): Promise<ResultadoDaLoja<string | null>>
}

function comPrazo<T>(promessa: Promise<T>, prazo: Promise<null>): Promise<T | null> {
  return Promise.race([promessa.catch(() => null), prazo])
}

export async function enriquecer(
  produtos: ProdutoDaLoja[],
  admin: Complemento,
  {
    via,
    estoqueId,
    prazoMs,
    comFoto = true,
  }: {
    /** `null` sem token: quantidade nem é pedida. */
    via: ViaDeEstoque | null
    estoqueId: number | null
    prazoMs: number
    /** Foto só para o card; a busca não precisa dela e economiza a chamada. */
    comFoto?: boolean
  },
): Promise<ProdutoDaLoja[]> {
  if (produtos.length === 0 || (via === null && !comFoto)) return produtos

  let desligar: ReturnType<typeof setTimeout> | undefined
  const prazo = new Promise<null>((resolve) => {
    desligar = setTimeout(() => resolve(null), prazoMs)
  })

  const resultado = await Promise.all(
    produtos.map(async (produto) => {
      const [quantidade, foto] = await Promise.all([
        // Esgotado já diz tudo: gastar chamada para ouvir "0" é só latência.
        produto.emEstoque && via !== null ? comPrazo(admin.quantidade(produto.produtoId, via, estoqueId), prazo) : null,
        comFoto ? comPrazo(admin.foto(produto.produtoId), prazo) : null,
      ])
      return {
        ...produto,
        // Só as últimas unidades seguem adiante. O número exato acima disso
        // não é para o cliente, e o que não chega ao modelo não vaza por ele.
        ...(quantidade?.ok && quantidade.valor <= ULTIMAS_UNIDADES ? { quantidade: quantidade.valor } : {}),
        ...(foto?.ok && foto.valor ? { foto: foto.valor } : {}),
      }
    }),
  )

  clearTimeout(desligar)
  return resultado
}
