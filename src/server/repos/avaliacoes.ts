import 'server-only'
import { faixaDaNota } from '@/core/flow/schema'
import { FUSO_DOS_RELATORIOS, type Periodo } from '@/core/relatorios'
import { bancoDeDados } from '../banco-de-dados'
import { db, ehIdInvalido } from '../db'
import type { Responsaveis } from './relatorios'
import type { NotaLida } from '@/core/nps'

/**
 * As notas de satisfação (0060).
 *
 * A tabela existe porque `contacts.campos` **sobrescreve**: a nota de setembro
 * apagava a de março, e com ela a única pergunta que a pesquisa serve para
 * responder, "estamos melhorando?". Aqui cada resposta é uma linha com data
 * própria.
 *
 * **Nada aqui pode derrubar a conversa.** É a mesma postura do bloco de etapa e
 * do de etiqueta: a pesquisa é registro, e registro que falha custa um número
 * no relatório. Estourar custaria a conversa de alguém, e logo na conversa de
 * quem acabou de ser atendido.
 */

export type Avaliacao = {
  id: string
  contatoId: string
  nota: number
  comentario: string | null
  origem: OrigemDaAvaliacao
  atendenteId: string | null
  criadaEm: string
}

export type OrigemDaAvaliacao = 'fluxo' | 'atendimento'

/**
 * Guarda a nota e devolve o id da linha.
 *
 * Devolve `null` quando não deu, e quem chama **segue mesmo assim**. Ver o
 * cabeçalho: perder o registro é melhor que perder a conversa.
 */
export async function guardarNota(
  clienteId: string,
  contatoId: string,
  nota: number,
  origem: OrigemDaAvaliacao = 'fluxo',
  extras: { atendenteId?: string | null; sessaoId?: string | null } = {},
): Promise<string | null> {
  // A faixa do `check` do banco, conferida aqui para o erro ser nosso e não um
  // 400 do PostgREST com texto em inglês no log.
  if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
    console.error('[avaliacoes] nota fora de 0 a 10', nota)
    return null
  }

  const { data, error } = await db()
    .from('avaliacoes')
    .insert({
      cliente_id: clienteId,
      contato_id: contatoId,
      nota,
      origem,
      atendente_id: extras.atendenteId ?? null,
      sessao_id: extras.sessaoId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[avaliacoes] não foi possível guardar a nota', error.message)
    return null
  }
  return (data as { id: string }).id
}

/**
 * Completa a **última** avaliação deste contato com o comentário.
 *
 * Pela última, e não por um id que o motor carregaria de volta: o motor não
 * gera id, e uma ida e volta só para transportar um uuid exigiria um estado
 * `aguardando_*` que nada mais no produto precisa.
 *
 * O risco teórico, duas pesquisas do mesmo contato na mesma conversa, com o
 * comentário caindo na errada, não existe na prática: o bloco zera a pesquisa
 * pendente ao ser reentrado, então só há uma nota esperando comentário por vez.
 * E a janela é a de uma resposta de WhatsApp.
 */
export async function guardarComentario(
  clienteId: string,
  contatoId: string,
  comentario: string,
): Promise<void> {
  const { data, error } = await db()
    .from('avaliacoes')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('contato_id', contatoId)
    .order('criada_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    console.error('[avaliacoes] não achei a nota para completar', error?.message)
    return
  }

  const { error: erroDoUpdate } = await db()
    .from('avaliacoes')
    .update({ comentario })
    .eq('id', (data as { id: string }).id)

  if (erroDoUpdate) {
    console.error('[avaliacoes] não foi possível guardar o comentário', erroDoUpdate.message)
  }
}

/** O histórico desta pessoa, do mais novo para o mais velho. É a ficha. */
export async function avaliacoesDoContato(
  clienteId: string,
  contatoId: string,
  limite = 20,
): Promise<Avaliacao[]> {
  const { data, error } = await db()
    .from('avaliacoes')
    .select('id, contato_id, nota, comentario, origem, atendente_id, criada_em')
    .eq('cliente_id', clienteId)
    .eq('contato_id', contatoId)
    .order('criada_em', { ascending: false })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não foi possível ler as avaliações: ${error.message}`)

  return (data as Record<string, string | number | null>[]).map((linha) => ({
    id: String(linha.id),
    contatoId: String(linha.contato_id),
    nota: Number(linha.nota),
    comentario: linha.comentario === null ? null : String(linha.comentario),
    origem: String(linha.origem) as OrigemDaAvaliacao,
    atendenteId: linha.atendente_id === null ? null : String(linha.atendente_id),
    criadaEm: String(linha.criada_em),
  }))
}

/** Em que faixa a nota cai, reexportado para a tela não importar de `core/`. */
export { faixaDaNota }

/**
 * As notas da conta inteira num período, para o relatório.
 *
 * Traz nota e data, e não o resumo pronto: quem resume é `core/nps.ts`, que é
 * puro e testável. Repo faz ida ao banco, e só.
 *
 * O teto existe porque esta consulta cresce com o uso e ninguém lê dez mil
 * linhas: o resumo de uma amostra grande já responde a pergunta, e a lista de
 * comentários tem teto próprio.
 */
export async function notasDaConta(
  clienteId: string,
  desde: string,
  limite = 2000,
): Promise<NotaLida[]> {
  const { data, error } = await db()
    .from('avaliacoes')
    .select('nota, criada_em')
    .eq('cliente_id', clienteId)
    .gte('criada_em', desde)
    .order('criada_em', { ascending: false })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não foi possível ler as notas: ${error.message}`)

  return (data as { nota: number; criada_em: string }[]).map((linha) => ({
    nota: Number(linha.nota),
    criadaEm: String(linha.criada_em),
  }))
}

/**
 * Os comentários escritos, do mais novo para o mais velho.
 *
 * Só quem escreveu alguma coisa: a nota sem comentário já está no resumo, e
 * uma lista cheia de linhas vazias esconderia as poucas que têm texto, que são
 * justamente as que alguém quer ler.
 */
export async function comentariosDaConta(
  clienteId: string,
  desde: string,
  limite = 50,
): Promise<ComentarioLido[]> {
  const { data, error } = await db()
    .from('avaliacoes')
    .select('id, nota, comentario, criada_em, contato_id, contacts!inner(nome, nome_real)')
    .eq('cliente_id', clienteId)
    .gte('criada_em', desde)
    .not('comentario', 'is', null)
    .order('criada_em', { ascending: false })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não foi possível ler os comentários: ${error.message}`)

  return (data as Record<string, unknown>[]).map((linha) => {
    const contato = linha.contacts as { nome: string | null; nome_real: string | null } | null
    return {
      id: String(linha.id),
      contatoId: String(linha.contato_id),
      /* O nome corrigido à mão vence o do perfil, a mesma regra da ficha. */
      nome: contato?.nome_real ?? contato?.nome ?? null,
      nota: Number(linha.nota),
      comentario: String(linha.comentario ?? ''),
      criadaEm: String(linha.criada_em),
    }
  })
}

/**
 * Os comentários do período do relatório, no escopo de quem olha.
 *
 * Irmã de `comentariosDaConta`, com o recorte que o relatório usa: dia de
 * Brasília nas duas pontas e, para quem só vê os próprios atendimentos, só
 * os contatos atribuídos a essas pessoas. Sem o escopo, um atendente leria o
 * que o cliente do colega escreveu sobre o colega.
 */
export async function comentariosDoPeriodo(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  limite = 60,
): Promise<ComentarioLido[]> {
  const { rows } = await bancoDeDados().query(
    `select a.id, a.nota, a.comentario, a.criada_em, a.contato_id,
            coalesce(c.nome_real, c.nome) as nome
       from public.avaliacoes a
       join public.contacts c on c.id = a.contato_id
      where a.cliente_id = $1
        and a.comentario is not null and btrim(a.comentario) <> ''
        and a.criada_em >= ($2::date::timestamp at time zone '${FUSO_DOS_RELATORIOS}')
        and a.criada_em < (($3::date + 1)::timestamp at time zone '${FUSO_DOS_RELATORIOS}')
        and ($4::uuid[] is null or c.atribuido_a = any($4::uuid[]))
      order by a.criada_em desc
      limit ${Math.max(1, Math.floor(limite))}`,
    [clienteId, periodo.de, periodo.ate, responsaveis === null ? null : [...responsaveis]],
  )

  return (rows as { id: string; nota: number; comentario: string; criada_em: Date; contato_id: string; nome: string | null }[]).map(
    (r) => ({
      id: r.id,
      contatoId: r.contato_id,
      nome: r.nome,
      nota: Number(r.nota),
      comentario: r.comentario.trim(),
      criadaEm: new Date(r.criada_em).toISOString(),
    }),
  )
}

export type ComentarioLido = {
  id: string
  contatoId: string
  nome: string | null
  nota: number
  comentario: string
  criadaEm: string
}
