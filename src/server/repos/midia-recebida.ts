import 'server-only'
import {
  caminhoDoArquivo,
  mimeLimpo,
  type ArquivoGuardado,
} from '@/core/midia-recebida'
import { db, ehIdInvalido } from '../db'

/**
 * A cópia nossa da mídia que o cliente mandou (`0055`).
 *
 * ---------------------------------------------------------------------------
 * Bucket privado, e o acesso nunca sai daqui
 * ---------------------------------------------------------------------------
 *
 * O `autofluxos-acervo` é público por decisão consciente da `0017` — a Meta
 * precisa baixar do `link` que mandamos —, e a mesma frase que decidiu isso
 * escreveu a fronteira: *"documento pessoal não entra, e isso é regra de uso,
 * não de banco."*
 *
 * Mídia recebida é exatamente o documento pessoal que aquele parágrafo exclui:
 * RG, comprovante de pagamento, exame. Por isso ela tem bucket próprio, sem
 * policy nenhuma de RLS — `anon` e `authenticated` não leem nada — e a única
 * porta é uma URL assinada de validade curta, criada aqui depois de o servidor
 * conferir quem está pedindo.
 */

export const BUCKET_DOS_RECEBIDOS = 'autofluxos-recebidos'

/**
 * Quanto tempo a URL assinada vale.
 *
 * Cinco minutos é o número da própria Meta para a URL de mídia dela, e a mesma
 * ordem de grandeza da Intercom (30 min) e da 360dialog (5 min) — ver
 * `docs/PLANO-MIDIA-RECEBIDA.md`. O que importa não é o número exato: é a
 * assinatura morrer antes de a URL virar link permanente em log, print ou
 * histórico de navegador.
 *
 * Longo o bastante para abrir um PDF e voltar; curto o bastante para não
 * sobreviver à conversa.
 */
export const VALIDADE_DA_ASSINATURA_S = 300

/**
 * Sobe o arquivo e grava o registro dele na mensagem.
 *
 * Devolve `null` quando não deu — e **não estoura**. Quem chama roda depois de a
 * mensagem já estar gravada: uma foto que não subiu deixa a conversa sem a
 * foto, e qualquer coisa pior que isso seria a foto derrubando a conversa.
 *
 * `upsert: true` porque o caminho é derivado do id da mensagem, que é único: se
 * a mesma mídia for tentada duas vezes, a segunda escreve por cima em vez de
 * falhar por conflito e deixar a coluna vazia com o arquivo no bucket.
 */
export async function guardarArquivo(
  clienteId: string,
  contatoId: string,
  mensagemId: string,
  arquivo: { bytes: Uint8Array; mime: string; nomeArquivo?: string },
  midia: ArquivoGuardado['midia'],
): Promise<ArquivoGuardado | null> {
  const mime = mimeLimpo(arquivo.mime)
  const caminho = caminhoDoArquivo(clienteId, contatoId, mensagemId, mime)

  const { error: erroDoUpload } = await db()
    .storage.from(BUCKET_DOS_RECEBIDOS)
    .upload(caminho, arquivo.bytes, { contentType: mime, upsert: true })

  if (erroDoUpload) {
    console.error('[midia] não deu para guardar o arquivo recebido', erroDoUpload.message)
    return null
  }

  const registro: ArquivoGuardado = {
    midia,
    caminho,
    mime,
    bytes: arquivo.bytes.byteLength,
    ...(arquivo.nomeArquivo ? { nomeArquivo: arquivo.nomeArquivo } : {}),
  }

  const { error } = await db().from('messages').update({ arquivo: registro }).eq('id', mensagemId)

  if (error) {
    /*
     * O arquivo subiu e a coluna não gravou: sobra um objeto que nenhuma tela
     * alcança e que o expurgo — que varre pela coluna — não vai achar. Apagar
     * aqui é o que impede o bucket de acumular dado pessoal órfão, que é o
     * pior dos mundos: invisível e presente.
     */
    console.error('[midia] arquivo subiu mas não gravou na mensagem', error.message)
    await db().storage.from(BUCKET_DOS_RECEBIDOS).remove([caminho])
    return null
  }

  return registro
}

/**
 * A URL assinada para a tela desenhar. `null` quando não deu.
 *
 * **Chamada na hora de desenhar, nunca gravada.** URL assinada em coluna é link
 * público com um passo a mais: viaja em log, em backup e em qualquer tela que
 * mostre o registro, e continua valendo até expirar.
 */
export async function urlAssinada(caminho: string): Promise<string | null> {
  const { data, error } = await db()
    .storage.from(BUCKET_DOS_RECEBIDOS)
    .createSignedUrl(caminho, VALIDADE_DA_ASSINATURA_S)

  if (error) {
    console.error('[midia] não deu para assinar a URL', error.message)
    return null
  }
  return data?.signedUrl ?? null
}

/**
 * Assina vários caminhos de uma vez — é o que a conversa precisa.
 *
 * Uma conversa com trinta fotos faria trinta chamadas se cada bolha assinasse a
 * sua. `createSignedUrls` (no plural) é um pedido só, e a ordem da resposta não
 * é garantida — por isso o resultado volta como mapa e não como lista.
 */
export async function urlsAssinadas(caminhos: string[]): Promise<Map<string, string>> {
  const porCaminho = new Map<string, string>()
  if (caminhos.length === 0) return porCaminho

  const { data, error } = await db()
    .storage.from(BUCKET_DOS_RECEBIDOS)
    .createSignedUrls(caminhos, VALIDADE_DA_ASSINATURA_S)

  if (error) {
    // Degrada, não derruba: a conversa abre sem as imagens, com o aviso da
    // bolha. Uma tela de trabalho não pode fechar porque o Storage piscou.
    console.error('[midia] não deu para assinar as URLs da conversa', error.message)
    return porCaminho
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) porCaminho.set(item.path, item.signedUrl)
  }
  return porCaminho
}

/**
 * Apaga os arquivos de um contato do bucket.
 *
 * **É o que fecha a política de retenção.** `contacts` cascateia as mensagens
 * (0003 e 0007), mas cascade de banco não alcança o Storage: sem esta função, o
 * expurgo de 12 meses apagaria a conversa e deixaria a foto do documento no
 * bucket para sempre — dado pessoal órfão, que é o pior resultado possível,
 * porque some da tela e continua existindo.
 *
 * Roda **antes** de apagar as linhas: é delas que sai a lista de caminhos.
 *
 * Falha em silêncio pelo mesmo motivo do resto do expurgo: um arquivo que
 * resistiu é um problema; uma limpeza que para no meio e deixa metade dos
 * contatos vencidos é outro, maior.
 */
export async function apagarArquivosDoContato(contatoId: string): Promise<number> {
  const { data, error } = await db()
    .from('messages')
    .select('arquivo')
    .eq('contact_id', contatoId)
    .not('arquivo', 'is', null)

  if (ehIdInvalido(error)) return 0
  if (error) {
    console.error('[midia] não deu para listar os arquivos do contato', error.message)
    return 0
  }

  const caminhos = (data as { arquivo: { caminho?: unknown } | null }[])
    .map((linha) => linha.arquivo?.caminho)
    .filter((caminho): caminho is string => typeof caminho === 'string' && caminho !== '')

  if (caminhos.length === 0) return 0

  const { error: erroAoApagar } = await db()
    .storage.from(BUCKET_DOS_RECEBIDOS)
    .remove(caminhos)

  if (erroAoApagar) {
    console.error('[midia] não deu para apagar os arquivos do contato', erroAoApagar.message)
    return 0
  }

  return caminhos.length
}
