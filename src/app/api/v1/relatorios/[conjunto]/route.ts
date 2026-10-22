import { CONJUNTOS, ehConjunto, lerConsulta, paraCsv } from '@/core/api/relatorios'
import { autenticarChave, erroDaApi } from '@/server/api/autenticar'
import { lerConjunto } from '@/server/api/relatorios'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/v1/relatorios/{contatos|mensagens|vendas|cobrancas}`: o conector
 * de BI. `formato=csv|json`, `desde` e `ate` (AAAA-MM-DD), `pagina` e `limite`.
 *
 * **A chave pode vir em `?chave=`**, só aqui. O Power BI manda cabeçalho, mas
 * o Looker Studio e o `IMPORTDATA` do Google Sheets não mandam, e sem isso o
 * conector não serviria a quem mais pede. O custo é a chave aparecer no
 * endereço (histórico, log de proxy), e a contenção é o escopo: só
 * `relatorios:ler` abre esta rota, uma chave com ele não escreve nada, e a
 * documentação manda criar uma só para isso. As mensagens saem sem texto.
 *
 * A próxima página vem em `proxima_pagina` (JSON) e no cabeçalho
 * `X-Proxima-Pagina` (CSV, que não tem onde dizer).
 */
export async function GET(request: Request, { params }: { params: Promise<{ conjunto: string }> }) {
  const url = new URL(request.url)
  const naUrl = url.searchParams.get('chave')
  const pedido =
    naUrl && !request.headers.get('authorization')
      ? new Request(request.url, { headers: { authorization: `Bearer ${naUrl}` } })
      : request
  const acesso = await autenticarChave(pedido, 'relatorios:ler')
  if (acesso instanceof Response) return acesso

  const { conjunto } = await params
  if (!ehConjunto(conjunto)) {
    return erroDaApi(404, 'conjunto_nao_encontrado', `Use um destes: ${Object.keys(CONJUNTOS).join(', ')}.`)
  }
  const lida = lerConsulta(url.searchParams)
  if (!lida.ok) return erroDaApi(400, 'consulta_invalida', lida.erro)
  const { consulta } = lida

  let pagina
  try {
    pagina = await lerConjunto(conjunto, acesso.clienteId, consulta)
  } catch (erro) {
    console.error(`[api] relatório ${conjunto} falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não foi possível montar o relatório agora. Tente de novo.')
  }

  const proxima = pagina.temMais ? consulta.pagina + 1 : null
  const cabecalhos: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (proxima) cabecalhos['X-Proxima-Pagina'] = String(proxima)

  if (consulta.formato === 'csv') {
    return new Response(paraCsv(CONJUNTOS[conjunto].colunas, pagina.linhas), {
      headers: {
        ...cabecalhos,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `inline; filename="${conjunto}.csv"`,
      },
    })
  }
  return Response.json(
    { conjunto, pagina: consulta.pagina, proxima_pagina: proxima, linhas: pagina.linhas.length, dados: pagina.linhas },
    { headers: cabecalhos },
  )
}
