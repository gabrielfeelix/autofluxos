import 'server-only'
import type { AnuncioEmCache, NomesDoAnuncio } from '@/core/anuncios'
import { db, ehIdInvalido } from '../db'

/**
 * Os nomes de campanha já resolvidos, por conta (0050).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide se vale perguntar à Meta é
 * `resolver-anuncios.ts`; quem decide o que a tela mostra é `core/anuncios.ts`.
 */

type Linha = {
  ad_id: string
  anuncio: string | null
  conjunto: string | null
  campanha: string | null
  resolvido_em: string
}

const COLUNAS = 'ad_id, anuncio, conjunto, campanha, resolvido_em'

function paraCache(linha: Linha): AnuncioEmCache {
  return {
    adId: linha.ad_id,
    anuncio: linha.anuncio ?? '',
    conjunto: linha.conjunto ?? '',
    campanha: linha.campanha ?? '',
    resolvidoEm: linha.resolvido_em,
  }
}

/**
 * Os nomes que já temos, dos ids pedidos.
 *
 * Devolve `Map` e não lista porque todo uso é "e este `ad_id` aqui?" — uma
 * busca por conversa, dentro de um laço que pinta a fila. Lista obrigaria quem
 * chama a montar o índice, e alguém acabaria fazendo `find()` dentro do laço.
 */
export async function nomesGuardados(
  clienteId: string,
  adIds: string[],
): Promise<Map<string, AnuncioEmCache>> {
  const limpos = [...new Set(adIds.map((id) => id.trim()).filter((id) => id !== ''))]
  if (limpos.length === 0) return new Map()

  const { data, error } = await db()
    .from('anuncios')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .in('ad_id', limpos)

  /*
   * Falta de cache nunca é erro fatal: a tela tem o `headline` para mostrar.
   * Um id torto (`22P02`) ou a tabela ainda não migrada não podem derrubar o
   * Inbox inteiro por causa de um enfeite.
   */
  if (error) {
    if (ehIdInvalido(error)) return new Map()
    throw new Error(`não deu para ler os nomes de anúncio: ${error.message}`)
  }

  const mapa = new Map<string, AnuncioEmCache>()
  for (const linha of (data ?? []) as Linha[]) mapa.set(linha.ad_id, paraCache(linha))
  return mapa
}

/**
 * Grava o que a Meta respondeu.
 *
 * `upsert` porque o caso normal **é** o segundo encontro: o anúncio já está na
 * tabela e o que muda é `resolvido_em`. Insert puro exigiria ler antes para
 * decidir, e duas idas ao banco para escrever três textos é caro à toa.
 */
export async function guardarNomes(
  clienteId: string,
  adId: string,
  nomes: NomesDoAnuncio,
): Promise<void> {
  const { error } = await db()
    .from('anuncios')
    .upsert(
      {
        client_id: clienteId,
        ad_id: adId,
        anuncio: nomes.anuncio,
        conjunto: nomes.conjunto,
        campanha: nomes.campanha,
        resolvido_em: new Date().toISOString(),
      },
      { onConflict: 'client_id,ad_id' },
    )

  if (error) throw new Error(`não deu para guardar o nome do anúncio: ${error.message}`)
}
