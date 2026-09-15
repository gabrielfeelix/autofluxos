/**
 * Gravar áudio na caixa de resposta: a parte que não depende do navegador.
 *
 * ---------------------------------------------------------------------------
 * Por que existe um módulo só para escolher um formato
 * ---------------------------------------------------------------------------
 *
 * Porque escolher errado é o modo de falha desta funcionalidade, e ele falha
 * **longe** de onde a escolha foi feita: o arquivo sobe, a Server Action grava
 * a mensagem, e só então a Meta recusa — com o erro aparecendo na conversa de
 * um cliente. Uma regra de três linhas escondida dentro de um componente de
 * interface é uma regra que ninguém testa.
 *
 * Aqui ela é função pura: recebe "este navegador suporta X?" e devolve o que
 * gravar. O teste roda sem `MediaRecorder`, sem microfone e sem DOM.
 *
 * ---------------------------------------------------------------------------
 * O que a Meta aceita, e o que o navegador produz
 * ---------------------------------------------------------------------------
 *
 * A tabela da Cloud API aceita AAC, AMR, MP3, `audio/mp4` (.m4a) e `audio/ogg`
 * — este último com a letra miúda que decide tudo: *"OPUS codecs only; base
 * audio/ogg not supported; mono input only"*.
 *
 * **`audio/webm` não está na lista**, e é o padrão histórico do Chrome. Isso é
 * resolvido pedindo MP4 ou OGG — mas **pedir o contêiner não basta**, e é o que
 * a primeira versão deste arquivo errou.
 *
 * Contêiner e codec são coisas separadas. `audio/mp4` pedido sem codec deixa a
 * escolha com o navegador, e o Chrome entrega **Opus dentro de MP4** — que a
 * Meta não toca, porque para ela `audio/mp4` significa AAC e Opus só vale em
 * OGG. O arquivo gravado em 15/set foi aberto byte a byte e confirmou: `mp4a`
 * ausente, `dOps` presente.
 *
 * Daí as duas metades deste módulo:
 *
 * 1. **`escolherFormato`** pede sempre com `;codecs=` explícito.
 * 2. **`codecServeParaAMeta`** confere o que o gravador devolveu, porque pedir
 *    não garante receber — e o modo de falha é silencioso: o Storage aceita, a
 *    Cloud API responde 200, e nada chega no celular.
 *
 * Levantamento com as URLs da Meta em `docs/PESQUISA-VOZ-E-CHAMADA.md`.
 */

export type FormatoDeGravacao = {
  /**
   * O que se pede ao `MediaRecorder` — pode levar `;codecs=`, e no Firefox
   * precisa levar: `audio/ogg` sozinho lá sai em Vorbis, que a Meta recusa.
   */
  mimeType: string
  /**
   * O MIME que vai para o Storage e para a Meta, **sem parâmetro**. O
   * `allowed_mime_types` do bucket compara string exata: `audio/ogg;codecs=opus`
   * não bate com `audio/ogg` e o upload volta 400.
   */
  mime: string
  extensao: string
}

/**
 * A ordem importa, e **o codec é obrigatório em todo item desta lista**.
 *
 * ---------------------------------------------------------------------------
 * `audio/mp4` sem codec é uma armadilha, e ela custou um envio silencioso
 * ---------------------------------------------------------------------------
 *
 * A primeira versão desta lista pedia `audio/mp4` puro, na suposição de que
 * contêiner MP4 implica AAC. **Não implica.** Pedir sem codec deixa a escolha
 * com o navegador, e o Chrome escolhe **Opus dentro de MP4**.
 *
 * O arquivo gravado em 15/set/2026 foi inspecionado byte a byte: `mp4a` e
 * `esds` ausentes, `Opus` e `dOps` presentes. E a linha da Meta é específica —
 * `audio/mp4` significa **AAC**; Opus ela só aceita em contêiner **OGG**
 * (`audio/ogg`, "OPUS codecs only").
 *
 * O estrago foi o pior formato possível: o Storage aceitou (o MIME `audio/mp4`
 * confere), a Cloud API respondeu **200**, a mensagem foi gravada como
 * entregue — e nada chegou no celular. Como o webhook `statuses` da Meta não é
 * tratado, a falha não aparece em lugar nenhum.
 *
 * Por isso: `mp4a.40.2` (AAC-LC) escrito por extenso, e `audio/mp4` sem codec
 * **não volta para esta lista**. O que sobra é OGG/Opus, do Firefox, que já
 * vinha com o codec explícito pelo mesmo motivo.
 */
export const FORMATOS_DE_GRAVACAO: readonly FormatoDeGravacao[] = [
  // AAC-LC em contêiner MP4. `mp4a.40.2` é o AAC-LC da tabela do MPEG-4.
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', mime: 'audio/mp4', extensao: 'm4a' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.5', mime: 'audio/mp4', extensao: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', mime: 'audio/ogg', extensao: 'ogg' },
] as const

/**
 * Os pares (contêiner, codec) que a Meta entrega. Tudo fora daqui ela recusa.
 *
 * Existe separado de `FORMATOS_DE_GRAVACAO` porque as duas perguntas são
 * diferentes: aquela é *o que pedir*, esta é *o que aceitar de volta*. O
 * navegador pode entregar coisa diferente do que foi pedido, e foi assim que o
 * Opus-em-MP4 passou.
 */
const COMBINACOES_ACEITAS: readonly { container: string; codec: RegExp }[] = [
  { container: 'audio/mp4', codec: /^mp4a/i },
  { container: 'audio/aac', codec: /^(mp4a|aac)/i },
  { container: 'audio/mpeg', codec: /./ },
  { container: 'audio/ogg', codec: /^opus$/i },
] as const

/**
 * Confere o que o gravador **realmente** produziu, e não o que foi pedido.
 *
 * `MediaRecorder.mimeType`, lido depois do `start()`, devolve o tipo efetivo
 * com o codec — é a única fonte que revela a troca. Chamar isto antes de subir
 * é o que transforma "a Meta aceitou e nada chegou" em uma frase na tela.
 *
 * Tipo sem `;codecs=` passa: alguns navegadores não declaram o codec, e recusar
 * por omissão barraria gravação boa. O que esta função pega é a contradição
 * explícita — MP4 dizendo que tem Opus dentro.
 */
export function codecServeParaAMeta(mimeTypeEfetivo: string): boolean {
  const [container = '', ...parametros] = mimeTypeEfetivo.split(';').map((p) => p.trim())
  const aceita = COMBINACOES_ACEITAS.find((c) => c.container === container.toLowerCase())
  if (!aceita) return false

  const declarado = parametros
    .find((p) => p.toLowerCase().startsWith('codecs='))
    ?.slice('codecs='.length)
    .replace(/["']/g, '')
    .trim()

  if (!declarado) return true
  // `codecs="mp4a.40.2, avc1"` é lista. Todo item precisa servir.
  return declarado.split(',').every((c) => aceita.codec.test(c.trim()))
}

/**
 * O `mime` e a extensão a partir do tipo **efetivo** do gravador.
 *
 * Existe porque o navegador pode entregar contêiner diferente do pedido. Usar
 * a extensão do formato pedido nesse caso gravaria um `.m4a` que por dentro é
 * OGG — e o acervo decide o tipo de mídia **pela extensão** (`midiaDaExtensao`),
 * então a mentira se propagaria até a bolha.
 *
 * `null` quando o contêiner não é nenhum dos que a Meta aceita.
 */
export function formatoEntregue(
  mimeTypeEfetivo: string,
): { mime: string; extensao: string } | null {
  const container = (mimeTypeEfetivo.split(';')[0] ?? '').trim().toLowerCase()
  const daLista = FORMATOS_DE_GRAVACAO.find((f) => f.mime === container)
  if (daLista) return { mime: daLista.mime, extensao: daLista.extensao }
  // Contêineres que a Meta aceita mas que não pedimos — um navegador pode
  // devolver um deles por conta própria, e recusar seria recusar algo bom.
  if (container === 'audio/aac') return { mime: 'audio/aac', extensao: 'aac' }
  if (container === 'audio/mpeg') return { mime: 'audio/mpeg', extensao: 'mp3' }
  return null
}

/** A frase de quando o navegador entregou codec que a Meta não toca. */
export const CODEC_TROCADO =
  'Este navegador gravou num formato que o WhatsApp não entrega. Atualize o navegador ou use o Firefox.'

/**
 * O primeiro formato que este navegador grava **e** a Meta aceita.
 *
 * `null` quando não há nenhum — e `null` é uma resposta legítima, não um erro:
 * quem chama transforma em frase na tela.
 *
 * O `suporta` entra por parâmetro em vez de a função chamar
 * `MediaRecorder.isTypeSupported` direto porque é o que deixa isto testável.
 */
export function escolherFormato(
  suporta: (mimeType: string) => boolean,
): FormatoDeGravacao | null {
  for (const formato of FORMATOS_DE_GRAVACAO) {
    try {
      if (suporta(formato.mimeType)) return formato
    } catch {
      // `isTypeSupported` estoura em navegador antigo em vez de devolver false.
      // Tratar como "não suporta" é o comportamento que a especificação queria.
    }
  }
  return null
}

/**
 * Teto da gravação, em segundos.
 *
 * **Não é o teto da Meta** — 16 MB de AAC mono dariam mais de uma hora. É o
 * teto do bom senso: o microfone esquecido ligado é o acidente comum aqui, e
 * cinco minutos já é mais longo do que qualquer áudio que alguém queira ouvir
 * num atendimento. Bater no teto **envia o que gravou**, não descarta: perder
 * cinco minutos de fala por causa de um limite nosso seria pior que o limite.
 */
export const LIMITE_DE_GRAVACAO_S = 300

/** A partir daqui a tela avisa que está acabando, em vez de cortar de surpresa. */
export const AVISO_DE_FIM_S = 30

/**
 * O nome do arquivo no acervo.
 *
 * Carimbo de data e não o nome que o navegador daria (`recording.m4a`, igual
 * para todos): o acervo é uma pasta por cliente, e uma lista de trinta
 * `recording` é uma lista inútil. O sufixo aleatório contra colisão quem põe é
 * o próprio acervo, em `nomeSeguro`.
 */
export function nomeDoAudio(agora: Date, extensao: string): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0')
  const carimbo =
    `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}` +
    `-${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}${doisDigitos(agora.getSeconds())}`
  return `audio-${carimbo}.${extensao}`
}

/** `m:ss`, que é como todo aplicativo de voz mostra e ninguém precisa aprender. */
export function duracaoLegivel(segundos: number): string {
  const inteiro = Math.max(0, Math.floor(segundos))
  const minutos = Math.floor(inteiro / 60)
  return `${minutos}:${String(inteiro % 60).padStart(2, '0')}`
}

/**
 * As restrições do microfone.
 *
 * `channelCount: 1` **é exigência da Meta**, não economia: a linha do OGG na
 * tabela dela diz *"mono input only"*. Que de quebra corte o arquivo pela
 * metade é lucro, não motivo.
 *
 * Cancelamento de eco e supressão de ruído ficam ligados porque quem atende
 * grava no meio de um escritório, com o alto-falante do próprio computador
 * ligado. São os padrões do navegador para chamada, e a voz aqui é fala.
 */
export const RESTRICOES_DO_MICROFONE: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
}

/**
 * Traduz a recusa do navegador ao pedir o microfone.
 *
 * O `name` do erro é o contrato estável da especificação; a `message` varia por
 * navegador e por idioma, e não serve para decidir nada. As três primeiras são
 * as que acontecem de verdade — pessoa que negou, máquina sem microfone, e
 * outro programa segurando o dispositivo.
 */
export function motivoDoMicrofone(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : ''

  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return 'O navegador bloqueou o microfone. Libere no cadeado da barra de endereço e tente de novo.'
  }
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
    return 'Nenhum microfone encontrado neste computador.'
  }
  if (nome === 'NotReadableError' || nome === 'AbortError') {
    return 'Outro programa está usando o microfone. Feche-o e tente de novo.'
  }
  return 'Não deu para abrir o microfone.'
}

/** A frase de quando nenhum formato serve. Diz o que fazer, não o que faltou. */
export const SEM_FORMATO =
  'Este navegador não grava em formato que o WhatsApp aceite. Atualize o Chrome, o Edge ou use o Firefox.'
