import { z } from 'zod'
import { pulsoDaConta } from '@/server/repos/leads'
import { conferirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * "Chegou alguma coisa?" — a fonte mais barata do Inbox.
 *
 * Devolve **só** o carimbo da mensagem mais recente da conta. Quem chama
 * compara com o que já tinha e, se mudou, pede um `router.refresh()`. Essa
 * divisão é o ponto: perguntar é de graça e acontece a cada poucos segundos;
 * recarregar a tela custa e só acontece quando há motivo.
 *
 * Um `refresh` cego no mesmo intervalo faria o servidor remontar a lista de
 * conversas, o histórico e a barra lateral toda vez — para, quase sempre,
 * desenhar exatamente a mesma coisa.
 *
 * Não vai telefone, texto, nome nem id: uma data não conta nada sobre ninguém,
 * e é tudo de que a tela precisa para saber que está desatualizada. A mesma
 * postura da rota de alertas, ao lado.
 */
export async function GET(
  _req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/inbox/pulso'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  // 404 e não 403, como na rota de alertas: confirmar que a conta existe já é
  // contar de um cliente para quem não é dele.
  if (!(await conferirAcessoAoCliente(params.data.clienteId))) {
    return Response.json({ erro: 'não encontrado' }, { status: 404 })
  }

  const pulso = await pulsoDaConta(params.data.clienteId)
  return Response.json(
    { pulso },
    {
      headers: {
        // Um pulso guardado em cache é um Inbox que não atualiza — que é
        // exatamente o defeito que esta rota existe para consertar.
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  )
}
