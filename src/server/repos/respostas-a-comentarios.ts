import 'server-only'
import type { RespostaAComentario } from '@/core/comentarios'
import { db, ehIdInvalido } from '../db'

/**
 * As respostas a comentário do Instagram (0160).
 *
 * Qual delas casa com um comentário é decisão pura, em `core/comentarios.ts`.
 * Aqui ficam as idas ao banco: a regra, e o registro de cada comentário
 * tratado, que é o que impede a mesma pessoa de receber o mesmo direct duas
 * vezes quando a Meta reenvia o webhook.
 */

export type RespostaSalva = RespostaAComentario & {
  canalId: string
  postLegenda: string | null
  postImagem: string | null
  postLink: string | null
  mensagem: string
  respostaPublica: string | null
  /** O fluxo que a resposta da pessoa abre. Nulo: o fluxo padrão do canal. */
  fluxoId: string | null
  execucoes: number
}

type Linha = {
  id: string
  channel_id: string
  palavras: string[] | null
  post_id: string | null
  post_legenda: string | null
  post_imagem: string | null
  post_link: string | null
  mensagem: string
  resposta_publica: string | null
  flow_id: string | null
  ativo: boolean
  execucoes: number
}

const COLUNAS =
  'id, channel_id, palavras, post_id, post_legenda, post_imagem, post_link, mensagem, resposta_publica, flow_id, ativo, execucoes'

function paraResposta(linha: Linha): RespostaSalva {
  return {
    id: linha.id,
    canalId: linha.channel_id,
    palavras: linha.palavras ?? [],
    postId: linha.post_id,
    postLegenda: linha.post_legenda,
    postImagem: linha.post_imagem,
    postLink: linha.post_link,
    mensagem: linha.mensagem,
    respostaPublica: linha.resposta_publica,
    fluxoId: linha.flow_id,
    ativo: linha.ativo,
    execucoes: linha.execucoes,
  }
}

export async function listarRespostasAComentarios(clienteId: string): Promise<RespostaSalva[]> {
  const { data, error } = await db()
    .from('respostas_a_comentarios')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não foi possível listar as respostas a comentário: ${error.message}`)
  return (data as Linha[]).map(paraResposta)
}

/** As ligadas de um canal, na ordem de cadastro, que é o último desempate. */
export async function respostasAtivasDoCanal(canalId: string): Promise<RespostaSalva[]> {
  const { data, error } = await db()
    .from('respostas_a_comentarios')
    .select(COLUNAS)
    .eq('channel_id', canalId)
    .eq('ativo', true)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não foi possível ler as respostas a comentário: ${error.message}`)
  return (data as Linha[]).map(paraResposta)
}

export async function criarRespostaAComentario(
  clienteId: string,
  dados: {
    canalId: string
    palavras: string[]
    post: { id: string; legenda: string | null; imagem: string | null; link: string | null } | null
    mensagem: string
    respostaPublica: string | null
    fluxoId: string | null
  },
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  // O canal vem de um formulário: conferir que é desta conta e é Instagram ou página.
  const { data: canal, error: erroDoCanal } = await db()
    .from('channels')
    .select('id')
    .eq('id', dados.canalId)
    .eq('client_id', clienteId)
    .in('provider', ['instagram', 'messenger'])
    .maybeSingle()

  if (ehIdInvalido(erroDoCanal)) return { ok: false, motivo: 'escolha uma conta do Instagram ou uma página válida' }
  if (erroDoCanal) throw new Error(`não foi possível conferir a conta: ${erroDoCanal.message}`)
  if (!canal) return { ok: false, motivo: 'esta conta não é deste cliente' }

  if (dados.fluxoId) {
    const { data: fluxo, error: erroDoFluxo } = await db()
      .from('flows')
      .select('id')
      .eq('id', dados.fluxoId)
      .eq('client_id', clienteId)
      .maybeSingle()
    if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'escolha um fluxo desta conta' }
    if (erroDoFluxo) throw new Error(`não foi possível conferir o fluxo: ${erroDoFluxo.message}`)
    if (!fluxo) return { ok: false, motivo: 'escolha um fluxo desta conta' }
  }

  const { data, error } = await db()
    .from('respostas_a_comentarios')
    .insert({
      client_id: clienteId,
      channel_id: dados.canalId,
      palavras: dados.palavras,
      post_id: dados.post?.id ?? null,
      post_legenda: dados.post?.legenda?.slice(0, 300) ?? null,
      post_imagem: dados.post?.imagem ?? null,
      post_link: dados.post?.link ?? null,
      mensagem: dados.mensagem,
      resposta_publica: dados.respostaPublica,
      flow_id: dados.fluxoId,
    })
    .select('id')
    .single()

  if (error) throw new Error(`não foi possível criar a resposta a comentário: ${error.message}`)
  return { ok: true, id: (data as { id: string }).id }
}

export async function alternarRespostaAComentario(
  clienteId: string,
  respostaId: string,
  ativo: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('respostas_a_comentarios')
    .update({ ativo })
    .eq('id', respostaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não foi possível mudar a resposta a comentário: ${error.message}`)
  return (data?.length ?? 0) === 1
}

export async function apagarRespostaAComentario(clienteId: string, respostaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('respostas_a_comentarios')
    .delete()
    .eq('id', respostaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não foi possível apagar a resposta a comentário: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/**
 * Reserva o comentário antes de responder. `false` quando ele já foi tratado.
 *
 * A reserva vem **antes** do envio, e não depois: a Meta reenvia o webhook
 * quando demoramos, e dois processos tratando o mesmo comentário mandariam o
 * direct duas vezes. A chave primária decide quem chegou primeiro.
 */
export async function reservarComentario(dados: {
  comentarioId: string
  clienteId: string
  respostaId: string
  autorIgsid: string | null
}): Promise<boolean> {
  const { error } = await db().from('comentarios_respondidos').insert({
    comentario_id: dados.comentarioId,
    client_id: dados.clienteId,
    resposta_id: dados.respostaId,
    autor_igsid: dados.autorIgsid,
  })

  if (error?.code === '23505') return false
  if (error) throw new Error(`não foi possível reservar o comentário: ${error.message}`)
  return true
}

/** Grava o desfecho e, se deu certo, soma uma execução na regra. */
export async function concluirComentario(dados: {
  comentarioId: string
  respostaId: string
  ok: boolean
  detalhe: string | null
  contatoId?: string | null
}): Promise<void> {
  await db()
    .from('comentarios_respondidos')
    .update({
      ok: dados.ok,
      detalhe: dados.detalhe?.slice(0, 500) ?? null,
      ...(dados.contatoId ? { contato_id: dados.contatoId } : {}),
    })
    .eq('comentario_id', dados.comentarioId)

  if (!dados.ok) return

  /*
   * Ler e somar, sem RPC. Dois comentários no mesmo instante podem perder uma
   * unidade da contagem; o direct de cada um sai do mesmo jeito, e o número
   * exato de quem respondeu está em `comentarios_respondidos`.
   */
  const { data } = await db()
    .from('respostas_a_comentarios')
    .select('execucoes')
    .eq('id', dados.respostaId)
    .maybeSingle()
  if (!data) return
  await db()
    .from('respostas_a_comentarios')
    .update({ execucoes: (data as { execucoes: number }).execucoes + 1 })
    .eq('id', dados.respostaId)
}

/** Quanto vale a marca: a mesma janela da Meta para a resposta privada. */
const JANELA_DO_COMENTARIO_MS = 7 * 24 * 60 * 60 * 1000

/**
 * O comentário respondido que ainda espera a primeira mensagem desta pessoa,
 * e o fluxo que essa mensagem deve abrir.
 *
 * Só conta o que deu certo, ainda não foi consumido, está dentro dos 7 dias e
 * cuja regra aponta um fluxo. Sem fluxo na regra, a conversa segue o padrão do
 * canal, e não há nada para devolver.
 */
export async function comentarioEsperandoResposta(
  contatoId: string,
): Promise<{ comentarioId: string; fluxoId: string } | null> {
  const { data, error } = await db()
    .from('comentarios_respondidos')
    .select('comentario_id, respostas_a_comentarios!inner(flow_id)')
    .eq('contato_id', contatoId)
    .eq('ok', true)
    .is('consumido_em', null)
    .gte('criado_em', new Date(Date.now() - JANELA_DO_COMENTARIO_MS).toISOString())
    .not('respostas_a_comentarios.flow_id', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(1)

  if (ehIdInvalido(error)) return null
  if (error) {
    console.warn('[comentarios] não foi possível ler o comentário pendente', error.message)
    return null
  }
  const linha = (data as unknown as { comentario_id: string; respostas_a_comentarios: { flow_id: string | null } }[])[0]
  const fluxoId = linha?.respostas_a_comentarios?.flow_id
  return linha && fluxoId ? { comentarioId: linha.comentario_id, fluxoId } : null
}

/** A primeira resposta da pessoa já abriu o fluxo: as próximas seguem a conversa. */
export async function consumirComentario(comentarioId: string): Promise<void> {
  await db()
    .from('comentarios_respondidos')
    .update({ consumido_em: new Date().toISOString() })
    .eq('comentario_id', comentarioId)
}
