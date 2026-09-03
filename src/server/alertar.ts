import 'server-only'
import { ambienteAtual, gravarAlerta } from './repos/alertas'

/**
 * Avisa uma pessoa que alguma coisa quebrou.
 *
 * **Grava sempre; o webhook é o extra.** A primeira versão disto era só o POST
 * num webhook de Discord vindo do ambiente — e `ALERTA_WEBHOOK_URL` nunca foi
 * preenchida em lugar nenhum. Durante meses existiu um mecanismo de aviso
 * completo, chamado nos seis lugares certos, que não avisava ninguém: tudo
 * caía num `console.error` que vive algumas horas no log da Vercel e some.
 *
 * O erro de projeto foi pendurar a única cópia do aviso numa credencial que só
 * uma pessoa consegue criar. Agora o alerta vira linha em `public.alertas`
 * (tabela da 0039, tela em `/admin/alertas`), e o webhook toca por cima quando
 * a variável existir. Ninguém precisa configurar nada para parar de perder
 * falha.
 *
 * **Por que não Sentry.** O plano grátis existe, mas é mais um cadastro, mais
 * um SDK no bundle e mais um lugar para manter — e continuaria sendo uma
 * credencial a preencher. Uma tabela de seis colunas funciona no primeiro
 * deploy. Se o volume justificar, Sentry entra por cima disto sem reescrever
 * nada.
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

/**
 * O webhook opcional. Sem isto no ambiente, nada é postado — mas o alerta
 * continua sendo gravado. Antes, a ausência desta variável era o suficiente
 * para o aviso inteiro virar no-op.
 */
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
  const descrito = descrever(detalhe)

  // Sempre no log, e primeiro. Se o banco for justamente o que está fora, é o
  // único lugar que sobra — e este é o caminho em que isso é mais provável.
  console.error(`[alerta] ${titulo}`, descrito, contexto)

  await gravarAlerta({ titulo, detalhe: descrito, contexto })

  const url = process.env[VARIAVEL]
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: montarTexto(titulo, descrito, contexto) }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch (erro) {
    // O webhook falhou, e o alerta já está gravado — que é justamente o ponto
    // de gravar antes. Insistir aqui só transformaria uma falha em duas.
    console.error('[alerta] não deu para avisar pelo webhook', erro)
  }
}

function montarTexto(titulo: string, detalhe: string, contexto: ContextoDoAlerta): string {
  const onde = ambienteAtual()
  const linhas = [`🔴 **AutoFluxos (${onde}) — ${titulo}**`, detalhe]

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
