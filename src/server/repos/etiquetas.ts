import 'server-only'
import { ehCorDeEtiqueta, LIMITE_DO_NOME, type CorDeEtiqueta } from '@/core/etiquetas'
import { db, ehIdInvalido } from '../db'

/**
 * As etiquetas que uma pessoa cria e aplica (0025).
 *
 * **Não confundir com as derivadas.** `EtiquetaDeLead` em `repos/leads.ts` sai
 * do histórico — quem abriu com áudio, quem foi para uma pessoa, quem nunca
 * respondeu — e nunca vira linha. Estas são as outras: "cliente antigo",
 * "orçamento enviado", "não insistir", que nenhum histórico sabe deduzir.
 */

export type Etiqueta = {
  id: string
  nome: string
  cor: CorDeEtiqueta
  /** Quantos contatos a têm. Presente só onde a tela pede a contagem. */
  contatos?: number
}

type Linha = { id: string; nome: string; cor: string }

const COLUNAS = 'id, nome, cor'

/** Cor torta no banco vira `cinza` em vez de sumir da tela. Ver `core/etiquetas.ts`. */
function paraEtiqueta(linha: Linha): Etiqueta {
  return {
    id: linha.id,
    nome: linha.nome,
    cor: ehCorDeEtiqueta(linha.cor) ? linha.cor : 'cinza',
  }
}

export async function listarEtiquetas(clienteId: string): Promise<Etiqueta[]> {
  const { data, error } = await db()
    .from('etiquetas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('nome', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as etiquetas: ${error.message}`)
  return (data as Linha[]).map(paraEtiqueta)
}

/**
 * As etiquetas com quantos contatos cada uma tem.
 *
 * É o rail da tela de contatos (§3.2 do plano), e a contagem é metade da
 * informação: uma lista de vinte etiquetas sem número nenhum não diz qual vale
 * clicar. Duas consultas e a soma na aplicação — o PostgREST não faz `group by`
 * e uma view só para isto envelheceria junto com a tabela.
 */
export async function listarEtiquetasComContagem(clienteId: string): Promise<Etiqueta[]> {
  const etiquetas = await listarEtiquetas(clienteId)
  if (etiquetas.length === 0) return []

  const { data, error } = await db()
    .from('contato_etiquetas')
    .select('etiqueta_id')
    .in(
      'etiqueta_id',
      etiquetas.map((e) => e.id),
    )

  if (error) throw new Error(`não deu para contar as etiquetas: ${error.message}`)

  const total = new Map<string, number>()
  for (const linha of data as { etiqueta_id: string }[]) {
    total.set(linha.etiqueta_id, (total.get(linha.etiqueta_id) ?? 0) + 1)
  }

  return etiquetas.map((etiqueta) => ({ ...etiqueta, contatos: total.get(etiqueta.id) ?? 0 }))
}

export async function criarEtiqueta(
  clienteId: string,
  dados: { nome: string; cor: CorDeEtiqueta },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const nome = dados.nome.trim().slice(0, LIMITE_DO_NOME)
  if (nome === '') return { ok: false, motivo: 'escreva o nome da etiqueta' }

  const { error } = await db()
    .from('etiquetas')
    .insert({ client_id: clienteId, nome, cor: dados.cor })

  if (error?.code === '23505') return { ok: false, motivo: `já existe uma etiqueta “${nome}”` }
  if (error) throw new Error(`não deu para criar a etiqueta: ${error.message}`)
  return { ok: true }
}

/**
 * Renomear e repintar de uma vez.
 *
 * **Apagar e recriar não é a mesma coisa**: a ligação é por id, então recriar
 * tiraria a etiqueta de todo mundo que já a tinha. Quem corrige um erro de
 * digitação não está pedindo para desetiquetar duzentos contatos.
 */
export async function editarEtiqueta(
  clienteId: string,
  etiquetaId: string,
  dados: { nome: string; cor: CorDeEtiqueta },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const nome = dados.nome.trim().slice(0, LIMITE_DO_NOME)
  if (nome === '') return { ok: false, motivo: 'escreva o nome da etiqueta' }

  const { data, error } = await db()
    .from('etiquetas')
    .update({ nome, cor: dados.cor })
    .eq('id', etiquetaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return { ok: false, motivo: 'esta etiqueta não existe mais' }
  if (error?.code === '23505') return { ok: false, motivo: `já existe uma etiqueta “${nome}”` }
  if (error) throw new Error(`não deu para editar a etiqueta: ${error.message}`)
  if ((data?.length ?? 0) !== 1) return { ok: false, motivo: 'esta etiqueta não existe mais' }
  return { ok: true }
}

/** Apagar tira a etiqueta de todos os contatos — é o `on delete cascade` da 0025. */
export async function apagarEtiqueta(clienteId: string, etiquetaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('etiquetas')
    .delete()
    .eq('id', etiquetaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar a etiqueta: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/**
 * As etiquetas de um lote de contatos, para a lista não fazer N+1.
 *
 * Devolve mapa vazio para contato sem etiqueta nenhuma — quem chama itera pela
 * lista de contatos, não pelas chaves daqui.
 */
export async function etiquetasDeContatos(
  contatos: string[],
): Promise<Map<string, Etiqueta[]>> {
  const porContato = new Map<string, Etiqueta[]>()
  if (contatos.length === 0) return porContato

  const { data, error } = await db()
    .from('contato_etiquetas')
    .select('contato_id, etiquetas (id, nome, cor)')
    .in('contato_id', contatos)

  if (ehIdInvalido(error)) return porContato
  if (error) throw new Error(`não deu para ler as etiquetas dos contatos: ${error.message}`)

  type Junta = { contato_id: string; etiquetas: Linha | Linha[] | null }
  for (const linha of data as unknown as Junta[]) {
    // O PostgREST devolve objeto quando a relação é para-um e lista quando é
    // para-muitos, e a forma depende de ele reconhecer a chave estrangeira.
    // Aceitar as duas evita a tela sumir com as etiquetas por causa disso.
    const etiquetas = Array.isArray(linha.etiquetas)
      ? linha.etiquetas
      : linha.etiquetas
        ? [linha.etiquetas]
        : []
    const atuais = porContato.get(linha.contato_id) ?? []
    atuais.push(...etiquetas.map(paraEtiqueta))
    porContato.set(linha.contato_id, atuais)
  }

  for (const lista of porContato.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome))
  return porContato
}

/**
 * Aplica ou tira uma etiqueta de contatos deste cliente.
 *
 * **Os dois ids são conferidos contra o cliente antes de escrever.** Eles vêm
 * de um formulário; a chave estrangeira só sabe que existem, não de quem são.
 * Sem isto, etiquetar por id alcançaria o contato de outra conta.
 *
 * Aceita lista porque a ação em lote é o caso real da tela de contatos, e um
 * laço de cem `insert` seria cem viagens ao banco.
 */
export async function marcarContatos(
  clienteId: string,
  etiquetaId: string,
  contatos: string[],
  aplicar: boolean,
): Promise<{ ok: true; afetados: number } | { ok: false; motivo: string }> {
  if (contatos.length === 0) return { ok: false, motivo: 'escolha ao menos um contato' }

  const [{ data: etiqueta, error: erroDaEtiqueta }, { data: doCliente, error: erroDosContatos }] =
    await Promise.all([
      db().from('etiquetas').select('id').eq('id', etiquetaId).eq('client_id', clienteId).maybeSingle(),
      db().from('contacts').select('id').eq('client_id', clienteId).in('id', contatos),
    ])

  if (ehIdInvalido(erroDaEtiqueta) || ehIdInvalido(erroDosContatos)) {
    return { ok: false, motivo: 'etiqueta ou contato inválido' }
  }
  if (erroDaEtiqueta) throw new Error(`não deu para conferir a etiqueta: ${erroDaEtiqueta.message}`)
  if (erroDosContatos) throw new Error(`não deu para conferir os contatos: ${erroDosContatos.message}`)
  if (!etiqueta) return { ok: false, motivo: 'esta etiqueta não é deste cliente' }

  const validos = (doCliente as { id: string }[]).map((c) => c.id)
  if (validos.length === 0) return { ok: false, motivo: 'nenhum contato deste cliente na seleção' }

  if (aplicar) {
    const { error } = await db()
      .from('contato_etiquetas')
      .upsert(
        validos.map((contatoId) => ({ contato_id: contatoId, etiqueta_id: etiquetaId })),
        { onConflict: 'contato_id,etiqueta_id', ignoreDuplicates: true },
      )
    if (error) throw new Error(`não deu para etiquetar: ${error.message}`)
  } else {
    const { error } = await db()
      .from('contato_etiquetas')
      .delete()
      .eq('etiqueta_id', etiquetaId)
      .in('contato_id', validos)
    if (error) throw new Error(`não deu para tirar a etiqueta: ${error.message}`)
  }

  return { ok: true, afetados: validos.length }
}

/**
 * Quem tem esta etiqueta, dentro deste cliente.
 *
 * O `client_id` entra pela lista de contatos e não pela etiqueta porque o
 * filtro precisa das duas coisas ao mesmo tempo: etiqueta de outra conta não
 * pode listar contato nenhum, mesmo que o id seja adivinhado certo.
 */
export async function contatosComEtiqueta(
  clienteId: string,
  etiquetaId: string,
): Promise<string[]> {
  const { data, error } = await db()
    .from('contato_etiquetas')
    .select('contato_id, contacts!inner (client_id)')
    .eq('etiqueta_id', etiquetaId)
    .eq('contacts.client_id', clienteId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para filtrar por etiqueta: ${error.message}`)
  return (data as { contato_id: string }[]).map((linha) => linha.contato_id)
}
