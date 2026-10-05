/**
 * A franquia de mensagens de serviço da Meta, a partir de 1º/out/2026.
 *
 * Resposta dentro da janela de 24h ("serviço") deixa de ser grátis: cada
 * **número** tem 1.000 por mês, sem acúmulo, e o resto paga a tarifa de
 * utilidade do país. No Brasil, R$ 0,035 pela tabela oficial em BRL de
 * 1/out/2026 (developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
 *
 * A contagem vem do `pricing_analytics` da WABA (0104), não de nós: é a régua
 * que vira fatura. Aqui só mora a conta, sem banco e sem rede.
 */

export const FRANQUIA_DE_SERVICO = 1000
/** Tarifa de serviço/utilidade para número brasileiro, em reais (1/out/2026). */
export const TARIFA_DE_SERVICO_BR = 0.035
/** A partir de quando o serviço passa a contar para a franquia. */
export const INICIO_DA_COBRANCA = '2026-10-01'
/** Daqui para cima a tela avisa. */
export const LIMIAR_DE_AVISO = 800

export type PontoDaMeta = {
  telefone: string
  /** `YYYY-MM-DD`, em São Paulo. */
  dia: string
  categoria: string
  tipo: string
  volume: number
  custo: number | null
}

const formatadorDoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** O dia de um `start` da Meta (segundos), em São Paulo. */
export function diaDaMeta(inicioEmSegundos: number): string {
  return formatadorDoDia.format(new Date(inicioEmSegundos * 1000))
}

/**
 * Os pontos de uma resposta do `pricing_analytics`.
 *
 * Tolerante de propósito: campo estranho vira ponto descartado, não exceção.
 * Uma mudança de formato da Meta não pode derrubar a manutenção inteira.
 */
export function lerPontosDaMeta(resposta: unknown): PontoDaMeta[] {
  const blocos = (resposta as { pricing_analytics?: { data?: unknown } } | null)?.pricing_analytics?.data
  if (!Array.isArray(blocos)) return []

  const pontos: PontoDaMeta[] = []
  for (const bloco of blocos) {
    const lista = (bloco as { data_points?: unknown } | null)?.data_points
    if (!Array.isArray(lista)) continue
    for (const cru of lista) {
      const p = cru as Record<string, unknown>
      const telefone = typeof p.phone_number === 'string' ? p.phone_number.replace(/\D/g, '') : ''
      const inicio = Number(p.start)
      const volume = Number(p.volume)
      if (!telefone || !Number.isFinite(inicio) || !Number.isFinite(volume)) continue
      const custo = Number(p.cost)
      pontos.push({
        telefone,
        dia: diaDaMeta(inicio),
        categoria: typeof p.pricing_category === 'string' ? p.pricing_category : 'DESCONHECIDA',
        tipo: typeof p.pricing_type === 'string' ? p.pricing_type : 'DESCONHECIDO',
        volume: Math.max(0, Math.round(volume)),
        custo: Number.isFinite(custo) ? custo : null,
      })
    }
  }
  return pontos
}

export type NivelDaFranquia = 'folga' | 'perto' | 'estourou'

export type FranquiaDoNumero = {
  telefone: string
  /** Mensagens de serviço no mês que contam para a franquia. */
  usadas: number
  restantes: number
  /** Acima das 1.000: estas são cobradas. */
  excedentes: number
  /** `excedentes` × tarifa brasileira. Estimativa; a fatura é da Meta. */
  custoEstimado: number
  nivel: NivelDaFranquia
  /** Antes de 1/out tudo é grátis: a tela mostra, mas não assusta. */
  valendo: boolean
}

/**
 * Serviço que conta para a franquia: categoria SERVICE, menos a janela grátis
 * de anúncio (`FREE_ENTRY_POINT`), que a Meta manteve fora da cobrança.
 */
export function contaParaFranquia(ponto: Pick<PontoDaMeta, 'categoria' | 'tipo'>): boolean {
  return ponto.categoria.toUpperCase() === 'SERVICE' && ponto.tipo.toUpperCase() !== 'FREE_ENTRY_POINT'
}

/** A franquia de cada número no mês de `mes` (`YYYY-MM-01`). */
export function franquiaDoMes(pontos: PontoDaMeta[], mes: string): FranquiaDoNumero[] {
  const prefixo = mes.slice(0, 7)
  const porTelefone = new Map<string, number>()

  for (const ponto of pontos) {
    if (!ponto.dia.startsWith(prefixo)) continue
    const atual = porTelefone.get(ponto.telefone) ?? 0
    porTelefone.set(ponto.telefone, atual + (contaParaFranquia(ponto) ? ponto.volume : 0))
  }

  const valendo = mes >= INICIO_DA_COBRANCA
  return [...porTelefone.entries()]
    .map(([telefone, usadas]) => {
      const excedentes = valendo ? Math.max(0, usadas - FRANQUIA_DE_SERVICO) : 0
      const nivel: NivelDaFranquia =
        usadas > FRANQUIA_DE_SERVICO ? 'estourou' : usadas >= LIMIAR_DE_AVISO ? 'perto' : 'folga'
      return {
        telefone,
        usadas,
        restantes: Math.max(0, FRANQUIA_DE_SERVICO - usadas),
        excedentes,
        custoEstimado: Math.round(excedentes * TARIFA_DE_SERVICO_BR * 100) / 100,
        nivel,
        valendo,
      }
    })
    .sort((a, b) => b.usadas - a.usadas)
}

/**
 * O preço de cada modelo enviado a número brasileiro, em reais, pela tabela
 * oficial em BRL da Meta (1/jul/2026): marketing R$ 0,3217; utilidade e
 * autenticação R$ 0,035. Marketing **não tem franquia**: paga desde o primeiro.
 * A fatura é da Meta, isto é estimativa para a tela avisar antes de enviar.
 */
export const TARIFA_DO_MODELO_BR = {
  MARKETING: 0.3217,
  UTILITY: TARIFA_DE_SERVICO_BR,
  AUTHENTICATION: TARIFA_DE_SERVICO_BR,
} as const

/** Quanto custa um envio de modelo desta categoria. Desconhecida, a de marketing: melhor avisar a mais. */
export function tarifaDoModelo(categoria: string): number {
  const chave = categoria.toUpperCase()
  return chave in TARIFA_DO_MODELO_BR
    ? TARIFA_DO_MODELO_BR[chave as keyof typeof TARIFA_DO_MODELO_BR]
    : TARIFA_DO_MODELO_BR.MARKETING
}

/** "R$ 0,32", "R$ 12,40". Abaixo de um real com centavo de fração, três casas: "R$ 0,035". */
export function emReais(valor: number): string {
  const casas = valor > 0 && valor < 0.1 && Math.round(valor * 100) !== valor * 100 ? 3 : 2
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export type GastoPorTipo = {
  /** MARKETING, UTILITY, AUTHENTICATION ou SERVICE. */
  categoria: string
  /** Mensagens que a Meta cobrou no período. */
  cobradas: number
  custo: number
}

export type GastoDoPeriodo = {
  total: number
  porTipo: GastoPorTipo[]
  /** Serviço grátis usado no período (dentro da franquia). */
  servicoGratis: number
}

/**
 * Quanto a conta gastou com a Meta entre `de` e `ate` (`YYYY-MM-DD`).
 *
 * `pontos` precisa começar no **dia 1 do mês de `de`**: a franquia de serviço
 * é mensal, e saber se a mensagem do dia 20 já passou das 1.000 exige contar
 * as dos dias 1 a 19, mesmo que estejam fora do período.
 *
 * Modelo conta pela tarifa só quando a Meta o marcou `REGULAR` (cobrado); os
 * tipos `FREE_*` são as janelas grátis dela. Serviço conta pela franquia, por
 * número e por mês, e só depois de 1/out/2026.
 */
export function gastoDoPeriodo(pontos: PontoDaMeta[], de: string, ate: string): GastoDoPeriodo {
  const porTipo = new Map<string, GastoPorTipo>()
  const somar = (categoria: string, cobradas: number, custo: number) => {
    const atual = porTipo.get(categoria) ?? { categoria, cobradas: 0, custo: 0 }
    atual.cobradas += cobradas
    atual.custo += custo
    porTipo.set(categoria, atual)
  }

  let servicoGratis = 0
  const usadasNoMes = new Map<string, number>()
  const ordenados = [...pontos].sort((a, b) => a.dia.localeCompare(b.dia))

  for (const ponto of ordenados) {
    const dentro = ponto.dia >= de && ponto.dia <= ate
    const categoria = ponto.categoria.toUpperCase()

    if (contaParaFranquia(ponto)) {
      const chave = `${ponto.telefone}|${ponto.dia.slice(0, 7)}`
      const antes = usadasNoMes.get(chave) ?? 0
      usadasNoMes.set(chave, antes + ponto.volume)
      if (!dentro) continue
      const valendo = ponto.dia >= INICIO_DA_COBRANCA
      const gratis = valendo ? Math.max(0, Math.min(ponto.volume, FRANQUIA_DE_SERVICO - antes)) : ponto.volume
      servicoGratis += gratis
      const cobradas = ponto.volume - gratis
      if (cobradas > 0) somar('SERVICE', cobradas, cobradas * TARIFA_DE_SERVICO_BR)
      continue
    }

    if (!dentro || categoria === 'SERVICE' || ponto.tipo.toUpperCase() !== 'REGULAR') continue
    somar(categoria, ponto.volume, ponto.volume * tarifaDoModelo(categoria))
  }

  const lista = [...porTipo.values()]
    .map((t) => ({ ...t, custo: Math.round(t.custo * 100) / 100 }))
    .sort((a, b) => b.custo - a.custo)
  return {
    total: Math.round(lista.reduce((s, t) => s + t.custo, 0) * 100) / 100,
    porTipo: lista,
    servicoGratis,
  }
}
