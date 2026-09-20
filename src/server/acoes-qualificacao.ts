'use server'

import { revalidatePath } from 'next/cache'
import type { Condicao } from '@/core/qualificacao'
import { exigirCapacidade, recusou } from './permissoes'
import { avaliacoesDoContato, avaliarContato, criteriosDaConta, publicarCriterios } from './repos/qualificacoes'
import { sessaoAtual } from './sessao'

/**
 * As ações de qualificação: publicar critérios, e avaliar alguém.
 *
 * ---------------------------------------------------------------------------
 * Duas capacidades, e a diferença é a mesma dos campos
 * ---------------------------------------------------------------------------
 *
 * **Publicar critérios é `configurar_empresa`**: vale para a conta inteira, e
 * uma regra mal escrita passa a decidir quem o time atende. **Avaliar é
 * `atender`**, no escopo `proprios`: é o trabalho de quem está na conversa,
 * aplicando a regra que já foi publicada.
 *
 * É o que a 7.3 separa: "Gestor abre Configurar critérios... operador avalia a
 * versão publicada, sem alterar a regra da empresa."
 */

export async function acaoPublicarCriterios(
  clienteId: string,
  entrada: { objetivo: string; modo: 'todas' | 'qualquer'; condicoes: Condicao[] },
): Promise<{ ok: boolean; erro?: string; problemas?: string[]; versao?: number }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const publicou = await publicarCriterios(clienteId, entrada)
  if (!publicou.ok) {
    /*
     * Os problemas sobem inteiros, e não viram um "não deu" genérico: a RB-22
     * é sobre a pessoa **saber o que falta preencher** antes de publicar, e uma
     * mensagem vaga a faria tentar de novo às cegas.
     */
    return { ok: false, erro: publicou.problemas[0], problemas: publicou.problemas }
  }

  revalidatePath(`/clientes/${clienteId}/ajustes/campos`)
  return { ok: true, versao: publicou.versao }
}

export async function acaoListarCriterios(
  clienteId: string,
): Promise<{ ok: boolean; erro?: string; criterios?: Awaited<ReturnType<typeof criteriosDaConta>> }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  return { ok: true, criterios: await criteriosDaConta(clienteId) }
}

/**
 * Avalia um contato para um objetivo.
 *
 * **Reavaliar gera registro novo**, e é o que a 7.3 chama de "Reavaliar": a
 * avaliação anterior é o que a regra da época respondeu, e apagá-la é apagar a
 * explicação de uma decisão que alguém tomou.
 */
export async function acaoAvaliarQualificacao(
  clienteId: string,
  contatoId: string,
  objetivo: string,
): Promise<{ ok: boolean; erro?: string; resultado?: string; motivos?: string[]; faltam?: string[] }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  const quem = await sessaoAtual()
  const r = await avaliarContato(clienteId, contatoId, objetivo, quem?.usuario.id ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return {
    ok: true,
    resultado: r.avaliacao.resultado,
    motivos: r.avaliacao.motivos,
    faltam: r.avaliacao.faltam,
  }
}

/**
 * As avaliações do contato, uma por objetivo.
 *
 * Uma por objetivo, e não um selo único na ficha: a mesma pessoa pode atender ao
 * Plano Básico e não ao Premium, e rotulá-la com um resultado só é exatamente o
 * que a 7.3 proíbe ("não rotular a pessoa permanentemente como desqualificada
 * para todos os objetivos").
 */
export async function acaoLerQualificacoes(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string; avaliacoes?: Awaited<ReturnType<typeof avaliacoesDoContato>> }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  return { ok: true, avaliacoes: await avaliacoesDoContato(clienteId, contatoId) }
}
