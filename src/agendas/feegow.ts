import {
  type Buscar,
  chamarJson,
  dataBr,
  dataIso,
  diasEntre,
  guardarNoId,
  horaCurta,
  lerDoId,
  lista,
  objeto,
  somarDias,
  telefoneNacional,
  texto,
} from './comum'
import type { ConectorDeAgenda, Marcacao, PessoaDaAgenda, ResultadoDaAgenda } from './types'

/**
 * Feegow Clinic (docs.feegow.com, lido em 30/out/2026).
 *
 * O token (`x-access-token`) é liberado pelo usuário master da licença, na
 * interface do Feegow Clinic. Datas vão em `DD-MM-YYYY`; a disponibilidade
 * volta aninhada `profissional_id > local_id > data > [horas]`.
 *
 * O serviço é a **especialidade** (`tipo=E`): é como o paciente pede ("quero
 * um dermatologista"), e é o filtro que a disponibilidade exige.
 */

export const ENDERECO_DA_FEEGOW = 'https://api.feegow.com/v1/api'
const SISTEMA = 'a Feegow'

export type AjustesDaFeegow = {
  /** O local padrão da marcação. A Feegow usa 0 para "sem local". */
  localId?: number
  unidadeId?: number
  /** O motivo de cancelamento que a clínica usa para "desmarcado pelo paciente". */
  motivoDeCancelamento?: number
  canalId?: number
}

/** Status que ainda são compromisso. 1 marcado, 7 confirmado (GET /appoints/status). */
const STATUS_EM_ABERTO = new Set(['1', '7'])
const NOME_DO_STATUS: Record<string, string> = { '1': 'Marcado', '7': 'Confirmado' }

export function conectorFeegow(token: string, ajustes: AjustesDaFeegow = {}, buscar: Buscar = fetch): ConectorDeAgenda {
  const cabecalhos = { 'x-access-token': token, 'content-type': 'application/json', accept: 'application/json' }

  async function get(caminho: string) {
    const r = await chamarJson(buscar, `${ENDERECO_DA_FEEGOW}${caminho}`, { headers: cabecalhos }, SISTEMA)
    return r.ok ? conteudo(r.valor) : r
  }
  async function post(caminho: string, corpo: unknown) {
    const r = await chamarJson(
      buscar,
      `${ENDERECO_DA_FEEGOW}${caminho}`,
      { method: 'POST', headers: cabecalhos, body: JSON.stringify(corpo) },
      SISTEMA,
    )
    return r.ok ? conteudo(r.valor) : r
  }

  async function nomes() {
    const [esp, prof] = await Promise.all([get('/specialties/list'), get('/professional/list?ativo=1')])
    const especialidades = new Map<string, string>()
    const profissionais = new Map<string, string>()
    if (esp.ok) for (const e of lista(esp.valor)) especialidades.set(texto(e.especialidade_id), texto(e.nome))
    if (prof.ok) for (const p of lista(prof.valor)) profissionais.set(texto(p.profissional_id), texto(p.nome) || `Profissional ${texto(p.profissional_id)}`)
    return { esp, prof, especialidades, profissionais }
  }

  async function pacienteId(pessoa: PessoaDaAgenda, criar: boolean): Promise<ResultadoDaAgenda<string | null>> {
    const r = await get(`/patient/list?limit=5&telefone=${telefoneNacional(pessoa.telefone)}`)
    if (!r.ok) return r
    const achado = lista(r.valor)[0]
    const id = texto(achado?.patient_id ?? achado?.paciente_id)
    if (id) return { ok: true, valor: id }
    if (!criar) return { ok: true, valor: null }
    const criado = await post('/patient/create', {
      nome_completo: pessoa.nome.slice(0, 200) || 'Paciente do WhatsApp',
      ...(pessoa.cpf ? { cpf: pessoa.cpf.replace(/\D/g, '') } : { sem_cpf: true }),
      ...(pessoa.nascimento ? { data_nascimento: pessoa.nascimento } : {}),
      celular1: telefoneNacional(pessoa.telefone),
    })
    if (!criado.ok) return criado
    const novo = texto(objeto(criado.valor).paciente_id)
    return novo ? { ok: true, valor: novo } : { ok: false, motivo: `${SISTEMA} não devolveu o paciente criado` }
  }

  return {
    async conferir() {
      const r = await get('/specialties/list')
      if (!r.ok) return r
      return { ok: true, valor: { resumo: `${lista(r.valor).length} especialidades na agenda` } }
    },

    async servicos() {
      const { esp, prof } = await nomes()
      if (!esp.ok) return esp
      return {
        ok: true,
        valor: {
          servicos: lista(esp.valor)
            .filter((e) => texto(e.exibir_agendamento_online) !== '0')
            .map((e) => ({ servicoId: texto(e.especialidade_id), nome: texto(e.nome) })),
          profissionais: prof.ok
            ? lista(prof.valor).map((p) => ({
                profissionalId: texto(p.profissional_id),
                nome: texto(p.nome) || `Profissional ${texto(p.profissional_id)}`,
              }))
            : [],
        },
      }
    },

    async horarios(filtro) {
      if (!filtro.servicoId) {
        return {
          ok: true,
          valor: { horarios: [], aviso: 'Pergunte qual especialidade a pessoa procura e use o servicoId de servicos_da_agenda.' },
        }
      }
      const dias = diasEntre(filtro.de, filtro.ate)
      if (dias.length === 0) return { ok: false, motivo: 'período de datas inválido' }
      const busca = new URLSearchParams({
        tipo: 'E',
        especialidade_id: filtro.servicoId,
        data_start: dataBr(dias[0]!),
        data_end: dataBr(dias[dias.length - 1]!),
        unidade_id: String(ajustes.unidadeId ?? 0),
      })
      if (filtro.profissionalId) busca.set('profissional_id', filtro.profissionalId)
      const [r, n] = await Promise.all([get(`/appoints/available-schedule?${busca}`), nomes()])
      if (!r.ok) return r
      return {
        ok: true,
        valor: { horarios: horariosDaFeegow(r.valor, filtro.servicoId, n.especialidades, n.profissionais) },
      }
    },

    async minhas(pessoa) {
      const id = await pacienteId(pessoa, false)
      if (!id.ok) return id
      if (!id.valor) return { ok: true, valor: [] }
      const hoje = new Date().toISOString().slice(0, 10)
      const [r, n] = await Promise.all([
        get(`/appoints/search?paciente_id=${id.valor}&data_start=${dataBr(hoje)}&data_end=${dataBr(somarDias(hoje, 120))}`),
        nomes(),
      ])
      if (!r.ok) return r
      return { ok: true, valor: marcacoesDaFeegow(r.valor, n.especialidades, n.profissionais) }
    },

    async marcar(horarioId, pessoa) {
      const h = lerDoId(horarioId)
      if (!h || h.s !== 'feegow') return { ok: false, motivo: 'horário inválido' }
      const id = await pacienteId(pessoa, true)
      if (!id.ok) return id
      const r = await post('/appoints/new-appoint', {
        local_id: Number(h.l || ajustes.localId || 0),
        paciente_id: Number(id.valor),
        profissional_id: Number(h.p),
        especialidade_id: Number(h.e),
        data: dataBr(h.d!),
        horario: `${h.h}:00`,
        plano: 0,
        ...(ajustes.canalId ? { canal_id: ajustes.canalId } : {}),
        celular: telefoneNacional(pessoa.telefone),
        notas: 'Marcado pelo WhatsApp (Dialogon).',
      })
      if (!r.ok) return r
      const marcacaoId = texto(objeto(r.valor).agendamento_id)
      if (!marcacaoId) return { ok: false, motivo: `${SISTEMA} não confirmou a marcação` }
      return {
        ok: true,
        valor: { marcacaoId, data: h.d!, hora: h.h!, ...(h.en ? { servico: h.en } : {}), ...(h.pn ? { profissional: h.pn } : {}), situacao: 'Marcado' },
      }
    },

    async desmarcar(marcacaoId) {
      const r = await post('/appoints/cancel-appoint', {
        agendamento_id: Number(marcacaoId),
        motivo_id: ajustes.motivoDeCancelamento ?? 1,
        obs: 'Desmarcado pelo paciente no WhatsApp (Dialogon).',
      })
      return r.ok ? { ok: true, valor: true } : r
    },
  }
}

/** `{ success, content }`: o envelope de toda resposta da Feegow. */
function conteudo(bruto: unknown): ResultadoDaAgenda<unknown> {
  const env = objeto(bruto)
  if (env.success === false) return { ok: false, motivo: `${SISTEMA} recusou: ${texto(env.content) || 'sem motivo'}` }
  return { ok: true, valor: 'content' in env ? env.content : bruto }
}

/**
 * A disponibilidade: `{ profissional_id: { "<id>": { local_id: [ { "<data>": ["08:00:00"] } ] } } }`.
 * `local_id` vem como lista no exemplo da documentação (o índice é o local) e
 * como objeto em contas com vários locais; as duas formas são lidas.
 */
export function horariosDaFeegow(
  bruto: unknown,
  especialidadeId: string,
  especialidades: Map<string, string>,
  profissionais: Map<string, string>,
) {
  const saida: { horarioId: string; data: string; hora: string; servico?: string; profissional?: string }[] = []
  const porProfissional = objeto(objeto(bruto).profissional_id)
  const servico = especialidades.get(especialidadeId)
  for (const [profId, dadosDoProf] of Object.entries(porProfissional)) {
    const locais = objeto(dadosDoProf).local_id
    const entradas: [string, unknown][] = Array.isArray(locais)
      ? locais.map((v, i) => [String(i), v])
      : Object.entries(objeto(locais))
    for (const [localId, porData] of entradas) {
      for (const [dia, horas] of Object.entries(objeto(porData))) {
        const data = dataIso(dia)
        if (!data || !Array.isArray(horas)) continue
        for (const bruta of horas) {
          const hora = horaCurta(bruta)
          if (!hora) continue
          const profissional = profissionais.get(profId)
          saida.push({
            horarioId: guardarNoId({
              s: 'feegow', p: profId, l: localId, e: especialidadeId, d: data, h: hora,
              ...(servico ? { en: servico } : {}), ...(profissional ? { pn: profissional } : {}),
            }),
            data,
            hora,
            ...(servico ? { servico } : {}),
            ...(profissional ? { profissional } : {}),
          })
        }
      }
    }
  }
  return saida.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))
}

export function marcacoesDaFeegow(
  bruto: unknown,
  especialidades: Map<string, string>,
  profissionais: Map<string, string>,
): Marcacao[] {
  return lista(bruto)
    .filter((a) => STATUS_EM_ABERTO.has(texto(a.status_id)))
    .map((a) => {
      const servico = especialidades.get(texto(a.especialidade_id))
      const profissional = profissionais.get(texto(a.profissional_id))
      return {
        marcacaoId: texto(a.agendamento_id),
        data: dataIso(a.data),
        hora: horaCurta(a.horario),
        ...(servico ? { servico } : {}),
        ...(profissional ? { profissional } : {}),
        situacao: NOME_DO_STATUS[texto(a.status_id)] ?? 'Marcado',
      }
    })
    .filter((m) => m.marcacaoId && m.data)
}
