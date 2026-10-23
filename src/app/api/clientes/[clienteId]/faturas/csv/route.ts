import { z } from 'zod'
import { diaDeHoje } from '@/core/contrato-do-plano'
import { ehFiltroDeFaturas, filtrarFaturas } from '@/core/mensalidade-da-4yu'
import { montarCsv, nomeDoArquivo } from '@/server/csv'
import { exigirCapacidade, recusou } from '@/server/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { faturasDaConta } from '@/server/repos/faturas-da-conta'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

const SITUACAO = { pendente: 'Em aberto', vencida: 'Vencida', paga: 'Paga', estornada: 'Estornada', cancelada: 'Cancelada' } as const

/**
 * As faturas da mensalidade como planilha, com o filtro da tela: quem filtrou
 * por "Pagas em 2026" espera o arquivo daquilo, que é o que o contador pede.
 *
 * Mesma porta da tela de Faturas (`configurar_empresa`), e recusa em 404 como
 * os outros CSV: confirmar que o endereço existe já é informação.
 */
export async function GET(req: Request, contexto: { params: Promise<{ clienteId: string }> }) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  const acesso = await exigirCapacidade(params.data.clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })
  const cliente = await acharCliente(params.data.clienteId)
  if (!cliente) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const filtro = ehFiltroDeFaturas(Object.fromEntries(new URL(req.url).searchParams))
  const faturas = filtrarFaturas(await faturasDaConta(cliente.id, 500), filtro)

  const arquivo = montarCsv(
    ['Vencimento', 'Descrição', 'Valor (R$)', 'Situação', 'Paga em', 'Recibo', 'Nota fiscal'],
    faturas.map((f) => [
      f.vencimento,
      f.tipo === 'excedente' ? 'Conversas acima da faixa' : 'Mensalidade',
      // Vírgula decimal: o Excel em português lê como número.
      (f.valorCentavos / 100).toFixed(2).replace('.', ','),
      SITUACAO[f.estado],
      f.pagaEm ? diaDeHoje(new Date(f.pagaEm)) : '',
      f.link ?? '',
      f.notaFiscalUrl ?? '',
    ]),
  )

  return new Response(arquivo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeDoArquivo('faturas', cliente.nome, diaDeHoje(new Date()))}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
