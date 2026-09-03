import 'server-only'
import { db } from '../db'

/**
 * Os avisos de falha, guardados onde alguém consegue ler depois.
 *
 * **Por que existe.** `alertar()` foi escrito para postar num webhook de
 * Discord, e a variável que aponta para esse webhook nunca foi preenchida. O
 * mecanismo estava certo e completo, chamado nos seis lugares certos, e não
 * avisava ninguém: falha no webhook do WhatsApp, recusa da Cloud API e cofre
 * que não devolve credencial morriam num `console.error` que some do log da
 * Vercel em algumas horas.
 *
 * O conserto não é criar o webhook — é fazer o aviso não depender de uma
 * credencial que só uma pessoa consegue criar. Grava-se aqui **sempre**; o
 * webhook, quando existir, toca por cima.
 *
 * **A escrita nunca estoura.** Este módulo é chamado de dentro de `alertar()`,
 * que por sua vez é chamado de caminhos que já estão falhando. Uma exceção aqui
 * viraria a segunda falha em cima da primeira — ver o comentário grande em
 * `alertar.ts`. Por isso `gravarAlerta` devolve `boolean` em vez de lançar.
 */

/** O que a tela do administrador lê. */
export type Alerta = {
  id: string
  titulo: string
  detalhe: string
  contexto: Record<string, unknown>
  ambiente: string
  criadoEm: string
  /** Nulo = ninguém viu ainda. */
  vistoEm: string | null
}

/**
 * Teto do que vai para o banco.
 *
 * Um `stack` de erro em cadeia passa fácil de dez mil caracteres, e o que
 * explica o problema está sempre no começo. Guardar o resto custa espaço numa
 * tabela que cresce sozinha e não ajuda ninguém a entender nada.
 */
const LIMITE_DO_DETALHE = 4_000

/** Quanto tempo um alerta fica guardado. Ver o cabeçalho da 0039. */
export const DIAS_DE_RETENCAO_DO_ALERTA = 90

/** Teto por execução da limpeza, pelo mesmo motivo de `TETO_POR_LIMPEZA`. */
const TETO_POR_LIMPEZA = 1_000

type Linha = {
  id: string
  titulo: string
  detalhe: string
  contexto: Record<string, unknown> | null
  ambiente: string
  criado_em: string
  visto_em: string | null
}

const COLUNAS = 'id, titulo, detalhe, contexto, ambiente, criado_em, visto_em'

function paraAlerta(linha: Linha): Alerta {
  return {
    id: linha.id,
    titulo: linha.titulo,
    detalhe: linha.detalhe,
    contexto: linha.contexto ?? {},
    ambiente: linha.ambiente,
    criadoEm: linha.criado_em,
    vistoEm: linha.visto_em,
  }
}

/**
 * Onde este alerta aconteceu.
 *
 * Sem isto, um alerta disparado num deploy de preview aparece na tela com a
 * mesma cara de um de produção — e a diferença entre "o cliente está sem
 * resposta agora" e "alguém testou uma branch" é a diferença entre largar o que
 * está fazendo e não largar.
 */
export function ambienteAtual(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local'
}

/**
 * Grava o alerta. Devolve `false` se não deu — nunca estoura.
 *
 * O `console.error` do fim não é redundante com a tabela: se o banco for
 * justamente o que está fora, ele é o único lugar que sobra.
 */
export async function gravarAlerta(entrada: {
  titulo: string
  detalhe: string
  contexto: Record<string, string | number | null | undefined>
}): Promise<boolean> {
  // `undefined` não sobrevive ao JSON e `null` polui a tela com campo vazio.
  // Limpar aqui, e não em quem chama, é o que garante que todos os seis pontos
  // de chamada gravem a mesma forma.
  const contexto: Record<string, string | number> = {}
  for (const [chave, valor] of Object.entries(entrada.contexto)) {
    if (valor === null || valor === undefined || valor === '') continue
    contexto[chave] = valor
  }

  try {
    const { error } = await db()
      .from('alertas')
      .insert({
        titulo: entrada.titulo,
        detalhe: entrada.detalhe.slice(0, LIMITE_DO_DETALHE),
        contexto,
        ambiente: ambienteAtual(),
      })

    if (error) {
      console.error('[alerta] não deu para gravar', error.message)
      return false
    }
    return true
  } catch (erro) {
    console.error('[alerta] não deu para gravar', erro)
    return false
  }
}

/** Os mais recentes primeiro. `apenasAbertos` é o filtro da tela. */
export async function listarAlertas(opcoes: {
  apenasAbertos?: boolean
  limite?: number
} = {}): Promise<Alerta[]> {
  let consulta = db()
    .from('alertas')
    .select(COLUNAS)
    .order('criado_em', { ascending: false })
    .limit(opcoes.limite ?? 100)

  if (opcoes.apenasAbertos) consulta = consulta.is('visto_em', null)

  const { data, error } = await consulta
  if (error) throw new Error(`não deu para listar os alertas: ${error.message}`)
  return (data as Linha[]).map(paraAlerta)
}

/** Quantos ninguém viu ainda. É o número que o menu do administrador mostra. */
export async function contarAlertasAbertos(): Promise<number> {
  const { count, error } = await db()
    .from('alertas')
    .select('id', { count: 'exact', head: true })
    .is('visto_em', null)

  if (error) throw new Error(`não deu para contar os alertas: ${error.message}`)
  return count ?? 0
}

/**
 * Marca como visto.
 *
 * Sem `id`, marca todos os abertos — é o "limpar tudo" da tela, e ele existe
 * porque a alternativa a marcar cinquenta alertas iguais um a um é não marcar
 * nenhum, e aí o contador deixa de querer dizer alguma coisa.
 */
export async function marcarAlertaVisto(id?: string): Promise<void> {
  let consulta = db().from('alertas').update({ visto_em: new Date().toISOString() })
  consulta = id ? consulta.eq('id', id) : consulta.is('visto_em', null)

  const { error } = await consulta
  if (error) throw new Error(`não deu para marcar o alerta: ${error.message}`)
}

/**
 * A data-limite: alerta criado antes dela está vencido.
 *
 * Função separada e pura pelo mesmo motivo de `limiteDaRetencao`: a fronteira
 * do prazo é o que precisa de teste, e a única forma de testá-la pelo lado do
 * banco seria mandar `limparAlertasVencidos` apagar de verdade — numa tabela
 * que é global e compartilhada com o produto rodando. Um teste assim apagaria
 * o alerta que alguém precisava ler.
 */
export function limiteDoAlerta(agora: Date): Date {
  const limite = new Date(agora)
  limite.setUTCDate(limite.getUTCDate() - DIAS_DE_RETENCAO_DO_ALERTA)
  return limite
}

/** Apaga o que passou do prazo. Chamada pela rota de retenção. */
export async function limparAlertasVencidos(agora: Date = new Date()): Promise<number> {
  const limite = limiteDoAlerta(agora)

  // Escolhe os ids antes de apagar: `delete` com `limit` não existe no
  // PostgREST, e apagar por data sem teto pode virar uma transação enorme no
  // primeiro dia em que a limpeza rodar depois de muito tempo parada.
  const { data, error } = await db()
    .from('alertas')
    .select('id')
    .lt('criado_em', limite.toISOString())
    .limit(TETO_POR_LIMPEZA)

  if (error) throw new Error(`não deu para achar alertas vencidos: ${error.message}`)

  const ids = (data as { id: string }[]).map((l) => l.id)
  if (ids.length === 0) return 0

  const { error: erroAoApagar } = await db().from('alertas').delete().in('id', ids)
  if (erroAoApagar) throw new Error(`não deu para apagar alertas: ${erroAoApagar.message}`)

  return ids.length
}
