import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * As consultas da primeira tela, e só dela.
 *
 * Moram aqui, e não em `metricas.ts`, porque respondem outra pergunta. Aquele
 * arquivo mede o mês: quantas conversas, quanto tempo, quem atendeu. Este
 * responde **quem está esperando agora**, que é trabalho, não medida, e que a
 * tela precisa ter antes de qualquer número (ver `docs/PLANO-HOMEPAGE.md` §1).
 *
 * O custo é a regra que rege o arquivo: a primeira tela abre a cada visita ao
 * cliente. Nada aqui traz lista inteira, a fila vem com `limit` e o resto vem
 * como contagem `head: true`, que não transfere linha nenhuma.
 */

/** Por que esta pessoa está na fila. A ordem do tipo é a ordem da urgência. */
export type MotivoDaFila = 'pediu-pessoa' | 'esperando-resposta'

export type ItemDaFila = {
  contatoId: string
  nome: string | null
  telefone: string
  motivo: MotivoDaFila
  /** O que o bot entendeu quando passou para uma pessoa. Só no handoff. */
  detalhe: string | null
  /** Desde quando espera, em ISO. É daqui que sai o "há 3 dias" da tela. */
  desde: string
}

export type FilaDoPainel = {
  itens: ItemDaFila[]
  /** Quantos esperam ao todo, o da lista é um recorte dos mais antigos. */
  total: number
  pedindoPessoa: number
}

/** Quantas linhas cabem na primeira tela sem ela virar o Inbox. */
export const ITENS_NA_FILA = 6

type LinhaDaFila = {
  contact_id: string
  nome: string | null
  wa_id: string
  handoff_motivo: string | null
  handoff_em: string | null
  ultima_em: string | null
}

/**
 * Quem precisa de uma pessoa, do mais antigo para o mais recente.
 *
 * **Duas leituras, e não uma com `or`.** As duas famílias têm critérios de
 * ordenação diferentes, quem pediu pessoa se ordena pelo instante do pedido,
 * quem espera resposta se ordena pela última mensagem, e uma consulta só
 * obrigaria a ordenar as duas pelo mesmo campo, o que enterraria um pedido de
 * ajuda de agora embaixo de uma conversa esquecida de março.
 *
 * O mais antigo primeiro, e não o mais recente: quem espera há três dias é
 * justamente quem some da tela quando a lista é cronológica ao contrário.
 */
export async function filaDoPainel(
  clienteId: string,
  limite = ITENS_NA_FILA,
): Promise<FilaDoPainel> {
  const campos = 'contact_id, nome, wa_id, handoff_motivo, handoff_em, ultima_em'

  const [pediram, devendo, quantosPediram, quantosDevendo] = await Promise.all([
    db()
      .from('leads')
      .select(campos)
      .eq('client_id', clienteId)
      .not('handoff_em', 'is', null)
      .order('handoff_em', { ascending: true })
      .limit(limite),

    db()
      .from('leads')
      .select(campos)
      .eq('client_id', clienteId)
      .eq('estado_efetivo', 'aberta')
      .eq('ultima_direcao', 'entrada')
      .is('handoff_em', null)
      .order('ultima_em', { ascending: true })
      .limit(limite),

    db()
      .from('leads')
      .select('contact_id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .not('handoff_em', 'is', null),

    db()
      .from('leads')
      .select('contact_id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('estado_efetivo', 'aberta')
      .eq('ultima_direcao', 'entrada')
      .is('handoff_em', null),
  ])

  // Id torto na URL é 404 da tela, não erro do painel: devolver fila vazia
  // deixa o resto da página abrir.
  const erro = pediram.error ?? devendo.error ?? quantosPediram.error ?? quantosDevendo.error
  if (ehIdInvalido(erro)) return { itens: [], total: 0, pedindoPessoa: 0 }
  if (erro) throw new Error(`não deu para montar a fila do painel: ${erro.message}`)

  const itens: ItemDaFila[] = []

  for (const linha of (pediram.data ?? []) as LinhaDaFila[]) {
    if (!linha.handoff_em) continue
    itens.push({
      contatoId: linha.contact_id,
      nome: linha.nome,
      telefone: linha.wa_id,
      motivo: 'pediu-pessoa',
      detalhe: linha.handoff_motivo,
      desde: linha.handoff_em,
    })
  }

  for (const linha of (devendo.data ?? []) as LinhaDaFila[]) {
    if (!linha.ultima_em) continue
    itens.push({
      contatoId: linha.contact_id,
      nome: linha.nome,
      telefone: linha.wa_id,
      motivo: 'esperando-resposta',
      detalhe: null,
      desde: linha.ultima_em,
    })
  }

  // Quem pediu pessoa vem inteiro na frente, mesmo que espere há menos tempo:
  // é o único caso em que o bot já disse que não dá conta.
  return {
    itens: itens.slice(0, limite),
    total: (quantosPediram.count ?? 0) + (quantosDevendo.count ?? 0),
    pedindoPessoa: quantosPediram.count ?? 0,
  }
}

export type Fechamentos = {
  ganhos: number
  perdidos: number
  /** Soma do que foi ganho, em reais. `null` quando nenhum ganho tinha valor. */
  valor: number | null
  dias: number
}

/**
 * O que fechou na janela, ganho, perdido e quanto (0058).
 *
 * **Só o que fechou.** A soma do funil aberto, o tal "pipeline", é o número mais
 * enganoso do CRM: ele cresce sozinho quando ninguém arquiva o que já morreu, e
 * uma conta desleixada acaba exibindo o maior número da tela. Ver
 * `docs/PLANO-HOMEPAGE.md` §6.
 *
 * `valor` é `null`, e não zero, quando nenhum cartão ganho tinha valor
 * preenchido: "R$ 0" diria que se vendeu de graça, quando o que houve foi
 * ninguém anotar o preço.
 */
export async function fechamentos(
  clienteId: string,
  dias = 30,
  agora = new Date(),
): Promise<Fechamentos> {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('situacao, valor')
    .eq('client_id', clienteId)
    .in('situacao', ['ganha', 'perdida'])
    .gte('fechado_em', desde)

  const vazio = { ganhos: 0, perdidos: 0, valor: null, dias }
  if (ehIdInvalido(error)) return vazio
  if (error) throw new Error(`não deu para contar os fechamentos: ${error.message}`)

  let ganhos = 0
  let perdidos = 0
  let valor: number | null = null

  for (const linha of (data ?? []) as { situacao: string; valor: number | string | null }[]) {
    if (linha.situacao === 'ganha') {
      ganhos += 1
      // `numeric` chega como texto no PostgREST, somar sem converter concatena.
      const bruto = linha.valor === null ? null : Number(linha.valor)
      if (bruto !== null && Number.isFinite(bruto)) valor = (valor ?? 0) + bruto
    } else {
      perdidos += 1
    }
  }

  return { ganhos, perdidos, valor, dias }
}
