import 'server-only'
import { recusaDoPlano } from './recursos-do-plano'
import { ehArquivoGuardado } from '@/core/midia-recebida'
import { db } from './db'
import { lerChave } from './repos/chave-de-ia'
import { baixarArquivo } from './repos/midia-recebida'

/**
 * O que o áudio diz, em texto.
 *
 * ---------------------------------------------------------------------------
 * Depende de IA, e não havia como não depender
 * ---------------------------------------------------------------------------
 *
 * O dono perguntou se dava para transcrever sem IA. Não dá: transcrição **é**
 * um modelo de fala, e a alternativa seria contratar outro provedor para fazer
 * a mesma coisa. A chave que já existe (`GEMINI_API_KEY`) transcreve áudio
 * nativamente, então o custo desta funcionalidade é uma chamada, não um
 * contrato novo.
 *
 * ---------------------------------------------------------------------------
 * A linha de privacidade, que é a mesma do `ia/modelo.ts` e vale mais aqui
 * ---------------------------------------------------------------------------
 *
 * Aquele arquivo escreve a regra: enquanto a chave é a da 4YU no free tier, o
 * Google **treina modelo com o que passa por ela, inclusive com revisão
 * humana**. Isso era aceitável para demonstração, com dado nosso.
 *
 * Aqui é a voz do cliente do cliente. É dado pessoal de terceiro, e é mais
 * sensível do que texto, voz identifica pessoa. Por isso:
 *
 * - **nunca automático.** Só transcreve quando alguém clica, e o clique é o
 *   consentimento de quem atende, que sabe o que está mandando para fora;
 * - o resultado é **guardado**, para uma conversa aberta dez vezes não virar
 *   dez chamadas e dez envios do mesmo áudio;
 * - **usa a chave do cliente quando a conta tem uma** (`repos/chave-de-ia.ts`),
 *   e aí o áudio para de ir para treino. Sem chave própria, cai na nossa, que é
 *   o caminho da demonstração.
 *
 * Isto está dito na tela, ao lado do botão, e não só aqui.
 */

const ENDERECO = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * O modelo, e por que não é o mesmo objeto `Modelo` do resto.
 *
 * `ia/gemini.ts` monta um cliente de **conversa**: histórico, ferramentas,
 * reserva, cota, `system_instruction`. Transcrever não tem nada disso, é um
 * pedido só, sem estado, com um arquivo dentro. Passar por lá exigiria abrir o
 * contrato de `Modelo` para áudio e carregar toda a máquina de conversa numa
 * chamada que não conversa.
 */
const MODELO = 'gemini-flash-latest'

/**
 * A reserva, e por que ela não é zelo.
 *
 * **Medido**: a primeira tentativa de transcrever um áudio real de produção
 * voltou `503 UNAVAILABLE, "This model is currently experiencing high demand"`.
 * A segunda, no mesmo áudio, transcreveu inteiro. Congestionamento do free tier
 * é o modo normal de falhar aqui, não a exceção.
 *
 * Sem reserva, quem clicou lê "não deu para transcrever" num áudio que o modelo
 * transcreveria perfeitamente trinta segundos depois, e a conclusão de quem
 * usa é que o recurso não funciona.
 *
 * É o mesmo desenho de `ia/gemini.ts`, que já mantém uma reserva pelo mesmo
 * motivo, e `gemini-3.6-flash` é a mesma que ele escolheu.
 */
const MODELO_RESERVA = 'gemini-3.6-flash'

/**
 * Os códigos que valem uma segunda tentativa noutro modelo.
 *
 * `429` é cota, `503` é fila. Os dois dizem "este modelo agora não", e nenhum
 * diz "este áudio não presta", que é a diferença entre trocar de modelo e
 * insistir num pedido que vai falhar igual. `400` e `404` ficam de fora de
 * propósito: repetir não muda o resultado e só gasta a cota.
 */
const CONGESTIONADO = new Set([429, 503])

/**
 * Trinta segundos.
 *
 * Mais folgado que a conversa (15 s) porque aqui **alguém está olhando e
 * esperando de propósito**: clicou em transcrever e sabe que vai demorar. O que
 * não pode é passar do teto da Server Action e morrer sem dizer nada.
 */
const TIMEOUT_MS = 30_000

/**
 * O teto do áudio que vale a pena mandar.
 *
 * O bucket já limita em 16 MB. Isto aqui é outro limite, e mais baixo: base64
 * infla o arquivo em um terço, e o corpo do pedido viaja inteiro. 8 MB de áudio
 * são uns vinte minutos de fala, muito além de qualquer recado de WhatsApp, e
 * o suficiente para o erro ser "esse áudio é grande demais" em vez de um
 * timeout sem explicação.
 */
const TETO_DO_AUDIO = 8 * 1024 * 1024

const INSTRUCAO =
  'Transcreva este áudio em português do Brasil. Devolva apenas o que foi dito, ' +
  'sem comentários seus, sem aspas e sem descrever sons. Se não houver fala ' +
  'inteligível, responda exatamente: (sem fala audível)'

export type ResultadoDaTranscricao =
  | { ok: true; texto: string }
  | { ok: false; erro: string }

/**
 * Transcreve e guarda. Devolve o que já estava guardado, se houver.
 *
 * O `clienteId` entra na consulta e não é decoração: é ele que impede um id de
 * mensagem de outra conta ser transcrito por quem tem acesso a esta. Quem chama
 * já conferiu o acesso ao cliente; isto aqui é a segunda tranca, no lugar onde
 * o dado é lido.
 */
export async function transcreverAudio(
  clienteId: string,
  contatoId: string,
  mensagemId: string,
): Promise<ResultadoDaTranscricao> {
  const { data, error } = await db()
    .from('messages')
    .select('id, arquivo, transcricao, contacts!inner(id, client_id)')
    .eq('id', mensagemId)
    .eq('contact_id', contatoId)
    .eq('contacts.client_id', clienteId)
    .maybeSingle()

  if (error) return { ok: false, erro: 'não deu para achar esta mensagem' }
  if (!data) return { ok: false, erro: 'esta mensagem não é desta conversa' }

  const linha = data as { transcricao: string | null; arquivo: unknown }

  // Já transcrita: devolve o que está guardado. Transcrever de novo custaria
  // uma chamada para produzir o mesmo texto.
  if (linha.transcricao) return { ok: true, texto: linha.transcricao }

  // Transcrição antiga continua legível (acima); nova só no plano que inclui.
  const recusa = await recusaDoPlano(clienteId, 'transcricao')
  if (recusa) return { ok: false, erro: recusa }

  if (!ehArquivoGuardado(linha.arquivo) || linha.arquivo.midia !== 'audio') {
    return { ok: false, erro: 'não há áudio guardado nesta mensagem' }
  }
  if (linha.arquivo.bytes > TETO_DO_AUDIO) {
    return { ok: false, erro: 'este áudio é grande demais para transcrever' }
  }

  /*
   * A do cliente primeiro, a nossa como rede. Mesma precedência de
   * `ia/modelo.ts`, e pelo mesmo motivo: quem tem chave paga não manda a voz de
   * ninguém para treino. Falha ao ler o cofre cai na nossa, com log.
   */
  let chave: string | null = null
  try {
    chave = await lerChave(clienteId)
  } catch (erro) {
    console.error('[transcricao] não deu para ler a chave do cliente:', erro)
  }
  chave ??= process.env.GEMINI_API_KEY ?? null
  if (!chave) return { ok: false, erro: 'falta GEMINI_API_KEY no ambiente' }

  const arquivo = await baixarArquivo(linha.arquivo.caminho)
  if (!arquivo) return { ok: false, erro: 'o arquivo não está mais no acervo' }

  let texto: string
  try {
    texto = await comReserva(chave, arquivo.bytes, linha.arquivo.mime)
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro)
    console.error('[transcricao] falhou', mensagemId, motivo)
    /*
     * A palavra muda quando os dois modelos estavam ocupados.
     *
     * "Não deu" faz procurar defeito no áudio ou no painel. "Está
     * congestionado, tente de novo" diz a verdade e diz o que fazer, e o que
     * fazer funciona, porque a fila do Google anda.
     */
    return {
      ok: false,
      erro: motivo.startsWith('ocupado')
        ? 'o modelo está congestionado agora; tente de novo em alguns segundos'
        : 'não deu para transcrever agora; tente de novo',
    }
  }

  if (texto.trim() === '') return { ok: false, erro: 'o modelo não devolveu nada' }

  /*
   * Guardar é o ponto da funcionalidade, e um erro ao guardar **não** invalida
   * a transcrição: quem clicou já pode ler. O que se perde é a economia da
   * próxima abertura, e isso aparece no log em vez de na cara da pessoa.
   */
  const { error: erroAoGuardar } = await db()
    .from('messages')
    .update({ transcricao: texto })
    .eq('id', mensagemId)

  if (erroAoGuardar) {
    console.error('[transcricao] não deu para guardar', mensagemId, erroAoGuardar.message)
  }

  return { ok: true, texto }
}

/**
 * Tenta no modelo bom e, se ele estiver ocupado, na reserva.
 *
 * Uma tentativa em cada, e não um laço: a pessoa está olhando a tela esperando.
 * Três tentativas com espera entre elas transformariam um clique numa espera de
 * um minuto e meio para, provavelmente, o mesmo resultado.
 */
async function comReserva(chave: string, bytes: Uint8Array, mime: string): Promise<string> {
  try {
    return await pedirAoGemini(chave, bytes, mime, MODELO)
  } catch (erro) {
    if (!(erro instanceof Error) || !erro.message.startsWith('ocupado')) throw erro
    console.warn('[transcricao] o modelo principal estava ocupado; indo para a reserva')
    return pedirAoGemini(chave, bytes, mime, MODELO_RESERVA)
  }
}

async function pedirAoGemini(
  chave: string,
  bytes: Uint8Array,
  mime: string,
  modelo: string,
): Promise<string> {
  const corpo = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: INSTRUCAO },
          {
            inline_data: {
              mime_type: mime,
              data: Buffer.from(bytes).toString('base64'),
            },
          },
        ],
      },
    ],
    /*
     * Temperatura no chão.
     *
     * Transcrição não é criação: qualquer liberdade aqui vira palavra inventada
     * onde o áudio estava sujo, e uma palavra inventada numa transcrição é
     * pior do que uma lacuna, porque parece o que a pessoa disse.
     */
    generationConfig: { temperature: 0 },
  }

  const corte = AbortSignal.timeout(TIMEOUT_MS)
  const resposta = await fetch(`${ENDERECO}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify(corpo),
    signal: corte,
  })

  if (!resposta.ok) {
    // O texto do Google é específico e é ele que resolve, chave sem cota, modelo
    // desativado, áudio recusado. Só o status não diz nada a quem for ler o log.
    const detalhe = `${resposta.status}: ${(await resposta.text()).slice(0, 300)}`
    // O prefixo é o que `comReserva` e a tela leem para separar "agora não" de
    // "nunca". Fica no começo da mensagem para não depender de procurar no meio.
    throw new Error(CONGESTIONADO.has(resposta.status) ? `ocupado, ${detalhe}` : detalhe)
  }

  const json = (await resposta.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }

  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((parte) => parte.text ?? '')
    .join('')
    .trim()
}
