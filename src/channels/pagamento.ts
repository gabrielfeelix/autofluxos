/**
 * O que todo gateway de pagamento sabe fazer, do jeito que o Dialogon pede
 * (docs/PLANO-COBRANCA-CAMADA-1.md).
 *
 * Mercado Pago e Asaas falam línguas diferentes: um conecta por login e o
 * outro por chave, um chama de `pending` e o outro de `PENDING`, um faz o Pix
 * e o link em duas chamadas e o outro numa só. Quem cobra (`server/cobrancas.ts`)
 * não quer saber de nada disso: pede uma cobrança, lê um pagamento, cancela.
 * Cada `channels/<gateway>.ts` traduz.
 *
 * **O dinheiro nunca passa por nós.** Toda chamada leva o acesso do dono e age
 * na conta dele (MERCADO-COBRANCA-NO-CHAT.md, regra 3).
 */

export const GATEWAYS = ['mercado_pago', 'asaas', 'infinitepay', 'pagbank', 'woovi', 'paghiper', 'stripe', 'efi', 'iugu', 'pagarme'] as const
export type Gateway = (typeof GATEWAYS)[number]

export const NOME_DO_GATEWAY: Record<Gateway, string> = {
  mercado_pago: 'Mercado Pago',
  asaas: 'Asaas',
  infinitepay: 'InfinitePay',
  pagbank: 'PagBank',
  woovi: 'Woovi',
  paghiper: 'PagHiper',
  stripe: 'Stripe',
  efi: 'Efí',
  iugu: 'Iugu',
  pagarme: 'Pagar.me',
}

/** Quem não cria cobrança sem o CPF ou CNPJ de quem paga: a tela pergunta antes. */
export const EXIGE_DOCUMENTO: ReadonlySet<Gateway> = new Set<Gateway>(['asaas', 'pagbank', 'paghiper', 'stripe', 'iugu', 'pagarme'])

/**
 * `teste` é o sandbox, sem dinheiro de verdade: pelo prefixo da chave (Asaas
 * `$aact_hmlg_`, Pagar.me `sk_test_`, Stripe `sk_test_`), pelo ambiente que
 * aceitou a credencial (Woovi, Efí) ou pela variável de quando conectou
 * (`PAGBANK_SANDBOX`).
 */
export type Ambiente = 'producao' | 'teste'

/** Com o que se fala com a conta do dono. O token vem do cofre, na hora. */
export type AcessoAoGateway = { token: string; ambiente: Ambiente }

export type PedidoDeCobranca = {
  /** O id da linha em `cobrancas`. Volta no aviso de pagamento, e é por ele que achamos a cobrança. */
  referencia: string
  /**
   * A organização que cobra. Só a InfinitePay usa: o endereço do aviso vai em
   * cada link, e é por organização (Mercado Pago e Asaas cadastram o aviso uma
   * vez, ao conectar).
   */
  clienteId?: string
  valorCentavos: number
  descricao: string
  venceEm: Date
  pagador: {
    nome: string
    /** CPF ou CNPJ, só dígitos. O Asaas não cobra sem; o Mercado Pago aceita sem. */
    documento: string | null
    /** E.164 sem o `+`, como o `wa_id`. */
    telefone: string | null
    email: string | null
  }
  /**
   * Pix Automático já autorizado (0145): o gateway debita sozinho no
   * vencimento, sem o pagador abrir nada. Só o Asaas.
   */
  autorizacaoPix?: string | null
}

export type CobrancaCriada = {
  /** O pagamento Pix. É o que se cancela quando a cobrança vence. */
  pagamentoId: string
  /** A preferência do link, quando o gateway separa os dois (Mercado Pago). */
  preferenciaId: string | null
  pixCopiaCola: string | null
  link: string | null
}

/**
 * O estado de um pagamento, já na nossa língua. Só `paga` e `estornada` mudam
 * uma cobrança pelo aviso: vencer e cancelar são decisões nossas, pelo relógio
 * e pela tela, e um cartão recusado no link não cancela a cobrança.
 */
export type SituacaoDoPagamento = 'pendente' | 'paga' | 'estornada' | 'cancelada'

export type PagamentoLido = {
  pagamentoId: string
  /** O `referencia` do pedido, devolvido pelo gateway. Nulo em pagamento que não nasceu aqui. */
  referencia: string | null
  situacao: SituacaoDoPagamento
  valorCentavos: number
  pagaEm: Date | null
  /** A assinatura do gateway que gerou este pagamento (cartão recorrente), se gerou. */
  recorrencia?: string | null
  /** O dia do vencimento, `AAAA-MM-DD`: diz de qual mês é o pagamento da assinatura. */
  vencimento?: string | null
}

/** A mensalidade como o gateway precisa para cobrar sozinho (0145). */
export type PedidoDeRecorrencia = {
  /** O id da linha em `assinaturas`. */
  referencia: string
  valorCentavos: number
  descricao: string
  /** O primeiro vencimento, `AAAA-MM-DD`. */
  primeiroVencimento: string
  pagador: PedidoDeCobranca['pagador']
}

export type AdesaoCriada = {
  /** A assinatura (cartão) ou a autorização (Pix Automático) no gateway. */
  idNoGateway: string
  /** Cartão: a fatura onde o pagador põe o cartão. */
  link: string | null
  /** Pix Automático: o QR que paga o primeiro mês e autoriza os seguintes. */
  pixCopiaCola: string | null
}

export type SituacaoDaAdesao = 'aguardando' | 'ativa' | 'encerrada'

export interface GatewayDePagamento {
  criarCobranca(acesso: AcessoAoGateway, pedido: PedidoDeCobranca): Promise<CobrancaCriada>
  lerPagamento(acesso: AcessoAoGateway, pagamentoId: string): Promise<PagamentoLido>
  /** Quem chama trata a falha: cancelar o que já foi pago dá erro, e está certo. */
  cancelarPagamento(acesso: AcessoAoGateway, pagamentoId: string): Promise<void>

  /** Cartão recorrente: o gateway cobra todo mês no cartão salvo. Opcional por gateway. */
  criarAssinaturaNoCartao?(acesso: AcessoAoGateway, pedido: PedidoDeRecorrencia): Promise<AdesaoCriada>
  /** Pix Automático: o QR paga o primeiro mês e autoriza o débito dos próximos. */
  criarAutorizacaoPix?(acesso: AcessoAoGateway, pedido: PedidoDeRecorrencia): Promise<AdesaoCriada>
  lerAdesao?(acesso: AcessoAoGateway, modo: 'cartao' | 'pix_automatico', idNoGateway: string): Promise<SituacaoDaAdesao>
  encerrarAdesao?(acesso: AcessoAoGateway, modo: 'cartao' | 'pix_automatico', idNoGateway: string): Promise<void>
}

/** "109,80" vira 10980 sem passar por ponto flutuante, que perde centavo em 0,1 + 0,2. */
export function centavosDeReais(reais: number): number {
  return Math.round(reais * 100)
}

/** A data no relógio do Brasil, `AAAA-MM-DD`: o vencimento do Asaas é só dia. */
export function diaEmSaoPaulo(quando: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(quando)
}

/**
 * O que um gateway de credencial colada devolve depois de provar a credencial
 * numa chamada. `token` é o que vai para o cofre: a chave, ou um JSON quando o
 * gateway pede mais de um campo (PagHiper, Efí), que só o canal sabe ler.
 */
export type ConexaoProvada = {
  contaNoGateway: string
  apelido: string | null
  token: string
  ambiente: Ambiente
  avisoNoGateway?: string | null
}

/** Recusa que a tela mostra como está: a credencial errada, o escopo faltando. */
export class ErroDeConexao extends Error {}

/** `5544999998888` vira DDD e número. Só número do Brasil. */
export function telefoneBrasileiro(telefone: string | null): { ddd: string; numero: string } | null {
  const partes = telefone?.match(/^55(\d{2})(\d{8,9})$/)
  return partes ? { ddd: partes[1]!, numero: partes[2]! } : null
}

/** O e-mail que preenche o campo quando o contato não tem: não recebe nada. */
export const EMAIL_SEM_EMAIL = 'pagador@autofluxos.4yu.com.br'

/** Os últimos quatro caracteres, para a tela dizer qual credencial está ligada sem mostrá-la. */
export function finalDe(segredo: string): string {
  return segredo.trim().slice(-4)
}
