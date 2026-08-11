import type { Opcao } from '../flow/schema.js'

/**
 * Tudo que o motor precisa lembrar de uma conversa. É serializável: cabe numa
 * linha de banco e volta de lá sem perder nada. Não existe estado do motor
 * fora daqui.
 */
export type Sessao = {
  /** Nó onde a conversa parou. `null` = ainda não começou. */
  noAtual: string | null
  /** Variáveis coletadas: `{ nome: "Ana", assunto: "orçamento" }` */
  vars: Record<string, string>
  /** Quantas vezes seguidas o motor não entendeu. Reseta ao avançar. */
  tentativas: number
  status: StatusSessao
}

export type StatusSessao =
  /** conversando normalmente */
  | 'ativa'
  /** parada num nó de IA, esperando a resposta do modelo */
  | 'aguardando_ia'
  /** o humano assumiu — o bot fica calado */
  | 'humano'
  /** o fluxo chegou ao fim */
  | 'encerrada'

/** O que chegou. O motor não sabe se veio do WhatsApp ou do simulador. */
export type Entrada =
  /** primeira interação: começa o fluxo do zero */
  | { tipo: 'inicio' }
  | { tipo: 'texto'; texto: string }
  /** a pessoa clicou num botão ou item de lista */
  | { tipo: 'opcao'; opcaoId: string }
  /** áudio, imagem, documento, figurinha... (Regra B) */
  | { tipo: 'midia'; formato: string }
  /** o servidor chamou o modelo e trouxe a resposta de volta */
  | { tipo: 'ia_respondeu'; texto: string }

/**
 * O que o mundo lá fora deve fazer. O motor nunca executa nada — ele descreve.
 * Quem executa é o canal (WhatsApp de verdade) ou o simulador (que só mostra).
 */
export type Acao =
  | { tipo: 'enviar_texto'; texto: string }
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
  | { tipo: 'transferir_humano'; motivo: string }
  | { tipo: 'encerrar' }

export type Resultado = {
  acoes: Acao[]
  sessao: Sessao
}

export function sessaoNova(): Sessao {
  return { noAtual: null, vars: {}, tentativas: 0, status: 'ativa' }
}
