import 'server-only'
import { conferirFechamento, type Situacao } from '@/core/crm'
import { db } from '../db'
import { listarMotivos } from '../repos/motivos-de-perda'
import { aplicarFato } from '../repos/crm'
import { agendar, cancelarPorChave } from '../repos/tarefas'
import { chaveDaContinuidade, dadosDaContinuidadeSchema } from '@/core/continuidade'

/**
 * Concluir uma ocorrência (T1.2).
 *
 * ---------------------------------------------------------------------------
 * Por que isto saiu de `repos/quadros.ts`
 * ---------------------------------------------------------------------------
 *
 * `fecharCartao` fazia quatro idas ao banco em fila e o comentário dela
 * admitia: "Não é transação". Entre a segunda e a terceira cabia uma queda —
 * teto de tempo da função, deploy no meio, rede — e o cartão ficava ganho com o
 * histórico em branco.
 *
 * Coordenar duas escritas que precisam valer juntas não é ida ao banco, é
 * decisão; por isso mora em `servicos/` e não em `repos/`. A transação em si é
 * da `concluir_processo` da 0072, porque o PostgREST não tem transação entre
 * requisições e fingir que tem seria o defeito de novo com outra aparência.
 *
 * ---------------------------------------------------------------------------
 * As três coisas que este arquivo garante
 * ---------------------------------------------------------------------------
 *
 *  1. **estado final e evento juntos** — ou os dois existem, ou nenhum (RB-24);
 *  2. **duplo clique devolve a mesma conclusão** — pela chave da operação, e
 *     pelo `and situacao = 'aberta'` do update quando não há chave (RB-10, A13);
 *  3. **a continuidade é intenção gravada, não efeito colateral** — se abrir o
 *     processo seguinte falhar, a conclusão de origem continua de pé e fica uma
 *     pendência visível para repetir só essa parte (RB-25, A26).
 *
 * O terceiro ponto é o que mudou de verdade. Antes, a passagem ao quadro
 * seguinte que falhava escrevia `console.error` e devolvia `null`: o log da
 * Vercel expira e a pendência expirava junto. Agora ela é uma linha em
 * `conclusoes_de_processo` com `continuidade = 'pendente'` ou `'falhou'`.
 */

export type SituacaoDaContinuidade = 'nao_se_aplica' | 'pendente' | 'feita' | 'falhou'

export type Conclusao = {
  id: string
  contatoId: string
  cartaoId: string
  /** O processo **da época**: renomear depois não reescreve isto (RB-24). */
  quadroId: string
  quadroNome: string
  quadroFinalidade: string
  colunaId: string
  colunaNome: string
  situacao: Exclude<Situacao, 'aberta'>
  motivo: string | null
  continuidade: SituacaoDaContinuidade
  continuidadeErro: string | null
  continuidadeTentativas: number
  destinoQuadroId: string | null
  destinoCartaoId: string | null
  criadoEm: string
}

type LinhaDaConclusao = {
  id: string
  contact_id: string
  cartao_id: string
  quadro_id: string
  quadro_nome: string
  quadro_finalidade: string
  coluna_id: string
  coluna_nome: string
  situacao: string
  motivo: string | null
  continuidade: string
  continuidade_erro: string | null
  continuidade_tentativas: number
  destino_quadro_id: string | null
  destino_cartao_id: string | null
  criado_em: string
}

/**
 * A mesma conclusão, como a `concluir_processo` a devolve.
 *
 * Os nomes levam `o_` porque os parâmetros OUT da função precisam não colidir
 * com as colunas das tabelas que ela consulta — ver a 0072 e o 42702 que a
 * primeira versão produzia. `o_repetida` é a única informação que não está na
 * tabela: ela responde "esta chamada escreveu, ou encontrou?".
 */
type LinhaDoRpc = {
  o_id: string
  o_contact_id: string
  o_cartao_id: string
  o_quadro_id: string
  o_quadro_nome: string
  o_quadro_finalidade: string
  o_coluna_id: string
  o_coluna_nome: string
  o_situacao: string
  o_motivo: string | null
  o_continuidade: string
  o_continuidade_erro: string | null
  o_continuidade_tentativas: number
  o_destino_quadro_id: string | null
  o_destino_cartao_id: string | null
  o_criado_em: string
  o_repetida: boolean
}

function doRpc(linha: LinhaDoRpc): LinhaDaConclusao {
  return {
    id: linha.o_id,
    contact_id: linha.o_contact_id,
    cartao_id: linha.o_cartao_id,
    quadro_id: linha.o_quadro_id,
    quadro_nome: linha.o_quadro_nome,
    quadro_finalidade: linha.o_quadro_finalidade,
    coluna_id: linha.o_coluna_id,
    coluna_nome: linha.o_coluna_nome,
    situacao: linha.o_situacao,
    motivo: linha.o_motivo,
    continuidade: linha.o_continuidade,
    continuidade_erro: linha.o_continuidade_erro,
    continuidade_tentativas: linha.o_continuidade_tentativas,
    destino_quadro_id: linha.o_destino_quadro_id,
    destino_cartao_id: linha.o_destino_cartao_id,
    criado_em: linha.o_criado_em,
  }
}

function paraConclusao(linha: LinhaDaConclusao): Conclusao {
  return {
    id: linha.id,
    contatoId: linha.contact_id,
    cartaoId: linha.cartao_id,
    quadroId: linha.quadro_id,
    quadroNome: linha.quadro_nome,
    quadroFinalidade: linha.quadro_finalidade,
    colunaId: linha.coluna_id,
    colunaNome: linha.coluna_nome,
    situacao: linha.situacao === 'perdida' ? 'perdida' : 'ganha',
    motivo: linha.motivo,
    continuidade: ehSituacaoDaContinuidade(linha.continuidade)
      ? linha.continuidade
      : 'nao_se_aplica',
    continuidadeErro: linha.continuidade_erro,
    continuidadeTentativas: linha.continuidade_tentativas,
    destinoQuadroId: linha.destino_quadro_id,
    destinoCartaoId: linha.destino_cartao_id,
    criadoEm: linha.criado_em,
  }
}

function ehSituacaoDaContinuidade(valor: string): valor is SituacaoDaContinuidade {
  return ['nao_se_aplica', 'pendente', 'feita', 'falhou'].includes(valor)
}

export type PedidoDeConclusao = {
  clienteId: string
  cartaoId: string
  situacao: Exclude<Situacao, 'aberta'>
  valor?: number | null
  motivo?: string | null
  titulo?: string | null
  autor?: string | null
  /**
   * A chave da operação. **Mande sempre** a partir da tela.
   *
   * Sem ela, o duplo clique ainda não cria duas conclusões — o `situacao =
   * 'aberta'` do update fecha isso. O que ela acrescenta é o retry depois de
   * uma **resposta perdida**: a requisição chegou, o cartão foi concluído, a
   * resposta se perdeu na volta, e a segunda tentativa precisa reconhecer a
   * própria operação em vez de descobrir um cartão "já concluído por outro".
   */
  chaveDaOperacao?: string | null
}

export type ResultadoDaConclusao =
  | { ok: true; conclusao: Conclusao; repetida: boolean }
  | { ok: false; motivo: string }

/**
 * Conclui, e enfileira a continuidade se houver.
 *
 * A ordem importa: a conclusão é gravada **antes** de a continuidade ser
 * enfileirada, e enfileirar que falha não desfaz o que já está gravado. É a
 * ordem certa de falhar — perder o registro da venda porque o pós-venda não
 * abriu seria inverter a importância das duas coisas.
 */
export async function concluirProcesso(
  pedido: PedidoDeConclusao,
): Promise<ResultadoDaConclusao> {
  const motivos =
    pedido.situacao === 'perdida' ? (await listarMotivos(pedido.clienteId)).map((m) => m.nome) : []

  const conferido = conferirFechamento(
    pedido.situacao,
    { valor: pedido.valor ?? null, motivo: pedido.motivo ?? null },
    motivos,
  )
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db().rpc('concluir_processo', {
    p_client_id: pedido.clienteId,
    p_cartao_id: pedido.cartaoId,
    p_situacao: pedido.situacao,
    p_valor: pedido.valor ?? null,
    p_motivo: pedido.motivo ?? null,
    p_titulo: pedido.titulo ?? null,
    p_autor: pedido.autor ?? null,
    p_chave: pedido.chaveDaOperacao ?? null,
  })

  if (error) return { ok: false, motivo: `não deu para concluir: ${error.message}` }

  // Conjunto vazio é recusa: cartão de outra conta, apagado, ou concluído por
  // um caminho que não gravou conclusão. Ver a 0033 sobre por que a função
  // devolve conjunto e não composto.
  const linhas = (data ?? []) as unknown as LinhaDoRpc[]
  const primeira = linhas[0]
  if (!primeira) return { ok: false, motivo: 'este cartão não está aberto' }

  const conclusao = paraConclusao(doRpc(primeira))

  /*
   * `repetida` vem do banco, e não de uma comparação de relógio aqui.
   *
   * A primeira versão deduzia "já existia" da idade de `criado_em`. Duas
   * chamadas separadas por 80 ms dão a mesma idade que uma chamada só, então a
   * dedução respondia "nova" para o segundo clique — que é exatamente o caso
   * que ela existe para reconhecer. Quem sabe se escreveu é quem escreveu.
   */
  const repetida = primeira.o_repetida === true

  // O estágio do contato é dado de apoio, como o histórico: falhar aqui não
  // pode derrubar a conclusão que já está gravada.
  if (!repetida) {
    await aplicarFato(
      pedido.clienteId,
      conclusao.contatoId,
      pedido.situacao === 'ganha' ? 'ganhou' : 'perdeu',
      pedido.autor ?? null,
    )
  }

  if (conclusao.continuidade !== 'pendente') return { ok: true, conclusao, repetida }

  /*
   * A continuidade é tentada **aqui e agora**, e a fila é a rede embaixo.
   *
   * Deixar só para a fila seria mais simples e estaria errado para o caso
   * comum: a tela diz "o contato entrou no funil Pós-venda" no mesmo clique, e
   * um cartão que só aparece quando o cron passa transforma essa frase em
   * promessa. O gesto continua sendo ganhar, e o resultado continua sendo
   * imediato.
   *
   * O que a T1.2 muda não é *quando* a passagem acontece, é o que sobra
   * quando ela **não** acontece. Antes: `console.error` e um `null`, num log
   * que expira. Agora: a intenção já está gravada em
   * `conclusoes_de_processo` antes desta linha rodar, então falhar aqui deixa
   * uma pendência visível — e a fila a repete sozinha, com teto (RB-25, A26).
   *
   * Ordem, e ela importa: enfileira **antes** de tentar. Se a função morrer
   * entre as duas, a fila cobre; se fosse ao contrário, morrer na tentativa
   * perderia a rede junto.
   */
  await enfileirarContinuidade(pedido.clienteId, conclusao.id)

  try {
    const resolvida = await resolverContinuidade(conclusao.id)
    if (resolvida) {
      // Deu certo na hora: a tarefa da fila não tem mais o que fazer. Deixá-la
      // viva não criaria um segundo cartão — a `chave_de_criacao` da 0071
      // fecha isso — mas gastaria uma passada do cron para descobrir.
      if (resolvida.continuidade !== 'pendente') {
        await cancelarPorChave(chaveDaContinuidade(conclusao.id))
      }
      return { ok: true, conclusao: resolvida, repetida }
    }
  } catch (erro) {
    // A tentativa falhou; a intenção está gravada e a tarefa está na fila.
    // Nada aqui pode derrubar a conclusão, que já está no banco.
    console.error('[conclusao] a continuidade fica para a fila:', erro)
  }

  return { ok: true, conclusao, repetida }
}

/**
 * Põe a continuidade na fila que já existe.
 *
 * A chave é por conclusão: reenfileirar a mesma intenção substitui a tarefa
 * pendente em vez de somar uma segunda. Duas tarefas vivas da mesma conclusão
 * não criariam dois cartões — a `chave_de_criacao` do destino fecha isso no
 * banco — mas criariam dois eventos "entrou no quadro", que é ruído no
 * histórico de alguém.
 */
export async function enfileirarContinuidade(
  clienteId: string,
  conclusaoId: string,
): Promise<void> {
  await agendar({
    clienteId,
    tipo: 'continuidade_de_processo',
    // Agora: não há espera a respeitar. A fila existe aqui pela repetição com
    // teto e pelo registro da falha, não pelo adiamento.
    quando: new Date(),
    dados: { conclusaoId },
    chave: chaveDaContinuidade(conclusaoId),
  })
}

/**
 * Executa a intenção: abre a ocorrência no processo de destino.
 *
 * Idempotente pela conclusão de origem, em duas camadas — ver a 0072. Chamada
 * pela fila e, quando a pessoa clica em "tentar de novo" numa pendência, pela
 * tela.
 */
export async function resolverContinuidade(
  conclusaoId: string,
): Promise<Conclusao | null> {
  const { data, error } = await db().rpc('resolver_continuidade', {
    p_conclusao_id: conclusaoId,
  })

  if (error) throw new Error(`não deu para abrir o processo de destino: ${error.message}`)

  const linhas = (data ?? []) as LinhaDaConclusao[]
  const primeira = linhas[0]
  return primeira ? paraConclusao(primeira) : null
}

/** A conclusão de uma ocorrência. `null` = ainda aberta, ou concluída antes da 0072. */
export async function conclusaoDoCartao(
  clienteId: string,
  cartaoId: string,
): Promise<Conclusao | null> {
  const { data, error } = await db()
    .from('conclusoes_de_processo')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .maybeSingle()

  if (error) {
    if (error.code === '22P02') return null
    throw new Error(`não deu para ler a conclusão: ${error.message}`)
  }
  return data ? paraConclusao(data as unknown as LinhaDaConclusao) : null
}

/**
 * O que ficou para trás nesta conta (A26).
 *
 * É a lista que faz a pendência ser **visível** em vez de um log expirado. A
 * tela é da F5; a consulta existe desde já porque sem ela "pendência visível"
 * é promessa, não entrega.
 */
export async function continuidadesPendentes(
  clienteId: string,
  limite = 50,
): Promise<Conclusao[]> {
  const { data, error } = await db()
    .from('conclusoes_de_processo')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .in('continuidade', ['pendente', 'falhou'])
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (error) {
    if (error.code === '22P02') return []
    throw new Error(`não deu para ler as pendências: ${error.message}`)
  }
  return (data as unknown as LinhaDaConclusao[]).map(paraConclusao)
}

const COLUNAS =
  'id, contact_id, cartao_id, quadro_id, quadro_nome, quadro_finalidade, coluna_id, ' +
  'coluna_nome, situacao, motivo, continuidade, continuidade_erro, ' +
  'continuidade_tentativas, destino_quadro_id, destino_cartao_id, criado_em'

/**
 * O executor da fila (tipo `continuidade_de_processo`).
 *
 * **Falha técnica sobe como exceção, de propósito.** O `rodarTarefas` a
 * transforma em `marcarFalha`, que devolve a tarefa à fila até o teto de três
 * tentativas — é a repetição com limite que a T1.2 pede, e ela já existe. O
 * que não pode subir é a pendência de configuração: destino apagado ou sem
 * etapa não melhora tentando de novo, então a 0072 a grava como `falhou` e
 * esta função a trata como `feita` — a tarefa terminou, a pendência fica
 * visível na conclusão.
 */
export async function rodarContinuidadeDeProcesso(
  dados: unknown,
): Promise<'feita' | 'ignorada'> {
  const analise = dadosDaContinuidadeSchema.safeParse(dados)
  if (!analise.success) return 'ignorada'

  const conclusao = await resolverContinuidade(analise.data.conclusaoId)

  // Conclusão apagada entre agendar e executar. Não é erro: é uma intenção que
  // deixou de existir, e insistir nela três vezes só encheria o painel.
  if (!conclusao) return 'ignorada'

  return 'feita'
}
