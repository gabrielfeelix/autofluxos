/**
 * "Sentiu falta de algo?": o pedido de melhoria que o cliente manda de dentro
 * do sistema (03/10/2026, ideia trazida do RD Station pelo Eduardo).
 *
 * **Mora na auditoria, sem tabela nova**, como o pedido de plano: a 0021 já é
 * append-only, então ninguém apaga a sugestão de um cliente por engano, e a
 * administração já sabe ler dali. O ato é `sugeriu_melhoria`; o texto e a
 * tela onde a pessoa estava vão em `detalhes`.
 *
 * Puro e sem rede. Quem grava é `server/acoes-sugestao.ts`.
 */

export const ATO_DA_SUGESTAO = 'sugeriu_melhoria'

export const LIMITE_DA_SUGESTAO = 2000

/** Menos que isso não é sugestão, é tecla escapada. */
const MINIMO_DA_SUGESTAO = 4

/** O caminho da tela, para a 4YU saber de onde veio. Endereço maior que isso é lixo. */
const LIMITE_DA_TELA = 300

export type ConferenciaDaSugestao = { ok: true; texto: string } | { ok: false; motivo: string }

export function conferirSugestao(bruto: string): ConferenciaDaSugestao {
  const texto = bruto.trim()
  if (texto.length < MINIMO_DA_SUGESTAO) return { ok: false, motivo: 'conte em poucas palavras o que faltou' }
  if (texto.length > LIMITE_DA_SUGESTAO) {
    return { ok: false, motivo: `a sugestão cabe em ${LIMITE_DA_SUGESTAO} caracteres` }
  }
  return { ok: true, texto }
}

/**
 * A tela, sem o id da conta: `/clientes/<id>/quadros` vira `/quadros`.
 *
 * O id não diz nada a quem lê a sugestão (a organização já está na linha) e
 * deixa a lista ilegível. A busca (`?q=...`) sai junto: pode carregar nome de
 * contato digitado num filtro, e a 4YU não precisa disso para entender o pedido.
 */
export function telaDaSugestao(caminho: string): string {
  const semBusca = caminho.split(/[?#]/)[0] ?? ''
  const semConta = semBusca.replace(/^\/clientes\/[^/]+/, '')
  return (semConta || '/').slice(0, LIMITE_DA_TELA)
}

/**
 * A triagem da 4YU sobre cada sugestão, também na auditoria: um ato
 * `triou_sugestao` com `alvo_id` = id da sugestão. Vale o mais novo, então
 * mudar de ideia é só marcar de novo, e o histórico de quem marcou o quê fica.
 * Sugestão sem triagem nenhuma é `nova`.
 */
export const ATO_DA_TRIAGEM = 'triou_sugestao'

export const SITUACOES_DA_SUGESTAO = ['nova', 'planejada', 'feita', 'descartada'] as const

export type SituacaoDaSugestao = (typeof SITUACOES_DA_SUGESTAO)[number]

export const ROTULO_DA_SITUACAO: Record<SituacaoDaSugestao, string> = {
  nova: 'Nova',
  planejada: 'Planejada',
  feita: 'Feita',
  descartada: 'Descartada',
}

export function ehSituacaoDaSugestao(valor: unknown): valor is SituacaoDaSugestao {
  return typeof valor === 'string' && (SITUACOES_DA_SUGESTAO as readonly string[]).includes(valor)
}

/**
 * O nome da tela como aparece no menu do cliente, para quem lê a sugestão não
 * ter que decorar endereço. Do mais específico para o mais geral: `/leads/
 * segmentos` acha "Segmentos" antes de `/leads` achar "Contatos".
 */
const NOMES_DAS_TELAS: [string, string][] = [
  ['/conversas/respostas-rapidas', 'Respostas rápidas'],
  ['/conversas/canais', 'Canais'],
  ['/leads/segmentos', 'Segmentos'],
  ['/leads/cobrancas', 'Cobranças'],
  ['/loja/catalogo', 'Produtos'],
  ['/loja/pedidos', 'Pedidos da loja'],
  ['/relatorios/vendas', 'Relatório de vendas'],
  ['/inbox', 'Conversas'],
  ['/conversas', 'Conversas'],
  ['/favoritas', 'Mensagens salvas'],
  ['/leads', 'Contatos'],
  ['/quadros', 'Negócios'],
  ['/negocios', 'Negócios'],
  ['/atividades', 'Atividades'],
  ['/fluxos', 'Automações'],
  ['/transmissoes', 'Transmissões'],
  ['/respostas', 'Respostas coletadas'],
  ['/loja', 'Integrações da loja'],
  ['/relatorios', 'Relatório de atendimento'],
  ['/ajustes', 'Configurações'],
  ['/configurar', 'Primeiros passos'],
]

/** Endereço que não está no menu volta como veio: melhor cru do que inventado. */
export function nomeDaTela(tela: string): string {
  if (tela === '/' || tela === '') return 'Início'
  const achado = NOMES_DAS_TELAS.find(([prefixo]) => tela === prefixo || tela.startsWith(`${prefixo}/`))
  return achado ? achado[1] : tela
}
