import 'server-only'
import { db } from './db'
import { clientesSumidos } from './repos/relacionamento'
import { anotar } from './repos/eventos'

/**
 * A régua que corre atrás de quem sumiu (0070).
 *
 * ---------------------------------------------------------------------------
 * Por que esta passada é só do cron, sem carona
 * ---------------------------------------------------------------------------
 *
 * `enviarAgendadas` e `passada-de-transmissoes` pegam carona no webhook e no
 * pulso do Inbox porque a unidade delas é o **minuto**: uma campanha marcada
 * para as 15h conferida de madrugada não é campanha.
 *
 * Aqui a unidade é o **dia**. "Sumido há 60 dias" não vira urgente às 14h32, e
 * rodar isto atrás do webhook gastaria a resposta que a Meta espera em 200 para
 * descobrir, todas as vezes, que ninguém completou mais um dia de silêncio. O
 * cron diário é exatamente a resolução certa, e é o mais barato.
 *
 * ---------------------------------------------------------------------------
 * A trava que impede o pior erro possível
 * ---------------------------------------------------------------------------
 *
 * Quem está sumido hoje continua sumido amanhã. Sem `por_sumico_em`, esta função
 * reinscreveria a mesma pessoa **todo dia** — e o resultado seria uma mensagem
 * diária no WhatsApp de um cliente antigo, dizendo "faz tempo que não se falam".
 * É assim que se perde um número, não um lead.
 *
 * A janela de silêncio (`DIAS_ENTRE_TENTATIVAS`) é generosa de propósito: se a
 * régua não funcionou em quatro meses, insistir mais cedo não muda o resultado e
 * só aumenta a chance de bloqueio.
 */

/** Quanto tempo até a mesma pessoa poder entrar de novo na mesma régua. */
export const DIAS_ENTRE_TENTATIVAS = 120

/** Quantas contas uma passada toca, para uma conta grande não travar as outras. */
export const CONTAS_POR_PASSADA = 25

export type ResumoDaRetomada = {
  contasOlhadas: number
  inscritos: number
  jaTentados: number
}

type LinhaDaRegua = {
  id: string
  client_id: string
  dias_sem_conversa: number | null
}

/**
 * Uma passada por todas as réguas de retomada ativas.
 *
 * Erro em uma conta não derruba as outras: é a mesma decisão de
 * `disparar-transmissao`, onde o `try` é por linha e não em volta do laço. Uma
 * conta com fluxo apagado não pode calar a régua de todo mundo.
 */
export async function passadaDeRetomada(): Promise<ResumoDaRetomada> {
  const resumo: ResumoDaRetomada = { contasOlhadas: 0, inscritos: 0, jaTentados: 0 }

  const { data, error } = await db()
    .from('sequencias')
    .select('id, client_id, dias_sem_conversa')
    .eq('evento', 'cliente_sumido')
    .eq('ativa', true)
    .limit(CONTAS_POR_PASSADA)

  if (error) throw new Error(`não deu para ler as réguas de retomada: ${error.message}`)

  for (const regua of (data ?? []) as LinhaDaRegua[]) {
    if (!regua.dias_sem_conversa) continue
    resumo.contasOlhadas += 1

    try {
      const sumidos = await clientesSumidos(regua.client_id, regua.dias_sem_conversa)
      if (sumidos.length === 0) continue

      const recentes = await quemJaFoiChamado(
        regua.id,
        sumidos.map((s) => s.contatoId),
      )

      for (const sumido of sumidos) {
        if (recentes.has(sumido.contatoId)) {
          resumo.jaTentados += 1
          continue
        }

        const entrou = await inscreverPorSumico(regua.client_id, regua.id, sumido.contatoId)
        if (!entrou) continue

        resumo.inscritos += 1
        await anotar(
          regua.client_id,
          sumido.contatoId,
          'automacao',
          { o_que: 'entrou na régua de retomada', dias: String(regua.dias_sem_conversa) },
          'automação',
        )
      }
    } catch (erro) {
      console.error('[retomada] conta', regua.client_id, erro)
    }
  }

  return resumo
}

/** Quem desta lista já entrou nesta régua dentro da janela de silêncio. */
async function quemJaFoiChamado(sequenciaId: string, contatos: string[]): Promise<Set<string>> {
  const desde = new Date(Date.now() - DIAS_ENTRE_TENTATIVAS * 86_400_000).toISOString()

  const { data } = await db()
    .from('sequencia_inscricoes')
    .select('contact_id')
    .eq('sequencia_id', sequenciaId)
    .in('contact_id', contatos)
    .gte('por_sumico_em', desde)

  return new Set(((data ?? []) as { contact_id: string }[]).map((l) => l.contact_id))
}

/**
 * Inscreve marcando **por que** entrou.
 *
 * `23505` é o índice único da 0031 dizendo "já está dentro", e isso não é falha:
 * a pessoa pode ter entrado nesta mesma régua por outro caminho, e uma segunda
 * inscrição ativa mandaria a sequência duas vezes.
 */
async function inscreverPorSumico(
  clienteId: string,
  sequenciaId: string,
  contatoId: string,
): Promise<boolean> {
  const { error } = await db().from('sequencia_inscricoes').insert({
    client_id: clienteId,
    sequencia_id: sequenciaId,
    contact_id: contatoId,
    por_sumico_em: new Date().toISOString(),
  })

  if (error?.code === '23505') return false
  if (error) {
    console.error('[retomada] não deu para inscrever:', error.message)
    return false
  }
  return true
}
