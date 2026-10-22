import 'server-only'
import { ENDERECO_DA_AGENDA } from '@/core/agenda'
import { enderecoDoPainel } from './endereco'
import { chaveDaAgenda } from './formularios-do-whatsapp/agenda'
import { apagarWebhook, criarWebhook, listarWebhooks, type WebhookDeEntrada } from './repos/webhooks-de-entrada'

/**
 * A ponte entre o AutoFluxos e a Verandi, os dois produtos da 4YU.
 *
 * Nenhum dos dois lê o banco do outro (dividem o projeto Supabase, cada um no
 * seu schema, e cruzar é proibido). A ponte é HTTP, com a chave `vr_` que a
 * conta já guardou para os blocos da agenda:
 *
 * - **avisos**: um clique cria o webhook de entrada daqui e registra o
 *   endereço e o segredo na Verandi (`PUT /api/v1/webhook`). Cada aula
 *   cancelada, falta ou vaga aberta chega em `/api/webhook/verandi/<conta>` e
 *   vira o gatilho de uma automação;
 * - **a ficha do aluno** na conversa (`GET /pessoas`, `GET /pessoas/:id`);
 * - **o relatório de aulas** em Análise (`GET /relatorio`).
 *
 * Tudo aqui falha quieto para quem só lê (a ficha some, o bloco some), e com
 * frase para quem clicou num botão.
 */

/** O nome do webhook de entrada que a ponte cria. É por ele que a tela o acha. */
export const NOME_DO_WEBHOOK_DA_VERANDI = 'Verandi (avisos)'

const TIMEOUT_MS = 4_000

async function chamar(chave: string, caminho: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${ENDERECO_DA_AGENDA}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${chave}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
}

export async function webhookDaVerandi(clienteId: string): Promise<WebhookDeEntrada | null> {
  return (await listarWebhooks(clienteId)).find((w) => w.nome === NOME_DO_WEBHOOK_DA_VERANDI) ?? null
}

export type ResultadoDaPonte = { ok: true } | { ok: false; erro: string }

/**
 * Liga os avisos. Ligar de novo troca o segredo dos dois lados, e é o jeito
 * de consertar quando algo saiu do lugar. Se a Verandi recusar, o webhook
 * criado aqui é apagado: segredo que só um lado conhece não serve para nada.
 */
export async function ligarAvisos(clienteId: string): Promise<ResultadoDaPonte> {
  const chave = await chaveDaAgenda(clienteId)
  if (!chave) return { ok: false, erro: 'Guarde antes a chave da Verandi, aqui mesmo nesta tela.' }

  const anterior = await webhookDaVerandi(clienteId)
  const novo = await criarWebhook(clienteId, NOME_DO_WEBHOOK_DA_VERANDI)
  if (!novo.ok) return { ok: false, erro: novo.motivo }

  const url = `${enderecoDoPainel()}/api/webhook/verandi/${clienteId}`
  let resposta: Response
  try {
    resposta = await chamar(chave, '/webhook', { method: 'PUT', body: JSON.stringify({ url, segredo: novo.segredo }) })
  } catch {
    await apagarWebhook(clienteId, novo.id)
    return { ok: false, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }
  }
  if (!resposta.ok) {
    await apagarWebhook(clienteId, novo.id)
    if (resposta.status === 401) return { ok: false, erro: 'A Verandi recusou a chave. Troque a chave e tente de novo.' }
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null
    return { ok: false, erro: corpo?.erro ? `A Verandi recusou: ${corpo.erro}.` : `A Verandi respondeu ${resposta.status}.` }
  }
  if (anterior) await apagarWebhook(clienteId, anterior.id)
  return { ok: true }
}

export async function desligarAvisos(clienteId: string): Promise<ResultadoDaPonte> {
  const chave = await chaveDaAgenda(clienteId)
  if (chave) await chamar(chave, '/webhook', { method: 'DELETE' }).catch(() => null)
  const atual = await webhookDaVerandi(clienteId)
  if (atual) await apagarWebhook(clienteId, atual.id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// A ficha do aluno
// ---------------------------------------------------------------------------

export type AlunoNaVerandi = {
  pessoaId: string
  nome: string
  situacao: string | null
  ativa: boolean
  ultimaPresenca: string | null
  licenca: { inicio: string; voltaPrevista: string | null } | null
  horariosFixos: { diaSemana: number; hora: string; servico: string | null }[]
  proximas: {
    participacaoId: string
    data: string
    hora: string
    servico: string | null
    /** Desmarcar agora ainda deixa reposição? Vale para o instante da leitura. */
    podeRepor: boolean
  }[]
  reposicoesAbertas: number
  /** A falta mais antiga ainda sem reposição: é ela que a próxima marcação repõe. */
  reposicaoDeId: string | null
  /** A modalidade, quando o contrato é de uma só: filtra os horários de marcar. */
  modalidade: { servicoId: string; nome: string } | null
  link: string
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

/**
 * O aluno pelo telefone do contato, ou `null`: sem chave, sem cadastro, ou a
 * Verandi fora do ar. A observação nunca vem, a Verandi não a manda.
 */
export async function alunoNaVerandi(clienteId: string, telefone: string): Promise<AlunoNaVerandi | null> {
  if (!/^\d{10,15}$/.test(telefone)) return null
  const chave = await chaveDaAgenda(clienteId)
  if (!chave) return null
  try {
    const achada = await chamar(chave, `/pessoas?telefone=${encodeURIComponent(telefone)}`)
    if (!achada.ok) return null
    const id = ((await achada.json()) as { pessoas?: { pessoaId?: string }[] }).pessoas?.[0]?.pessoaId
    if (!id) return null
    const ficha = await chamar(chave, `/pessoas/${encodeURIComponent(id)}`)
    if (!ficha.ok) return null
    const f = (await ficha.json()) as Record<string, unknown>
    const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
    const licenca = f.licenca as { inicio?: unknown; voltaPrevista?: unknown } | null
    const modalidade = f.modalidadeUnica as { servicoId?: unknown; nome?: unknown } | null
    return {
      pessoaId: id,
      nome: texto(f.nome) ?? '',
      situacao: texto(f.situacao),
      ativa: f.ativa === true,
      ultimaPresenca: texto(f.ultimaPresenca),
      licenca: licenca && texto(licenca.inicio) ? { inicio: licenca.inicio as string, voltaPrevista: texto(licenca.voltaPrevista) } : null,
      horariosFixos: lista(f.horariosFixos).map((h) => ({
        diaSemana: typeof h.diaSemana === 'number' ? h.diaSemana : 0,
        hora: texto(h.hora) ?? '',
        servico: texto(h.servico),
      })),
      proximas: lista(f.proximas)
        .filter((p) => texto(p.participacaoId))
        .slice(0, 6)
        .map((p) => ({
          participacaoId: p.participacaoId as string,
          data: texto(p.data) ?? '',
          hora: texto(p.hora) ?? '',
          servico: texto(p.servico),
          podeRepor: p.podeReporSeCancelarAgora !== false,
        })),
      reposicoesAbertas: lista(f.reposicoesAbertas).length,
      reposicaoDeId:
        lista(f.reposicoesAbertas)
          .filter((r) => texto(r.participacaoId))
          .sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')))[0]?.participacaoId as string | undefined ?? null,
      modalidade: modalidade && texto(modalidade.servicoId) ? { servicoId: modalidade.servicoId as string, nome: texto(modalidade.nome) ?? '' } : null,
      link: `${ENDERECO_DA_AGENDA.replace(/\/api\/v1$/, '')}/pessoas/${id}`,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// O relatório de aulas
// ---------------------------------------------------------------------------

export type RelatorioDaVerandi = {
  presencas: number
  faltas: number
  faltasAvisadas: number
  taxaDePresenca: number | null
  reposicoesFeitas: number
  experimentais: number
  experimentaisQueMatricularam: number
  matriculasNovas: number
  sairam: number
  alunosAtivos: number
}

/** O resumo das aulas do período, ou `null` sem chave ou com a Verandi fora. */
export async function relatorioDaVerandi(clienteId: string, de: string, ate: string): Promise<RelatorioDaVerandi | null> {
  const chave = await chaveDaAgenda(clienteId)
  if (!chave) return null
  try {
    const r = await chamar(chave, `/relatorio?de=${de}&ate=${ate}`)
    if (!r.ok) return null
    const c = (await r.json()) as Record<string, unknown>
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return {
      presencas: n(c.presencas),
      faltas: n(c.faltas),
      faltasAvisadas: n(c.faltasAvisadas),
      taxaDePresenca: typeof c.taxaDePresenca === 'number' ? c.taxaDePresenca : null,
      reposicoesFeitas: n(c.reposicoesFeitas),
      experimentais: n(c.experimentais),
      experimentaisQueMatricularam: n(c.experimentaisQueMatricularam),
      matriculasNovas: n(c.matriculasNovas),
      sairam: n(c.sairam),
      alunosAtivos: n(c.alunosAtivos),
    }
  } catch {
    return null
  }
}

/** A conta ligou a Verandi (guardou a chave)? Sem ir à Verandi. */
export async function temVerandi(clienteId: string): Promise<boolean> {
  return (await chaveDaAgenda(clienteId)) !== null
}
