import { z } from 'zod'
import { montarCsv, nomeDoArquivo } from '@/server/csv'
import { acharCliente } from '@/server/repos/clientes'
import {
  ETIQUETAS_DE_LEAD,
  paginarLeads,
  type EtiquetaDeLead,
  type Lead,
} from '@/server/repos/leads'
import { conferirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * Quantos leads são lidos por ida ao banco enquanto o arquivo é montado.
 *
 * Maior que a página da tela porque aqui ninguém está esperando uma lista
 * aparecer, e menor do que "tudo" porque uma exportação não pode ser o motivo
 * de a função estourar memória.
 */
const LOTE = 500

/** Teto do arquivo. Acima disso o produto precisa de exportação em fila. */
const TETO_DE_LINHAS = 20_000

/**
 * Baixa os leads do cliente como planilha.
 *
 * **O filtro da tela vem junto de propósito.** Quem filtrou por "foi para
 * pessoa" e clicou em exportar espera o arquivo daquilo que está vendo; entregar
 * a base inteira seria uma surpresa cara, ainda mais numa exportação que sai da
 * ferramenta e vira anexo de e-mail.
 *
 * O `proxy` já recusou quem não tem sessão nenhuma, e o cliente do endereço é o
 * único usado nas consultas. Falta a pergunta que o login trouxe: **esta pessoa
 * é desta conta?** Planilha de contato é o dado mais sensível que sai daqui, e
 * ela sai como anexo de e-mail.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/leads/csv'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  if (!(await conferirAcessoAoCliente(params.data.clienteId))) {
    return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })
  }

  const cliente = await acharCliente(params.data.clienteId)
  if (!cliente) return Response.json({ erro: 'cliente não encontrado' }, { status: 404 })

  const parametros = new URL(req.url).searchParams
  const busca = parametros.get('busca') ?? ''
  const etiqueta =
    ETIQUETAS_DE_LEAD.find((valor) => valor === parametros.get('etiqueta')) ?? null

  const leads = await lerTudo(cliente.id, busca, etiqueta)
  const colunas = colunasDosCampos(leads)

  const arquivo = montarCsv(
    ['Nome', 'Telefone', 'Situação', 'Última mensagem', 'Primeiro contato', ...colunas],
    leads.map((lead) => [
      lead.nome ?? '',
      lead.waId,
      lead.aguardando ? `aguardando pessoa — ${lead.aguardando.motivo}` : 'com o bot',
      lead.ultimaEm ?? '',
      lead.criadoEm,
      ...colunas.map((coluna) => lead.campos[coluna] ?? ''),
    ]),
  )

  return new Response(arquivo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeDoArquivo('leads', cliente.nome, hoje())}"`,
      // Planilha de lead é dado pessoal: nada de ficar em cache de proxy.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

async function lerTudo(
  clienteId: string,
  busca: string,
  etiqueta: EtiquetaDeLead | null,
): Promise<Lead[]> {
  const tudo: Lead[] = []

  for (let pagina = 1; tudo.length < TETO_DE_LINHAS; pagina++) {
    const lote = await paginarLeads(clienteId, { busca, etiqueta, pagina, porPagina: LOTE })
    tudo.push(...lote.leads)
    if (pagina >= lote.paginas || lote.leads.length === 0) break
  }

  return tudo.slice(0, TETO_DE_LINHAS)
}

/**
 * As colunas dinâmicas, na ordem em que aparecem.
 *
 * Cada fluxo coleta campos diferentes, então a planilha não tem cabeçalho fixo:
 * ele é a união do que os leads exportados carregam.
 */
function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}
