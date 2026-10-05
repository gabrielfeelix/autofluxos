import 'server-only'
import {
  categoriasDoRamo,
  lerClassificacao,
  pedidoDeClassificacao,
  type ConversaParaClassificar,
} from '@/core/duvidas'
import { lerChave } from './repos/chave-de-ia'
import { nichoDaConta } from './repos/recursos'
import {
  conversasPendentes,
  falasDesde,
  gravarDuvidas,
  marcarLida,
  temasConhecidos,
  type ConversaPendente,
} from './repos/duvidas'

/**
 * A passada diária que transforma conversa em dúvida classificada.
 *
 * **Fora do caminho da resposta, de propósito.** Classificar na hora em que o
 * cliente escreve deixaria o atendimento mais lento por um relatório que
 * alguém lê uma vez por semana. Aqui roda de madrugada, sobre conversa que já
 * sossegou há meia hora.
 *
 * **Várias conversas por chamada.** O cron da Vercel é diário e a função tem
 * 60 s: uma chamada por conversa daria umas 40 por noite, e o histórico de 90
 * dias de uma conta movimentada levaria meses. Em levas de até seis, a mesma
 * passada lê centenas, e o histórico escoa em poucos dias.
 *
 * **Para na primeira recusa do provedor.** Cota estourada não melhora
 * insistindo, e o que não foi lido continua pendente para a próxima noite:
 * nada é marcado como lido sem ter sido classificado.
 */

const ENDERECO = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODELO = 'gemini-3.1-flash-lite'
const CONVERSAS_POR_LEVA = 6
const TEMPO_DA_CHAMADA_MS = 25_000

export type ResultadoDaPassada = { conversas: number; duvidas: number; parouPor?: string }

export async function passadaDasDuvidas(prazoMs = 50_000): Promise<ResultadoDaPassada> {
  const fim = Date.now() + prazoMs
  const pendentes = await conversasPendentes(300)
  const porConta = new Map<string, ConversaPendente[]>()
  for (const p of pendentes) porConta.set(p.clienteId, [...(porConta.get(p.clienteId) ?? []), p])

  let conversas = 0
  let duvidas = 0

  for (const [clienteId, daConta] of porConta) {
    if (Date.now() > fim) return { conversas, duvidas, parouPor: 'tempo' }

    const chave = (await lerChave(clienteId).catch(() => null)) ?? process.env.GEMINI_API_KEY ?? null
    if (!chave) return { conversas, duvidas, parouPor: 'sem chave de IA' }

    const categorias = categoriasDoRamo(await nichoDaConta(clienteId))
    const temas = await temasConhecidos(clienteId)

    for (let i = 0; i < daConta.length; i += CONVERSAS_POR_LEVA) {
      if (Date.now() > fim) return { conversas, duvidas, parouPor: 'tempo' }

      const leva: (ConversaParaClassificar & { ate: string })[] = []
      for (const pendente of daConta.slice(i, i + CONVERSAS_POR_LEVA)) {
        const falas = await falasDesde(pendente.contatoId, pendente.desde)
        // Só mídia sem texto: nada a classificar, mas a marca anda, senão a
        // mesma conversa volta toda noite.
        if (!falas.some((f) => f.quem === 'cliente')) {
          await marcarLida(pendente.contatoId, clienteId, falas.at(-1)?.em ?? new Date(Date.now() - 30 * 60_000).toISOString())
          continue
        }
        leva.push({ id: pendente.contatoId, falas, ate: falas.at(-1)!.em })
      }
      if (leva.length === 0) continue

      let bruto: string
      try {
        bruto = await pedirJson(chave, pedidoDeClassificacao(leva, categorias, temas))
      } catch (erro) {
        return { conversas, duvidas, parouPor: erro instanceof Error ? erro.message.slice(0, 200) : 'o provedor recusou' }
      }

      const achadas = lerClassificacao(bruto, leva, categorias)
      await gravarDuvidas(clienteId, achadas)
      for (const conversa of leva) await marcarLida(conversa.id, clienteId, conversa.ate)

      conversas += leva.length
      duvidas += achadas.length
    }
  }

  return { conversas, duvidas }
}

async function pedirJson(chave: string, texto: string): Promise<string> {
  const resposta = await fetch(`${ENDERECO}/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      // Temperatura no chão: classificar não é criar, e o mesmo assunto
      // precisa sair com o mesmo nome de tema de uma noite para a outra.
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(TEMPO_DA_CHAMADA_MS),
  })
  if (!resposta.ok) throw new Error(`${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
  const json = (await resposta.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
}
