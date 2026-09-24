import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Os pedidos de troca de plano, lidos da auditoria, sem tabela nova.
 *
 * O pedido já nasce gravado como `pediu_troca_de_plano` (`acoes-plano.ts`), e
 * a resposta da administração também vira ato: `atendeu_pedido_de_plano` ou
 * `recusou_pedido_de_plano`, com o id do pedido em `detalhes.pedido`. A
 * situação de cada pedido sai do encontro dos dois. A auditoria é append-only
 * (0021/0042), então o histórico não se perde nem se reescreve, que é tudo o
 * que uma tabela de pedidos daria a mais hoje.
 */

export type SituacaoDoPedido = 'aberto' | 'atendido' | 'recusado'

export type PedidoDePlano = {
  id: string
  quando: string
  organizacaoId: string
  organizacaoNome: string
  quemPediu: string
  de: string
  para: string
  situacao: SituacaoDoPedido
  respondidoEm: string | null
  respondidoPor: string | null
}

type Linha = {
  id: string
  quando: string
  acao: string
  autor_email: string
  conta_id: string | null
  conta_nome: string
  detalhes: Record<string, unknown> | null
}

export const ACOES_DE_PEDIDO = ['pediu_troca_de_plano', 'atendeu_pedido_de_plano', 'recusou_pedido_de_plano'] as const

export async function pedidosDePlano(opcoes: { organizacaoId?: string } = {}): Promise<PedidoDePlano[]> {
  let consulta = db()
    .from('af_auditoria')
    .select('id, quando, acao, autor_email, conta_id, conta_nome, detalhes')
    .in('acao', [...ACOES_DE_PEDIDO])
    .order('quando', { ascending: false })
    .limit(500)
  if (opcoes.organizacaoId) consulta = consulta.eq('conta_id', opcoes.organizacaoId)

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os pedidos de plano: ${error.message}`)

  const linhas = data as Linha[]
  const respostas = new Map<string, Linha>()
  for (const linha of linhas) {
    const pedido = linha.detalhes?.pedido
    if (linha.acao !== 'pediu_troca_de_plano' && typeof pedido === 'string' && !respostas.has(pedido)) {
      respostas.set(pedido, linha)
    }
  }

  // O nome da organização é o de hoje, e não o do dia do pedido: quem atende
  // procura pelo nome que ela tem agora.
  const ids = [...new Set(linhas.map((linha) => linha.conta_id).filter((id): id is string => !!id))]
  const nomes = new Map<string, string>()
  if (ids.length > 0) {
    const { data: organizacoes } = await db().from('clients').select('id, nome').in('id', ids)
    for (const organizacao of (organizacoes ?? []) as { id: string; nome: string }[]) nomes.set(organizacao.id, organizacao.nome)
  }

  return linhas
    .filter((linha) => linha.acao === 'pediu_troca_de_plano' && linha.conta_id)
    .map((linha) => {
      const resposta = respostas.get(linha.id)
      return {
        id: linha.id,
        quando: linha.quando,
        organizacaoId: linha.conta_id!,
        organizacaoNome: nomes.get(linha.conta_id!) ?? linha.conta_nome ?? 'Organização apagada',
        quemPediu: linha.autor_email,
        de: String(linha.detalhes?.de ?? ''),
        para: String(linha.detalhes?.para ?? ''),
        situacao: !resposta ? 'aberto' : resposta.acao === 'atendeu_pedido_de_plano' ? 'atendido' : 'recusado',
        respondidoEm: resposta?.quando ?? null,
        respondidoPor: resposta?.autor_email ?? null,
      } satisfies PedidoDePlano
    })
}

export async function acharPedido(id: string): Promise<PedidoDePlano | null> {
  const todos = await pedidosDePlano()
  return todos.find((pedido) => pedido.id === id) ?? null
}
