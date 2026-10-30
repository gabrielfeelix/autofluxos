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
  objeto,
  somarDias,
  telefoneNacional,
  texto,
} from './comum'
import type { ConectorDeAgenda, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * Clínica nas Nuvens (OpenAPI em api.clinicanasnuvens.com.br/v2/api-docs,
 * lido em 30/out/2026).
 *
 * Duas camadas de credencial: Basic com `client_id:client_secret` e o token da
 * clínica no cabeçalho `clinicaNasNuvens-cid` (Configurações > Minha Empresa >
 * Integrações > API Clínica nas Nuvens). Limite de 120 consultas por minuto.
 *
 * **Paciente não se acha por telefone**: a busca é por CPF. Por isso este
 * conector pede o CPF (`pedir: 'cpf'`), e só aceita o paciente achado se o
 * celular do cadastro for o mesmo de quem conversa. Sem essa conferência,
 * qualquer um que soubesse um CPF veria a agenda de outra pessoa.
 *
 * A disponibilidade é por profissional. Sem profissional escolhido, a busca
 * percorre os profissionais ativos até `PROFISSIONAIS_POR_BUSCA`, por causa do
 * limite por minuto.
 */

export const ENDERECO_DA_CLINICA_NAS_NUVENS = 'https://api.clinicanasnuvens.com.br'
const SISTEMA = 'a Clínica nas Nuvens'
const PROFISSIONAIS_POR_BUSCA = 6

export type SegredoDaClinicaNasNuvens = { clientId: string; clientSecret: string; cid: string }

export type AjustesDaClinicaNasNuvens = {
  /** Obrigatórios para marcar: em qual agenda e com qual tipo de consulta. */
  idLocalAgenda?: number
  idTipoConsulta?: number
  /** O convênio "Particular", associado ao paciente que não tem nenhum. */
  idTipoConvenioParticular?: number
  /** Duração padrão, quando a disponibilidade não traz o fim. */
  duracaoMin?: number
}

const EM_ABERTO = new Set(['AGENDADO', 'CONFIRMADO', 'CONFIRMADO_PACIENTE', 'EM_ESPERA'])
const NOME_DA_SITUACAO: Record<string, string> = {
  AGENDADO: 'Marcado',
  CONFIRMADO: 'Confirmado',
  CONFIRMADO_PACIENTE: 'Confirmado',
  EM_ESPERA: 'Em espera',
}

export function conectorClinicaNasNuvens(
  segredo: SegredoDaClinicaNasNuvens,
  ajustes: AjustesDaClinicaNasNuvens = {},
  buscar: Buscar = fetch,
): ConectorDeAgenda {
  const basic = Buffer.from(`${segredo.clientId}:${segredo.clientSecret}`, 'utf8').toString('base64')
  const cabecalhos = {
    authorization: `Basic ${basic}`,
    'clinicaNasNuvens-cid': segredo.cid,
    'content-type': 'application/json',
    accept: 'application/json',
  }
  const chamar = (caminho: string, init: RequestInit = {}) =>
    chamarJson(buscar, `${ENDERECO_DA_CLINICA_NAS_NUVENS}${caminho}`, { ...init, headers: cabecalhos }, SISTEMA)

  async function profissionais() {
    const r = await chamar('/executor-agenda/lista?somenteAtivos=true&somenteProfissionaisSaude=true&registrosPorPagina=50')
    if (!r.ok) return r
    return {
      ok: true as const,
      valor: lista(objeto(r.valor).lista).map((e) => ({
        id: texto(e.id),
        idPessoa: texto(e.idpessoa),
        nome: texto(e.nome),
      })),
    }
  }

  /** O paciente pelo CPF, só se o celular dele for o de quem conversa. */
  async function paciente(pessoa: PessoaDaAgenda, criar: boolean): Promise<ResultadoDaAgenda<string | null>> {
    const cpf = (pessoa.cpf ?? '').replace(/\D/g, '')
    if (cpf.length !== 11) return { ok: false, motivo: 'falta o CPF', pedir: 'cpf' }
    const r = await chamar(`/paciente/lista?cpfCnpj=${cpf}&somenteAtivos=true`)
    if (!r.ok) return r
    const achado = lista(objeto(r.valor).lista)[0]
    if (achado) {
      const contato = objeto(achado.contato)
      const celulares = [contato.telefoneCelular, contato.telefoneRecados, contato.telefoneResidencial]
      if (!celulares.some((c) => mesmoTelefone(c, pessoa.telefone))) {
        return { ok: false, motivo: 'o CPF informado é de um cadastro com outro telefone' }
      }
      return { ok: true, valor: texto(achado.id) }
    }
    if (!criar) return { ok: true, valor: null }
    if (!pessoa.nascimento) return { ok: false, motivo: 'falta a data de nascimento', pedir: 'nascimento' }
    const criado = await chamar('/paciente/novo', {
      method: 'POST',
      body: JSON.stringify({
        nome: pessoa.nome.slice(0, 120) || 'Paciente do WhatsApp',
        cpfcnpj: cpf,
        dataNascimento: pessoa.nascimento,
        contato: { telefoneCelular: telefoneNacional(pessoa.telefone) },
      }),
    })
    if (!criado.ok) return criado
    const id = texto(objeto(criado.valor).id)
    return id ? { ok: true, valor: id } : { ok: false, motivo: `${SISTEMA} não devolveu o paciente criado` }
  }

  /** O convênio do paciente que a marcação exige: o que ele tem, ou o particular. */
  async function convenioDoPaciente(idPaciente: string): Promise<ResultadoDaAgenda<number>> {
    const r = await chamar(`/convenio-paciente/lista?idPaciente=${idPaciente}&somenteAtivos=true`)
    if (!r.ok) return r
    const convenios = lista(objeto(r.valor).lista)
    const particular = convenios.find((c) => String(c.idTipoConvenio) === String(ajustes.idTipoConvenioParticular))
    const escolhido = particular ?? convenios[0]
    if (escolhido) return { ok: true, valor: Number(escolhido.id) }
    if (!ajustes.idTipoConvenioParticular) return { ok: false, motivo: 'o paciente não tem convênio e a conexão não diz qual é o particular' }
    const novo = await chamar('/convenio-paciente/associar', {
      method: 'POST',
      body: JSON.stringify({ idPaciente: Number(idPaciente), idTipoConvenio: ajustes.idTipoConvenioParticular }),
    })
    if (!novo.ok) return novo
    const id = Number(objeto(novo.valor).id)
    return Number.isFinite(id) && id > 0 ? { ok: true, valor: id } : { ok: false, motivo: `${SISTEMA} não associou o convênio` }
  }

  return {
    async conferir() {
      const r = await chamar('/info')
      if (!r.ok) return r
      const p = await profissionais()
      return { ok: true, valor: { resumo: p.ok ? `${p.valor.length} profissionais na agenda` : 'chave aceita' } }
    },

    async servicos() {
      const [tipos, profs] = await Promise.all([chamar('/tipo-consulta/lista?somenteAtivos=true&registrosPorPagina=50'), profissionais()])
      if (!tipos.ok) return tipos
      return {
        ok: true,
        valor: {
          servicos: lista(objeto(tipos.valor).lista).map((t) => ({ servicoId: texto(t.id), nome: texto(t.nome) })),
          profissionais: profs.ok ? profs.valor.map((p) => ({ profissionalId: p.id, nome: p.nome })) : [],
        },
      }
    },

    async horarios(filtro) {
      const dias = diasEntre(filtro.de, filtro.ate)
      if (dias.length === 0) return { ok: false, motivo: 'período de datas inválido' }
      const profs = await profissionais()
      if (!profs.ok) return profs
      const alvo = filtro.profissionalId
        ? profs.valor.filter((p) => p.id === filtro.profissionalId)
        : profs.valor.slice(0, PROFISSIONAIS_POR_BUSCA)
      const horarios = []
      for (const prof of alvo) {
        const busca = new URLSearchParams({ idExecutorAgenda: prof.id, data: dias[0]!, dataFim: dias[dias.length - 1]! })
        const r = await chamar(`/executor-agenda/disponibilidade?${busca}`)
        if (!r.ok) return r
        for (const vaga of lista(r.valor)) {
          if (filtro.servicoId && texto(vaga.idTipoConsulta) && texto(vaga.idTipoConsulta) !== filtro.servicoId) continue
          const data = dataIso(vaga.data)
          const hora = horaCurta(vaga.horaInicio)
          if (!data || !hora) continue
          horarios.push({
            horarioId: guardarNoId({
              s: 'cnn', x: prof.id, pp: prof.idPessoa, d: data, h: hora,
              f: horaCurta(vaga.horaFim), t: texto(vaga.idTipoConsulta) || filtro.servicoId || '', pn: prof.nome,
            }),
            data,
            hora,
            profissional: prof.nome,
          })
        }
      }
      horarios.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))
      return { ok: true, valor: { horarios } }
    },

    async minhas(pessoa) {
      const id = await paciente(pessoa, false)
      if (!id.ok) return id
      if (!id.valor) return { ok: true, valor: [] }
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await chamar(`/agenda/lista?codigoPaciente=${id.valor}&dataInicial=${hoje}&dataFinal=${somarDias(hoje, 120)}`)
      if (!r.ok) return r
      return {
        ok: true,
        valor: lista(objeto(r.valor).lista)
          .filter((a) => EM_ABERTO.has(texto(a.status)))
          .map((a) => ({
            marcacaoId: texto(a.id),
            data: dataIso(a.data),
            hora: horaCurta(a.horaInicio),
            situacao: NOME_DA_SITUACAO[texto(a.status)] ?? 'Marcado',
          }))
          .filter((m) => m.marcacaoId && m.data),
      }
    },

    async marcar(horarioId, pessoa) {
      const h = lerDoId(horarioId)
      if (!h || h.s !== 'cnn') return { ok: false, motivo: 'horário inválido' }
      if (!ajustes.idLocalAgenda) return { ok: false, motivo: 'a conexão não diz em qual agenda marcar' }
      const tipo = Number(h.t || ajustes.idTipoConsulta)
      if (!tipo) return { ok: false, motivo: 'a conexão não diz o tipo de consulta' }
      const id = await paciente(pessoa, true)
      if (!id.ok) return id
      const convenio = await convenioDoPaciente(id.valor!)
      if (!convenio.ok) return convenio
      const fim = h.f || somarMinutos(h.h!, ajustes.duracaoMin ?? 30)
      const r = await chamar('/agenda/novo', {
        method: 'POST',
        body: JSON.stringify({
          data: h.d,
          horaInicio: h.h,
          horaFim: fim,
          idLocalAgenda: ajustes.idLocalAgenda,
          idPaciente: Number(id.valor),
          idPacienteConvenio: convenio.valor,
          idTipoConsulta: tipo,
          ...(h.pp ? { idPessoaExecutor: Number(h.pp) } : {}),
          status: 'AGENDADO',
          telefoneCelularPaciente: telefoneNacional(pessoa.telefone),
          observacoes: 'Marcado pelo WhatsApp (AutoFluxos).',
        }),
      })
      if (!r.ok) return r
      const marcacaoId = texto(objeto(r.valor).id)
      if (!marcacaoId) return { ok: false, motivo: `${SISTEMA} não confirmou a marcação` }
      return { ok: true, valor: { marcacaoId, data: h.d!, hora: h.h!, ...(h.pn ? { profissional: h.pn } : {}), situacao: 'Marcado' } }
    },

    async desmarcar(marcacaoId) {
      const r = await chamar('/agenda/alteracao-status', {
        method: 'PUT',
        body: JSON.stringify({ idAgenda: Number(marcacaoId), status: 'CANCELADO_PACIENTE' }),
      })
      return r.ok ? { ok: true, valor: true } : r
    },
  }
}

export function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = (h! * 60 + m! + minutos) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
