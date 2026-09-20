import 'server-only'
import {
  aplicarValores,
  doLegado,
  type DefinicaoDeCampo,
  type TipoDeCampo,
  type ValorDeCampo,
} from '@/core/campos'
import { db, ehIdInvalido } from '../db'

/**
 * Os campos do contato, com proveniência, e as definições da empresa (0077).
 *
 * ---------------------------------------------------------------------------
 * Por que a escrita é um RPC
 * ---------------------------------------------------------------------------
 *
 * `guardarCampo`, em `repos/conversas.ts`, faz `update contacts set campos = $1`
 * com o mapa **inteiro**. Duas escritas a campos diferentes, no mesmo contato,
 * ao mesmo tempo, perdem uma.
 *
 * Ler, mesclar e gravar daqui não conserta: entre o `select` e o `update` cabe
 * a outra escrita, exatamente como na tomada de atendimento da 0076. A mescla
 * acontece no banco, com a linha travada, e é o que `gravar_campos` faz.
 *
 * `guardarCampo` **continua existindo**: ele é o caminho do motor de fluxo, que
 * grava o mapa que acabou de montar e não tem proveniência para declarar.
 * Trocar a implementação dele por baixo mudaria o comportamento de cinco
 * chamadores para resolver o problema de um.
 */

type LinhaDaGravacao = { o_ok: boolean; o_campos: unknown; o_meta: unknown }

type MetaGravado = { origem: string; autor_id: string | null; em: string }

/**
 * Lê os campos do contato já no formato tipado.
 *
 * O que não tiver proveniência gravada vira `automacao`, que é o que
 * `doLegado` faz e pelo mesmo motivo: não dá para saber quem escreveu o que já
 * estava lá, e assumir `humano` daria ao legado uma autoridade que ele não
 * provou ter, travando correções futuras.
 */
export async function camposDoContato(
  clienteId: string,
  contatoId: string,
): Promise<Record<string, ValorDeCampo> | null> {
  const { data, error } = await db()
    .from('contacts')
    .select('campos, campos_meta, criado_em')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler os campos: ${error.message}`)
  if (!data) return null

  const linha = data as {
    campos: Record<string, string> | null
    campos_meta: Record<string, MetaGravado> | null
    criado_em: string
  }

  const valores = linha.campos ?? {}
  const meta = linha.campos_meta ?? {}

  /*
   * `campos` é a lista de chaves que valem, e não `campos_meta`: quem escreve
   * as duas é a mesma função, mas o legado tem valor sem meta, e nunca o
   * contrário. Iterar pelo meta perderia todo o dado anterior à 0077.
   */
  const saida = doLegado(valores, linha.criado_em)
  for (const [chave, info] of Object.entries(meta)) {
    const atual = saida[chave]
    if (!atual) continue
    saida[chave] = {
      valor: atual.valor,
      origem: ehOrigem(info?.origem) ? info.origem : 'automacao',
      autorId: info?.autor_id ?? null,
      em: info?.em ?? linha.criado_em,
    }
  }

  return saida
}

function ehOrigem(valor: unknown): valor is ValorDeCampo['origem'] {
  return valor === 'humano' || valor === 'contato' || valor === 'automacao' || valor === 'importacao'
}

export type ResultadoDaGravacao =
  | { ok: true; campos: Record<string, ValorDeCampo>; recusados: { chave: string; motivo: string }[] }
  | { ok: false; motivo: 'nao_encontrado' }

/**
 * Grava um lote de campos, campo a campo, respeitando a precedência (RB-19).
 *
 * A decisão de quem vence quem fica em `core/campos.ts`, porque é regra de
 * produto e precisa ser testável sem subir banco. O que acontece aqui é a
 * leitura do estado, a decisão, e a escrita **mesclada** no banco: o `||` do
 * `jsonb` preserva as chaves que este lote não traz.
 *
 * Devolve os recusados para quem chamou poder mostrar. Recusa não é erro: é o
 * sistema protegendo uma correção, e a tela precisa dizer isso em vez de
 * parecer quebrada.
 */
export async function gravarCampos(
  clienteId: string,
  contatoId: string,
  novos: Record<string, ValorDeCampo>,
): Promise<ResultadoDaGravacao> {
  const atuais = await camposDoContato(clienteId, contatoId)
  if (atuais === null) return { ok: false, motivo: 'nao_encontrado' }

  const { campos, recusados } = aplicarValores(atuais, novos)

  /*
   * Só o que **mudou** vai para o banco. Mandar o mapa inteiro funcionaria (o
   * `||` mescla), mas reescreveria a proveniência de campos que ninguém tocou,
   * e a próxima importação passaria a vencê-los pela data.
   */
  const valoresParaGravar: Record<string, string> = {}
  const metaParaGravar: Record<string, MetaGravado> = {}
  for (const [chave, valor] of Object.entries(campos)) {
    if (atuais[chave]?.valor === valor.valor && atuais[chave]?.origem === valor.origem) continue
    valoresParaGravar[chave] = valor.valor
    metaParaGravar[chave] = { origem: valor.origem, autor_id: valor.autorId, em: valor.em }
  }

  if (Object.keys(valoresParaGravar).length === 0) {
    return { ok: true, campos, recusados }
  }

  const { data, error } = await db().rpc('gravar_campos', {
    p_client_id: clienteId,
    p_contact_id: contatoId,
    p_valores: valoresParaGravar,
    p_meta: metaParaGravar,
  })

  if (ehIdInvalido(error)) return { ok: false, motivo: 'nao_encontrado' }
  if (error) throw new Error(`não deu para gravar os campos: ${error.message}`)

  const linha = ((data ?? []) as LinhaDaGravacao[])[0]
  if (!linha?.o_ok) return { ok: false, motivo: 'nao_encontrado' }

  return { ok: true, campos, recusados }
}

// ---------------------------------------------------------------------------
// As definições da empresa
// ---------------------------------------------------------------------------

type LinhaDaDefinicao = {
  chave: string
  rotulo: string
  tipo: string
  opcoes: string[] | null
  obrigatorio_em: string[] | null
  arquivado: boolean
}

export async function definicoesDeCampo(clienteId: string): Promise<DefinicaoDeCampo[]> {
  const { data, error } = await db()
    .from('campos_definidos')
    .select('chave, rotulo, tipo, opcoes, obrigatorio_em, arquivado')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  // Tabela ausente ou id torto devolve lista vazia: campo definido é
  // configuração, e uma conta sem nenhuma continua atendendo normalmente.
  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para ler as definições: ${error.message}`)
  }

  return ((data ?? []) as LinhaDaDefinicao[]).map((linha) => ({
    chave: linha.chave,
    rotulo: linha.rotulo,
    tipo: linha.tipo as TipoDeCampo,
    opcoes: linha.opcoes ?? [],
    obrigatorioEm: (linha.obrigatorio_em ?? []) as DefinicaoDeCampo['obrigatorioEm'],
    arquivado: linha.arquivado,
  }))
}

export async function definirCampo(
  clienteId: string,
  definicao: DefinicaoDeCampo,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const chave = definicao.chave.trim()
  if (chave === '') return { ok: false, motivo: 'o campo precisa de uma chave' }
  if (definicao.rotulo.trim() === '') return { ok: false, motivo: 'o campo precisa de um nome' }

  const { error } = await db()
    .from('campos_definidos')
    .upsert(
      {
        client_id: clienteId,
        chave,
        rotulo: definicao.rotulo.trim(),
        tipo: definicao.tipo,
        opcoes: definicao.opcoes ?? [],
        obrigatorio_em: definicao.obrigatorioEm ?? [],
        arquivado: definicao.arquivado ?? false,
      },
      { onConflict: 'client_id,chave' },
    )

  if (error) return { ok: false, motivo: `não deu para gravar: ${error.message}` }
  return { ok: true }
}

/**
 * Arquiva um campo. Nunca apaga.
 *
 * Apagar deixaria os valores gravados em `contacts.campos` órfãos: existe o
 * dado e não existe o rótulo dele. Arquivado some das telas de preenchimento e
 * continua explicando o histórico.
 */
export async function arquivarCampo(
  clienteId: string,
  chave: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('campos_definidos')
    .update({ arquivado: true })
    .eq('client_id', clienteId)
    .eq('chave', chave)
    .select('chave')
    .maybeSingle()

  if (error) return { ok: false, motivo: `não deu para arquivar: ${error.message}` }
  if (!data) return { ok: false, motivo: 'esse campo não existe nesta conta' }
  return { ok: true }
}
