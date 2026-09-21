import { z } from 'zod'

/**
 * O horário de atendimento, e por que ele é a peça que faltava.
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

/** `"08:00"`, a mesma grafia que a pessoa digita e que o banco guarda. */
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
/**
 * Um dia que foge da semana: feriado, recesso, véspera com hora reduzida.
 *
 * **Não é a mesma coisa que fechar o dia da semana.** Uma casa que abre toda
 * quarta continua abrindo toda quarta; no dia 25 de dezembro, não. Sem isto o
 * bot promete "te respondemos hoje a partir das 07:00" no Natal, e ninguém
 * responde, que é a promessa mais cara que o produto sabe fazer.
 *
 * `faixas` ausente ou vazia fecha o dia inteiro. Preenchida, ela **substitui**
 * a do dia da semana, que é o caso da véspera que abre só de manhã: somar as
 * duas abriria à tarde, exatamente o que a exceção existe para negar.
 *
 * `motivo` é o que a pessoa lê ("Natal", "recesso de fim de ano"). Opcional
 * porque nem todo fechamento tem nome, e um nome inventado por nós apareceria
 * na conversa do cliente de alguém.
 */
export type Excecao = {
  /** `AAAA-MM-DD`, o mesmo formato de `hojeNaConta`. */
  data: string
  motivo?: string
  faixas?: Faixa[]
}

export type HorarioDeAtendimento = {
  fuso: string
  /** Índice = dia da semana, 0 = domingo. Lista vazia = fechado o dia todo. */
  dias: Faixa[][]
  /** Dias soltos que mandam mais que a semana. Ver `Excecao`. */
  excecoes?: Excecao[]
  /**
   * De onde este expediente veio, e quando foi lido.
   *
   * `manual` é alguém digitando na nossa tela. `crm` é o expediente do sistema
   * que já manda na agenda do cliente (hoje a Verandi), copiado para cá. A
   * cópia é deliberada: o motor decide o que dizer **em toda mensagem**, e
   * pendurar isso numa chamada externa faria a resposta do bot depender de um
   * servidor de terceiro estar de pé.
   */
  origem?: {
    tipo: 'manual' | 'crm'
    /** Qual credencial do cliente busca o expediente. Só o id, nunca o valor. */
    conexaoId?: string
    /** De onde buscar, por exemplo `https://verandi.4yu.com.br/api/v1/funcionamento`. */
    url?: string
    /** Quando a cópia foi atualizada, em ISO. Ver `precisaSincronizar`. */
    sincronizadoEm?: string
  }
}

/** Sem nada configurado, atende sempre, é como o produto se comportou até aqui. */
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
 * `Intl` faz a conversão de fuso sem rede e sem tabela nossa, inclusive o
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
 * Que dia é hoje na conta, em `AAAA-MM-DD`.
 *
 * **Existe para a IA, e o erro que ela evita é caro.** Um modelo sem relógio
 * não avisa que não sabe a data: ele chuta. E `new Date().toISOString()` em
 * servidor UTC vira o dia seguinte a partir das 21h em São Paulo, a hora em
 * que gente manda mensagem para marcar aula. O bot ofereceria a agenda de
 * amanhã dizendo "hoje", e ninguém suspeitaria da resposta.
 *
 * O fuso é o da conta, e não o do servidor, pela mesma razão de
 * `agoraNaConta`: quem tem horário de atendimento tem fuso configurado, e é
 * ele que descreve o dia de quem está conversando.
 */
export function hojeNaConta(fuso: string, agora: Date = new Date()): string {
  // `en-CA` produz `AAAA-MM-DD` direto, que é o formato que a agenda aceita.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

/**
 * Tem gente para atender agora?
 *
 * **Nenhuma faixa em nenhum dia significa aberto**, e não fechado. É a
 * diferença entre "ninguém configurou ainda" e "configuraram para não atender
 * nunca", e tratar as duas igual faria o produto emudecer sozinho no dia em
 * que a coluna nascesse vazia para todo cliente que já existe.
 */
export function atendimentoAberto(
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): boolean {
  const { dia, minutos } = agoraNaConta(horario, agora)
  const hoje = hojeNaConta(horario.fuso, agora)
  const excecao = (horario.excecoes ?? []).find((e) => e.data === hoje)

  /*
   * Semana em branco **com** feriado cadastrado: aberto todo dia, menos nele.
   *
   * É o caminho de quem só quis marcar o Natal e nunca desenhou a semana.
   * Tratar a semana vazia como "fechado sempre" emudeceria o bot o ano
   * inteiro por causa de um único dia; ignorar a exceção jogaria fora a única
   * coisa que a pessoa configurou.
   */
  if (!excecao && horario.dias.every((faixas) => faixas.length === 0)) return true

  return faixasDoDia(horario, hoje, dia).some((faixa) => {
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
  const hoje = hojeNaConta(horario.fuso, agora)

  /*
   * Sete dias e não catorze, mesmo com exceção pelo caminho.
   *
   * Uma casa fechada por mais de uma semana inteira (recesso longo) não tem
   * "próxima abertura" que caiba numa frase de WhatsApp, e chutar "volta dia
   * 6 de janeiro" a partir de exceções que alguém pode não ter cadastrado até
   * lá seria prometer por conta própria. Nesses casos volta `null`, e o aviso
   * fica no "estamos fechados" sem data, que é a verdade que temos.
   */
  for (let adiante = 0; adiante < 7; adiante++) {
    const indice = (dia + adiante) % 7
    const data = somarDias(hoje, adiante)
    /**
     * A mesma noção de faixa válida que `atendimentoAberto` usa.
     *
     * Sem o `ate`, as duas funções discordavam: uma faixa invertida
     * (`18:00`–`08:00`) nunca abria o atendimento e mesmo assim era anunciada
     * como "abre hoje às 18:00". Prometer um horário em que ninguém vai
     * responder é pior do que não prometer nada.
     */
    const faixas = [...faixasDoDia(horario, data, indice)]
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

/**
 * As faixas que valem **neste dia**, com a exceção mandando mais que a semana.
 *
 * É o único lugar que junta as duas coisas, de propósito: `atendimentoAberto` e
 * `proximaAbertura` discordarem sobre um feriado seria o bot dizer que está
 * fechado e, na frase seguinte, prometer atendimento para a mesma tarde.
 */
export function faixasDoDia(
  horario: HorarioDeAtendimento,
  data: string,
  diaDaSemana: number,
): Faixa[] {
  const excecao = (horario.excecoes ?? []).find((e) => e.data === data)
  if (excecao) return excecao.faixas ?? []
  return horario.dias[diaDaSemana] ?? []
}

/**
 * Por que está fechado hoje, quando há um nome para isso.
 *
 * "Estamos fechados, voltamos amanhã" responde *até quando*. No feriado falta
 * o *porquê*, e é ele que faz a pessoa não insistir: quem lê "hoje é feriado"
 * entende que não adianta ligar, e quem lê só "fechado" numa quarta-feira de
 * manhã acha que o bot está com defeito.
 */
export function motivoDeHojeFechado(
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): string | null {
  const data = hojeNaConta(horario.fuso, agora)
  const excecao = (horario.excecoes ?? []).find((e) => e.data === data)
  if (!excecao) return null
  if ((excecao.faixas ?? []).length > 0) return null
  return (excecao.motivo ?? '').trim() || null
}

/**
 * `AAAA-MM-DD` mais N dias, sem fuso no meio.
 *
 * A data já vem lida no fuso da conta por `hojeNaConta`; daqui para a frente é
 * contagem de calendário, e `Date.UTC` faz isso sem o horário de verão
 * empurrar um dia para trás na virada.
 */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, (dia ?? 1) + dias))
  return d.toISOString().slice(0, 10)
}

/**
 * O que o banco devolve, conferido antes de virar decisão.
 *
 * `horario_atendimento` é `jsonb`: o banco aceita qualquer coisa ali. Hoje só
 * a nossa tela escreve, mas isto é o que decide se o bot promete atendimento ,
 * e um objeto torto não pode virar "aberto" por acidente. Leitura que falha
 * devolve `null`, que é "atende sempre": o lado que mantém o produto se
 * comportando como sempre se comportou.
 */
export const faixaSchema = z.object({
  de: z.string(),
  ate: z.string(),
})

export const excecaoSchema = z.object({
  /** `AAAA-MM-DD`. Formato torto derruba a leitura inteira, e é o certo: uma
      data ilegível viraria "fechado hoje" no dia errado. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo: z.string().optional(),
  faixas: z.array(faixaSchema).optional(),
})

export const horarioSchema = z.object({
  fuso: z.string().min(1),
  /** Sete listas, uma por dia da semana, domingo primeiro. */
  dias: z.array(z.array(faixaSchema)).length(7),
  excecoes: z.array(excecaoSchema).optional(),
  origem: z
    .object({
      tipo: z.enum(['manual', 'crm']),
      conexaoId: z.string().optional(),
      url: z.string().optional(),
      sincronizadoEm: z.string().optional(),
    })
    .optional(),
})

/** Lê o que veio do banco. Qualquer coisa fora do formato vira `null`. */
export function lerHorario(bruto: unknown): HorarioDeAtendimento | null {
  if (bruto === null || bruto === undefined) return null

  const analise = horarioSchema.safeParse(bruto)
  if (!analise.success) {
    console.error('[horario] configuração ilegível no banco, tratando como sempre aberto')
    return null
  }
  return analise.data
}
