import { chamarJson, diasEntre, lista, objeto, texto, type Buscar } from './comum'
import type { ConectorDeAgenda, HorarioLivre, Marcacao, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * Google Agenda como agenda da IA.
 *
 * Diferente de Feegow e Trinks, o Google não tem serviço, profissional nem
 * "horário livre": tem eventos. O livre é **o expediente menos o ocupado**,
 * calculado aqui. O expediente vem dos ajustes (`inicio`, `fim`, `dias`,
 * `duracaoMin`), com padrão de segunda a sexta, 9h às 18h, de hora em hora.
 *
 * Só o escopo `calendar.events`: ler e criar eventos. Por isso o ocupado sai
 * de `events.list` (que esse escopo lê) e não de `freeBusy`. Evento marcado
 * como "livre" no Google (`transparency: transparent`, o padrão de evento de
 * dia inteiro) não ocupa horário, como na própria agenda do Google.
 *
 * O fuso é o de Brasília fixo (-03:00): o Brasil não tem horário de verão
 * desde 2019, e a agenda de um negócio brasileiro está nele.
 *
 * A marcação leva a pessoa em `extendedProperties.private`, e é por ela que
 * "minhas marcações" acha os eventos dela sem ler a agenda inteira.
 */

const API = 'https://www.googleapis.com/calendar/v3'
const FUSO = '-03:00'
const NOME = 'O Google Agenda'
const CHAVE_DA_PESSOA = 'dialogon_contato'
const TETO_DE_HORARIOS = 40
const ANTECEDENCIA_MIN = 60

export type AjustesDoGoogle = {
  calendario?: string
  /** `HH:MM`. */
  inicio?: string
  fim?: string
  /** Dias da semana atendidos, `0` domingo a `6` sábado, separados por vírgula. */
  dias?: string
  duracaoMin?: number
  servico?: string
  /** O e-mail da conta Google, só para a tela. */
  conta?: string
}

/** O token de acesso vem pronto de quem monta: a troca do refresh mora no servidor. */
export function conectorGoogleAgenda(
  tokenDeAcesso: () => Promise<ResultadoDaAgenda<string>>,
  ajustes: AjustesDoGoogle = {},
  buscar: Buscar = fetch,
): ConectorDeAgenda {
  const calendario = encodeURIComponent(ajustes.calendario || 'primary')
  const duracao = ajustes.duracaoMin && ajustes.duracaoMin >= 10 ? ajustes.duracaoMin : 60
  const inicio = minutos(ajustes.inicio ?? '09:00') ?? 9 * 60
  const fim = minutos(ajustes.fim ?? '18:00') ?? 18 * 60
  const dias = new Set((ajustes.dias ?? '1,2,3,4,5').split(',').map((d) => Number(d.trim())))
  const servico = ajustes.servico || 'Horário'

  async function chamar(caminho: string, init: RequestInit = {}): Promise<ResultadoDaAgenda<unknown>> {
    const token = await tokenDeAcesso()
    if (!token.ok) return token
    return chamarJson(
      buscar,
      `${API}${caminho}`,
      { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token.valor}` } },
      NOME,
    )
  }

  /** Os intervalos ocupados entre dois instantes, em milissegundos. */
  async function ocupados(de: Date, ate: Date): Promise<ResultadoDaAgenda<[number, number][]>> {
    const url = new URLSearchParams({
      timeMin: de.toISOString(),
      timeMax: ate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    const r = await chamar(`/calendars/${calendario}/events?${url}`)
    if (!r.ok) return r
    const intervalos = lista(objeto(r.valor).items).flatMap((evento): [number, number][] => {
      if (evento.status === 'cancelled' || evento.transparency === 'transparent') return []
      const comeco = instante(objeto(evento.start))
      const termino = instante(objeto(evento.end))
      return comeco !== null && termino !== null ? [[comeco, termino]] : []
    })
    return { ok: true, valor: intervalos }
  }

  return {
    async conferir() {
      const r = await chamar(`/calendars/${calendario}/events?maxResults=1`)
      if (!r.ok) return r
      return { ok: true, valor: { resumo: ajustes.conta ? `agenda de ${ajustes.conta}` : 'agenda principal ligada' } }
    },

    async servicos() {
      return { ok: true, valor: { servicos: [{ servicoId: 'horario', nome: servico, duracaoMin: duracao }], profissionais: [] } }
    },

    async horarios(filtro) {
      const periodo = diasEntre(filtro.de, filtro.ate || filtro.de)
      if (periodo.length === 0) return { ok: false, motivo: 'período inválido: use AAAA-MM-DD' }
      const primeiro = new Date(`${periodo[0]}T00:00:00${FUSO}`)
      const ultimo = new Date(`${periodo[periodo.length - 1]}T23:59:59${FUSO}`)

      const busy = await ocupados(primeiro, ultimo)
      if (!busy.ok) return busy

      const limite = Date.now() + ANTECEDENCIA_MIN * 60_000
      const horarios: HorarioLivre[] = []
      for (const dia of periodo) {
        if (!dias.has(new Date(`${dia}T12:00:00${FUSO}`).getUTCDay())) continue
        for (let m = inicio; m + duracao <= fim && horarios.length < TETO_DE_HORARIOS; m += duracao) {
          const hora = hhmm(m)
          const comeco = Date.parse(`${dia}T${hora}:00${FUSO}`)
          const termino = comeco + duracao * 60_000
          if (comeco < limite) continue
          if (busy.valor.some(([a, b]) => a < termino && b > comeco)) continue
          horarios.push({ horarioId: `${dia}T${hora}`, data: dia, hora, servico })
        }
      }
      return {
        ok: true,
        valor: { horarios, ...(horarios.length === 0 ? { aviso: 'sem horário livre nesse período; ofereça outros dias' } : {}) },
      }
    },

    async minhas(pessoa) {
      const url = new URLSearchParams({
        timeMin: new Date().toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '20',
        privateExtendedProperty: `${CHAVE_DA_PESSOA}=${pessoa.telefone}`,
      })
      const r = await chamar(`/calendars/${calendario}/events?${url}`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: lista(objeto(r.valor).items)
          .filter((evento) => evento.status !== 'cancelled')
          .map((evento) => paraMarcacao(evento, servico)),
      }
    },

    async marcar(horarioId, pessoa) {
      const casado = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(horarioId)
      if (!casado) return { ok: false, motivo: 'horário inválido: use um horarioId de horarios_livres' }
      const comeco = new Date(`${casado[1]}T${casado[2]}:00${FUSO}`)
      const termino = new Date(comeco.getTime() + duracao * 60_000)

      // Alguém pode ter marcado no Google entre a consulta e a escolha.
      const busy = await ocupados(comeco, termino)
      if (!busy.ok) return busy
      if (busy.valor.length > 0) return { ok: false, motivo: 'esse horário acabou de ser ocupado; ofereça outro' }

      const r = await chamar(`/calendars/${calendario}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpoDoEvento(pessoa, servico, comeco, termino)),
      })
      if (!r.ok) return r
      return { ok: true, valor: paraMarcacao(objeto(r.valor), servico) }
    },

    async desmarcar(marcacaoId) {
      const r = await chamar(`/calendars/${calendario}/events/${encodeURIComponent(marcacaoId)}`, { method: 'DELETE' })
      // Já apagado no Google conta como desmarcado.
      if (!r.ok && !/respondeu 410|respondeu 404/.test(r.motivo)) return r
      return { ok: true, valor: true }
    },
  }
}

function corpoDoEvento(pessoa: PessoaDaAgenda, servico: string, comeco: Date, termino: Date) {
  const nome = pessoa.nome.trim() || 'Cliente'
  return {
    summary: `${servico}: ${nome}`,
    description: `Marcado pela conversa no Dialogon.\nTelefone: ${pessoa.telefone}`,
    start: { dateTime: comeco.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: termino.toISOString(), timeZone: 'America/Sao_Paulo' },
    extendedProperties: { private: { [CHAVE_DA_PESSOA]: pessoa.telefone } },
  }
}

function paraMarcacao(evento: Record<string, unknown>, servico: string): Marcacao {
  const comeco = instante(objeto(evento.start))
  const local = comeco === null ? null : new Date(comeco - 3 * 3_600_000).toISOString()
  return {
    marcacaoId: texto(evento.id),
    data: local ? local.slice(0, 10) : '',
    hora: local ? local.slice(11, 16) : '',
    servico,
    situacao: evento.status === 'cancelled' ? 'cancelado' : 'marcado',
  }
}

/** O instante de um `start`/`end` do Google, de dia inteiro ou com hora. */
function instante(ponto: Record<string, unknown>): number | null {
  const comHora = texto(ponto.dateTime)
  if (comHora) {
    const t = Date.parse(comHora)
    return Number.isNaN(t) ? null : t
  }
  const dia = texto(ponto.date)
  if (dia) {
    const t = Date.parse(`${dia}T00:00:00${FUSO}`)
    return Number.isNaN(t) ? null : t
  }
  return null
}

function minutos(hora: string): number | null {
  const casado = /^(\d{1,2}):(\d{2})$/.exec(hora.trim())
  return casado ? Number(casado[1]) * 60 + Number(casado[2]) : null
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
