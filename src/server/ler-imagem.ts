import 'server-only'
import { ehArquivoGuardado } from '@/core/midia-recebida'
import { db } from './db'
import { lerChave } from './repos/chave-de-ia'
import { baixarArquivo } from './repos/midia-recebida'
import { comReserva } from './transcrever-audio'

/**
 * O que a foto mostra, em texto, para a IA da conversa responder.
 *
 * Caso que trouxe isto: cliente da PCYES mandou o print do carrinho do site e
 * escreveu "gostaria desses". O bot só lia texto e passou a conversa calado
 * para a equipe, quando a IA, que consulta a loja, podia ter mandado os cards
 * na hora. O Gemini lê imagem do mesmo jeito que transcreve áudio
 * (`transcrever-audio.ts`): o arquivo vai junto do pedido, em `inline_data`.
 *
 * **Só roda na conversa com a IA**, e por isso pode ser automático, ao
 * contrário da transcrição, que espera o clique. A pessoa já está conversando
 * com um modelo, contratado pela conta, e a mensagem dela já vai para ele; a
 * foto é parte da mesma pergunta. A chave segue a mesma precedência: a da conta
 * quando ela tem uma, a nossa como rede.
 *
 * A leitura fica guardada em `messages.transcricao`, a mesma coluna do áudio:
 * é ela que entra no histórico que a IA recebe, e é ela que a equipe lê se
 * abrir a conversa depois para entender o que o bot respondeu.
 */

/**
 * Doze segundos, e não os trinta da transcrição.
 *
 * Lá alguém clicou e está esperando de propósito. Aqui a pessoa do outro lado
 * está vendo "digitando", e a IA ainda vai responder depois disto. Se a leitura
 * não vem nesse tempo, vale mais pedir para ela escrever do que deixá-la
 * esperando meio minuto.
 */
const TIMEOUT_MS = 12_000

/** Foto de WhatsApp tem algumas centenas de KB; isto é folga, não meta. */
const TETO_DA_IMAGEM = 6 * 1024 * 1024

/** O que o modelo devolve quando não há nada aproveitável na imagem. */
const ILEGIVEL = '(ilegivel)'

const INSTRUCAO =
  'Um cliente mandou esta imagem numa conversa de atendimento de uma loja. ' +
  'Descreva em português do Brasil, em poucas linhas, o que interessa para atendê-lo. ' +
  'Se houver produtos (print de carrinho, de página da loja, foto de embalagem, etiqueta), ' +
  'liste cada um numa linha com o nome completo e o modelo como aparecem, a quantidade e o preço ' +
  'quando estiverem visíveis. Se for print de carrinho ou de site, diga isso na primeira linha. ' +
  'Copie textos importantes exatamente como estão escritos. Não invente o que não dá para ler. ' +
  `Se a imagem não tiver nada legível ou útil, responda exatamente: ${ILEGIVEL}`

/**
 * Lê a imagem desta mensagem. `null` quando não deu, por qualquer motivo: quem
 * chama pede para a pessoa escrever, e o motivo vai para o log.
 *
 * `mensagemId` é a linha em `messages`, já gravada e com o arquivo guardado
 * (`guardarMidiaRecebida` roda antes, logo depois do dedupe).
 */
export async function lerImagemRecebida(
  clienteId: string,
  contatoId: string,
  mensagemId: string,
): Promise<string | null> {
  const { data, error } = await db()
    .from('messages')
    .select('arquivo, transcricao, contacts!inner(id, client_id)')
    .eq('id', mensagemId)
    .eq('contact_id', contatoId)
    .eq('contacts.client_id', clienteId)
    .maybeSingle()

  if (error || !data) {
    console.warn('[ler-imagem] mensagem não encontrada', mensagemId, error?.message ?? '')
    return null
  }
  const linha = data as { arquivo: unknown; transcricao: string | null }
  if (linha.transcricao) return linha.transcricao

  if (!ehArquivoGuardado(linha.arquivo) || linha.arquivo.midia !== 'imagem') {
    console.warn('[ler-imagem] sem imagem guardada', mensagemId)
    return null
  }
  if (linha.arquivo.bytes > TETO_DA_IMAGEM) {
    console.warn('[ler-imagem] imagem grande demais', mensagemId, linha.arquivo.bytes)
    return null
  }

  let chave: string | null = null
  try {
    chave = await lerChave(clienteId)
  } catch (erro) {
    console.error('[ler-imagem] não deu para ler a chave do cliente:', erro)
  }
  chave ??= process.env.GEMINI_API_KEY ?? null
  if (!chave) return null

  const arquivo = await baixarArquivo(linha.arquivo.caminho)
  if (!arquivo) return null

  let texto: string
  try {
    texto = (await comReserva(chave, arquivo.bytes, linha.arquivo.mime, INSTRUCAO, TIMEOUT_MS)).trim()
  } catch (erro) {
    console.error('[ler-imagem] falhou', mensagemId, erro instanceof Error ? erro.message : String(erro))
    return null
  }
  if (texto === '' || texto.includes(ILEGIVEL)) return null

  const { error: erroAoGuardar } = await db()
    .from('messages')
    .update({ transcricao: texto })
    .eq('id', mensagemId)
  if (erroAoGuardar) {
    console.error('[ler-imagem] não deu para guardar', mensagemId, erroAoGuardar.message)
  }
  return texto
}

/**
 * Como a leitura entra na conversa que a IA lê.
 *
 * O colchete diz ao modelo que aquilo não foi escrito pela pessoa: sem ele, a
 * descrição "Print de carrinho do site" pareceria uma frase dela.
 */
export function comoTextoDaImagem(lida: string, legenda?: string | null): string {
  const escrita = (legenda ?? '').trim()
  return `[A pessoa mandou uma imagem. O que dá para ver nela:\n${lida.trim()}]${escrita ? `\n${escrita}` : ''}`
}
