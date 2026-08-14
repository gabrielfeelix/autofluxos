import 'server-only'

/**
 * Avisa uma pessoa que alguma coisa quebrou.
 *
 * **Por que webhook e não Sentry.** O plano grátis do Sentry existe, mas é mais
 * um cadastro, mais um SDK no bundle e mais um lugar para manter. O que resolve
 * aqui é um POST num webhook de Discord vindo do ambiente. Se um dia o volume
 * justificar, Sentry entra por cima disto sem reescrever nada.
 *
 * **Onde ela é chamada, e só aí:** falha no `after()` do webhook, falha de
 * entrega na Cloud API e erro ao ler credencial do cofre. Alerta que toca para
 * tudo é alerta que ninguém lê.
 *
 * **Ela nunca estoura e nunca segura a conversa.** Os três lugares que a chamam
 * já estão num caminho de falha: uma exceção daqui viraria a segunda falha em
 * cima da primeira, e a pessoa do outro lado do WhatsApp ficaria sem resposta
 * por causa do aviso, não por causa do problema. Por isso todo erro morre aqui
 * dentro e o tempo é limitado.
 *
 * A URL vem do ambiente e é nossa — não passa pela conferência de endereço do
 * nó de API, que existe para URL que alguém digita no editor.
 */

/** Sem isto no ambiente, `alertar()` é no-op. Dev e CI não disparam nada. */
const VARIAVEL = 'ALERTA_WEBHOOK_URL'

/** Curto de propósito: o orçamento da função é para atender, não para avisar. */
const TEMPO_LIMITE_MS = 3_000

/** O Discord recusa acima de 2000 caracteres — cortar aqui evita perder o aviso inteiro. */
const LIMITE_DO_TEXTO = 1_800

export type ContextoDoAlerta = Record<string, string | number | null | undefined>

export async function alertar(
  titulo: string,
  detalhe: unknown,
  contexto: ContextoDoAlerta = {},
): Promise<void> {
  const url = process.env[VARIAVEL]
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: montarTexto(titulo, detalhe, contexto) }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch (erro) {
    // O alerta falhou. Não existe a quem avisar disso a não ser o log — e
    // insistir aqui só transformaria uma falha em duas.
    console.error('[alerta] não deu para avisar', erro)
  }
}

function montarTexto(titulo: string, detalhe: unknown, contexto: ContextoDoAlerta): string {
  const onde = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local'
  const linhas = [`🔴 **AutoFluxos (${onde}) — ${titulo}**`, descrever(detalhe)]

  for (const [chave, valor] of Object.entries(contexto)) {
    if (valor === null || valor === undefined || valor === '') continue
    linhas.push(`${chave}: ${valor}`)
  }

  return linhas.join('\n').slice(0, LIMITE_DO_TEXTO)
}

/**
 * O que chega aqui é o que o `catch` pegou, e `catch` pega qualquer coisa.
 * `String(erro)` num objeto daria `[object Object]` — justamente no campo que
 * era para explicar o que houve.
 */
function descrever(detalhe: unknown): string {
  if (detalhe instanceof Error) return detalhe.stack ?? `${detalhe.name}: ${detalhe.message}`
  if (typeof detalhe === 'string') return detalhe
  try {
    return JSON.stringify(detalhe)
  } catch {
    return String(detalhe)
  }
}
