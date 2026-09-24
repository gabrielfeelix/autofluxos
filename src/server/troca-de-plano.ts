import 'server-only'
import { previsaoDaTroca, type PrevisaoDaTroca } from '@/core/troca-de-plano'
import { planoVigente } from './repos/planos'
import { contratoDaConta, usoDaOrganizacao } from './repos/plano'

export type { PrevisaoDaTroca }

/**
 * O impacto de levar esta organização para `para`, medido agora.
 *
 * As duas ações (pedido da organização e troca pela administração) chamam isto
 * de novo na hora de confirmar: o que o modal mostrou pode ter mudado entre
 * abrir e clicar, e o bloqueio vale pelo estado de agora.
 */
export async function preverTroca(clienteId: string, para: string): Promise<PrevisaoDaTroca> {
  const [contrato, uso] = await Promise.all([contratoDaConta(clienteId), usoDaOrganizacao(clienteId)])
  const [de, destino] = await Promise.all([planoVigente(contrato.plano), planoVigente(para)])
  return previsaoDaTroca(de, destino, uso, contrato.precoContratado)
}

/** O motivo de recusar a confirmação, ou nulo se ela pode seguir. */
export function recusaDaTroca(previsao: PrevisaoDaTroca, ciente: boolean): string | null {
  if (previsao.impacto.bloqueios.length > 0) return previsao.impacto.bloqueios[0]!
  if (previsao.impacto.exigeCiencia && !ciente) return 'confirme que entendeu o que sai do plano'
  return null
}

/** O resumo que vai para a auditoria junto da troca ou do pedido. */
export function resumoDaTroca(previsao: PrevisaoDaTroca) {
  return {
    sentido: previsao.impacto.sentido,
    perdeEmUso: previsao.impacto.perde.filter((p) => p.emUso).map((p) => `${p.rotulo}: ${p.emUso}`),
    avisos: previsao.impacto.avisos,
  }
}
