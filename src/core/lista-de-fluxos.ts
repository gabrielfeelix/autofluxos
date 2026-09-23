import { CANAIS, type CanalId } from './canais'

/**
 * Busca e filtros da lista de automações (A01), no endereço (`?q=`, `canal`,
 * `estado`, `pasta`) para voltar e para mandar o recorte a alguém.
 *
 * O filtro roda em memória: a página já lê todos os fluxos da conta para
 * agrupar por pasta e contar, e uma conta tem dezenas, não milhares.
 */
export const ESTADOS_DO_FILTRO = ['publicadas', 'nunca', 'ligadas', 'desligadas', 'pendencia'] as const
export type EstadoDoFiltro = (typeof ESTADOS_DO_FILTRO)[number]

export const ROTULO_DO_ESTADO: Record<EstadoDoFiltro, string> = {
  publicadas: 'Publicadas',
  nunca: 'Nunca publicadas',
  ligadas: 'Entrada ligada',
  desligadas: 'Entrada desligada',
  pendencia: 'Com pendência',
}

export type FiltroDeFluxos = {
  q: string
  canal: CanalId | null
  estado: EstadoDoFiltro | null
  /** Id da pasta, ou `sem` para quem está fora de pasta. */
  pasta: string | null
}

export type FluxoParaFiltro = {
  nome: string
  canal: CanalId
  publicada: boolean
  ativo: boolean
  pastaId: string | null
  /** Tem impedimento para publicar. */
  pendente: boolean
}

export function lerFiltroDeFluxos(params: Record<string, string | undefined>): FiltroDeFluxos {
  const canal = params.canal ?? ''
  const estado = params.estado ?? ''
  const pasta = (params.pasta ?? '').trim()
  return {
    q: (params.q ?? '').trim().slice(0, 80),
    canal: (CANAIS as readonly string[]).includes(canal) ? (canal as CanalId) : null,
    estado: (ESTADOS_DO_FILTRO as readonly string[]).includes(estado)
      ? (estado as EstadoDoFiltro)
      : null,
    pasta: pasta === '' ? null : pasta,
  }
}

/** "Não Comparecimento" e "nao comp" viram a mesma coisa. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function casaFluxo(fluxo: FluxoParaFiltro, filtro: FiltroDeFluxos): boolean {
  if (filtro.q !== '' && !semAcento(fluxo.nome).includes(semAcento(filtro.q))) return false
  if (filtro.canal && fluxo.canal !== filtro.canal) return false
  if (filtro.pasta === 'sem' ? fluxo.pastaId !== null : filtro.pasta && fluxo.pastaId !== filtro.pasta) {
    return false
  }
  switch (filtro.estado) {
    case 'publicadas':
      return fluxo.publicada
    case 'nunca':
      return !fluxo.publicada
    case 'ligadas':
      return fluxo.ativo
    case 'desligadas':
      return !fluxo.ativo
    // Pendência é o que pede ação: impedimento, ou ligada sem nunca ter
    // publicado (abre conversa para um fluxo que não responde).
    case 'pendencia':
      return fluxo.pendente || (fluxo.ativo && !fluxo.publicada)
    default:
      return true
  }
}

/** O endereço da lista com estes parâmetros, sem os vazios. */
export function enderecoDaLista(base: string, parametros: Record<string, string | null | undefined>): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor) busca.set(chave, valor)
  }
  const texto = busca.toString()
  return texto === '' ? base : `${base}?${texto}`
}
