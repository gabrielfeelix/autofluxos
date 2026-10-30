import {
  type Buscar,
  chamarJson,
  dataIso,
  diasEntre,
  guardarNoId,
  horaCurta,
  lerDoId,
  lista,
  numero,
  telefoneNacional,
  texto,
} from './comum'
import type { ConectorDeAgenda, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * EVO, da W12 (Swagger em evo-integracao-api.w12app.com.br, lido em
 * 30/out/2026).
 *
 * Basic com o DNS da academia como usuário e a Secret Key como senha. O
 * serviço é a **atividade** (pilates, spinning); o horário é a sessão da
 * grade (`idConfiguration` mais a data).
 *
 * Só aluno com cadastro reserva: a busca é pelo telefone (`/api/v2/members`),
 * e quem não é aluno vai para a recepção, que é onde a aula experimental se
 * combina.
 *
 * **Desmarcar não sai pela integração.** A troca de status da reserva existe
 * (`/api/v2/activities/booking/change-status`), mas o Swagger publica o enum
 * sem nomes (0, 1, 2). Gravar um número sem saber se é "cancelada" ou "faltou"
 * pode marcar falta em quem avisou; a conversa vai para a recepção.
 */

export const ENDERECO_DA_EVO = 'https://evo-integracao-api.w12app.com.br'
const SISTEMA = 'a EVO'

export type SegredoDaEvo = { dns: string; chave: string }
export type AjustesDaEvo = { idBranch?: number }

export function conectorEvo(segredo: SegredoDaEvo, ajustes: AjustesDaEvo = {}, buscar: Buscar = fetch): ConectorDeAgenda {
  const basic = Buffer.from(`${segredo.dns}:${segredo.chave}`, 'utf8').toString('base64')
  const cabecalhos = { authorization: `Basic ${basic}`, 'content-type': 'application/json', accept: 'application/json' }
  const chamar = (caminho: string, init: RequestInit = {}) =>
    chamarJson(buscar, `${ENDERECO_DA_EVO}${caminho}`, { ...init, headers: cabecalhos }, SISTEMA)
  const filial = ajustes.idBranch ? `&idBranch=${ajustes.idBranch}` : ''

  async function aluno(pessoa: PessoaDaAgenda): Promise<ResultadoDaAgenda<string | null>> {
    const r = await chamar(`/api/v2/members?phone=${telefoneNacional(pessoa.telefone)}&take=5${filial}`)
    if (!r.ok) return r
    return { ok: true, valor: texto(lista(r.valor)[0]?.idMember) || null }
  }

  async function grade(dia: string, extra: string) {
    const r = await chamar(`/api/v1/activities/schedule?date=${dia}${extra}${filial}`)
    return r.ok ? { ok: true as const, valor: lista(r.valor) } : r
  }

  return {
    async conferir() {
      const r = await chamar(`/api/v1/activities?take=50${filial}`)
      if (!r.ok) return r
      return { ok: true, valor: { resumo: `${lista(r.valor).length} atividades na grade` } }
    },

    async servicos() {
      const r = await chamar(`/api/v1/activities?take=100${filial}`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: {
          servicos: lista(r.valor)
            .filter((a) => a.inactive !== true)
            .map((a) => ({ servicoId: texto(a.idActivity), nome: texto(a.name) })),
          // O professor é da sessão, não da atividade: vem em cada horário.
          profissionais: [],
        },
      }
    },

    async horarios(filtro) {
      const horarios = []
      const atividade = filtro.servicoId ? `&idActivities=${encodeURIComponent(filtro.servicoId)}` : ''
      for (const dia of diasEntre(filtro.de, filtro.ate)) {
        const r = await grade(dia, `&onlyAvailables=true&take=100${atividade}`)
        if (!r.ok) return r
        for (const s of r.valor) {
          const capacidade = numero(s.capacity)
          const ocupadas = numero(s.ocupation) ?? 0
          if (capacidade !== null && ocupadas >= capacidade) continue
          const data = dataIso(s.activityDate) || dia
          const hora = horaCurta(s.startTime)
          if (!hora || !texto(s.idConfiguration)) continue
          horarios.push({
            horarioId: guardarNoId({ s: 'evo', c: texto(s.idConfiguration), d: data, h: hora, en: texto(s.name), pn: texto(s.instructor) }),
            data,
            hora,
            servico: texto(s.name),
            ...(texto(s.instructor) ? { profissional: texto(s.instructor) } : {}),
          })
        }
      }
      return { ok: true, valor: { horarios } }
    },

    async minhas(pessoa) {
      const id = await aluno(pessoa)
      if (!id.ok) return id
      if (!id.valor) return { ok: true, valor: [] }
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await grade(hoje, `&idMember=${id.valor}&showFullWeek=true&take=100`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: r.valor
          // Com `idMember`, a sessão em que a pessoa está volta com `memberStatus`.
          .filter((s) => texto(s.memberStatus) !== '')
          .map((s) => ({
            marcacaoId: guardarNoId({ c: texto(s.idConfiguration), d: dataIso(s.activityDate) }),
            data: dataIso(s.activityDate),
            hora: horaCurta(s.startTime),
            servico: texto(s.name),
            situacao: texto(s.memberStatus),
          }))
          .filter((m) => m.data >= hoje),
      }
    },

    async marcar(horarioId, pessoa) {
      const h = lerDoId(horarioId)
      if (!h || h.s !== 'evo') return { ok: false, motivo: 'horário inválido' }
      const id = await aluno(pessoa)
      if (!id.ok) return id
      if (!id.valor) return { ok: false, motivo: 'não há aluno com este telefone na EVO' }
      const busca = new URLSearchParams({ idConfiguration: h.c!, activityDate: h.d!, idMember: id.valor })
      const r = await chamar(`/api/v2/activities/booking?${busca}`, { method: 'POST' })
      if (!r.ok) return r
      return { ok: true, valor: { marcacaoId: guardarNoId({ c: h.c!, d: h.d! }), data: h.d!, hora: h.h!, servico: h.en ?? '', profissional: h.pn ?? '', situacao: 'Reservado' } }
    },

    async desmarcar() {
      return { ok: false, motivo: 'a EVO não desmarca pela integração; a recepção desmarca' }
    },
  }
}
