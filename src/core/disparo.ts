/**
 * O ritmo da transmissão, as contas, sem rede e sem banco.
 *
 * ---------------------------------------------------------------------------
 * Três limites diferentes, e confundi-los custa o número do cliente
 * ---------------------------------------------------------------------------
 *
 * 1. **A escada de 24h**: 250 → 2.000 → 10.000 → 100.000 → ilimitado
 *    **destinatários únicos** em 24h. Desde out/2025 é **por portfólio**, não
 *    por número, quem soma os limites de dois números do mesmo cliente conta
 *    o dobro do que existe.
 * 2. **O throughput por segundo**: 80 mps no padrão, **20 mps em coexistência**
 *   , que é o nosso caminho principal. É por `phone_number_id`, e conta
 *    **entrada e saída juntas**: o inbound do atendimento compete com a
 *    transmissão pela mesma cota.
 * 3. **O limite por usuário** (131049/131056): decisão da Meta sobre quantas
 *    mensagens de marketing uma pessoa aguenta. Não é nosso e não tem contorno.
 *
 * Só conta conversa **iniciada pela empresa**. Responder quem chamou é
 * ilimitado, e é por isso que um cliente que só atende nunca esbarra nisto.
 */

/**
 * A escada de destinatários únicos em 24h, por portfólio.
 *
 * Sobe em 6h quando a qualidade está alta **e** o cliente usou 50% do limite
 * nos últimos 7 dias. Quem dispara pouco fica preso em 250 para sempre, o que
 * é contra-intuitivo e vale dizer na tela: mandar pouco não "guarda" limite.
 */
export const ESCADA = [250, 2_000, 10_000, 100_000] as const

/**
 * O ritmo padrão da Cloud API, por segundo.
 *
 * 80 mps é o teto do número comum. Não usamos ele como padrão: ver
 * `RITMO_EM_COEXISTENCIA`.
 */
export const RITMO_PADRAO = 80

/**
 * O ritmo em coexistência, **o nosso caso principal**.
 *
 * Um quarto do padrão. Quem dimensiona pelo número grande descobre isto no meio
 * de uma campanha, como uma enxurrada de 130429.
 */
export const RITMO_EM_COEXISTENCIA = 20

/**
 * Onde a fila realmente começa: 20 por segundo.
 *
 * Não é o teto, é o **ponto de partida seguro**, e a diferença importa. O
 * throughput conta entrada e saída na mesma cota: disparar no teto deixa o
 * atendimento sem banda e as respostas de quem está conversando agora começam
 * a falhar, o pior jeito possível de uma campanha dar errado.
 */
export const RITMO_INICIAL = 20

/** Quanto esperar entre mensagens para respeitar um ritmo por segundo. */
export function intervaloMs(porSegundo: number): number {
  if (porSegundo <= 0) return 1_000
  return Math.ceil(1_000 / porSegundo)
}

/**
 * Quantos cabem ainda hoje, dado o que já saiu.
 *
 * **Conferir isto ANTES de enfileirar, e não durante.** Uma campanha de 5.000
 * com tier de 2.000 não é um erro a ser descoberto na mensagem 2.001, é uma
 * campanha que precisa ser fatiada em 3 dias, e a pessoa tem o direito de saber
 * disso na hora de agendar.
 */
export function cabemHoje(limite: number, jaEnviadas: number): number {
  return Math.max(0, limite - jaEnviadas)
}

/**
 * Em quantos dias uma transmissão cabe, respeitando o teto diário.
 *
 * Serve à tela: "5.000 pessoas no seu limite de 2.000 por dia = 3 dias".
 */
export function diasNecessarios(publico: number, limiteDiario: number): number {
  if (limiteDiario <= 0) return 0
  return Math.ceil(publico / limiteDiario)
}

// ---------------------------------------------------------------------------
// O retry
// ---------------------------------------------------------------------------

/** Nunca mais que isso entre tentativas, meia hora já é abandono na prática. */
export const TETO_DO_BACKOFF_MS = 30 * 60 * 1000

/** Depois de tantas, é porque não vai. */
export const TENTATIVAS_MAXIMAS = 4

/**
 * Espera exponencial **com jitter**, e o jitter não é enfeite.
 *
 * Sem ele, mil mensagens que tomaram 130429 no mesmo segundo voltam juntas no
 * mesmo segundo, o mesmo pico que causou o erro, de novo. É o "thundering
 * herd", e ele transforma um soluço num apagão.
 *
 * O jitter é ±25% e vem de quem chama (`aleatorio`) para o teste poder fixá-lo.
 */
export function esperaMs(tentativa: number, aleatorio: number = Math.random()): number {
  const base = Math.min(1_000 * 2 ** Math.max(0, tentativa - 1), TETO_DO_BACKOFF_MS)
  const fator = 0.75 + aleatorio * 0.5
  return Math.round(base * fator)
}

/**
 * As 24h de `131049` e `131056`.
 *
 * **Repetir antes suspende o destinatário por mais 24h.** A tentativa extra não
 * é neutra: ela piora o caso. Por isso este valor não é "backoff longo", é uma
 * espera de outra natureza, e o motor a trata separado.
 */
export const ESPERA_POR_USUARIO_MS = 24 * 60 * 60 * 1000

export type Tentativa = {
  /** Quantas já foram feitas com este destinatário. */
  tentativas: number
  codigo: number | null
}

export type Decisao =
  | { acao: 'enviar' }
  | { acao: 'esperar'; ms: number }
  | { acao: 'desistir'; motivo: string }
  | { acao: 'parar_tudo'; motivo: string }

/**
 * O que fazer com um destinatário depois de um erro.
 *
 * Traduz a conduta de `condutaPara()` em decisão de fila. As duas funções são
 * separadas de propósito: aquela classifica o **erro**, esta decide o **que
 * fazer agora**, e a segunda depende de quantas tentativas já houve, que a
 * primeira não sabe.
 */
export function decidir(
  conduta: 'repetir' | 'desistir' | 'esperar_24h' | 'corrigir_codigo' | 'template_pausado',
  tentativa: Tentativa,
  aleatorio: number = Math.random(),
): Decisao {
  switch (conduta) {
    case 'template_pausado':
      /*
       * O template morreu. Tentar outro destinatário só produz o mesmo erro
       * 5.000 vezes, e cada uma delas é um registro a mais contra a nota de
       * qualidade do número.
       */
      return { acao: 'parar_tudo', motivo: 'o modelo foi pausado ou reprovado pela Meta' }

    case 'corrigir_codigo':
      /*
       * Bug nosso no payload. Retry repete o erro exatamente igual, e parar a
       * transmissão inteira é certo: se o payload está errado para um, está
       * errado para todos.
       */
      return { acao: 'parar_tudo', motivo: 'o conteúdo enviado não bate com o modelo aprovado' }

    case 'desistir':
      return { acao: 'desistir', motivo: 'este número não recebe' }

    case 'esperar_24h':
      // Não é backoff: repetir antes das 24h SUSPENDE o destinatário por mais
      // 24h. A tentativa extra piora.
      return { acao: 'esperar', ms: ESPERA_POR_USUARIO_MS }

    case 'repetir':
      if (tentativa.tentativas >= TENTATIVAS_MAXIMAS) {
        return { acao: 'desistir', motivo: 'tentamos várias vezes e não deu' }
      }
      return { acao: 'esperar', ms: esperaMs(tentativa.tentativas + 1, aleatorio) }
  }
}

/**
 * A transmissão sai hoje, em Brasília? Sem horário quer dizer "agora".
 *
 * Marcada para outro dia, o consumo de hoje não diz nada sobre ela, e a prévia
 * não pode barrar a campanha de amanhã pelo que saiu hoje.
 */
export function saiNoDiaDeHoje(quando: string | null | undefined, agora = new Date()): boolean {
  if (!quando) return true
  const momento = new Date(quando)
  if (Number.isNaN(momento.getTime())) return true
  const dia = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
  return dia(momento) <= dia(agora)
}

/**
 * Dá para transmitir agora?
 *
 * Junta as três perguntas que a tela precisa responder antes de deixar alguém
 * clicar em "enviar", e responde em português, porque quem lê é o consultor,
 * não quem programou.
 */
export function podeTransmitir(entrada: {
  statusDoTemplate: string
  publico: number
  limiteDiario: number
  jaEnviadasHoje: number
}): { pode: boolean; recado: string | null } {
  if (entrada.statusDoTemplate !== 'aprovado') {
    return {
      pode: false,
      recado: 'Este modelo ainda não está aprovado pela Meta, só modelo aprovado entrega.',
    }
  }

  if (entrada.publico === 0) {
    return { pode: false, recado: 'Nenhum contato foi selecionado.' }
  }

  const cabem = cabemHoje(entrada.limiteDiario, entrada.jaEnviadasHoje)
  if (cabem === 0) {
    return {
      pode: false,
      recado: `O limite de ${entrada.limiteDiario} conversas por dia da Meta já foi usado hoje. Dá para agendar para amanhã.`,
    }
  }

  if (entrada.publico > cabem) {
    /*
     * Barra, com os números. O motor manda a lista inteira de uma vez e não
     * fatia por dia: a mensagem que passa do limite a Meta recusa. Deixar
     * criar dizendo "o resto sai amanhã" prometia algo que ninguém cumpre.
     */
    return {
      pode: false,
      recado: `Hoje já saíram ${entrada.jaEnviadasHoje} de ${entrada.limiteDiario}. Esta lista tem ${entrada.publico}.`,
    }
  }

  return { pode: true, recado: null }
}
