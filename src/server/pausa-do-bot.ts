import 'server-only'
import { chaveDaRetomada, dadosDaRetomadaSchema } from '@/core/tarefas'
import { db } from './db'
import { anotar } from './repos/eventos'
import { alterarAutomacaoDoContato } from './repos/conversas'
import { agendar, cancelarPorChave } from './repos/tarefas'

/**
 * Pausar o bot num contato **por um tempo** (06/nov/2026, pedido do Eduardo).
 *
 * A pausa de sempre (`automacao_ativa = false`) cala o bot até alguém religar,
 * e ninguém religa: a conversa humana acaba, a pessoa curte um story semanas
 * depois e nada responde. O prazo resolve as duas pontas. Enquanto corre,
 * nenhuma automação dispara para o contato (story, comentário, gatilho,
 * sequência, porque todos já respeitam a pausa); quando acaba, o bot volta
 * sozinho.
 *
 * **Sem coluna nova**: o fim da pausa é o `quando` da tarefa pendente com a
 * chave do contato. Religar à mão cancela a tarefa pela mesma chave.
 */
export async function agendarRetomada(clienteId: string, contatoId: string, minutos: number | null): Promise<void> {
  const chave = chaveDaRetomada(contatoId)
  if (minutos === null) {
    await cancelarPorChave(chave)
    return
  }
  await agendar({
    clienteId,
    tipo: 'retomar_automacao',
    quando: new Date(Date.now() + minutos * 60_000),
    dados: { contatoId },
    chave,
  })
}

export async function cancelarRetomada(contatoId: string): Promise<void> {
  await cancelarPorChave(chaveDaRetomada(contatoId))
}

/** Até quando o bot está pausado neste contato, ou `null` sem prazo marcado. */
export async function fimDaPausa(contatoId: string): Promise<string | null> {
  const { data } = await db()
    .from('tarefas')
    .select('quando')
    .eq('chave', chaveDaRetomada(contatoId))
    .eq('estado', 'pendente')
    .order('quando', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.quando as string | undefined) ?? null
}

/**
 * O prazo acabou: religa o bot no contato, **calado**.
 *
 * Não responde a última mensagem, ao contrário do "religar" pelo Inbox: quem
 * pausou estava conversando, e o bot acordar respondendo uma frase de meia
 * hora atrás no meio do assunto é exatamente o atropelo que a pausa evitou.
 * Com atendimento ainda aberto, não religa: quem está atendendo decide.
 */
export async function rodarRetomadaDaAutomacao(clienteId: string, dados: unknown): Promise<'feita' | 'ignorada'> {
  const analise = dadosDaRetomadaSchema.safeParse(dados)
  if (!analise.success) return 'ignorada'
  const { contatoId } = analise.data
  const r = await alterarAutomacaoDoContato(clienteId, contatoId, true)
  if (!r.ok) return 'ignorada'
  await anotar(clienteId, contatoId, 'automacao', { o_que: 'bot religado no fim da pausa', religou: true })
  return 'feita'
}
