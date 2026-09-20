import 'server-only'
import {
  relacionamentoDe,
  type FaixasDeNivel,
  type Relacionamento,
} from '@/core/relacionamento'
import { db, ehIdInvalido } from '../db'

/**
 * O relacionamento de muita gente de uma vez.
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que é ouro e o que é
 * "sumido" é `core/relacionamento.ts`.
 *
 * ---------------------------------------------------------------------------
 * O que a T8.1 consertou, e é o ponto inteiro da F8
 * ---------------------------------------------------------------------------
 *
 * As duas funções deste arquivo derivavam compra de **cartão ganho**:
 * `quadro_cartoes` com `situacao = 'ganha'`, em qualquer quadro. É exatamente o
 * que a 0071 separou e o que a RB-32 proíbe: "Resolvido" no Atendimento,
 * "Qualificado" na Captação e "Compareceu" na Agenda **não são compra**. A
 * clínica que respondeu dez dúvidas aparecia com dez compras e uma receita que
 * ninguém faturou.
 *
 * Pior, e era a linha mais errada das duas: `Number(linha.valor ?? 0)`
 * transformava **valor desconhecido em zero**, que é o oposto da RB-06. Um
 * cliente com três compras sem valor informado lia "R$ 0,00" e caía em
 * `sem_compra`, ou seja, a tela afirmava que ele nunca comprou.
 *
 * Agora a fonte é a view `contatos_comerciais` (0082), que já agrega **só venda
 * válida** (cancelada fora, RB-31), já devolve `vendas_sem_valor` separado do
 * total, e já preserva o nulo de `ultima_compra_em`, que é "sem compra com data
 * conhecida" e **não** "faz muito tempo" (RB-35).
 *
 * ---------------------------------------------------------------------------
 * Por que em lote, e por que uma consulta e não duas
 * ---------------------------------------------------------------------------
 *
 * `resumoDeVendas` já responde isto para **uma** pessoa, e é o certo na ficha.
 * A lista de contatos e o cron de retomada precisam da mesma resposta para
 * centenas, e chamá-lo num laço seria uma consulta por pessoa, o N+1 clássico:
 * numa conta com quatrocentos contatos, quatrocentas idas ao banco para desenhar
 * uma tela.
 *
 * Eram duas consultas (os ganhos e as conversas) e agora é **uma**: a view já
 * traz `ultima_mensagem_em` junto dos números comerciais, então perguntar duas
 * vezes por duas colunas da mesma linha era trabalho à toa.
 */

export type FaixasDaConta = FaixasDeNivel

/** As faixas desta conta, ou o padrão do produto se a leitura falhar. */
export async function faixasDaConta(clienteId: string): Promise<FaixasDeNivel | null> {
  const { data, error } = await db()
    .from('clients')
    .select('nivel_ouro, nivel_prata')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error) || error || !data) return null

  const linha = data as { nivel_ouro: string | number; nivel_prata: string | number }
  return {
    // `numeric` chega como string no supabase-js, e comparar "5000" com 1000
    // como texto daria ordem alfabética. Mesma armadilha de `quadro_cartoes.valor`.
    ouro: Number(linha.nivel_ouro),
    prata: Number(linha.nivel_prata),
  }
}

export async function definirFaixas(
  clienteId: string,
  faixas: FaixasDeNivel,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db()
    .from('clients')
    .update({ nivel_ouro: faixas.ouro, nivel_prata: faixas.prata })
    .eq('id', clienteId)

  if (error) throw new Error(`não deu para salvar as faixas: ${error.message}`)
  return { ok: true }
}

/**
 * O relacionamento de cada contato pedido, pela chave `contatoId`.
 *
 * Contato sem cartão ganho e sem conversa aparece no mapa mesmo assim, com
 * zeros: quem chama precisa poder desenhar a linha da pessoa sem conferir se ela
 * está no mapa, e um `undefined` aqui vira `cannot read property` na tela.
 */
export async function relacionamentoDeMuitos(
  clienteId: string,
  contatoIds: string[],
  faixas: FaixasDeNivel,
  agora: Date = new Date(),
): Promise<Map<string, Relacionamento>> {
  const mapa = new Map<string, Relacionamento>()
  if (contatoIds.length === 0) return mapa

  const { data, error } = await db()
    .from('contatos_comerciais')
    .select('contact_id, compras, valor_conhecido, vendas_sem_valor, ultima_compra_em, ultima_mensagem_em')
    .eq('client_id', clienteId)
    .in('contact_id', contatoIds)

  if (ehIdInvalido(error)) return semCompraParaTodos(mapa, contatoIds, faixas, agora)
  if (error) throw new Error(`não deu para ler o relacionamento: ${error.message}`)

  const porContato = new Map<string, LinhaComercial>()
  for (const linha of (data ?? []) as LinhaComercial[]) {
    porContato.set(linha.contact_id, linha)
  }

  for (const id of contatoIds) {
    const linha = porContato.get(id)
    mapa.set(
      id,
      relacionamentoDe(
        {
          // `numeric` chega como string do supabase-js: somar sem converter
          // concatenaria "200" com "350.50". `valor_conhecido` é nulo quando
          // não há venda válida **ou** quando nenhuma tem valor, e os dois
          // viram 0 no total, que é o que `nivelPor` sabe ler junto de
          // `compras`.
          total: linha?.valor_conhecido == null ? 0 : Number(linha.valor_conhecido),
          compras: Number(linha?.compras ?? 0),
          semValor: Number(linha?.vendas_sem_valor ?? 0),
          ultimaCompraEm: linha?.ultima_compra_em ?? null,
          ultimaConversaEm: linha?.ultima_mensagem_em ?? null,
        },
        faixas,
        agora,
      ),
    )
  }

  return mapa
}

type LinhaComercial = {
  contact_id: string
  compras: number | string | null
  valor_conhecido: string | number | null
  vendas_sem_valor: number | string | null
  ultima_compra_em: string | null
  ultima_mensagem_em: string | null
}

/**
 * Contato que a view não devolveu entra no mapa com zeros, e não fica de fora.
 *
 * Quem chama precisa poder desenhar a linha da pessoa sem conferir se ela está
 * no mapa, e um `undefined` aqui vira `cannot read property` na tela.
 */
function semCompraParaTodos(
  mapa: Map<string, Relacionamento>,
  contatoIds: string[],
  faixas: FaixasDeNivel,
  agora: Date,
): Map<string, Relacionamento> {
  for (const id of contatoIds) {
    mapa.set(
      id,
      relacionamentoDe(
        { total: 0, compras: 0, semValor: 0, ultimaCompraEm: null, ultimaConversaEm: null },
        faixas,
        agora,
      ),
    )
  }
  return mapa
}

/**
 * Quem comprou, parou de falar, e ninguém percebeu.
 *
 * É a consulta que alimenta a régua de retomada, e ela pede **quem já comprou**
 * de propósito. Correr atrás de desconhecido que sumiu é encher a fila de
 * trabalho que ninguém faz; correr atrás de cliente que sumiu é dinheiro na
 * mesa saindo pela porta.
 *
 * ---------------------------------------------------------------------------
 * O que a T8.1 mudou aqui, e o que **não** mudou
 * ---------------------------------------------------------------------------
 *
 * "Já comprou" passou a ser **venda válida** e não mais cartão ganho. Antes, uma
 * conta com um quadro de atendimento mandava régua de retomada para todo mundo
 * que teve uma dúvida resolvida, dizendo "faz tempo que a gente não se fala"
 * para quem nunca comprou nada. É a RB-32 escrita numa consulta.
 *
 * **O que não mudou é a recência, e é de propósito:** quem entra continua sendo
 * escolhido pela última **mensagem**, não pela última compra. Quem comprou há
 * seis meses e trocou mensagem ontem está vivo; quem comprou há um mês e sumiu
 * depois está indo embora. É a mesma decisão de `relacionamentoDe`.
 *
 * A RB-35 entra pelo outro lado: a régua exige **compra com data conhecida**.
 * Cliente importado sem histórico de compra não é "cliente que parou de
 * comprar", é cliente de quem não se sabe nada, e mandar régua para ele é
 * afirmar um passado que ninguém registrou.
 *
 * O teto existe porque isto roda dentro de uma passada de cron com outras
 * tarefas: uma conta com dois mil clientes antigos não pode monopolizar a
 * janela. Quem sobrar entra na passada seguinte, e isso é aceitável porque a
 * unidade aqui é o dia, não o minuto.
 */
export async function clientesSumidos(
  clienteId: string,
  diasSemConversa: number,
  limite = 200,
): Promise<{
  contatoId: string
  /** A soma **do que se sabe**. Ver `semValor` antes de escrever isto na tela. */
  total: number
  /** Quantas compras válidas sem valor informado (RB-06). */
  semValor: number
  ultimaConversaEm: string | null
  /** A última compra **com data conhecida**. Nunca nula: a régua exige uma. */
  ultimaCompraEm: string
}[]> {
  const corte = new Date(Date.now() - diasSemConversa * 86_400_000).toISOString()

  /*
   * As quatro condições vão para o Postgres de uma vez, e não em duas etapas
   * como antes.
   *
   * `is('ultima_mensagem_em', null)` continua **fora**, e agora com um segundo
   * motivo: quem comprou e nunca teve mensagem registrada é quase sempre
   * contato importado ou lançado à mão, e a régua seria a primeira mensagem que
   * a pessoa recebe da conta.
   *
   * `not('ultima_compra_em', 'is', null)` é a RB-35 na consulta: sem data de
   * compra conhecida, não dá para dizer que alguém parou de comprar.
   */
  const { data, error } = await db()
    .from('contatos_comerciais')
    .select('contact_id, valor_conhecido, vendas_sem_valor, ultima_mensagem_em, ultima_compra_em')
    .eq('client_id', clienteId)
    .gt('compras', 0)
    .not('ultima_compra_em', 'is', null)
    .not('ultima_mensagem_em', 'is', null)
    .lt('ultima_mensagem_em', corte)
    .order('ultima_mensagem_em', { ascending: true })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os clientes sumidos: ${error.message}`)

  return ((data ?? []) as LinhaComercial[]).map((linha) => ({
    contatoId: linha.contact_id,
    // `numeric` chega como string do supabase-js. Nulo aqui quer dizer que
    // **nenhuma** das compras tem valor informado, e vira 0 no total com o
    // `semValor` ao lado dizendo por quê: nunca "ela gastou zero".
    total: linha.valor_conhecido == null ? 0 : Number(linha.valor_conhecido),
    semValor: Number(linha.vendas_sem_valor ?? 0),
    ultimaConversaEm: linha.ultima_mensagem_em,
    ultimaCompraEm: linha.ultima_compra_em as string,
  }))
}
