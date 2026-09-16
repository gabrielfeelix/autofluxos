/**
 * Onde todo erro de servidor vira linha em `public.alertas`.
 *
 * ---------------------------------------------------------------------------
 * O buraco que isto fecha
 * ---------------------------------------------------------------------------
 *
 * Quando um Server Component quebra, o React em produção **não manda a
 * mensagem para o navegador**. Ele manda o erro 441, que é sempre o mesmo texto
 * genérico ("An error occurred in the Server Components render"), mais um
 * `digest`: um número que identifica aquele erro específico.
 *
 * Nossa tela de erro mostra esse número e pede "mande este código para quem for
 * consertar". Só que o número não levava a lugar nenhum. O digest aparecia num
 * `console.error` que vive poucas horas no log da Vercel, e depois some. Quem
 * recebia o código não tinha o que fazer com ele.
 *
 * Foi exatamente o que aconteceu em 16/set/2026: um cliente mandou o código
 * `1522888730` de um erro nas Configurações, e não havia onde procurar. Pedir
 * trabalho ao usuário em troca de nada é pior do que não pedir nada, porque
 * ainda dá a impressão de que alguém vai resolver.
 *
 * `onRequestError` é o gancho do Next que roda em **todo** erro de servidor:
 * Server Component, Server Action, Route Handler e middleware. Com ele, o
 * mesmo número que a pessoa lê na tela é o número que está gravado na tabela.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui e não num `try/catch` em cada página
 * ---------------------------------------------------------------------------
 *
 * Porque erro que a gente lembrou de capturar não é o erro que derruba o
 * produto. O gancho pega os que ninguém previu, que são os únicos que importam
 * depois que o código está no ar.
 *
 * ---------------------------------------------------------------------------
 * Ele nunca pode estourar
 * ---------------------------------------------------------------------------
 *
 * Um erro aqui dentro seria a segunda falha em cima da primeira, e o Next
 * chama isto **enquanto** já está tratando a primeira. Por isso tudo mora num
 * `try/catch` que engole, e `alertar` já é escrito para nunca estourar.
 */

import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  erro,
  requisicao,
  contexto,
) => {
  /*
   * O gancho roda nos dois runtimes, e `alertar` fala com o Supabase pelo
   * cliente de servidor, que é Node. No edge (o middleware) a gravação não
   * acontece, e o `console.error` do próprio Next continua valendo lá.
   *
   * O import é dinâmico pelo mesmo motivo: `server-only` no topo deste arquivo
   * quebraria o bundle do edge antes de qualquer verificação de runtime.
   */
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { alertar } = await import('@/server/alertar')

    /*
     * **O `digest` é o campo que faz tudo isto valer.** É o número que a pessoa
     * está lendo na tela neste exato momento, e é por ele que se procura em
     * `/admin/alertas`. Sem ele, esta linha seria só mais um erro sem dono.
     */
    const digest =
      erro && typeof erro === 'object' && 'digest' in erro ? String(erro.digest) : null

    await alertar('erro de servidor', erro, {
      digest,
      // Onde a pessoa estava. `routePath` é o molde (`/clientes/[clienteId]/
      // ajustes/etiquetas`) e `path` é o endereço real que ela abriu.
      rota: contexto.routePath ?? null,
      endereco: requisicao.path ?? null,
      metodo: requisicao.method ?? null,
      // `render` ou `action`, e se foi no servidor ou na revalidação. É o que
      // separa "a tela não montou" de "o botão não funcionou".
      tipo: `${contexto.routerKind}/${contexto.routeType}`,
      origem: contexto.renderSource ?? null,
    })
  } catch {
    // Engolido de propósito. Ver o cabeçalho: o Next já está tratando a falha
    // original, e uma exceção daqui a substituiria por uma pior.
  }
}
