import 'server-only'
import { conferirNome, type Especie, type Produto } from '@/core/produtos'
import { db, ehIdInvalido } from '../db'

/**
 * O catálogo no banco (0079).
 *
 * Como todo `repos/`: só ida ao banco, sem regra. Quem decide o que é nome
 * válido e o que é selecionável é `core/produtos.ts`.
 *
 * O que este arquivo garante, e que a tela não garante sozinha:
 *
 *  - **arquivar não apaga**, o vínculo de `venda_itens.produto_id` e de
 *    `quadro_cartoes.produto_id` continua apontando para a linha, e a
 *    segmentação por produto continua achando o histórico;
 *  - **nome único entre os ativos**, o índice parcial recusa o duplicado, e a
 *    recusa vira frase em vez de 500.
 */

type LinhaDoProduto = {
  id: string
  nome: string
  especie: string
  arquivado_em: string | null
}

const COLUNAS = 'id, nome, especie, arquivado_em'

function paraProduto(linha: LinhaDoProduto): Produto {
  return {
    id: linha.id,
    nome: linha.nome,
    especie: linha.especie === 'servico' ? 'servico' : 'produto',
    arquivadoEm: linha.arquivado_em,
  }
}

export type ResultadoDoProduto = { ok: true; produto: Produto } | { ok: false; motivo: string }

/**
 * O catálogo da conta.
 *
 * Devolve **ativos e arquivados**, ordenados com os ativos primeiro. Filtrar
 * arquivado aqui obrigaria uma segunda consulta para a tela que precisa
 * mostrar o histórico, e `core/produtos.selecionaveis` já separa os dois usos
 * sem ir ao banco de novo.
 */
export async function listarProdutos(clienteId: string): Promise<Produto[]> {
  const { data, error } = await db()
    .from('produtos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('arquivado_em', { ascending: true, nullsFirst: true })
    .order('nome', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler o catálogo: ${error.message}`)
  return (data as LinhaDoProduto[]).map(paraProduto)
}

/** Um item do catálogo, arquivado ou não. `null` = não existe nesta conta. */
export async function produtoPorId(clienteId: string, produtoId: string): Promise<Produto | null> {
  const { data, error } = await db()
    .from('produtos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('id', produtoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o item do catálogo: ${error.message}`)
  return data ? paraProduto(data as LinhaDoProduto) : null
}

export async function criarProduto(
  clienteId: string,
  nomeBruto: string,
  especie: Especie,
): Promise<ResultadoDoProduto> {
  const conferido = conferirNome(nomeBruto)
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db()
    .from('produtos')
    .insert({ client_id: clienteId, nome: conferido.nome, especie })
    .select(COLUNAS)
    .single()

  // 23505 aqui só pode ser o índice de nome único entre os ativos. Virar frase
  // importa: "já existe" é resposta, 500 é defeito.
  if (error?.code === '23505') {
    return { ok: false, motivo: `já existe "${conferido.nome}" no catálogo` }
  }
  if (error) return { ok: false, motivo: `não deu para criar: ${error.message}` }

  return { ok: true, produto: paraProduto(data as LinhaDoProduto) }
}

export async function renomearProduto(
  clienteId: string,
  produtoId: string,
  nomeBruto: string,
): Promise<ResultadoDoProduto> {
  const conferido = conferirNome(nomeBruto)
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db()
    .from('produtos')
    .update({ nome: conferido.nome, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', produtoId)
    .select(COLUNAS)
    .maybeSingle()

  if (error?.code === '23505') {
    return { ok: false, motivo: `já existe "${conferido.nome}" no catálogo` }
  }
  if (ehIdInvalido(error)) return { ok: false, motivo: 'esse item do catálogo não existe' }
  if (error) return { ok: false, motivo: `não deu para renomear: ${error.message}` }
  if (!data) return { ok: false, motivo: 'esse item do catálogo não existe' }

  return { ok: true, produto: paraProduto(data as LinhaDoProduto) }
}

/**
 * Arquiva ou desarquiva.
 *
 * Não existe `apagarProduto`, e a ausência é a decisão: apagar zeraria o
 * `produto_id` das vendas (a FK é `on delete set null`) e a pergunta "quem
 * comprou o Plano Ouro" passaria a responder menos do que a verdade, sem aviso.
 */
export async function arquivarProduto(
  clienteId: string,
  produtoId: string,
  arquivar: boolean,
): Promise<ResultadoDoProduto> {
  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('produtos')
    .update({ arquivado_em: arquivar ? agora : null, atualizado_em: agora })
    .eq('client_id', clienteId)
    .eq('id', produtoId)
    .select(COLUNAS)
    .maybeSingle()

  // Desarquivar esbarra no índice de nome único entre ativos se alguém criou
  // outro com o mesmo nome enquanto este estava arquivado. A frase precisa
  // dizer o que fazer, porque o caminho não é óbvio.
  if (error?.code === '23505') {
    return {
      ok: false,
      motivo: 'já existe um item ativo com esse nome. Renomeie um dos dois antes de desarquivar.',
    }
  }
  if (ehIdInvalido(error)) return { ok: false, motivo: 'esse item do catálogo não existe' }
  if (error) return { ok: false, motivo: `não deu para arquivar: ${error.message}` }
  if (!data) return { ok: false, motivo: 'esse item do catálogo não existe' }

  return { ok: true, produto: paraProduto(data as LinhaDoProduto) }
}
