/**
 * Por onde uma automação conversa — e o que cada canal permite.
 *
 * ---------------------------------------------------------------------------
 * A decisão: **o canal é da automação, escolhido ao criar.**
 * ---------------------------------------------------------------------------
 *
 * Não é por bloco, não é por template, não é uma automação que atende três
 * redes ao mesmo tempo. É a mesma escolha que o ManyChat e o Chatfuel fazem —
 * lá o fluxo também é de um canal só, e quem quer Instagram e WhatsApp desenha
 * dois —, e ela não é preguiça de produto: é consequência de os canais não
 * serem intercambiáveis.
 *
 * O WhatsApp aceita **3 botões**; o Instagram aceita 13 quick replies; o
 * Telegram aceita teclado inline de dezenas. O WhatsApp fecha a janela em 24h
 * fora de template aprovado; o Telegram não tem janela nenhuma. Um fluxo que
 * servisse aos três seria obrigado ao **menor denominador** — três botões, tudo
 * dentro de 24h, sem teclado inline — e entregaria em toda parte a pior versão
 * de cada canal. Pior: o `validar()` não teria o que cobrar, porque a mesma
 * pergunta com 8 opções está certa no Telegram e errada no WhatsApp.
 *
 * Com o canal escolhido na automação, cada desenho é validado pelas medidas de
 * quem vai executá-lo, e a tela pode dizer de quem ela é.
 *
 * ---------------------------------------------------------------------------
 * O que está implementado, e o que está desenhado
 * ---------------------------------------------------------------------------
 *
 * `disponivel: false` não é enfeite: é canal cujo adaptador (`channels/`) não
 * existe. Ele aparece na tela porque esconder a possibilidade é como se
 * descobre tarde demais que ela nunca foi pensada — mas não dá para escolher,
 * porque automação que não entrega mensagem é pior do que automação que não
 * existe.
 *
 * Para ligar um canal novo, três coisas e nenhuma a mais:
 *
 * 1. um adaptador que implemente `Canal` (`src/channels/types.ts`);
 * 2. os limites daqui passando a alimentar o `validar()`;
 * 3. `disponivel: true`.
 */
export const CANAIS = ['whatsapp', 'instagram', 'telegram'] as const

export type CanalId = (typeof CANAIS)[number]

export type DefinicaoDeCanal = {
  id: CanalId
  nome: string
  /** Uma linha sobre o que a automação faz ali. */
  resumo: string
  /** A cor da marca. É o que pinta o selo — e só ele. */
  cor: string
  /** Tem adaptador de entrega? `false` = desenhado, não implementado. */
  disponivel: boolean
  /** O que falta, escrito para quem for ligar o canal. */
  falta?: string
  limites: {
    /** Acima disso, a lista de opções deixa de ser botão. */
    botoes: number
    /** Teto de opções numa resposta. */
    opcoes: number
    /** Caracteres do rótulo de uma opção. */
    rotulo: number
    /** Horas em que dá para responder sem template/pagamento. `null` = sem janela. */
    janelaHoras: number | null
  }
}

export const DEFINICAO_DO_CANAL: Record<CanalId, DefinicaoDeCanal> = {
  whatsapp: {
    id: 'whatsapp',
    nome: 'WhatsApp',
    resumo: 'Atende no número da empresa, pela Cloud API da Meta.',
    cor: '#25D366',
    disponivel: true,
    limites: { botoes: 3, opcoes: 10, rotulo: 20, janelaHoras: 24 },
  },
  instagram: {
    id: 'instagram',
    nome: 'Instagram',
    resumo: 'Responde no direct — comentário que vira conversa, resposta a story.',
    cor: '#E1306C',
    /*
     * O adaptador existe (`channels/instagram.ts`), o webhook existe, e a tela
     * de conectar existe. O que falta não é código: as permissões
     * `instagram_business_basic` e `instagram_business_manage_messages` estão
     * em **Standard Access** até o app review passar, e em Standard o Business
     * Login só embarca contas da própria conta da Meta da 4YU.
     *
     * Manter `false` é a regra deste arquivo sendo cumprida, não contornada:
     * oferecer o canal na criação de automação faria alguém desenhar um fluxo
     * inteiro para descobrir na hora de publicar que não há conta de cliente
     * para ligar. A tela `/clientes/<id>/instagram` já conecta e já recebe —
     * com o nosso perfil, que é exatamente o que o Standard permite.
     */
    disponivel: false,
    falta:
      'aprovação do app review da Meta (Advanced Access em instagram_business_manage_messages). O adaptador, o webhook e a tela de conectar já existem.',
    // 13 quick replies, rótulo de 20, e a mesma janela de 24h da Meta.
    limites: { botoes: 3, opcoes: 13, rotulo: 20, janelaHoras: 24 },
  },
  telegram: {
    id: 'telegram',
    nome: 'Telegram',
    resumo: 'Atende num bot @seu_negocio, sem número e sem custo por conversa.',
    cor: '#2AABEE',
    disponivel: false,
    falta: 'adaptador da Bot API e um campo para o token do bot nas Conexões',
    // Teclado inline não tem teto prático, e não existe janela de 24h: o
    // limite de 10 é nosso, para a lista continuar legível.
    limites: { botoes: 4, opcoes: 10, rotulo: 32, janelaHoras: null },
  },
}

/** O canal de tudo que já existe. Automação antiga é de WhatsApp. */
export const CANAL_PADRAO: CanalId = 'whatsapp'

/**
 * O que chegou do formulário é um canal válido **e ligado**?
 *
 * Devolve o padrão em vez de estourar: o valor vem de `<form>`, e uma aba velha
 * com um canal que saiu da lista não pode virar erro na cara de quem clicou.
 * Escolher canal indisponível cai no mesmo lugar — a tela já não oferece, então
 * quem chega aqui está fora do caminho normal.
 */
export function canalValido(valor: unknown): CanalId {
  const id = String(valor ?? '') as CanalId
  return CANAIS.includes(id) && DEFINICAO_DO_CANAL[id].disponivel ? id : CANAL_PADRAO
}
