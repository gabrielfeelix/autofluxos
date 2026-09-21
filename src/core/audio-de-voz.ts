/**
 * Gravar áudio na caixa de resposta: a parte que não depende do navegador.
 *
 * ---------------------------------------------------------------------------
 * Por que existe um módulo só para escolher um formato
 * ---------------------------------------------------------------------------
 *
 * Porque escolher errado é o modo de falha desta funcionalidade, e ele falha
 * **longe** de onde a escolha foi feita: o arquivo sobe, a Server Action grava
 * a mensagem, e só então a Meta recusa, com o erro aparecendo na conversa de
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
 * A tabela da Cloud API aceita AAC, AMR, MP3, `audio/mp4` (.m4a) e `audio/ogg`, este último com a letra miúda que decide tudo: *"OPUS codecs only; base
 * audio/ogg not supported; mono input only"*.
 *
 * **`audio/webm` não está na lista**, e é o padrão histórico do Chrome. Isso é
 * resolvido pedindo MP4 ou OGG, mas **pedir o contêiner não basta**, e é o que
 * a primeira versão deste arquivo errou.
 *
 * Contêiner e codec são coisas separadas. `audio/mp4` pedido sem codec deixa a
 * escolha com o navegador, e o Chrome entrega **Opus dentro de MP4**, que a
 * Meta não toca, porque para ela `audio/mp4` significa AAC e Opus só vale em
 * OGG. O arquivo gravado em 15/set foi aberto byte a byte e confirmou: `mp4a`
 * ausente, `dOps` presente.
 *
 * Daí as duas metades deste módulo:
 *
 * 1. **`escolherFormato`** pede sempre com `;codecs=` explícito.
 * 2. **`codecServeParaAMeta`** confere o que o gravador devolveu, porque pedir
 *    não garante receber, e o modo de falha é silencioso: o Storage aceita, a
 *    Cloud API responde 200, e nada chega no celular.
 *
 * Levantamento com as URLs da Meta em `docs/PESQUISA-VOZ-E-CHAMADA.md`.
 */

export type FormatoDeGravacao = {
  /**
   * O que se pede ao `MediaRecorder`, pode levar `;codecs=`, e no Firefox
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
  /**
   * Se o arquivo precisa trocar de contêiner antes de subir.
   *
   * O Chrome só grava Opus dentro de WebM, e WebM não tem linha na tabela da
   * Meta. Os pacotes Opus lá dentro são os mesmos que entrariam num OGG, então
   * a saída é reembalar, não converter. Ver `core/ogg-opus.ts`.
   */
  remux: boolean
}

/**
 * O que pedir ao `MediaRecorder`, em ordem, e **tudo aqui é Opus**.
 *
 * ---------------------------------------------------------------------------
 * Por que MP4 saiu desta lista
 * ---------------------------------------------------------------------------
 *
 * Duas falhas medidas em produção, no mesmo dia, pela mesma razão de fundo: o
 * `MediaRecorder` grava em streaming, e MP4 não foi feito para isso.
 *
 * A primeira foi o codec, `audio/mp4` pedido sem `;codecs=` deixou o Chrome
 * escolher, e ele escolheu **Opus dentro de MP4**, que a Meta não entrega.
 * Pedir `mp4a.40.2` corrigiu o codec, e aí apareceu a segunda: o MP4 que sai
 * do navegador é **fragmentado**. O arquivo foi aberto caixa a caixa ,
 * `stts`, `stsz` e `stco` vazios, `mvex` presente, `mvhd duration = 0`. Quem
 * lê MP4 progressivo, e é o que o WhatsApp faz, vê zero amostras.
 *
 * Não é defeito do navegador: gravando, ele não sabe a duração para escrever
 * no cabeçalho. MP4 exige saber; **OGG não**, é um contêiner de streaming,
 * feito de páginas autossuficientes, sem índice e sem duração declarada. É
 * também o que o WhatsApp usa nativamente para voz.
 *
 * Daí a lista ser só Opus:
 *
 * - **Firefox** grava `audio/ogg;codecs=opus` e o arquivo já sai pronto.
 * - **Chrome, Edge e Opera** só dão Opus em WebM. Os pacotes são os mesmos, e
 *   `webmOpusParaOgg` troca o envelope, sem decodificar, sem reencode, sem
 *   WASM, sem dependência nova.
 *
 * O codec vai escrito por extenso nos dois: `audio/ogg` sem codec sai em
 * Vorbis no Firefox, que a Meta recusa pela mesma letra miúda.
 */
export const FORMATOS_DE_GRAVACAO: readonly FormatoDeGravacao[] = [
  { mimeType: 'audio/ogg;codecs=opus', mime: 'audio/ogg', extensao: 'ogg', remux: false },
  { mimeType: 'audio/webm;codecs=opus', mime: 'audio/ogg', extensao: 'ogg', remux: true },
] as const

/**
 * Confere que o navegador realmente gravou **Opus**, e não outra coisa.
 *
 * `MediaRecorder.mimeType`, lido depois do `start()`, é o tipo efetivo e a
 * única fonte que revela uma troca. Foi assim que o Opus-em-MP4 passou
 * despercebido: pedir não garante receber.
 *
 * Exige o codec declarado. Aqui a omissão **não** passa, ao contrário do caso
 * geral: os dois contêineres desta lista aceitam mais de um codec (WebM leva
 * Vorbis, OGG também), e o remux só sabe ler Opus.
 */
export function gravouOpus(mimeTypeEfetivo: string): boolean {
  const codec = mimeTypeEfetivo
    .split(';')
    .slice(1)
    .map((p) => p.trim())
    .find((p) => p.toLowerCase().startsWith('codecs='))
    ?.slice('codecs='.length)
    .replace(/["']/g, '')
    .trim()
    .toLowerCase()

  return codec === 'opus'
}

/** A frase de quando o navegador entregou codec que a Meta não toca. */
export const CODEC_TROCADO =
  'Este navegador gravou num formato que o WhatsApp não entrega. Atualize o navegador ou use o Firefox.'

/**
 * O primeiro formato que este navegador grava **e** a Meta aceita.
 *
 * `null` quando não há nenhum, e `null` é uma resposta legítima, não um erro:
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
 * **Não é o teto da Meta**, 16 MB de AAC mono dariam mais de uma hora. É o
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
 * as que acontecem de verdade, pessoa que negou, máquina sem microfone, e
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
