import {
  type Buscar,
  chamarJson,
  dataIso,
  diasEntre,
  guardarNoId,
  horaCurta,
  lerDoId,
  lista,
  mesmoTelefone,
  numero,
  objeto,
  reais,
  somarDias,
  texto,
} from './comum'
import type { ConectorDeAgenda, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * AgendaPro (developers.agendapro.com, API v3, lido em 30/out/2026).
 *
 * `Authorization: Bearer apk_live_...`, criada em Configuraciones >
 * Integraciones. A chave é de uma empresa; o local vai na conexão, porque a
 * busca de vagas exige `location_id`.
 *
 * **Data local com `Z`.** A AgendaPro escreve a hora do local com o sufixo `Z`,
 * e o `Z` não quer dizer UTC: 13:00 em São Paulo vai e volta como
 * `T13:00:00Z`. Nada aqui converte fuso.
 *
 * Reserva criada pela API não dispara aviso da AgendaPro: quem confirma para
 * a pessoa é a própria conversa.
 */

export const ENDERECO_DA_AGENDAPRO = 'https://connect.agendapro.com'
const SISTEMA = 'a AgendaPro'

export type AjustesDaAgendaPro = { locationId?: number }

const ENCERRADOS = /cancel|no.?show|falt|complet|finaliz/i

export function conectorAgendaPro(chave: string, ajustes: AjustesDaAgendaPro = {}, buscar: Buscar = fetch): ConectorDeAgenda {
  const cabecalhos = { authorization: `Bearer ${chave}`, 'content-type': 'application/json', accept: 'application/json' }
  const chamar = (caminho: string, init: RequestInit = {}) =>
    chamarJson(buscar, `${ENDERECO_DA_AGENDAPRO}${caminho}`, { ...init, headers: cabecalhos }, SISTEMA)

  async function local(): Promise<ResultadoDaAgenda<number>> {
    if (ajustes.locationId) return { ok: true, valor: ajustes.locationId }
    const r = await chamar('/v3/locations?per_page=5')
    if (!r.ok) return r
    const locais = lista(objeto(r.valor).data)
    if (locais.length !== 1) return { ok: false, motivo: 'a conta tem mais de um local e a conexão não diz qual' }
    return { ok: true, valor: Number(locais[0]!.id) }
  }

  async function clienteId(pessoa: PessoaDaAgenda, criar: boolean): Promise<ResultadoDaAgenda<string | null>> {
    const digitos = pessoa.telefone.replace(/\D/g, '')
    const r = await chamar(`/v3/clients/quick-search?q=${digitos.slice(-9)}&limit=5`)
    if (!r.ok) return r
    // A busca é por texto livre (nome, e-mail, documento): o telefone confere.
    const achado = lista(objeto(r.valor).data).find((c) => mesmoTelefone(c.phone, digitos))
    if (achado) return { ok: true, valor: texto(achado.id) }
    if (!criar) return { ok: true, valor: null }
    const [primeiro, ...resto] = (pessoa.nome || 'Cliente do WhatsApp').trim().split(/\s+/)
    const criado = await chamar('/v3/clients', {
      method: 'POST',
      body: JSON.stringify({ first_name: primeiro, last_name: resto.join(' ') || '-', phone: `+${digitos}` }),
    })
    if (!criado.ok) return criado
    const id = texto(objeto(criado.valor).id)
    return id ? { ok: true, valor: id } : { ok: false, motivo: `${SISTEMA} não devolveu o cliente criado` }
  }

  return {
    async conferir() {
      const r = await chamar('/v3/services?per_page=50')
      if (!r.ok) return r
      return { ok: true, valor: { resumo: `${lista(objeto(r.valor).data).length} serviços na agenda` } }
    },

    async servicos() {
      const [s, p] = await Promise.all([chamar('/v3/services?per_page=100'), chamar('/v3/providers?per_page=100')])
      if (!s.ok) return s
      return {
        ok: true,
        valor: {
          servicos: lista(objeto(s.valor).data).map((v) => {
            const preco = numero(v.price)
            const duracao = numero(v.duration)
            return {
              servicoId: texto(v.id),
              nome: texto(v.name),
              ...(duracao ? { duracaoMin: duracao } : {}),
              ...(preco !== null ? { preco: reais(Math.round(preco * 100)) } : {}),
            }
          }),
          profissionais: p.ok
            ? lista(objeto(p.valor).data).map((x) => ({ profissionalId: texto(x.id), nome: texto(x.public_name ?? x.name) }))
            : [],
        },
      }
    },

    async horarios(filtro) {
      if (!filtro.servicoId) {
        return { ok: true, valor: { horarios: [], aviso: 'Pergunte qual serviço a pessoa quer e use o servicoId de servicos_da_agenda.' } }
      }
      const l = await local()
      if (!l.ok) return l
      const horarios = []
      for (const dia of diasEntre(filtro.de, filtro.ate)) {
        const busca = new URLSearchParams({ location_id: String(l.valor), start_date: dia, service_id: filtro.servicoId })
        if (filtro.profissionalId) busca.set('provider_id', filtro.profissionalId)
        const r = await chamar(`/v3/available_slots?${busca}`)
        if (!r.ok) return r
        const dados = objeto(objeto(r.valor).data)
        for (const vaga of lista(dados.slots)) {
          const hora = horaCurta(vaga.start_time)
          if (!hora) continue
          horarios.push({
            horarioId: guardarNoId({
              s: 'agendapro', d: dia, h: hora, f: horaCurta(vaga.end_time), sv: filtro.servicoId,
              p: texto(vaga.provider_id), l: String(l.valor), pn: texto(vaga.provider_name),
            }),
            data: dia,
            hora,
            profissional: texto(vaga.provider_name),
          })
        }
      }
      return { ok: true, valor: { horarios } }
    },

    async minhas(pessoa) {
      const id = await clienteId(pessoa, false)
      if (!id.ok) return id
      if (!id.valor) return { ok: true, valor: [] }
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await chamar(`/v3/bookings?client_id=${id.valor}&start_date=${hoje}&end_date=${somarDias(hoje, 120)}&per_page=50`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: lista(objeto(r.valor).data)
          .filter((b) => !ENCERRADOS.test(texto(objeto(b.status).name)))
          .map((b) => ({
            marcacaoId: texto(b.id),
            data: dataIso(b.start_time),
            hora: horaCurta(b.start_time),
            servico: texto(objeto(b.service).name),
            profissional: texto(objeto(b.service_provider).public_name),
            situacao: texto(objeto(b.status).name) || 'Marcado',
          }))
          .filter((m) => m.marcacaoId && m.data),
      }
    },

    async marcar(horarioId, pessoa) {
      const h = lerDoId(horarioId)
      if (!h || h.s !== 'agendapro') return { ok: false, motivo: 'horário inválido' }
      const id = await clienteId(pessoa, true)
      if (!id.ok) return id
      const r = await chamar('/v3/bookings', {
        method: 'POST',
        body: JSON.stringify({
          start_time: `${h.d}T${h.h}:00Z`,
          ...(h.f ? { end_time: `${h.d}T${h.f}:00Z` } : {}),
          service_id: Number(h.sv),
          provider_id: Number(h.p),
          client_id: Number(id.valor),
          location_id: Number(h.l),
          notes: 'Marcado pelo WhatsApp (AutoFluxos).',
        }),
      })
      if (!r.ok) return r
      const marcacaoId = texto(objeto(r.valor).id)
      if (!marcacaoId) return { ok: false, motivo: `${SISTEMA} não confirmou a marcação` }
      return { ok: true, valor: { marcacaoId, data: h.d!, hora: h.h!, profissional: h.pn ?? '', situacao: 'Marcado' } }
    },

    async desmarcar(marcacaoId) {
      const r = await chamar(`/v3/bookings/${encodeURIComponent(marcacaoId)}/cancel`, { method: 'PATCH' })
      return r.ok ? { ok: true, valor: true } : r
    },
  }
}
