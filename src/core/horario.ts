/**
 * O horário de atendimento — e por que ele é a peça que faltava.
 *
 * O bot faz handoff às 3h da manhã e a pessoa fica no vácuo até alguém abrir o
 * painel, sem ninguém dizer nada. *"Nosso horário é das 8h às 18h, te
 * respondemos amanhã cedo"* é uma frase que salva a conversa; silêncio não.
 *
 * Está aqui, puro e sem rede, pelo mesmo motivo da janela de 24h: **é conta
 * sobre tempo**, e conta sobre tempo tem que dar para testar sem subir servidor
 * e sem esperar dar meia-noite.
 *
 * O fuso vem junto da conta e não do servidor. A Vercel roda em UTC; ler o
 * relógio do processo diria que um estúdio de São Paulo abre às 5h.
 */

/** Domingo é 0, como em `Date.prototype.getDay()`. */
export const DIAS_DA_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const

/** `"08:00"` — a mesma grafia que a pessoa digita e que o banco guarda. */
export type Relogio = string

export type Faixa = { de: Relogio; ate: Relogio }

/**
 * O expediente de uma conta.
 *
 * Faixas por dia, e mais de uma por dia de propósito: almoço fechado é o caso
 * comum de estúdio e consultório, e um único `de`/`ate` obrigaria a mentir.
 *
 * `fuso` é um nome da base IANA (`America/Sao_Paulo`). Guardar o deslocamento
 * em horas seria mais simples e estaria errado duas vezes por ano.
 */
export type HorarioDeAtendimento = {
  fuso: string
  /** Índice = dia da semana, 0 = domingo. Lista vazia = fechado o dia todo. */
  dias: Faixa[][]
}

/** Sem nada configurado, atende sempre — é como o produto se comportou até aqui. */
export const SEMPRE_ABERTO: HorarioDeAtendimento = {
  fuso: 'America/Sao_Paulo',
  dias: [[], [], [], [], [], [], []],
}

const FORMATO_DE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

/** `"08:30"` → 510. `null` quando não é hora. */
export function emMinutos(relogio: Relogio): number | null {
  const achado = FORMATO_DE_HORA.exec(relogio.trim())
  if (!achado) return null
  return Number(achado[1]) * 60 + Number(achado[2])
}

/**
 * Que horas são **na conta**, não no servidor.
 *
 * `Intl` faz a conversão de fuso sem rede e sem tabela nossa — inclusive o
 * horário de verão, que é onde uma conta de horas na mão erra.
 */
export function agoraNaConta(
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: horario.fuso,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora)

  const pegar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  const SIGLAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // `hour` pode vir "24" à meia-noite em algumas implementações do `hour12:
  // false`. Zero e vinte e quatro são o mesmo instante, e 24 quebraria toda
  // comparação de faixa.
  const hora = Number(pegar('hour')) % 24

  return {
    dia: Math.max(0, SIGLAS.indexOf(pegar('weekday'))),
    minutos: hora * 60 + Number(pegar('minute')),
  }
}

/**
 * Tem gente para atender agora?
 *
 * **Nenhuma faixa em nenhum dia significa aberto**, e não fechado. É a
 * diferença entre "ninguém configurou ainda" e "configuraram para não atender
 * nunca" — e tratar as duas igual faria o produto emudecer sozinho no dia em
 * que a coluna nascesse vazia para todo cliente que já existe.
 */
export function atendimentoAberto(
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): boolean {
  if (horario.dias.every((faixas) => faixas.length === 0)) return true

  const { dia, minutos } = agoraNaConta(horario, agora)
  return (horario.dias[dia] ?? []).some((faixa) => {
    const de = emMinutos(faixa.de)
    const ate = emMinutos(faixa.ate)
    // Faixa ilegível não abre o atendimento: melhor dizer que está fechado e a
    // pessoa ser respondida de manhã do que prometer alguém que não existe.
    if (de === null || ate === null || ate <= de) return false
    return minutos >= de && minutos < ate
  })
}

/**
 * Quando abre de novo, em palavras.
 *
 * A frase importa mais que o dado: *"te respondemos amanhã a partir das 8h"* é
 * o que faz alguém esperar em vez de desistir. Sem isso sobra "estamos
 * fechados", que não diz até quando.
 */
export function proximaAbertura(
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): string | null {
  if (horario.dias.every((faixas) => faixas.length === 0)) return null

  const { dia, minutos } = agoraNaConta(horario, agora)

  for (let adiante = 0; adiante < 7; adiante++) {
    const indice = (dia + adiante) % 7
    /**
     * A mesma noção de faixa válida que `atendimentoAberto` usa.
     *
     * Sem o `ate`, as duas funções discordavam: uma faixa invertida
     * (`18:00`–`08:00`) nunca abria o atendimento e mesmo assim era anunciada
     * como "abre hoje às 18:00". Prometer um horário em que ninguém vai
     * responder é pior do que não prometer nada.
     */
    const faixas = [...(horario.dias[indice] ?? [])]
      .map((faixa) => ({ faixa, de: emMinutos(faixa.de), ate: emMinutos(faixa.ate) }))
      .filter(
        (item): item is { faixa: Faixa; de: number; ate: number } =>
          item.de !== null && item.ate !== null && item.ate > item.de,
      )
      .sort((a, b) => a.de - b.de)

    for (const { faixa, de } of faixas) {
      // Hoje só conta o que ainda não passou; nos dias seguintes, a primeira.
      if (adiante === 0 && de <= minutos) continue

      if (adiante === 0) return `hoje a partir das ${faixa.de}`
      if (adiante === 1) return `amanhã a partir das ${faixa.de}`
      return `${DIAS_DA_SEMANA[indice]} a partir das ${faixa.de}`
    }
  }

  return null
}
