import { z } from 'zod'
import { lerConversaAberta } from '@/server/conversa-aberta'
import { alcanceDaTela, espiando } from '@/server/espiar'
import { exigirCapacidade, recusou } from '@/server/permissoes'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { acharLead } from '@/server/repos/leads'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  clienteId: z.string().uuid(),
  contatoId: z.string().uuid(),
})

/**
 * A coluna da conversa aberta, para trocar de conversa sem refazer o Inbox.
 *
 * Ver `server/conversa-aberta.ts`. **Não marca como lida**: quem lê é quem
 * está olhando, e esta rota também é chamada para pré-carregar a conversa
 * quando o ponteiro passa pela linha. A marca vem do `POST` de
 * `inbox/conversa`, com a conversa montada e a aba visível.
 */
export async function GET(
  _req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/inbox/aberta/[contatoId]'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'conversa inválida' }, { status: 400 })
  const { clienteId, contatoId } = params.data

  // 404 e não 403, como nas rotas vizinhas: confirmar que a conta existe já é
  // contar de um cliente para quem não é dele.
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  // O alcance é o da tela: espiando, o do espiado, como na página.
  const [espiao, alcance, temAutomacao, sessao] = await Promise.all([
    espiando(clienteId),
    alcanceDaTela(clienteId),
    clienteTemAutomacao(clienteId),
    sessaoAtual(),
  ])
  const lead = await acharLead(clienteId, contatoId, alcance)
  if (!lead) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const dados = await lerConversaAberta({
    clienteId,
    lead,
    usuarioId: espiao ? espiao.alvo.id : (sessao?.usuario.id ?? null),
    temAutomacao,
  })

  return Response.json(dados, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
