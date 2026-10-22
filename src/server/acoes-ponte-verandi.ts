'use server'

import { revalidatePath } from 'next/cache'
import { dentroDaJanela } from '@/channels/janela'
import { EXEMPLOS_DO_MODELO_DA_VERANDI, MODELOS_DA_VERANDI } from '@/core/eventos-da-verandi'
import { janelaDeDias, type HorarioLivre } from '@/core/formulario-de-agendamento'
import { acaoApagarTemplate, acaoCriarTemplate } from './acoes-transmissoes'
import { registrar } from './repos/auditoria'
import { chaveDaAgenda, desmarcarNaAgenda, horariosLivres, marcarNaAgenda } from './formularios-do-whatsapp/agenda'
import { alunoNaVerandi, desligarAvisos, ligarAvisos, webhookDaVerandi, type AlunoNaVerandi, type ResultadoDaPonte } from './ponte-verandi'
import { contextoDeResposta } from './repos/conversas'
import { acharGatilhoDeEvento } from './repos/webhooks-de-entrada'
import { exigirCapacidade, meuAlcance, recusou } from './permissoes'
import { acharLead } from './repos/leads'
import { listarTemplates } from './repos/templates'

/**
 * Ligar e desligar os avisos da Verandi (a ponte). Mexe em integração, então
 * é de quem configura a operação, como guardar a chave.
 */

export async function acaoLigarAvisosDaVerandi(clienteId: string): Promise<ResultadoDaPonte> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const r = await ligarAvisos(clienteId)
  if (r.ok) {
    await auditar(clienteId, acesso, 'ligou_avisos_da_verandi')
    revalidatePath(`/clientes/${clienteId}/ajustes/chaves`)
  }
  return r
}

export async function acaoDesligarAvisosDaVerandi(clienteId: string): Promise<ResultadoDaPonte> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const r = await desligarAvisos(clienteId)
  await auditar(clienteId, acesso, 'desligou_avisos_da_verandi')
  revalidatePath(`/clientes/${clienteId}/ajustes/chaves`)
  return r
}

/**
 * Cria na Meta os modelos de fora das 24 horas, um por aviso, como
 * `acaoCriarModeloDeCobranca`: o aprovado e o em análise ficam, o recusado e o
 * rascunho são apagados e mandados de novo (o nome é único por conta).
 * Utilidade; a aprovação costuma levar minutos.
 */
export async function acaoCriarModelosDaVerandi(clienteId: string): Promise<ResultadoDaPonte> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite criar modelo.' }
  const existentes = await listarTemplates(clienteId)
  for (const m of MODELOS_DA_VERANDI) {
    const anterior = existentes.find((t) => t.nome === m.nome)
    if (anterior && anterior.status !== 'recusado' && anterior.status !== 'rascunho') continue
    if (anterior) {
      const apagado = await acaoApagarTemplate(clienteId, anterior.id)
      if (!apagado.ok) return { ok: false, erro: apagado.erro ?? 'A Meta não apagou o modelo recusado.' }
    }
    const r = await acaoCriarTemplate(clienteId, {
      nome: m.nome,
      categoria: 'UTILITY',
      componentes: { corpo: m.corpo },
      exemplos: EXEMPLOS_DO_MODELO_DA_VERANDI,
    })
    if (!r.ok) return { ok: false, erro: r.erro ?? 'A Meta não aceitou agora.' }
  }
  await auditar(clienteId, acesso, 'criou_modelos_da_verandi')
  return { ok: true }
}

type Acesso = Exclude<Awaited<ReturnType<typeof exigirCapacidade>>, { erro: string }>

async function auditar(clienteId: string, acesso: Acesso, acao: string): Promise<void> {
  await registrar({
    acao,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'integracao',
    alvoNome: 'Verandi',
    impersonadoPor: acesso.sessao.impersonadoPor,
  }).catch(() => undefined)
}

/**
 * O aluno na Verandi para a conversa e a ficha. Só para quem enxerga o
 * contato; sem chave, sem cadastro ou com a Verandi fora, `null`, e o cartão
 * não aparece.
 */
export async function acaoAlunoNaVerandi(clienteId: string, contatoId: string): Promise<AlunoNaVerandi | null> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return null
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return null
  return alunoNaVerandi(clienteId, lead.waId)
}

// ---------------------------------------------------------------------------
// Marcar e desmarcar pelo Inbox
// ---------------------------------------------------------------------------

/**
 * O aluno do contato, de novo a cada ação. **Nunca o `pessoaId` que a tela
 * manda**: quem atende só mexe na agenda de quem está na conversa que ele
 * enxerga, e o id vindo do navegador poderia ser o de qualquer aluno da conta.
 */
async function alunoDaConversa(clienteId: string, contatoId: string): Promise<{ chave: string; aluno: AlunoNaVerandi } | { erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { erro: 'Sua função não permite mexer na agenda.' }
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return { erro: 'Conversa não encontrada.' }
  const [chave, aluno] = await Promise.all([chaveDaAgenda(clienteId), alunoNaVerandi(clienteId, lead.waId)])
  if (!chave || !aluno) return { erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }
  return { chave, aluno }
}

export type HorariosParaMarcar = { ok: true; horarios: HorarioLivre[] } | { ok: false; erro: string }

/** Os horários livres dos próximos 7 dias, só da modalidade do aluno quando ele faz uma. */
export async function acaoHorariosParaMarcar(clienteId: string, contatoId: string): Promise<HorariosParaMarcar> {
  const achado = await alunoDaConversa(clienteId, contatoId)
  if ('erro' in achado) return { ok: false, erro: achado.erro }
  const { de, ate } = janelaDeDias(new Date(), 7)
  try {
    const horarios = await horariosLivres(achado.chave, de, ate, achado.aluno.modalidade?.servicoId)
    return { ok: true, horarios: horarios.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora)) }
  } catch {
    return { ok: false, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }
  }
}

export type AulaMarcada =
  | {
      ok: true
      participacaoId: string
      reposicao: boolean
      /** O gatilho "Aula marcada" está ligado: a automação confirma, a tela não oferece. */
      confirmaSozinho: boolean
      /** Dá para mandar a confirmação como texto livre (dentro das 24 horas). */
      janelaAberta: boolean
    }
  | { ok: false; erro: string }

/**
 * Marca a aula. Reposição quando o aluno tem uma em aberto (a falta mais
 * antiga), senão avulsa. O 409 da Verandi ("este horário está cheio") volta
 * como a frase dela.
 */
export async function acaoMarcarAulaPeloInbox(clienteId: string, contatoId: string, sessaoId: string): Promise<AulaMarcada> {
  if (!/^[\w-]{1,64}$/.test(sessaoId)) return { ok: false, erro: 'Horário inválido.' }
  const achado = await alunoDaConversa(clienteId, contatoId)
  if ('erro' in achado) return { ok: false, erro: achado.erro }
  const { chave, aluno } = achado
  let r
  try {
    r = await marcarNaAgenda(chave, aluno.pessoaId, sessaoId, aluno.reposicaoDeId ?? undefined)
  } catch {
    return { ok: false, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }
  }
  if (!r.ok) return { ok: false, erro: r.motivo }
  const [webhook, gatilho, contexto] = await Promise.all([
    webhookDaVerandi(clienteId).catch(() => null),
    acharGatilhoDeEvento(clienteId, 'participacao.criada').catch(() => null),
    contextoDeResposta(clienteId, contatoId).catch(() => null),
  ])
  return {
    ok: true,
    participacaoId: r.participacaoId,
    reposicao: aluno.reposicaoDeId !== null,
    confirmaSozinho: Boolean(webhook?.ativo && gatilho),
    janelaAberta: contexto !== null && dentroDaJanela(contexto),
  }
}

/** Desmarca uma das próximas aulas do aluno da conversa, e diz se ficou reposição. */
export async function acaoDesmarcarAulaPeloInbox(
  clienteId: string,
  contatoId: string,
  participacaoId: string,
): Promise<{ ok: true; temCredito: boolean } | { ok: false; erro: string }> {
  const achado = await alunoDaConversa(clienteId, contatoId)
  if ('erro' in achado) return { ok: false, erro: achado.erro }
  if (!achado.aluno.proximas.some((p) => p.participacaoId === participacaoId)) {
    return { ok: false, erro: 'Esta aula não está mais entre as próximas.' }
  }
  try {
    const r = await desmarcarNaAgenda(achado.chave, participacaoId)
    return r.ok ? r : { ok: false, erro: r.motivo }
  } catch {
    return { ok: false, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }
  }
}
