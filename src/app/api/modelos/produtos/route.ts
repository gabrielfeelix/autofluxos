import { strToU8, zipSync } from 'fflate'
import { csvDoModelo, xlsxDoModelo } from '@/core/modelo-de-produtos'

/**
 * O modelo de planilha de produtos, em `?formato=csv` ou `?formato=xlsx`.
 *
 * Não é dado de conta nenhuma (três linhas de exemplo), então não pergunta de
 * quem é. O `proxy` já exige sessão para chegar aqui.
 */
export function GET(req: Request) {
  const formato = new URL(req.url).searchParams.get('formato')

  if (formato === 'xlsx') {
    const arquivos = Object.fromEntries(
      Object.entries(xlsxDoModelo()).map(([caminho, texto]) => [caminho, strToU8(texto)]),
    )
    return new Response(zipSync(arquivos), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="modelo-produtos.xlsx"',
      },
    })
  }

  return new Response(csvDoModelo(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-produtos.csv"',
    },
  })
}
