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
 * **`audio/webm` não está na lista**, e é o padrão histórico do Chrome. Era o
 * risco apontado no handoff de 15/set, e ele deixou de existir sozinho: o
 * Chrome passou a gravar em contêiner MP4, o Safari sempre gravou, e o Firefox
 * grava OGG/Opus. Os três caem em formato que a Meta aceita **sem conversão
 * nenhuma** — nada de WASM, nada de remux, nada de dependência nova.
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
 * A ordem importa, e não é alfabética.
 *
 * MP4/AAC vem primeiro porque é o que Chrome, Edge, Opera e Safari produzem —
 * a esmagadora maioria de quem atende. OGG/Opus é o Firefox. Um navegador que
 * não suporte nenhum dos dois só sabe gravar WebM, e WebM não tem linha na
 * tabela da Meta: nesse caso a resposta certa é recusar com motivo, não subir
 * um arquivo que vai ser recusado três passos adiante.
 */
export const FORMATOS_DE_GRAVACAO: readonly FormatoDeGravacao[] = [
  { mimeType: 'audio/mp4', mime: 'audio/mp4', extensao: 'm4a' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', mime: 'audio/mp4', extensao: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', mime: 'audio/ogg', extensao: 'ogg' },
  { mimeType: 'audio/aac', mime: 'audio/aac', extensao: 'aac' },
] as const

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
