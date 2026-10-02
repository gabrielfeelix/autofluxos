import { z } from 'zod'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo, type CodigoDeErro } from '@/server/api/autenticar'
import { acharContatoPeloTelefone } from '@/server/repos/contato-por-telefone'
import { acharFluxo } from '@/server/repos/fluxos'
import { abrirFluxoParaContato, type AberturaPorNossaConta } from '@/server/receber-mensagem'

/**
 * `POST /api/v1/fluxos/{fluxoId}/disparar`: começa uma automação para um
 * contato que já existe.
 *
 * O mesmo caminho do pós-atendimento e da sequência (`abrirFluxoParaContato`):
 * confere a janela de 24h, a automação pausada e o atendimento humano antes de
 * falar. Fora da janela o WhatsApp só aceita template, e template é a fase 2.
 */

/** O fluxo roda na hora, e um bloco de IA ou de API no caminho pode demorar. */
export const maxDuration = 60

const corpoSchema = z.object({ telefone: z.string().trim().min(1, 'obrigatório').max(40) })

const RECUSAS: Record<Exclude<AberturaPorNossaConta, 'aberto' | 'sem_fluxo'>, { codigo: CodigoDeErro; mensagem: string }> = {
  janela_fechada: {
    codigo: 'janela_fechada',
    mensagem: 'Passaram mais de 24h desde a última mensagem do contato. Fora da janela, o WhatsApp só aceita modelo aprovado.',
  },
  sem_contexto: {
    codigo: 'sem_conversa',
    mensagem: 'Este contato ainda não conversou com nenhum número desta conta.',
  },
  automacao_pausada: {
    codigo: 'automacao_pausada',
    mensagem: 'A automação está desligada para este contato.',
  },
  atendimento_humano: {
    codigo: 'atendimento_humano',
    mensagem: 'Alguém da equipe está atendendo este contato agora.',
  },
  ocupado: {
    codigo: 'ocupado',
    mensagem: 'Chegou uma mensagem deste contato neste instante. Tente de novo em alguns segundos.',
  },
}

export async function POST(request: Request, { params }: { params: Promise<{ fluxoId: string }> }) {
  const acesso = await autenticarChave(request, 'fluxos:disparar')
  if (acesso instanceof Response) return acesso

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  const { fluxoId } = await params
  const naoAchou = erroDaApi(404, 'fluxo_nao_encontrado', 'Nenhuma automação publicada e ligada com este id nesta conta.')
  if (!z.guid().safeParse(fluxoId).success) return naoAchou

  try {
    const fluxo = await acharFluxo(fluxoId)
    if (!fluxo || fluxo.clienteId !== acesso.clienteId || !fluxo.ativo || !fluxo.versaoPublicadaId) return naoAchou

    const contatoId = await acharContatoPeloTelefone(acesso.clienteId, analise.data.telefone)
    if (!contatoId) return erroDaApi(404, 'contato_nao_encontrado', 'Nenhum contato com este telefone nesta conta.')

    const resultado = await abrirFluxoParaContato(acesso.clienteId, contatoId, fluxoId)
    if (resultado === 'aberto') return Response.json({ status: 'aberto', contato_id: contatoId }, { status: 202 })
    if (resultado === 'sem_fluxo') return naoAchou

    const recusa = RECUSAS[resultado]
    return erroDaApi(409, recusa.codigo, recusa.mensagem)
  } catch (erro) {
    console.error(`[api] disparar fluxo falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para disparar a automação agora. Tente de novo.')
  }
}
