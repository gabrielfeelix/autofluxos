import 'server-only'
import type { Ferramenta } from '@/core/ferramentas'
import { db } from '../db'

/**
 * Quanta autonomia a IA tem para gravar — e onde mora a resposta.
 *
 * Três clientes descritos por quem vende, e três comportamentos: um confia e
 * quer o robô marcando sozinho, outro quer a pessoa confirmando, o terceiro
 * quer que a IA só faça o bate-bola e um funcionário aprove. O modelo precisa
 * caber os três sem virar configuração infinita, e cabe em dois eixos.
 *
 * **Eixo 1 — lê ou grava?** Já está no dado, sai do verbo HTTP. Campo nenhum a
 * criar, e opinião nenhuma a coletar.
 *
 * **Eixo 2 — política, por cliente e por ferramenta.** Só para o que grava.
 */
export const POLITICAS = ['automatico', 'confirmar', 'humano'] as const
export type Politica = (typeof POLITICAS)[number]

/**
 * O padrão, e por que ele mora no código.
 *
 * Uma tabela pré-preenchida para todo cliente seria um segundo lugar onde o
 * padrão pode divergir de si mesmo — e o cliente cadastrado antes da migration
 * ficaria sem linha nenhuma, ou seja, sem padrão. Com o padrão aqui, quem nunca
 * foi configurado já nasce protegido, que é o lado certo para errar.
 *
 * **Escrita começa em `confirmar`.** É o desenho que resolve a maior parte dos
 * casos sem tela nova — uma mensagem e uma pergunta, coisa que o motor faz
 * desde o primeiro dia — e é também o que tira a decisão de ser *unicamente
 * automatizada*, que é a expressão do art. 20 da LGPD. Quem quiser o robô
 * marcando sozinho pede, e vira uma linha.
 */
export const PADRAO_DE_ESCRITA: Politica = 'confirmar'

/**
 * Leitura é sempre automática, e a escolha não é oferecida.
 *
 * Não existe cliente que queira aprovar "quais horários tem quinta". Oferecer a
 * opção seria oferecer uma tela para manter, testar e explicar de graça — e uma
 * trava que, marcada por engano, faria a IA parecer quebrada.
 */
export const PADRAO_DE_LEITURA: Politica = 'automatico'

/**
 * As políticas deste cliente, uma leitura por resposta.
 *
 * Só o que foge do padrão está gravado, então o mapa costuma vir vazio — e
 * vazio é a resposta certa, não um erro.
 *
 * **Falha de banco não vira exceção.** Ela subiria até o `after()` do webhook,
 * a sessão nunca seria salva e a pessoa ficaria sem resposta nenhuma. Sem
 * política lida, valem os padrões, que são os conservadores: o pior caso é a IA
 * perguntar antes de gravar quando o cliente já tinha dispensado a pergunta.
 */
export async function lerPoliticas(clienteId: string): Promise<Map<string, Politica>> {
  const { data, error } = await db()
    .from('client_tool_policies')
    .select('ferramenta, politica')
    .eq('client_id', clienteId)

  if (error || !data) {
    if (error) console.error('[ia] não deu para ler as políticas', error.message)
    return new Map()
  }

  const mapa = new Map<string, Politica>()
  for (const linha of data as { ferramenta: string; politica: string }[]) {
    if ((POLITICAS as readonly string[]).includes(linha.politica)) {
      mapa.set(linha.ferramenta, linha.politica as Politica)
    }
  }
  return mapa
}

/**
 * A política que vale para esta ferramenta neste cliente.
 *
 * Leitura ignora o que estiver gravado, e não é descuido: o `check` do banco já
 * recusa política de leitura, e esta função é a segunda porta. Duas portas
 * porque a consequência de uma linha errada é a IA emudecer numa consulta
 * inofensiva, e ninguém suspeitaria da tabela.
 */
export function politicaDe(ferramenta: Ferramenta, gravadas: Map<string, Politica>): Politica {
  if (!ferramenta.escreve) return PADRAO_DE_LEITURA
  return gravadas.get(ferramenta.nome) ?? PADRAO_DE_ESCRITA
}
