/**
 * O objetivo da conta, e o que ele torna obrigatório (T7.1).
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, e por que ele é de produto e não de tela
 * ---------------------------------------------------------------------------
 *
 * Os "primeiros passos" da tela inicial pediam cinco coisas a todo mundo, e a
 * quinta era **"Organizar no funil"**. Quem abriu a conta para atender no
 * WhatsApp com gente de verdade, sem bot e sem CRM, terminava o que queria e a
 * tela continuava dizendo que faltava um passo, para sempre.
 *
 * Isso não é ruído de interface: barra de progresso que nunca fecha ensina a
 * pessoa a ignorar a barra, e a partir daí ela também ignora quando o passo que
 * falta é o canal desligado. E a RB-44 e o §4.2 da proposta são explícitos: o
 * CRM é **opcional**, e a empresa nova começa sem ele.
 *
 * A saída não é apagar o passo: é perguntar o objetivo e cobrar só o que ele
 * exige. Quem escolhe "vender e acompanhar" continua vendo o funil cobrado,
 * porque para esse objetivo ele é a ferramenta.
 *
 * ---------------------------------------------------------------------------
 * Por que o objetivo mora na conta, e não no contato
 * ---------------------------------------------------------------------------
 *
 * É a mesma decisão do nicho: o objetivo descreve **o que a empresa comprou**,
 * não o que uma pessoa quer hoje. Guardá-lo por contato faria a mesma conta
 * cobrar funil de metade da base e não da outra, e ninguém saberia explicar por
 * quê.
 *
 * Puro, sem banco e sem React, como `core/planos.ts`: quem grava é
 * `server/repos/recursos.ts`.
 */

// ---------------------------------------------------------------------------
// 1. O objetivo
// ---------------------------------------------------------------------------

/**
 * Para que a empresa contratou.
 *
 * São três, e não sete, porque cada um tem que mudar **alguma coisa** no que a
 * tela cobra. Objetivo que não muda nada é pergunta feita para nada, e a
 * primeira tela de um produto é o pior lugar para isso.
 */
export const OBJETIVOS = ['atender', 'automatizar', 'vender'] as const

export type Objetivo = (typeof OBJETIVOS)[number]

export function ehObjetivo(valor: unknown): valor is Objetivo {
  return typeof valor === 'string' && (OBJETIVOS as readonly string[]).includes(valor)
}

/**
 * O padrão de quem nunca respondeu.
 *
 * **`atender` é o mais modesto de propósito**, e isso é o oposto de um palpite
 * comercial: ele é o único que não cobra nem bot nem funil. Quem cai nele por
 * omissão consegue terminar o onboarding; quem cai em `vender` por omissão vê
 * dois passos que ninguém pediu. Falhar para o lado de cobrar menos é o certo
 * quando o custo do erro é uma tela que mente sobre estar incompleta.
 */
export const OBJETIVO_PADRAO: Objetivo = 'atender'

export const ROTULO_DO_OBJETIVO: Record<Objetivo, string> = {
  atender: 'Atender mais rápido, com a minha equipe',
  automatizar: 'Responder sozinho o que se repete',
  vender: 'Vender e acompanhar cada negociação',
}

/** A frase que explica a escolha sem prometer o que não existe. */
export const EXPLICA_O_OBJETIVO: Record<Objetivo, string> = {
  atender:
    'As conversas chegam no Inbox e sua equipe responde. Sem bot e sem funil: dá para ligar os dois depois, quando fizer sentido.',
  automatizar:
    'Um roteiro responde dúvida repetida, horário e preço, e chama alguém quando precisa. O funil continua opcional.',
  vender:
    'Além de atender, cada contato vira uma negociação que anda por etapas até fechar, com valor e motivo de perda.',
}

// ---------------------------------------------------------------------------
// 2. O que cada objetivo cobra
// ---------------------------------------------------------------------------

/**
 * Os passos que existem. A ordem é a do onboarding.
 *
 * `conta` e `canal` não estão aqui porque não são negociáveis: a conta existe
 * porque quem lê a criou, e sem canal nenhuma conversa chega, qualquer que seja
 * o objetivo.
 */
export const PASSOS_OPCIONAIS = ['automacao', 'funil'] as const

export type PassoOpcional = (typeof PASSOS_OPCIONAIS)[number]

/** Vendas e automação são escolhas independentes. */
export function cobra(objetivo: Objetivo, passo: PassoOpcional): boolean {
  if (objetivo === 'atender') return false
  if (objetivo === 'automatizar') return passo === 'automacao'
  return passo === 'funil'
}

/**
 * O CRM nasce ligado com este objetivo?
 *
 * Só `vender`, e é a tradução do §4.2: "empresa nova começa com
 * chatbot/inbox/contatos; CRM fica disponível em Configurações → Recursos".
 * Quem diz "vender e acompanhar" já pediu o CRM em palavras, e obrigá-lo a
 * achar um interruptor depois seria fazer a pessoa repetir a resposta que
 * acabou de dar.
 */
export function nasceComCrm(objetivo: Objetivo): boolean {
  return objetivo === 'vender'
}

// ---------------------------------------------------------------------------
// 3. Ligar e desligar o CRM
// ---------------------------------------------------------------------------

/**
 * Esconder o CRM apaga alguma coisa?
 *
 * **Não, e a resposta é o contrato.** O §4.2 é explícito: "ocultar CRM da
 * navegação é preferência de interface; não apaga dados, não suspende
 * integrações e não revoga acesso". Esta função existe para que essa frase
 * tenha um lugar onde ser testada, em vez de viver só num comentário de tela
 * que alguém apaga.
 *
 * Quem tem quadro com cartão e desliga o CRM continua com o quadro e com os
 * cartões: o que muda é o item no menu.
 */
export function desligarApagaDado(): false {
  return false
}

/**
 * O CRM aparece no menu desta conta?
 *
 * A empresa que **já usa quadros** mantém o CRM visível mesmo sem ter ligado
 * nada, e é o §4.2 outra vez: "empresa atual que usa quadros mantém CRM visível
 * na migração". Sem esta linha, a migration que criou o interruptor esconderia,
 * da noite para o dia, a tela que alguém usa todo dia, sem ninguém ter pedido.
 */
export function mostraCrm({
  ligado,
  temQuadro,
}: {
  ligado: boolean
  temQuadro: boolean
}): boolean {
  return ligado || temQuadro
}
