import { z } from 'zod'
import type { AoFalhar, Cabecalho, Mapeamento, Metodo, Opcao } from '../flow/schema'

/**
 * `Sessao` e `Entrada` são schemas Zod, não só tipos: eles atravessam a
 * fronteira da rede (o simulador manda a sessão de volta a cada mensagem, o
 * webhook do WhatsApp manda o que chegou). Tudo que vem de fora é validado
 * antes de encostar no motor.
 *
 * `Acao` é só tipo — ela sempre sai daqui, nunca entra.
 */

export const statusSessaoSchema = z.enum([
  /** conversando normalmente */
  'ativa',
  /** parada num nó de IA, esperando a resposta do modelo */
  'aguardando_ia',
  /** parada num nó de API, esperando a resposta da chamada */
  'aguardando_http',
  /** o humano assumiu — o bot fica calado */
  'humano',
  /** o fluxo chegou ao fim */
  'encerrada',
])

/**
 * Tudo que o motor precisa lembrar de uma conversa. É serializável: cabe numa
 * linha de banco e volta de lá sem perder nada. Não existe estado do motor
 * fora daqui.
 */
export const sessaoSchema = z.object({
  /** Nó onde a conversa parou. `null` = ainda não começou. */
  noAtual: z.string().nullable(),
  /** Variáveis coletadas: `{ nome: "Ana", assunto: "orçamento" }` */
  vars: z.record(z.string(), z.string()),
  /** Quantas vezes seguidas o motor não entendeu. Reseta ao avançar. */
  tentativas: z.number().int().min(0),
  status: statusSessaoSchema,
})

/** O que chegou. O motor não sabe se veio do WhatsApp ou do simulador. */
export const entradaSchema = z.discriminatedUnion('tipo', [
  /** primeira interação: começa o fluxo do zero */
  z.object({ tipo: z.literal('inicio') }),
  z.object({ tipo: z.literal('texto'), texto: z.string() }),
  /** a pessoa clicou num botão ou item de lista */
  z.object({ tipo: z.literal('opcao'), opcaoId: z.string().min(1) }),
  /** áudio, imagem, documento, figurinha... (Regra B) */
  z.object({ tipo: z.literal('midia'), formato: z.string().min(1) }),
  /** o servidor chamou o modelo e trouxe a resposta de volta */
  z.object({ tipo: z.literal('ia_respondeu'), texto: z.string() }),
  /**
   * O servidor chamou a API e trouxe os valores **já extraídos**. Quem entende
   * de JSON é o resolvedor; o motor só sabe manipular pares de nome e texto.
   */
  z.object({
    tipo: z.literal('http_respondeu'),
    valores: z.record(z.string(), z.string()),
  }),
])

export type StatusSessao = z.infer<typeof statusSessaoSchema>
export type Sessao = z.infer<typeof sessaoSchema>
export type Entrada = z.infer<typeof entradaSchema>

/**
 * O que o mundo lá fora deve fazer. O motor nunca executa nada — ele descreve.
 * Quem executa é o canal (WhatsApp de verdade) ou o simulador (que só mostra).
 */
export type Acao =
  | {
      tipo: 'enviar_texto'
      texto: string
      /** Esperar fora do motor antes do envio. Ausente = entregar na hora. */
      atrasoMs?: number
    }
  | {
      tipo: 'enviar_opcoes'
      texto: string
      opcoes: Opcao[]
      /** decidido pela quantidade: até 3 vira botão, até 10 vira lista */
      formato: 'botoes' | 'lista'
    }
  /** persistir no contato — é isso que alimenta a tela de leads */
  | { tipo: 'salvar_campo'; campo: string; valor: string }
  /** chamar o modelo e reentrar no motor com `{ tipo: 'ia_respondeu' }` */
  | { tipo: 'chamar_ia'; instrucao: string }
  /**
   * Chamar uma API e reentrar no motor com `{ tipo: 'http_respondeu' }`.
   *
   * `url`, `corpo` e os valores dos cabeçalhos já vêm interpolados com as
   * variáveis da sessão. O que **não** vem resolvido é `{{segredo.x}}` — isso é
   * trabalho do servidor, e de propósito: segredo que entrasse aqui entraria na
   * sessão, e a sessão viaja para o navegador no simulador.
   */
  | {
      tipo: 'chamar_http'
      metodo: Metodo
      url: string
      cabecalhos: Cabecalho[]
      corpo: string
      mapear: Mapeamento[]
      aoFalhar: AoFalhar
      /**
       * Referência à credencial, nunca a credencial. O motor não sabe o que há
       * do outro lado deste id, e é por isso que segredo nenhum consegue
       * entrar na sessão — que viaja para o navegador no simulador.
       */
      conexaoId?: string
    }
  | { tipo: 'transferir_humano'; motivo: string }
  | { tipo: 'encerrar' }

export type Resultado = {
  acoes: Acao[]
  sessao: Sessao
}

export function sessaoNova(): Sessao {
  return { noAtual: null, vars: {}, tentativas: 0, status: 'ativa' }
}
