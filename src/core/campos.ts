/**
 * Os campos da empresa: tipo, identidade estável e quem pode sobrescrever quem.
 *
 * ---------------------------------------------------------------------------
 * Os dois defeitos que este arquivo existe para fechar
 * ---------------------------------------------------------------------------
 *
 * **1. `guardarCampo` grava o objeto inteiro.** Ele recebe `campos` completo e
 * faz `update contacts set campos = $1`. Quer dizer que duas escritas a campos
 * **diferentes**, no mesmo contato, ao mesmo tempo, perdem uma: quem gravou por
 * último escreveu por cima do objeto que o outro acabou de montar, e o valor do
 * outro some sem erro nenhum.
 *
 * Não é hipótese. O caminho da mensagem grava `campos` em três lugares
 * (`receber-mensagem`, a resposta do fluxo e o lead do formulário), e o painel
 * grava pela tela ao mesmo tempo. É a RB-19: "Atualização concorrente de campos
 * distintos não pode substituir o objeto inteiro e perder o outro valor".
 *
 * **2. Não existe proveniência.** `campos` é `Record<string, string>` e não
 * guarda quem escreveu, quando, nem de onde veio. Então não há como cumprir a
 * outra metade da RB-19: "Dado corrigido por humano não é sobrescrito
 * silenciosamente por resposta antiga/importação".
 *
 * ---------------------------------------------------------------------------
 * A regra de precedência, e por que ela não é "o mais novo vence"
 * ---------------------------------------------------------------------------
 *
 * Porque "o mais novo" transforma uma importação de planilha, rodada hoje com
 * dados de março, em correção do que alguém arrumou ontem à mão. A pessoa
 * conferiu o telefone com o cliente, e a planilha antiga o desfaz.
 *
 * A ordem é por **autoridade da origem**, e o tempo só desempata dentro da
 * mesma origem. Ver `PESO_DA_ORIGEM` abaixo.
 */

/** De onde veio um valor. Vai para o banco: nomes estáveis. */
export type OrigemDoValor =
  /** Alguém do atendimento digitou na tela. */
  | 'humano'
  /** A pessoa respondeu ao bot, ou preencheu um formulário. */
  | 'contato'
  /** O bot deduziu ou o modelo extraiu. */
  | 'automacao'
  /** Veio de uma planilha ou de outro sistema. */
  | 'importacao'

/**
 * Quem vence quem, quando os dois têm valor para o mesmo campo.
 *
 * **Humano no topo, importação no fundo**, e a distância entre eles é o ponto:
 * o que uma pessoa conferiu e digitou não é desfeito por um lote que alguém
 * subiu depois. `contato` fica acima de `automacao` porque a pessoa dizendo o
 * próprio telefone vale mais do que o modelo deduzindo qual é.
 */
const PESO_DA_ORIGEM: Record<OrigemDoValor, number> = {
  humano: 3,
  contato: 2,
  automacao: 1,
  importacao: 0,
}

/** Um valor com a história dele. */
export type ValorDeCampo = {
  valor: string
  origem: OrigemDoValor
  /** Quem escreveu, quando dá para saber. `null` para bot e importação. */
  autorId: string | null
  /** ISO 8601. Desempata dentro da mesma origem. */
  em: string
}

/**
 * Este valor novo pode substituir o que está lá? (RB-19)
 *
 * ---------------------------------------------------------------------------
 * Por que objeto e não booleano
 * ---------------------------------------------------------------------------
 *
 * Porque a tela precisa dizer **por que** não gravou, e porque a recusa não é
 * um erro: é o sistema protegendo uma correção. Um `false` mudo faria a pessoa
 * achar que o botão quebrou.
 *
 * Ver também a armadilha registrada no handoff da F2: ao trocar retorno de
 * booleano para objeto, `if (!objeto)` é sempre falso e o typecheck não avisa.
 */
export type DecisaoDeEscrita =
  | { grava: true }
  | { grava: false; motivo: 'origem_mais_fraca' | 'mais_antigo' | 'igual' }

export function podeSobrescrever(
  atual: ValorDeCampo | undefined,
  novo: ValorDeCampo,
): DecisaoDeEscrita {
  // Campo vazio aceita qualquer origem: preencher o que não existe nunca
  // desfaz trabalho de ninguém.
  if (!atual) return { grava: true }

  // Mesmo valor não é escrita: gravar só trocaria a proveniência de uma
  // correção humana pela de um bot que concordou com ela.
  if (atual.valor === novo.valor) return { grava: false, motivo: 'igual' }

  const pesoAtual = PESO_DA_ORIGEM[atual.origem]
  const pesoNovo = PESO_DA_ORIGEM[novo.origem]

  if (pesoNovo > pesoAtual) return { grava: true }
  if (pesoNovo < pesoAtual) return { grava: false, motivo: 'origem_mais_fraca' }

  /*
   * Mesma origem: o tempo desempata. É aqui, e **só** aqui, que "o mais novo
   * vence" vale — duas correções humanas em sequência são a segunda corrigindo
   * a primeira, que é o comportamento que quem digita espera.
   *
   * Data ilegível não vence: falha fechado, preservando o que já estava.
   */
  const quandoAtual = Date.parse(atual.em)
  const quandoNovo = Date.parse(novo.em)
  if (Number.isNaN(quandoNovo)) return { grava: false, motivo: 'mais_antigo' }
  if (Number.isNaN(quandoAtual)) return { grava: true }

  return quandoNovo > quandoAtual ? { grava: true } : { grava: false, motivo: 'mais_antigo' }
}

/**
 * Aplica um lote de valores, campo a campo.
 *
 * **Campo a campo, e não objeto inteiro**, que é o defeito 1 do cabeçalho: um
 * lote que traz `telefone` não pode apagar o `cidade` que outra escrita acabou
 * de gravar. Devolve o mapa novo e a lista do que foi recusado, para quem chama
 * poder mostrar.
 */
export function aplicarValores(
  atuais: Record<string, ValorDeCampo>,
  novos: Record<string, ValorDeCampo>,
): { campos: Record<string, ValorDeCampo>; recusados: { chave: string; motivo: string }[] } {
  const campos = { ...atuais }
  const recusados: { chave: string; motivo: string }[] = []

  for (const [chave, valor] of Object.entries(novos)) {
    const decisao = podeSobrescrever(atuais[chave], valor)
    if (decisao.grava) {
      campos[chave] = valor
    } else if (decisao.motivo !== 'igual') {
      // `igual` não é recusa a mostrar: nada mudou e nada se perdeu.
      recusados.push({ chave, motivo: decisao.motivo })
    }
  }

  return { campos, recusados }
}

// ---------------------------------------------------------------------------
// Os tipos de campo
// ---------------------------------------------------------------------------

/**
 * Os tipos da primeira entrega, tirados da seção 7.2 da proposta.
 *
 * `texto_curto` e `texto_longo` são o mesmo dado com telas diferentes, e são
 * dois de propósito: quem define o campo está dizendo qual caixa aparece, e
 * derivar isso do tamanho do que alguém digitou seria adivinhar.
 */
export type TipoDeCampo =
  | 'texto_curto'
  | 'texto_longo'
  | 'numero'
  | 'moeda'
  | 'data'
  | 'sim_nao'
  | 'selecao'
  | 'selecao_multipla'

export const TIPOS_DE_CAMPO: readonly TipoDeCampo[] = [
  'texto_curto',
  'texto_longo',
  'numero',
  'moeda',
  'data',
  'sim_nao',
  'selecao',
  'selecao_multipla',
]

/**
 * A definição de um campo da empresa.
 *
 * `chave` é a identidade **estável**: renomear muda `rotulo`, nunca `chave`.
 * É o que preserva as referências dos fluxos e das avaliações já gravadas, e é
 * a regra da 7.2: "Chaves estáveis preservam referências; renomear muda o
 * rótulo, não o identificador".
 */
export type DefinicaoDeCampo = {
  chave: string
  rotulo: string
  tipo: TipoDeCampo
  /** As opções, para `selecao` e `selecao_multipla`. */
  opcoes?: string[]
  /**
   * Em que ações este campo é obrigatório.
   *
   * Lista e não booleano, porque a obrigatoriedade é **contextual** (RB-20):
   * um campo exigido para fechar venda não pode impedir receber mensagem.
   */
  obrigatorioEm?: ('qualificar' | 'fechar_venda')[]
  arquivado?: boolean
}

/** O que faltou para uma ação, e nada além disso (RB-20). */
export function faltamPara(
  definicoes: DefinicaoDeCampo[],
  campos: Record<string, ValorDeCampo>,
  acao: 'qualificar' | 'fechar_venda',
): string[] {
  return definicoes
    .filter((d) => !d.arquivado && (d.obrigatorioEm ?? []).includes(acao))
    .filter((d) => {
      const valor = campos[d.chave]?.valor
      return valor === undefined || valor.trim() === ''
    })
    .map((d) => d.rotulo)
}

/**
 * Um campo obrigatório bloqueia receber mensagem ou criar contato? Nunca.
 *
 * Existe como função, e não como ausência de checagem, porque "nunca" precisa
 * de um lugar onde esteja escrito e testado. A RB-20 é literal: "Campo
 * obrigatório para qualificar ou fechar venda não impede receber mensagem,
 * criar contato ou salvar rascunho".
 */
export function bloqueiaEntrada(): false {
  return false
}

/**
 * Converte o `campos` legado (`Record<string, string>`) para o formato tipado.
 *
 * **Sem inferir tipo**, e é a regra da T4.1: "Mapear strings legadas sem inferir
 * tipo de forma destrutiva; guardar original em conversão". Um valor "10/03" é
 * data para quem escreveu e texto para quem lê de outro país, e adivinhar errado
 * é perder o dado original sem ninguém notar.
 *
 * A origem é `automacao` e não `humano`: não dá para saber quem escreveu o que
 * já estava lá, e assumir `humano` daria ao legado uma autoridade que ele não
 * provou ter, travando correções futuras.
 */
export function doLegado(
  campos: Record<string, string>,
  em: string,
): Record<string, ValorDeCampo> {
  const saida: Record<string, ValorDeCampo> = {}
  for (const [chave, valor] of Object.entries(campos)) {
    saida[chave] = { valor, origem: 'automacao', autorId: null, em }
  }
  return saida
}

/** O caminho de volta, para quem ainda lê `Record<string, string>`. */
export function paraLegado(campos: Record<string, ValorDeCampo>): Record<string, string> {
  const saida: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(campos)) {
    saida[chave] = valor.valor
  }
  return saida
}
