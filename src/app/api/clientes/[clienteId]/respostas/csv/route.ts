import { z } from 'zod'
import { montarCsv, nomeDoArquivo } from '@/server/csv'
import { acharCliente } from '@/server/repos/clientes'
import { exigirCapacidade, recusou } from '@/server/permissoes'
import {
  colunasDe,
  lerRespostasParaArquivo,
  type DesfechoDaResposta,
} from '@/server/repos/respostas'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

const ROTULO_DO_DESFECHO: Record<DesfechoDaResposta, string> = {
  bot: 'terminou com o bot',
  pessoa: 'foi para uma pessoa',
  aberta: 'não terminou',
}

/**
 * Baixa o histórico de respostas como planilha.
 *
 * **O filtro da tela vem junto**, pela mesma razão registrada no CSV de leads:
 * quem filtrou por uma automação e clicou em exportar espera o arquivo daquilo
 * que está vendo, e entregar a conta inteira seria uma surpresa cara num
 * arquivo que vira anexo de e-mail.
 *
 * **Exportar é capacidade própria** (RB-40): alcançar a empresa não basta. Este
 * arquivo leva nome, telefone e tudo que a pessoa respondeu para fora da
 * ferramenta, então ele passa pela mesma porta do CSV de contatos, e a recusa é
 * 404 pelo mesmo motivo: confirmar que o endereço existe já é informação.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/respostas/csv'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  const acesso = await exigirCapacidade(params.data.clienteId, 'exportar', 'todos')
  if (recusou(acesso)) {
    return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })
  }

  const cliente = await acharCliente(params.data.clienteId)
  if (!cliente) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const parametros = new URL(req.url).searchParams
  const fluxoId = parametros.get('fluxo') || null
  const busca = parametros.get('busca') ?? ''
  const bruto = parametros.get('desfecho')
  const desfecho = (['bot', 'pessoa', 'aberta'] as const).find((valor) => valor === bruto) ?? null

  const respostas = await lerRespostasParaArquivo(cliente.id, { fluxoId, busca, desfecho })
  const colunas = colunasDe(respostas)

  const arquivo = montarCsv(
    ['Pessoa', 'Telefone', 'Automação', 'Quando', 'Desfecho', ...colunas],
    respostas.map((resposta) => [
      resposta.nome ?? '',
      resposta.waId,
      resposta.fluxoNome,
      resposta.iniciadaEm,
      ROTULO_DO_DESFECHO[resposta.desfecho],
      ...colunas.map((coluna) => resposta.vars[coluna] ?? ''),
    ]),
  )

  return new Response(arquivo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeDoArquivo('respostas', cliente.nome, hoje())}"`,
      // Resposta de conversa é dado pessoal: nada de cache de proxy.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}
