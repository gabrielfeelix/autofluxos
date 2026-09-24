import { NOME_DO_TIPO, type TipoDeAtividade } from './atividades'
import { comoFrase, type Evento } from './crm'

/**
 * O negócio visto como negócio (F2 do plano de 24/09).
 *
 * No banco o cartão sempre foi a negociação (`quadro_cartoes`: título, valor,
 * situação) apontando para a pessoa. O que enganava era a cara dele. Este
 * arquivo é o que a tela precisa para dizer "negócio" antes de "pessoa", sem
 * I/O: o título que se mostra, a etapa como degrau e o histórico por tipo.
 */

/**
 * O título que o cartão e a página mostram.
 *
 * Sem título, "Negócio de <nome>" **marcado como provisório**, para a tela
 * desenhar em cinza. Mostrar só o nome da pessoa era o que fazia o funil
 * parecer uma lista de contatos.
 */
export function tituloDoNegocio(negocio: {
  titulo?: string | null
  nome: string
}): { texto: string; provisorio: boolean } {
  const titulo = negocio.titulo?.trim()
  if (titulo) return { texto: titulo, provisorio: false }
  const nome = negocio.nome.trim()
  return { texto: nome ? `Negócio de ${nome}` : 'Negócio sem título', provisorio: true }
}

/** Dias inteiros entre dois instantes, nunca negativo. */
export function diasDesde(inicio: string, agora: number): number {
  const ms = agora - Date.parse(inicio)
  if (!Number.isFinite(ms)) return 0
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** "hoje", "1 dia", "12 dias". */
export function comoDias(dias: number): string {
  if (dias === 0) return 'hoje'
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * Onde o negócio está no funil, como degrau: "3 de 6".
 *
 * `null` quando a etapa não está na lista (apagada entre a leitura e o
 * clique): melhor não desenhar progresso nenhum do que um "0 de 6" falso.
 */
export function degrauDaEtapa(
  etapas: { id: string }[],
  colunaId: string,
): { posicao: number; total: number; ultima: boolean } | null {
  const indice = etapas.findIndex((etapa) => etapa.id === colunaId)
  if (indice < 0) return null
  return { posicao: indice + 1, total: etapas.length, ultima: indice === etapas.length - 1 }
}

// ---------------------------------------------------------------------------
// O histórico do negócio
// ---------------------------------------------------------------------------

export const FILTROS_DO_HISTORICO = [
  'tudo',
  'anotacoes',
  'atividades',
  'etapas',
  'conversa',
  'automacao',
] as const

export type FiltroDoHistorico = (typeof FILTROS_DO_HISTORICO)[number]

export const NOME_DO_FILTRO: Record<FiltroDoHistorico, string> = {
  tudo: 'Tudo',
  anotacoes: 'Anotações',
  atividades: 'Atividades',
  etapas: 'Etapas',
  conversa: 'Conversa',
  automacao: 'Automação',
}

export function ehFiltroDoHistorico(valor: unknown): valor is FiltroDoHistorico {
  return typeof valor === 'string' && (FILTROS_DO_HISTORICO as readonly string[]).includes(valor)
}

/**
 * Em que filtro cai cada tipo de evento.
 *
 * "Etapas" junta tudo que muda a posição ou o desfecho do negócio (mover,
 * ganhar, perder, assumir, temperatura), porque é a pergunta "o que aconteceu
 * com este negócio". Tipo desconhecido cai em "automação": evento novo escrito
 * por código futuro ainda aparece em "Tudo", e o lugar menos lido é o certo
 * para o que ninguém classificou.
 */
export function categoriaDoEvento(tipo: string): Exclude<FiltroDoHistorico, 'tudo'> {
  switch (tipo) {
    case 'nota':
      return 'anotacoes'
    case 'atividade':
      return 'atividades'
    case 'mudou-de-etapa':
    case 'ganhou':
    case 'perdeu':
    case 'assumiu':
    case 'mudou-de-temperatura':
    case 'entrou-no-quadro':
    case 'saiu-do-quadro':
    case 'venda-cancelada':
      return 'etapas'
    case 'chegou':
    case 'mensagem-recebida':
    case 'mensagem-enviada':
    case 'agendou':
      return 'conversa'
    default:
      return 'automacao'
  }
}

/**
 * O evento é deste negócio?
 *
 * Os eventos moram no contato (`eventos_do_contato`). Os que falam de um
 * negócio levam `dados.cartaoId`, a convenção que a `0072` já usava para
 * ganhar e perder. Evento **com** o id de outro negócio fica de fora; evento
 * **sem** id é da pessoa (conversa, fluxo) e entra, desde que tenha acontecido
 * depois de o negócio existir, e quem corta pela data é a consulta.
 */
export function eventoDoNegocio(dados: Record<string, unknown>, cartaoId: string): boolean {
  const deQuem = dados.cartaoId
  return typeof deQuem !== 'string' || deQuem === '' || deQuem === cartaoId
}

export function filtrarHistorico<T extends { tipo: string }>(
  itens: T[],
  filtro: FiltroDoHistorico,
): T[] {
  if (filtro === 'tudo') return itens
  return itens.filter((item) => categoriaDoEvento(item.tipo) === filtro)
}

/**
 * A frase do evento no histórico do negócio.
 *
 * `comoFrase` escreve com a pessoa de sujeito ("perdeu, preço"); na página do
 * negócio o sujeito é o negócio, e a frase começa com maiúscula porque é linha
 * solta, não continuação do nome.
 */
export function fraseDoNegocio(evento: Pick<Evento, 'tipo' | 'dados'>): string {
  const frase = comoFrase({ id: '', autor: null, criadoEm: '', ...evento })
  if (evento.tipo === 'ganhou') return frase.replace(/^ganhou/, 'Negócio ganho')
  if (evento.tipo === 'perdeu') return frase.replace(/^perdeu/, 'Negócio perdido')
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

// ---------------------------------------------------------------------------
// Negócios em lista (5.2b)
// ---------------------------------------------------------------------------

/** O recorte da lista, como mora no endereço. Vazio = qualquer. */
export type FiltroDaLista = {
  busca?: string
  etapa?: string
  responsavel?: string
  situacao?: string
  temperatura?: string
}

type NegocioDaLista = {
  titulo?: string | null
  nome: string
  telefone: string
  colunaId: string
  responsavelId?: string | null
  situacao?: string
  temperatura?: string | null
}

/** Sem acento e em minúscula, para "joao" achar "João". */
function normal(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * A mesma regra do quadro, dita pelo endereço: busca em título, nome e
 * telefone; `responsavel=ninguem` é quem está sem dono.
 */
export function filtrarNegocios<T extends NegocioDaLista>(negocios: T[], filtro: FiltroDaLista): T[] {
  const busca = normal(filtro.busca?.trim() ?? '')
  const digitos = busca.replace(/\D/g, '')
  return negocios.filter((n) => {
    if (filtro.etapa && n.colunaId !== filtro.etapa) return false
    if (filtro.situacao && (n.situacao ?? 'aberta') !== filtro.situacao) return false
    if (filtro.temperatura && (n.temperatura ?? 'nenhuma') !== filtro.temperatura) return false
    if (filtro.responsavel) {
      if (filtro.responsavel === 'ninguem' ? n.responsavelId : n.responsavelId !== filtro.responsavel) {
        return false
      }
    }
    if (busca) {
      const texto = normal(`${n.titulo ?? ''} ${n.nome}`)
      const acha = texto.includes(busca) || (digitos.length >= 3 && n.telefone.includes(digitos))
      if (!acha) return false
    }
    return true
  })
}

/** "Ligação marcada: confirmar aula". A atividade no histórico do negócio. */
export function fraseDaAtividade(
  tipo: TipoDeAtividade,
  situacao: 'aberta' | 'concluida' | 'cancelada',
  titulo: string,
): string {
  const nome = NOME_DO_TIPO[tipo]
  const verbo = situacao === 'concluida' ? 'feita' : situacao === 'cancelada' ? 'cancelada' : 'marcada'
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${verbo}: ${titulo}`
}
