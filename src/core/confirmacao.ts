/**
 * "Posso marcar?" — e o que a pessoa respondeu.
 *
 * Existe porque a IA passou a **gravar** no sistema do cliente. Ler é
 * reversível; marcar e desmarcar não são, e a diferença entre as duas foi o que
 * organizou o resto do desenho.
 *
 * **Por que a confirmação é do motor e não do modelo.** O prompt já pede que ele
 * confirme em palavras (regra 10), e pedir não é garantir: um modelo convencido
 * pula a etapa, e a primeira vez que isso acontecer alguém perde uma aula. Aqui
 * a confirmação é uma parada de verdade — a chamada não sai enquanto a pessoa
 * não responder.
 *
 * Também é o que tira a decisão de ser "unicamente automatizada", que é
 * exatamente a expressão do art. 20 da LGPD. Quem decide passa a ser quem é
 * afetado, e isso não é ganho jurídico apenas: é a resposta certa.
 *
 * Puro de propósito, como todo `core/`: sem rede, sem relógio, sem banco.
 */

/**
 * O que conta como sim.
 *
 * Curto e literal, e isso é escolha. A tentação é aceitar de tudo — "aham",
 * "bora", "manda ver" — e ela é errada nos dois sentidos: um falso sim marca
 * aula que ninguém pediu, e um falso não só custa uma repetição da pergunta.
 * **Na dúvida, não é sim.**
 *
 * Sem acento e em minúsculas na lista; a comparação normaliza os dois lados.
 */
const SINS = [
  'sim',
  's',
  'pode',
  'pode sim',
  'pode ser',
  'confirmo',
  'confirmado',
  'confirma',
  'isso',
  'isso mesmo',
  'ok',
  'okay',
  'claro',
  'quero',
  'quero sim',
  'positivo',
  'certo',
  'perfeito',
  'aceito',
  'vamos',
  'bora',
  'fechado',
  'combinado',
  'por favor',
  'pf',
  'manda',
  'ta bom',
  'tudo bem',
  'beleza',
  'blz',
  'uhum',
  'aham',
  'yes',
]

/**
 * O que conta como não.
 *
 * Uma lista à parte, e não "tudo que não é sim", porque as três respostas são
 * diferentes: **sim** grava, **não** cancela e volta a conversar, e
 * **não entendi** repete a pergunta. Tratar "quanto custa?" como recusa
 * encerraria o assunto sem a pessoa ter recusado nada.
 */
const NAOS = [
  'nao',
  'n',
  'nao quero',
  'nao pode',
  'negativo',
  'cancela',
  'cancelar',
  'deixa',
  'deixa pra la',
  'esquece',
  'melhor nao',
  'agora nao',
  'espera',
  'peraí',
  'para',
  'no',
]

export type Confirmacao = 'sim' | 'nao' | 'nao_entendi'

/**
 * Lê a resposta a uma pergunta de confirmação.
 *
 * Compara a frase **inteira**, e não procura a palavra dentro dela. Buscar
 * dentro é o erro clássico e ele é grave aqui: "não, pode deixar" contém
 * "pode"; "sim, mas depois" contém "sim" e não é um sim para agora. Quem
 * escreveu uma frase quer conversar, e conversa volta para o modelo.
 */
export function lerConfirmacao(texto: string): Confirmacao {
  const limpo = normalizar(texto)
  if (limpo === '') return 'nao_entendi'

  // Emoji de joinha vale sim, e é comum no WhatsApp — mais comum que "sim".
  if (limpo === '👍' || limpo === '👍🏻' || limpo === '✅') return 'sim'

  // Pontuação final não muda a resposta: "sim!" e "não." são o que parecem.
  const semPontuacao = limpo.replace(/[!.,;:?]+$/, '').trim()

  if (SINS.includes(semPontuacao)) return 'sim'
  if (NAOS.includes(semPontuacao)) return 'nao'
  return 'nao_entendi'
}

/**
 * Tira acento, caixa e espaço repetido.
 *
 * Sem isso, "Não" e "nao" seriam respostas diferentes — e quem digita no
 * celular escreve as duas.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A pergunta que vai para a pessoa antes de gravar.
 *
 * **Escrita aqui, e não pelo modelo**, e a razão é a mesma da confirmação
 * existir: a frase que descreve o que vai ser feito não pode ser inventada por
 * quem vai fazer. Um modelo pedindo "posso confirmar?" sem dizer o quê recebe
 * um "pode" que não confirma nada.
 *
 * `resumo` é o que a conversa já viu — "10/09 07:00 · Pilates solo", montado a
 * partir do que a própria consulta devolveu. Vazio quando não há como saber, e
 * aí a pergunta fica genérica em vez de mentir sobre o que vai acontecer.
 */
export function perguntaDeConfirmacao(acao: string, resumo?: string): string {
  const alvo = resumo && resumo.trim() !== '' ? ` ${resumo.trim()}` : ''
  return `Só confirmando antes: ${acao}${alvo}. Posso?`
}

/** O que a pessoa ouve quando responde que não. */
export const AVISO_DE_RECUSA = 'Sem problema, não fiz nada. Me diz como prefere seguir.'

/** O que ela ouve quando responde qualquer outra coisa. */
export const AVISO_DE_DUVIDA =
  'Só para eu não errar: responda **sim** para eu seguir, ou **não** para cancelar.'
