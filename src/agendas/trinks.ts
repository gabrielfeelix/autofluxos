import {
  type Buscar,
  chamarJson,
  dataIso,
  diasEntre,
  guardarNoId,
  horaCurta,
  lerDoId,
  lista,
  objeto,
  numero,
  reais,
  somarDias,
  telefoneNacional,
  texto,
} from './comum'
import type { ConectorDeAgenda, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * Trinks (trinks.readme.io, lido em 30/out/2026).
 *
 * Cabeçalhos `X-Api-Key` e `estabelecimentoId`. A chave sai de trinks.com >
 * Minha Área > Meu Cadastro > Token de API Pessoal e vale para todos os
 * estabelecimentos do dono, por isso o estabelecimento vai junto na conexão.
 *
 * **60 consultas por minuto e 5.000 por mês por chave.** A busca de horários
 * é por dia, então o período fica curto (`DIAS_DA_TRINKS`).
 *
 * **A Trinks não confere conflito ao criar agendamento.** Antes de gravar, a
 * vaga é lida de novo; se sumiu, a marcação não sai.
 */

export const ENDERECO_DA_TRINKS = 'https://api.trinks.com'
const SISTEMA = 'a Trinks'
const DIAS_DA_TRINKS = 3

export type AjustesDaTrinks = { estabelecimentoId: string }

const ENCERRADOS = /cancel|falt|finaliz|conclu/i

export function conectorTrinks(chave: string, ajustes: AjustesDaTrinks, buscar: Buscar = fetch): ConectorDeAgenda {
  const cabecalhos = {
    'X-Api-Key': chave,
    estabelecimentoId: ajustes.estabelecimentoId,
    'content-type': 'application/json',
    accept: 'application/json',
  }
  const chamar = (caminho: string, init: RequestInit = {}) =>
    chamarJson(buscar, `${ENDERECO_DA_TRINKS}${caminho}`, { ...init, headers: cabecalhos }, SISTEMA)

  async function servicos() {
    const r = await chamar('/v1/servicos?pageSize=100&somenteVisiveisCliente=true')
    if (!r.ok) return r
    return { ok: true as const, valor: lista(objeto(r.valor).data) }
  }

  async function vagasDoDia(dia: string, servicoId: string, duracao: string, profissionalId?: string) {
    const busca = new URLSearchParams({ servicoId, ...(duracao ? { servicoDuracao: duracao } : {}) })
    if (profissionalId) busca.set('profissionalId', profissionalId)
    const r = await chamar(`/v1/agendamentos/profissionais/${dia}?${busca}`)
    if (!r.ok) return r
    return { ok: true as const, valor: lista(objeto(r.valor).data) }
  }

  async function clienteId(pessoa: PessoaDaAgenda, criar: boolean): Promise<ResultadoDaAgenda<string | null>> {
    const nacional = telefoneNacional(pessoa.telefone)
    const r = await chamar(`/v1/clientes?Telefone=${nacional}&PageSize=5`)
    if (!r.ok) return r
    const id = texto(lista(objeto(r.valor).data)[0]?.id)
    if (id) return { ok: true, valor: id }
    if (!criar) return { ok: true, valor: null }
    const criado = await chamar('/v1/clientes', {
      method: 'POST',
      body: JSON.stringify({
        nome: pessoa.nome.slice(0, 120) || 'Cliente do WhatsApp',
        // 6 = WhatsApp, pela tabela de tipos de telefone da Trinks.
        telefones: [{ ddi: '55', ddd: nacional.slice(0, 2), numero: nacional.slice(2), tipoId: 6 }],
      }),
    })
    if (!criado.ok) return criado
    const novo = texto(objeto(criado.valor).id)
    return novo ? { ok: true, valor: novo } : { ok: false, motivo: `${SISTEMA} não devolveu o cliente criado` }
  }

  return {
    async conferir() {
      const r = await servicos()
      if (!r.ok) return r
      return { ok: true, valor: { resumo: `${r.valor.length} serviços na agenda` } }
    },

    async servicos() {
      const [s, p] = await Promise.all([servicos(), chamar('/v1/profissionais?pageSize=100')])
      if (!s.ok) return s
      return {
        ok: true,
        valor: {
          servicos: s.valor.map((v) => {
            const preco = numero(v.preco)
            const duracao = numero(v.duracaoEmMinutos)
            return {
              servicoId: texto(v.id),
              nome: texto(v.nome),
              ...(duracao ? { duracaoMin: duracao } : {}),
              ...(preco !== null ? { preco: reais(Math.round(preco * 100)) } : {}),
            }
          }),
          profissionais: p.ok
            ? lista(objeto(p.valor).data).map((x) => ({ profissionalId: texto(x.id), nome: texto(x.nome) }))
            : [],
        },
      }
    },

    async horarios(filtro) {
      if (!filtro.servicoId) {
        return { ok: true, valor: { horarios: [], aviso: 'Pergunte qual serviço a pessoa quer e use o servicoId de servicos_da_agenda.' } }
      }
      const s = await servicos()
      if (!s.ok) return s
      const servico = s.valor.find((v) => texto(v.id) === filtro.servicoId)
      const duracao = texto(servico?.duracaoEmMinutos)
      const nomeDoServico = texto(servico?.nome)
      const horarios = []
      for (const dia of diasEntre(filtro.de, filtro.ate).slice(0, DIAS_DA_TRINKS)) {
        const r = await vagasDoDia(dia, filtro.servicoId, duracao, filtro.profissionalId)
        if (!r.ok) return r
        for (const prof of r.valor) {
          for (const bruta of Array.isArray(prof.horariosVagos) ? prof.horariosVagos : []) {
            const hora = horaCurta(bruta)
            if (!hora) continue
            horarios.push({
              horarioId: guardarNoId({
                s: 'trinks', p: texto(prof.id), d: dia, h: hora, sv: filtro.servicoId, du: duracao || '30',
                ...(servico && numero(servico.preco) !== null ? { v: texto(servico.preco) } : {}),
                en: nomeDoServico, pn: texto(prof.nome),
              }),
              data: dia,
              hora,
              ...(nomeDoServico ? { servico: nomeDoServico } : {}),
              profissional: texto(prof.nome),
            })
          }
        }
      }
      return { ok: true, valor: { horarios } }
    },

    async minhas(pessoa) {
      const id = await clienteId(pessoa, false)
      if (!id.ok) return id
      if (!id.valor) return { ok: true, valor: [] }
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await chamar(`/v1/agendamentos?clienteId=${id.valor}&dataInicio=${hoje}&dataFim=${somarDias(hoje, 120)}&pageSize=50`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: lista(objeto(r.valor).data)
          .filter((a) => !ENCERRADOS.test(texto(objeto(a.status).nome)))
          .map((a) => ({
            marcacaoId: texto(a.id),
            data: dataIso(a.dataHoraInicio),
            hora: horaCurta(a.dataHoraInicio),
            servico: texto(objeto(a.servico).nome),
            profissional: texto(objeto(a.profissional).nome),
            situacao: texto(objeto(a.status).nome) || 'Marcado',
          }))
          .filter((m) => m.marcacaoId && m.data),
      }
    },

    async marcar(horarioId, pessoa) {
      const h = lerDoId(horarioId)
      if (!h || h.s !== 'trinks') return { ok: false, motivo: 'horário inválido' }
      // A Trinks grava em cima de outro agendamento: a vaga é conferida agora.
      const vagas = await vagasDoDia(h.d!, h.sv!, h.du!, h.p)
      if (!vagas.ok) return vagas
      const livre = vagas.valor.some(
        (prof) => texto(prof.id) === h.p && Array.isArray(prof.horariosVagos) && prof.horariosVagos.some((x) => horaCurta(x) === h.h),
      )
      if (!livre) return { ok: false, motivo: 'esse horário acabou de ser ocupado' }
      const id = await clienteId(pessoa, true)
      if (!id.ok) return id
      const r = await chamar('/v1/agendamentos', {
        method: 'POST',
        body: JSON.stringify({
          servicoId: Number(h.sv),
          clienteId: Number(id.valor),
          profissionalId: Number(h.p),
          dataHoraInicio: `${h.d}T${h.h}:00`,
          duracaoEmMinutos: Number(h.du) || 30,
          ...(h.v ? { valor: Number(h.v) } : {}),
          observacoes: 'Marcado pelo WhatsApp (Dialogon).',
          confirmado: false,
        }),
      })
      if (!r.ok) return r
      const marcacaoId = texto(objeto(r.valor).id)
      if (!marcacaoId) return { ok: false, motivo: `${SISTEMA} não confirmou a marcação` }
      return { ok: true, valor: { marcacaoId, data: h.d!, hora: h.h!, servico: h.en ?? '', profissional: h.pn ?? '', situacao: 'Marcado' } }
    },

    async desmarcar(marcacaoId) {
      const r = await chamar(`/v1/agendamentos/${encodeURIComponent(marcacaoId)}/status/cancelado`, {
        method: 'PATCH',
        // 1 = Cliente, pela tabela de quem cancelou.
        body: JSON.stringify({ quemCancelou: 1, motivo: 'Desmarcado pela cliente no WhatsApp (Dialogon).' }),
      })
      return r.ok ? { ok: true, valor: true } : r
    },
  }
}
