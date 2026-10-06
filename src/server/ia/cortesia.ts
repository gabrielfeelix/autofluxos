import { RECUSA_FORA_DO_ASSUNTO } from './prompt'
import type { Modelo } from './types'

/**
 * Agradecimento nunca recebe a recusa de "fora do assunto".
 *
 * A regra 3 do prompt já diz isso, e mesmo assim o modelo recusou "Agradeço"
 * na PCYES em 06/out/2026, logo depois de encaminhar a pessoa ao comercial.
 * Trocar a recusa por uma frase fixa ("Por nada!") não serve: "obrigado" pode
 * fechar a conversa, agradecer o que chegou e pedir mais, ou vir colado numa
 * pergunta. Quem decide a resposta continua sendo o modelo, com a conversa
 * inteira; o que muda é que ele é perguntado de novo, avisado de que aquilo
 * não é fora do assunto. A frase fixa fica só para o caso de ele insistir.
 */
export function comCortesia(modelo: Modelo): Modelo {
  return {
    async responder(pedido) {
      const resposta = await modelo.responder(pedido)
      if (!ehRecusa(resposta) || !temCortesia(pedido.pergunta)) return resposta

      const segunda = await modelo.responder({
        ...pedido,
        instrucao: `${pedido.instrucao}\n${AVISO_DE_CORTESIA}`,
      })
      return ehRecusa(segunda) ? { tipo: 'texto', texto: ULTIMO_RECURSO } : segunda
    },
  }
}

const AVISO_DE_CORTESIA =
  'ATENÇÃO NESTA RESPOSTA: a mensagem do cliente tem agradecimento, confirmação ou despedida, e isso nunca é fora do assunto. ' +
  'Leia a conversa até aqui e responda ao que ele quis dizer: se agradeceu e encerrou, despeça-se em uma frase e diga que fica à disposição; ' +
  'se agradeceu o que recebeu e pediu ou perguntou mais alguma coisa, atenda o pedido; se só confirmou ("ok", "certo"), siga a conversa de onde ela estava.'

/** Se o modelo recusar de novo: curta e sem fechar a porta. */
const ULTIMO_RECURSO = 'Por nada! Posso ajudar em mais alguma coisa?'

function ehRecusa(resposta: Awaited<ReturnType<Modelo['responder']>>): boolean {
  return resposta.tipo === 'texto' && resposta.texto === RECUSA_FORA_DO_ASSUNTO
}

/**
 * A mensagem traz agradecimento, confirmação ou despedida em algum lugar,
 * sozinha ou junto de outra coisa ("valeu, e o mouse branco?"). Larga de
 * propósito: errar para o lado de perguntar de novo custa uma chamada a mais;
 * errar para o outro lado é recusar quem agradeceu.
 */
export function temCortesia(mensagem: string): boolean {
  const texto = mensagem.toLowerCase()
  if (texto.length > 300) return false
  if (/^[\s\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]+$/u.test(texto)) return true // só emoji: 👍, 🙏🏻
  return /\b(agrade[cç]|obrigad|obg\b|brigad|grat[oa]\b|gratid|valeu|vlw|tmj|ok\b|okay|blz|beleza|certo\b|entendi|perfeito|show\b|top\b|combinado|fechado|tudo bem|tudo certo|de boa|at[eé] mais|at[eé] logo|tchau|falou|abra[cç]o|abs\b)/u.test(
    texto,
  )
}
