import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O atendente de IA em laço — a IA responde, e a conversa volta a ela.
 *
 * **O laço é o desenho, não um truque.** Um bloco de IA sozinho responde uma
 * vez e segue para o próximo nó; quem tem uma segunda dúvida encontra o fim do
 * fluxo. Voltar da IA para a pergunta que a alimenta é o que transforma um
 * bloco em atendimento: a pessoa pergunta quantas vezes quiser, e cada resposta
 * é uma passada nova pelo mesmo par de blocos.
 *
 * **A saída não é do laço, é da IA.** Não existe aqui nenhuma condição contando
 * perguntas nem oferecendo "quer falar com alguém?" a cada rodada. Quem
 * interrompe é o próprio modelo: o prompt manda responder `NAO_SEI` quando a
 * pergunta foge do contexto do negócio, quando a pessoa pede uma pessoa e
 * quando ela parece irritada — e `nao_sei` transfere para o humano em
 * `efeitos/resolver.ts`, com aviso diferente fora do horário. Ou seja: o laço
 * tem porta de saída em toda volta, e ela é a mesma regra que impede a IA de
 * inventar preço.
 *
 * Por isso o `handoff` daqui **não é o destino comum** — ele é a saída de quem
 * escolhe falar com alguém logo na abertura, antes de a IA dizer uma palavra.
 * Pedir atendente e receber um robô perguntando "como posso ajudar?" é o atrito
 * que o documento do cliente chama de loop do bot. O caminho de quem entra na
 * IA sai pelo `nao_sei`, que o motor resolve sem passar por este grafo.
 *
 * **A pergunta do laço não tem opções de propósito.** Opção vira botão, e botão
 * é o oposto do que este fluxo oferece: aqui a pessoa escreve o que quiser.
 *
 * **Fora da galeria de modelos, e não por esquecimento.** `MODELOS` só oferece
 * fluxo que *qualquer* cliente publica, e o `validar()` recusa um bloco de IA
 * quando o plano não a contratou (`IA_NAO_CONTRATADA`) — um modelo com IA na
 * galeria mostraria erro na cara de quem só escolheu da lista. Este grafo é
 * ponto de partida para quem tem IA no plano e contexto do negócio escrito.
 */
export const atendenteIa: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi! 👋 Sou o assistente virtual e respondo por aqui mesmo. Pode perguntar o que quiser — se eu não souber, chamo alguém do time.',
          },
        ],
      },
    },
    {
      id: 'porta',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'Quer perguntar por aqui mesmo ou já falar com alguém do time?',
        salvarEm: 'porta',
        opcoes: [
          { id: 'perguntar', rotulo: 'Tenho uma dúvida' },
          { id: 'atendente', rotulo: 'Falar com atendente' },
        ],
        timeoutMinutos: 30,
      },
    },
    {
      id: 'como-ajudo',
      type: 'pergunta',
      position: { x: -180, y: 300 },
      data: {
        texto: 'Pode mandar sua dúvida. 😊',
        salvarEm: 'pergunta',
        /*
         * Meia hora. É o mesmo prazo do modelo de recado, e pelo mesmo motivo:
         * cabe quem saiu e voltou, e é curto o bastante para a pessoa ainda
         * lembrar do que estava perguntando.
         */
        timeoutMinutos: 30,
      },
    },
    {
      id: 'responder',
      type: 'ia',
      position: { x: -180, y: 450 },
      data: {
        /*
         * A instrução é do momento, não do negócio. O que a empresa é, o que
         * ela cobra e o que ela não responde moram no contexto do negócio, que
         * é por cliente — repetir aqui criaria um segundo lugar para a mesma
         * verdade divergir de si mesma.
         */
        instrucao:
          'Responda a dúvida da pessoa usando o que você sabe sobre a empresa. Se ela já tiver perguntado algo antes nesta conversa, leve em conta o que foi dito.',
        salvarEm: 'ultima_resposta',
      },
    },
    {
      id: 'mais-alguma',
      type: 'pergunta',
      position: { x: -180, y: 600 },
      data: {
        texto: 'Posso ajudar em mais alguma coisa?',
        salvarEm: 'pergunta',
        timeoutMinutos: 30,
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 180, y: 750 },
      data: {
        motivo: 'a pessoa pediu atendente',
        mensagens: ['Claro! Já estou chamando alguém do time aqui. 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'porta' },
    { id: 'e2', source: 'porta', sourceHandle: 'perguntar', target: 'como-ajudo' },
    // Quem já quer gente não passa pela IA: pedir para falar com alguém e
    // receber um robô perguntando "como posso ajudar?" é o atrito que o
    // documento do cliente chama de loop do bot.
    { id: 'e3', source: 'porta', sourceHandle: 'atendente', target: 'humano' },
    { id: 'e4', source: 'como-ajudo', target: 'responder' },
    { id: 'e5', source: 'responder', target: 'mais-alguma' },
    // O laço: a próxima pergunta volta para a IA, e não há teto de voltas.
    { id: 'e6', source: 'mais-alguma', target: 'responder' },
  ],
})
