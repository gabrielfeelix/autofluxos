import 'server-only'
import {
  relacionamentoDe,
  type FaixasDeNivel,
  type Relacionamento,
} from '@/core/relacionamento'
import { db, ehIdInvalido } from '../db'

/**
 * O relacionamento de muita gente de uma vez.
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que é ouro e o que é
 * "sumido" é `core/relacionamento.ts`.
 *
 * ---------------------------------------------------------------------------
 * Por que em lote, e não `resumoDoContato` num laço
 * ---------------------------------------------------------------------------
 *
 * `resumoDoContato` já responde isto para **uma** pessoa, e é o certo na ficha.
 * A lista de contatos e o cron de retomada precisam da mesma resposta para
 * centenas — e chamá-lo num laço seria uma consulta por pessoa, o N+1 clássico:
 * numa conta com quatrocentos contatos, quatrocentas idas ao banco para desenhar
 * uma tela. Aqui são duas, independentes do tamanho da lista.
 *
 * A soma é feita em JavaScript, e não com `sum()` no Postgres, porque o
 * agrupamento pela Data API exigiria uma view nova por causa de um `group by` —
 * e a mesma aritmética já existe testada em `core/crm.ts`. O volume que passa
 * por aqui é o de uma conta, não o do banco inteiro.
 */

export type FaixasDaConta = FaixasDeNivel

/** As faixas desta conta, ou o padrão do produto se a leitura falhar. */
export async function faixasDaConta(clienteId: string): Promise<FaixasDeNivel | null> {
  const { data, error } = await db()
    .from('clients')
    .select('nivel_ouro, nivel_prata')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error) || error || !data) return null

  const linha = data as { nivel_ouro: string | number; nivel_prata: string | number }
  return {
    // `numeric` chega como string no supabase-js, e comparar "5000" com 1000
    // como texto daria ordem alfabética. Mesma armadilha de `quadro_cartoes.valor`.
    ouro: Number(linha.nivel_ouro),
    prata: Number(linha.nivel_prata),
  }
}

export async function definirFaixas(
  clienteId: string,
  faixas: FaixasDeNivel,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db()
    .from('clients')
    .update({ nivel_ouro: faixas.ouro, nivel_prata: faixas.prata })
    .eq('id', clienteId)

  if (error) throw new Error(`não deu para salvar as faixas: ${error.message}`)
  return { ok: true }
}

/**
 * O relacionamento de cada contato pedido, pela chave `contatoId`.
 *
 * Contato sem cartão ganho e sem conversa aparece no mapa mesmo assim, com
 * zeros: quem chama precisa poder desenhar a linha da pessoa sem conferir se ela
 * está no mapa, e um `undefined` aqui vira `cannot read property` na tela.
 */
export async function relacionamentoDeMuitos(
  clienteId: string,
  contatoIds: string[],
  faixas: FaixasDeNivel,
  agora: Date = new Date(),
): Promise<Map<string, Relacionamento>> {
  const mapa = new Map<string, Relacionamento>()
  if (contatoIds.length === 0) return mapa

  const [ganhos, conversas] = await Promise.all([
    db()
      .from('quadro_cartoes')
      .select('contact_id, valor, fechado_em')
      .eq('client_id', clienteId)
      .eq('situacao', 'ganha')
      .in('contact_id', contatoIds),
    db()
      .from('contacts')
      .select('id, ultima_mensagem_em')
      .eq('client_id', clienteId)
      .in('id', contatoIds),
  ])

  const porContato = new Map<string, { total: number; compras: number; ultima: string | null }>()
  for (const linha of (ganhos.data ?? []) as {
    contact_id: string
    valor: string | number | null
    fechado_em: string | null
  }[]) {
    const atual = porContato.get(linha.contact_id) ?? { total: 0, compras: 0, ultima: null }
    // `numeric` chega como string: somar sem converter concatenaria "200" com
    // "350.50". É a mesma nota que já existe em `resumoDoContato`.
    atual.total += linha.valor === null ? 0 : Number(linha.valor)
    atual.compras += 1
    if (linha.fechado_em && (!atual.ultima || linha.fechado_em > atual.ultima)) {
      atual.ultima = linha.fechado_em
    }
    porContato.set(linha.contact_id, atual)
  }

  const falouEm = new Map<string, string | null>()
  for (const linha of (conversas.data ?? []) as {
    id: string
    ultima_mensagem_em: string | null
  }[]) {
    falouEm.set(linha.id, linha.ultima_mensagem_em)
  }

  for (const id of contatoIds) {
    const compras = porContato.get(id) ?? { total: 0, compras: 0, ultima: null }
    mapa.set(
      id,
      relacionamentoDe(
        {
          total: compras.total,
          compras: compras.compras,
          ultimaCompraEm: compras.ultima,
          ultimaConversaEm: falouEm.get(id) ?? null,
        },
        faixas,
        agora,
      ),
    )
  }

  return mapa
}

/**
 * Quem comprou, parou de falar, e ninguém percebeu.
 *
 * É a consulta que alimenta a régua de retomada — e ela pede **quem já comprou**
 * de propósito. Correr atrás de desconhecido que sumiu é encher a fila de
 * trabalho que ninguém faz; correr atrás de cliente que sumiu é dinheiro na
 * mesa saindo pela porta.
 *
 * O teto existe porque isto roda dentro de uma passada de cron com outras
 * tarefas: uma conta com dois mil clientes antigos não pode monopolizar a
 * janela. Quem sobrar entra na passada seguinte, e isso é aceitável porque a
 * unidade aqui é o dia, não o minuto.
 */
export async function clientesSumidos(
  clienteId: string,
  diasSemConversa: number,
  limite = 200,
): Promise<{ contatoId: string; total: number; ultimaConversaEm: string | null }[]> {
  const corte = new Date(Date.now() - diasSemConversa * 86_400_000).toISOString()

  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('contact_id, valor')
    .eq('client_id', clienteId)
    .eq('situacao', 'ganha')

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os ganhos: ${error.message}`)

  const total = new Map<string, number>()
  for (const linha of (data ?? []) as { contact_id: string; valor: string | number | null }[]) {
    total.set(linha.contact_id, (total.get(linha.contact_id) ?? 0) + Number(linha.valor ?? 0))
  }
  if (total.size === 0) return []

  /**
   * `is('ultima_mensagem_em', null)` **não** entra aqui.
   *
   * Quem comprou e nunca teve mensagem registrada é quase sempre contato
   * importado ou lançado à mão, e não alguém que sumiu. Mandar régua de
   * retomada para ele é a primeira mensagem que a pessoa recebe da conta — e ela
   * chega dizendo "faz tempo que a gente não se fala".
   */
  const { data: calados, error: erroDosCalados } = await db()
    .from('contacts')
    .select('id, ultima_mensagem_em')
    .eq('client_id', clienteId)
    .in('id', [...total.keys()])
    .not('ultima_mensagem_em', 'is', null)
    .lt('ultima_mensagem_em', corte)
    .order('ultima_mensagem_em', { ascending: true })
    .limit(limite)

  if (erroDosCalados) throw new Error(`não deu para ler os calados: ${erroDosCalados.message}`)

  return ((calados ?? []) as { id: string; ultima_mensagem_em: string | null }[]).map((linha) => ({
    contatoId: linha.id,
    total: total.get(linha.id) ?? 0,
    ultimaConversaEm: linha.ultima_mensagem_em,
  }))
}
