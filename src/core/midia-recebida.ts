import { TIPOS_DE_MIDIA, type TipoDeMidia } from './flow/schema'

/**
 * As regras de guardar o arquivo que o cliente mandou.
 *
 * ---------------------------------------------------------------------------
 * Por que guardar é obrigatório, e não um recurso a mais
 * ---------------------------------------------------------------------------
 *
 * O `id` de mídia que chega no webhook **vive 7 dias**, a URL de download vive
 * 5 minutos, e os termos da Cloud API (4.5) dizem em letra: *"Meta does not
 * offer archiving service or backup features, and you will be the sole person
 * responsible for creating backups."*
 *
 * Passados os 7 dias o arquivo não existe em lugar nenhum — nem pagando, nem
 * pedindo. Antes disto, quem atendia via `(áudio, imagem ou documento)` no
 * lugar do comprovante. Ver `docs/PLANO-MIDIA-RECEBIDA.md`.
 *
 * Mora em `core/` pelo mesmo motivo de `core/reacoes.ts`: é regra sobre dados,
 * sem banco e sem rede, e regra assim tem que dar para testar sem subir nada.
 */

/**
 * O teto por arquivo, e por que ele é 16 MB e não 100 MB.
 *
 * A Meta aceita **documento de até 100 MB** na entrada — dez vezes o que ela
 * aceita de vídeo. Um único PDF desses ocuparia 10% do plano gratuito inteiro,
 * que é compartilhado com a Verandi (ver `docs/BANCO-COMPARTILHADO.md`).
 *
 * 16 MB é o teto que a própria Meta usa para vídeo e áudio, então o número não
 * é inventado aqui: é o maior arquivo que ela mesma deixa **sair**. O que
 * passar disso fica registrado como recebido e sem cópia — e a bolha diz isso,
 * em vez de mostrar um arquivo quebrado.
 */
export const TETO_DO_ARQUIVO = 16 * 1024 * 1024

/**
 * De `type` da Cloud API para o vocabulário que a bolha já sabe desenhar.
 *
 * **Figurinha vira imagem**, e não um tipo novo: ela é um WebP, o navegador
 * desenha igual, e inventar um quinto tipo obrigaria a mexer em `TIPOS_DE_MIDIA`
 * — que é o vocabulário do **motor de fluxo**, onde figurinha não significa
 * nada. O desenho diferente, se um dia fizer falta, é CSS.
 *
 * `location`, `contacts`, `reaction`, `text` e os outros não aparecem aqui de
 * propósito: eles não têm arquivo, e `null` é o que faz quem chama não pedir
 * download de algo que não existe.
 */
const TIPO_DA_META: Record<string, TipoDeMidia> = {
  image: 'imagem',
  sticker: 'imagem',
  video: 'video',
  audio: 'audio',
  document: 'documento',
}

export function midiaDoTipo(tipo: string | null | undefined): TipoDeMidia | null {
  if (!tipo) return null
  return TIPO_DA_META[tipo] ?? null
}

/**
 * A extensão do arquivo, a partir do mime que a Meta declarou.
 *
 * Serve para o nome no bucket, e **para o navegador saber o que fazer** quando
 * alguém abre a URL assinada. Sem extensão, um PDF baixa como arquivo sem tipo
 * e o sistema operacional pergunta com o que abrir — que é o tipo de atrito que
 * faz alguém achar que o anexo está quebrado.
 *
 * O mime vem com parâmetros às vezes (`audio/ogg; codecs=opus`), então o corte
 * no `;` não é zelo: sem ele a extensão viraria `ogg; codecs=opus`.
 */
const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export function extensaoDoMime(mime: string | null | undefined): string {
  if (!mime) return 'bin'
  const limpo = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  return EXTENSAO[limpo] ?? 'bin'
}

/** O mime sem os parâmetros — é o que o bucket valida em `allowed_mime_types`. */
export function mimeLimpo(mime: string | null | undefined): string {
  return mime?.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream'
}

/**
 * Onde o arquivo mora no bucket: `<clienteId>/<contatoId>/<mensagemId>.<ext>`.
 *
 * O caminho começa pelo cliente **para o expurgo e a exclusão de conta serem
 * um prefixo**, e não uma varredura. É o mesmo desenho do acervo e do bucket de
 * logos, e é o que faz "apagar tudo deste cliente" ser uma operação e não um
 * laço.
 *
 * O id da mensagem no nome, e não o id da mídia na Meta: o nosso id é único e
 * nosso, e o da Meta some em 7 dias junto com o arquivo dela.
 */
export function caminhoDoArquivo(
  clienteId: string,
  contatoId: string,
  mensagemId: string,
  mime: string | null | undefined,
): string {
  return `${clienteId}/${contatoId}/${mensagemId}.${extensaoDoMime(mime)}`
}

/** O que fica gravado na coluna `messages.arquivo`. */
export type ArquivoGuardado = {
  midia: TipoDeMidia
  /** Caminho no bucket privado. **Nunca uma URL** — ver o comentário abaixo. */
  caminho: string
  mime: string
  bytes: number
  nomeArquivo?: string
}

/**
 * **Nunca gravamos URL, só caminho.**
 *
 * URL assinada guardada em coluna é link público com um passo a mais: ela viaja
 * em log, em backup e em qualquer tela que mostre o registro, e continua valendo
 * até expirar. O caminho não abre nada sozinho — a assinatura é feita na hora de
 * desenhar a bolha, para quem já provou que pode ver aquela conversa.
 *
 * É o padrão de quem publica número: a Intercom assina por 30 minutos, a
 * 360dialog por 5. Ver `docs/PLANO-MIDIA-RECEBIDA.md`.
 */
export function ehArquivoGuardado(valor: unknown): valor is ArquivoGuardado {
  if (!valor || typeof valor !== 'object') return false
  const a = valor as Record<string, unknown>
  return (
    typeof a.midia === 'string' &&
    (TIPOS_DE_MIDIA as readonly string[]).includes(a.midia) &&
    typeof a.caminho === 'string' &&
    a.caminho !== '' &&
    typeof a.mime === 'string' &&
    typeof a.bytes === 'number'
  )
}
