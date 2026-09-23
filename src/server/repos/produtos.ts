import 'server-only'
import { conferirNome, conferirPreco, type Especie, type Produto } from '@/core/produtos'
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
  preco: string | number | null
  arquivado_em: string | null
}

const COLUNAS = 'id, nome, especie, preco, arquivado_em'

/**
 * `numeric` do Postgres chega como **string** no supabase-js, não número.
 *
 * O driver não converte de propósito: `numeric` guarda mais precisão do que um
 * `double` aguenta, e converter cedo perderia centavo calado. Para preço de
 * tabela o `Number` é seguro, mas a conversão precisa ser explícita aqui e não
 * espalhada, senão em algum lugar `preco` vira `"150.00"` e a comparação com
 * número responde errado sem erro nenhum.
 */
function paraPreco(bruto: string | number | null): number | null {
  if (bruto === null) return null
  const numero = typeof bruto === 'number' ? bruto : Number(bruto)
  return Number.isFinite(numero) ? numero : null
}

function paraProduto(linha: LinhaDoProduto): Produto {
  return {
    id: linha.id,
    nome: linha.nome,
    especie: linha.especie === 'servico' ? 'servico' : 'produto',
    preco: paraPreco(linha.preco),
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
  precoBruto = '',
): Promise<ResultadoDoProduto> {
  const conferido = conferirNome(nomeBruto)
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  // Preço em branco é o caminho normal, não exceção: o item nasce sem preço e
  // ganha depois, e é por isso que o parâmetro tem default.
  const preco = conferirPreco(precoBruto)
  if (!preco.ok) return { ok: false, motivo: preco.motivo }

  const { data, error } = await db()
    .from('produtos')
    .insert({ client_id: clienteId, nome: conferido.nome, especie, preco: preco.preco })
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
 * O preço do item.
 *
 * Função própria em vez de um parâmetro opcional em `renomearProduto`, e a
 * razão é a que atrapalha todo update parcial: com um campo anulável, "não
 * mandei o preço" e "mandei o preço vazio para apagar" chegariam iguais, e uma
 * das duas intenções seria perdida calada. Separando, cada função tem um
 * assunto e `''` quer dizer sempre a mesma coisa: **apaga o preço**.
 *
 * Apagar é operação legítima e não é erro: o dono que parou de vender por um
 * preço fixo precisa conseguir voltar para "não informado", e voltar para
 * "não informado" é justamente o que impede o bot de anunciar um preço velho.
 *
 * Isto **não toca venda nenhuma**. `venda_itens.valor_unitario` guarda o que
 * foi cobrado na época e continua guardando, pela mesma razão que renomear não
 * reescreve `venda_itens.descricao`.
 */
export async function definirPreco(
  clienteId: string,
  produtoId: string,
  precoBruto: string,
): Promise<ResultadoDoProduto> {
  const preco = conferirPreco(precoBruto)
  if (!preco.ok) return { ok: false, motivo: preco.motivo }

  const { data, error } = await db()
    .from('produtos')
    .update({ preco: preco.preco, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', produtoId)
    .select(COLUNAS)
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'esse item do catálogo não existe' }
  if (error) return { ok: false, motivo: `não deu para salvar o preço: ${error.message}` }
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
