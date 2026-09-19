/**
 * Quem é cliente bom, quem está sumindo, e o que fazer com cada um.
 *
 * ---------------------------------------------------------------------------
 * Por que faixa em reais, e não quintil
 * ---------------------------------------------------------------------------
 *
 * O método clássico de RFM ordena a base e corta em cinco partes iguais: os 20%
 * que mais gastam viram nota 5. Ele é o padrão do varejo e **não serve aqui**,
 * por uma razão que aparece já no primeiro cliente do AutoFluxos: a nota é
 * relativa à base, então num estúdio com trinta alunas o "topo" é topo de trinta
 * — pode ser gente que gastou trezentos reais no ano. O dono olha "Ouro" e vê um
 * cliente que ele não considera ouro nenhum, e a partir daí não confia em mais
 * nada da tela.
 *
 * Quintil também move o chão sozinho: entra um cliente grande e todo mundo cai
 * de faixa sem ter feito nada. Explicar isso a quem vende pilates custa mais do
 * que a segmentação vale.
 *
 * Aqui a faixa é **em reais, escolhida pelo dono**, com um padrão que funciona
 * para quem nunca abrir a tela de ajuste. É a recomendação para base pequena, e
 * é o que se consegue defender numa frase: "ouro é quem já me deu R$ 5.000".
 *
 * ---------------------------------------------------------------------------
 * Três eixos, e não um número só
 * ---------------------------------------------------------------------------
 *
 * O nível responde "quanto vale", a recência responde "ainda está aqui", e as
 * duas juntas respondem a única pergunta que gera trabalho: **quem era bom e
 * está sumindo**. Um score único (555, 321) esconde exatamente isso — 5 em valor
 * e 1 em recência vira "médio" e some no meio da lista.
 *
 * Puro, sem banco e sem React, como `core/planos.ts`: é dado e aritmética, e
 * dado tem que dar para testar sem subir servidor.
 */

// ---------------------------------------------------------------------------
// 1. O nível do cliente
// ---------------------------------------------------------------------------

/**
 * A ordem aqui é a ordem de importância, e o código depende disso: `nivelPor`
 * percorre de cima para baixo e para no primeiro que couber.
 */
export const NIVEIS = ['ouro', 'prata', 'bronze', 'sem_compra'] as const

export type Nivel = (typeof NIVEIS)[number]

export const ROTULO_DO_NIVEL: Record<Nivel, string> = {
  ouro: 'Ouro',
  prata: 'Prata',
  bronze: 'Bronze',
  sem_compra: 'Ainda não comprou',
}

/**
 * A classe da bolinha, escrita inteira.
 *
 * Como em `core/etiquetas.ts`: o Tailwind lê o texto do arquivo, e
 * `bg-${nivel}-400` montado em tempo de execução não existiria na folha de
 * estilo — a marca ficaria invisível, sem erro nenhum.
 */
export const CLASSE_DO_NIVEL: Record<Nivel, string> = {
  ouro: 'bg-amber-400',
  prata: 'bg-slate-300',
  bronze: 'bg-orange-700',
  sem_compra: 'bg-transparent border border-line',
}

export type FaixasDeNivel = {
  /** A partir de quanto, em reais, o cliente é ouro. */
  ouro: number
  /** A partir de quanto é prata. Abaixo disso, quem já comprou é bronze. */
  prata: number
}

/**
 * O padrão de quem nunca abriu a tela de ajuste.
 *
 * **É palpite honesto, e está escrito aqui para quem for mexer saber disso.**
 * Saiu do ticket dos primeiros clientes (mensalidade de estúdio entre R$ 150 e
 * R$ 400): prata pega quem fechou um plano, ouro pega quem já renovou várias
 * vezes ou comprou o pacote grande. Quando houver base real, este é o lugar de
 * corrigir, e é uma linha.
 */
export const FAIXAS_PADRAO: FaixasDeNivel = { ouro: 5000, prata: 1000 }

/**
 * Em que nível esta pessoa está, pelo que ela já gastou.
 *
 * Quem nunca comprou **não é bronze**: é `sem_compra`. Parece detalhe e não é —
 * chamar de bronze quem nunca deu um real mistura, na mesma faixa, o cliente
 * pequeno e o desconhecido, e são duas conversas completamente diferentes.
 */
export function nivelPor(totalGasto: number, faixas: FaixasDeNivel = FAIXAS_PADRAO): Nivel {
  if (totalGasto <= 0) return 'sem_compra'
  if (totalGasto >= faixas.ouro) return 'ouro'
  if (totalGasto >= faixas.prata) return 'prata'
  return 'bronze'
}

/** As faixas fazem sentido? Ouro abaixo de prata é tela que mente. */
export function conferirFaixas(faixas: FaixasDeNivel): { ok: true } | { ok: false; motivo: string } {
  if (!Number.isFinite(faixas.ouro) || !Number.isFinite(faixas.prata)) {
    return { ok: false, motivo: 'os valores precisam ser números' }
  }
  if (faixas.prata < 0 || faixas.ouro < 0) {
    return { ok: false, motivo: 'os valores não podem ser negativos' }
  }
  if (faixas.ouro <= faixas.prata) {
    return { ok: false, motivo: 'o valor do ouro precisa ser maior que o do prata' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 2. A recência
// ---------------------------------------------------------------------------

/**
 * O estado de presença de alguém, pelo tempo desde o último contato.
 *
 * **Os cortes são em dias inteiros e redondos de propósito.** A recomendação
 * para base pequena é justamente essa: mês e trimestre são unidades que o dono
 * usa para pensar o negócio, e "há 37 dias" não é uma unidade de decisão.
 */
export const RECENCIAS = ['ativo', 'esfriando', 'sumido', 'perdido', 'sem_contato'] as const

export type Recencia = (typeof RECENCIAS)[number]

export const ROTULO_DA_RECENCIA: Record<Recencia, string> = {
  ativo: 'Ativo',
  esfriando: 'Esfriando',
  sumido: 'Sumido',
  perdido: 'Frio',
  sem_contato: 'Nunca falou',
}

/** Os cortes, em dias. Abertos para teste e para virar ajuste quando precisar. */
export const CORTES_DE_RECENCIA = { esfriando: 30, sumido: 90, perdido: 180 } as const

/**
 * Há quantos dias, e o que isso significa.
 *
 * `null` em `ultimaEm` é quem nunca teve o fato medido, e vira `sem_contato` em
 * vez de "perdido há infinitos dias": afirmar que sumiu quem nunca chegou é o
 * tipo de mentira de tela que este produto evita desde o começo.
 */
export function recenciaPor(ultimaEm: string | null, agora: Date = new Date()): Recencia {
  if (!ultimaEm) return 'sem_contato'

  const dias = diasDesde(ultimaEm, agora)
  if (dias === null) return 'sem_contato'
  if (dias >= CORTES_DE_RECENCIA.perdido) return 'perdido'
  if (dias >= CORTES_DE_RECENCIA.sumido) return 'sumido'
  if (dias >= CORTES_DE_RECENCIA.esfriando) return 'esfriando'
  return 'ativo'
}

/**
 * Dias inteiros desde uma data ISO. `null` quando a data não se lê.
 *
 * Data futura devolve 0 e não negativo: acontece com relógio de servidor
 * adiantado, e "há -1 dias" na tela é pior do que "hoje".
 */
export function diasDesde(quando: string | null, agora: Date = new Date()): number | null {
  if (!quando) return null
  const t = Date.parse(quando)
  if (Number.isNaN(t)) return null
  const dias = Math.floor((agora.getTime() - t) / 86_400_000)
  return dias < 0 ? 0 : dias
}

// ---------------------------------------------------------------------------
// 3. As duas coisas juntas
// ---------------------------------------------------------------------------

export type Relacionamento = {
  nivel: Nivel
  recencia: Recencia
  /** Desde a última compra. `null` = nunca comprou. */
  diasDaUltimaCompra: number | null
  /** Desde a última mensagem dela. `null` = nunca escreveu. */
  diasDaUltimaConversa: number | null
  total: number
  compras: number
}

export type FatosDoContato = {
  total: number
  compras: number
  /** A última compra. */
  ultimaCompraEm: string | null
  /** A última vez que **a pessoa** falou. */
  ultimaConversaEm: string | null
}

/**
 * O retrato do relacionamento com uma pessoa.
 *
 * **A recência é da conversa, não da compra**, e essa escolha é o coração da
 * tela. Quem comprou há seis meses e trocou mensagem ontem está vivo; quem
 * comprou há um mês e sumiu depois está indo embora. Medir pela compra faria o
 * segundo caso parecer saudável até a hora da renovação — que é exatamente
 * quando não dá mais para fazer nada.
 */
export function relacionamentoDe(
  fatos: FatosDoContato,
  faixas: FaixasDeNivel = FAIXAS_PADRAO,
  agora: Date = new Date(),
): Relacionamento {
  return {
    nivel: nivelPor(fatos.total, faixas),
    recencia: recenciaPor(fatos.ultimaConversaEm, agora),
    diasDaUltimaCompra: diasDesde(fatos.ultimaCompraEm, agora),
    diasDaUltimaConversa: diasDesde(fatos.ultimaConversaEm, agora),
    total: fatos.total,
    compras: fatos.compras,
  }
}

/**
 * A frase que diz o que fazer com essa pessoa hoje.
 *
 * A tela só vira ferramenta quando responde "e agora?". Um rótulo "Ouro ·
 * Sumido" informa e não move ninguém; "Cliente ouro sumido há 4 meses — vale uma
 * ligação" move.
 *
 * **A ordem dos casos é a ordem da urgência**, e o primeiro que casa ganha:
 * cliente bom indo embora vem antes de qualquer outra coisa, porque é o único
 * caso em que o dinheiro já está na mesa e está saindo pela porta.
 */
export function oQueFazer(r: Relacionamento): string | null {
  const bom = r.nivel === 'ouro' || r.nivel === 'prata'

  if (bom && (r.recencia === 'sumido' || r.recencia === 'perdido')) {
    return `Cliente ${ROTULO_DO_NIVEL[r.nivel].toLowerCase()} sem falar com você há ${meses(r.diasDaUltimaConversa)}. Vale uma ligação antes de virar perda.`
  }
  if (bom && r.recencia === 'esfriando') {
    return `Já comprou ${r.compras === 1 ? 'uma vez' : `${r.compras} vezes`} e está esfriando. É a hora de oferecer a próxima.`
  }
  if (r.nivel === 'bronze' && (r.recencia === 'ativo' || r.recencia === 'esfriando')) {
    return 'Comprou pouco e ainda responde. É com quem dá para crescer.'
  }
  if (r.nivel === 'sem_compra' && r.recencia === 'ativo') {
    return 'Conversa com você e nunca fechou. Falta uma oferta.'
  }
  if (r.nivel === 'sem_compra' && (r.recencia === 'sumido' || r.recencia === 'perdido')) {
    return null
  }
  return null
}

/** "4 meses", "20 dias". Ninguém decide nada com "há 127 dias". */
function meses(dias: number | null): string {
  if (dias === null) return 'um tempo'
  if (dias < 45) return `${dias} dias`
  const m = Math.round(dias / 30)
  return m === 1 ? 'um mês' : `${m} meses`
}
