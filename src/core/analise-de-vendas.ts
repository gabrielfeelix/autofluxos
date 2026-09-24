/**
 * As contas de Análise > Vendas (plano de navegação e CRM, 5.3), sem I/O.
 *
 * O banco devolve contagens agrupadas; aqui mora o que é regra: o que é taxa
 * de vitória, até onde um negócio chegou, qual passagem perde mais e como um
 * ano vira doze meses com os vazios no lugar.
 */

export type AbaDeVendas = 'receita' | 'conversao' | 'equipe'

export const ABAS_DE_VENDAS: { chave: AbaDeVendas; rotulo: string }[] = [
  { chave: 'receita', rotulo: 'Receita' },
  { chave: 'conversao', rotulo: 'Conversão' },
  { chave: 'equipe', rotulo: 'Equipe' },
]

export function lerAbaDeVendas(valor: unknown): AbaDeVendas {
  return valor === 'conversao' || valor === 'equipe' ? valor : 'receita'
}

/**
 * Ganhos sobre fechados, em %. Aberto não entra: ainda pode virar qualquer
 * coisa, e contá-lo derrubaria a taxa de quem tem muito negócio novo.
 * `null` quando nada fechou, que é diferente de 0%.
 */
export function taxaDeVitoria(ganhos: number, perdidos: number): number | null {
  const fechados = ganhos + perdidos
  return fechados === 0 ? null : Math.round((ganhos / fechados) * 100)
}

/** Valor médio de um ganho, só entre os que têm valor anotado. */
export function ticketMedio(valor: number | null, ganhosComValor: number): number | null {
  if (valor === null || ganhosComValor === 0) return null
  return Math.round((valor / ganhosComValor) * 100) / 100
}

// ---------------------------------------------------------------------------
// Meses
// ---------------------------------------------------------------------------

export type MesDeVendas = {
  /** `YYYY-MM`. */
  mes: string
  ganhos: number
  /** `null` quando nenhum ganho do mês tinha valor: não é "R$ 0". */
  valor: number | null
}

/** Os `quantos` meses que terminam no mês de `ate` (`YYYY-MM-DD`), em ordem. */
export function mesesAte(ate: string, quantos = 12): string[] {
  const ano = Number(ate.slice(0, 4))
  const mes = Number(ate.slice(5, 7)) - 1
  const lista: string[] = []
  for (let i = quantos - 1; i >= 0; i--) {
    const total = ano * 12 + mes - i
    lista.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`)
  }
  return lista
}

/**
 * Todos os meses pedidos, zero incluído, pelo mesmo motivo do `completarDias`:
 * mês parado precisa aparecer como mês, e não sumir do eixo.
 */
export function completarMeses(linhas: MesDeVendas[], meses: string[]): MesDeVendas[] {
  const porMes = new Map(linhas.map((l) => [l.mes, l]))
  return meses.map((mes) => porMes.get(mes) ?? { mes, ganhos: 0, valor: null })
}

const NOMES_DOS_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** `2026-09` como `set` ou, com ano, `set/26`. */
export function mesCurto(mes: string, comAno = false): string {
  const nome = NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1] ?? mes
  return comAno ? `${nome}/${mes.slice(2, 4)}` : nome
}

/** O mês cai, ao menos em parte, dentro do período? */
export function mesNoPeriodo(mes: string, de: string, ate: string): boolean {
  return mes >= de.slice(0, 7) && mes <= ate.slice(0, 7)
}

// ---------------------------------------------------------------------------
// Passagem de etapa a etapa
// ---------------------------------------------------------------------------

export type EtapaDoFunil = { id: string; nome: string; ordem: number; tipo: 'normal' | 'ganho' | 'perdido' }

/**
 * Um grupo de negócios que foi até a mesma etapa. `maiorOrdem` é a `ordem` da
 * etapa mais adiantada em que o negócio esteve (a atual ou uma do histórico);
 * `null` quando não se sabe, e aí ele conta só na primeira.
 */
export type AlcanceDosNegocios = { maiorOrdem: number | null; ganho: boolean; n: number }

export type PassagemDaEtapa = {
  etapa: EtapaDoFunil
  /** Quantos negócios chegaram até aqui. */
  chegaram: number
  /** Dos que chegaram, quantos foram para a próxima. `null` na última. */
  seguiram: number | null
  /** `seguiram / chegaram` em %. `null` na última ou sem ninguém. */
  taxa: number | null
}

/**
 * Quantos negócios chegaram a cada etapa, e quantos passaram para a seguinte.
 *
 * **Chegar é ter estado ali ou mais adiante.** Um negócio que pulou de "Novo"
 * direto para "Proposta" passou por "Aula experimental" para a conta, senão a
 * etapa pulada pareceria reter gente que nunca esteve nela. Ganho chegou ao
 * fim, por definição. A etapa "perdido" não é degrau: sai da lista.
 */
export function passagemPorEtapa(etapas: EtapaDoFunil[], alcances: AlcanceDosNegocios[]): PassagemDaEtapa[] {
  const degraus = etapas.filter((e) => e.tipo !== 'perdido').sort((a, b) => a.ordem - b.ordem)
  const chegaram = degraus.map((etapa, i) =>
    alcances.reduce((soma, a) => {
      if (i === 0 || a.ganho) return soma + a.n
      return a.maiorOrdem !== null && a.maiorOrdem >= etapa.ordem ? soma + a.n : soma
    }, 0),
  )
  return degraus.map((etapa, i) => {
    const ultima = i === degraus.length - 1
    const seguiram = ultima ? null : (chegaram[i + 1] ?? 0)
    const aqui = chegaram[i] ?? 0
    return {
      etapa,
      chegaram: aqui,
      seguiram,
      taxa: seguiram === null || aqui === 0 ? null : Math.round((seguiram / aqui) * 100),
    }
  })
}

/**
 * A passagem que mais perde, em proporção: onde a maior fatia de quem chegou
 * não seguiu. Proporção, e não quantidade, porque o topo do funil sempre perde
 * mais gente em número só por ter mais gente. Sem perda nenhuma, `null`.
 */
export function maiorPerda(passagens: PassagemDaEtapa[]): number | null {
  let indice: number | null = null
  let pior = 100
  passagens.forEach((p, i) => {
    if (p.taxa !== null && p.taxa < pior) {
      pior = p.taxa
      indice = i
    }
  })
  return indice
}

// ---------------------------------------------------------------------------
// Motivos e equipe
// ---------------------------------------------------------------------------

export type MotivoDePerda = { motivo: string | null; n: number }

export const SEM_MOTIVO = 'Sem motivo anotado'

/** Do mais comum ao menos; "sem motivo" sempre por último, não é um motivo. */
export function ordenarMotivos(motivos: MotivoDePerda[]): { rotulo: string; n: number; semMotivo: boolean }[] {
  return [...motivos]
    .map((m) => ({ rotulo: m.motivo?.trim() || SEM_MOTIVO, n: m.n, semMotivo: !m.motivo?.trim() }))
    .sort((a, b) => Number(a.semMotivo) - Number(b.semMotivo) || b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

/** Segundos até fechar como dias inteiros, arredondados; menos de um dia é 0. */
export function diasAteFechar(segundos: number | null): number | null {
  return segundos === null ? null : Math.round(segundos / 86400)
}
