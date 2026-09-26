import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O atendente de restaurante com IA: a pessoa pede do jeito que falaria no
 * balcão (PLANO-NICHOS 1.5 e 4.5).
 *
 * É o outro lado da demonstração: "tem pizza sem lactose?", "manda foto da
 * calabresa", "quanto fica duas grandes e uma coca?". Nada disso cabe em botão,
 * e é aqui que a IA contínua (`conversar`) paga o que custa: o bloco segura a
 * conversa, busca no cardápio, manda foto e o arquivo do cardápio, e monta o
 * pedido pelo texto, "meia calabresa meia mussarela" inclusive, que o catálogo
 * ainda não sabe representar (4.8).
 *
 * ---------------------------------------------------------------------------
 * Como o pedido sai da IA
 * ---------------------------------------------------------------------------
 *
 * A IA não fecha pedido sozinha: ela monta o resumo e pede para a pessoa
 * escrever *menu*, que é palavra de saída da conversa livre
 * (`PALAVRAS_DE_SAIDA_DA_IA`). O menu que vem depois tem "Enviar pedido", que
 * termina numa pessoa com o motivo "Novo pedido" e o último resumo da IA na
 * nota do contato.
 *
 * O caminho que parece mais curto, a IA responder a marca de "não sei" para
 * passar a conversa, foi descartado: a frase de confirmação do pedido sumiria,
 * trocada pelo aviso genérico de transferência, e a equipe leria "a IA não
 * soube responder" no motivo de um pedido que deu certo.
 *
 * O mesmo menu aparece quando a conversa chega ao teto de respostas: aí a
 * pessoa escolhe entre enviar o que já tem, continuar ou chamar alguém.
 */
export const atendenteIaRestaurante: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto:
              'Oi, {{nome}}! 👋 Pode pedir do seu jeito, por aqui mesmo. Te mostro o cardápio, mando foto dos pratos e já monto seu pedido.',
          },
        ],
      },
    },
    {
      id: 'o-que-vai-ser',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: { texto: 'O que vai ser hoje?', salvarEm: 'primeira_mensagem' },
    },
    {
      id: 'conversa',
      type: 'ia',
      position: { x: 0, y: 300 },
      data: {
        /*
         * A instrução diz o jeito de atender um restaurante; o que a casa vende,
         * quanto custa a entrega e até que horas abre moram no contexto do
         * negócio e no cardápio. Repetir aqui criaria um segundo lugar para a
         * mesma verdade divergir.
         */
        instrucao: [
          'Você atende os pedidos de um restaurante pelo WhatsApp. Seja simpático e direto, com frases curtas.',
          '- Pediram o cardápio ou o menu completo: mande com enviar_cardapio.',
          '- Perguntaram de um prato ou de uma parte do cardápio (pizzas, lanches, bebidas): busque com loja_buscar e, se a pessoa quiser ver, mande a foto com loja_mostrar.',
          '- Se a pessoa estiver em dúvida, sugira um ou dois pratos do cardápio, sem inventar nada que não esteja nele.',
          '- Entenda o pedido escrito do jeito que vier: "meia calabresa meia mussarela" é uma pizza só, com dois sabores. Repita o que entendeu para a pessoa conferir.',
          '- Para fechar, pergunte o que faltar: os itens, o endereço de entrega (ou se vai retirar) e a forma de pagamento.',
          '- Com tudo certo, mande o resumo do pedido com itens, endereço, pagamento e o total quando souber os preços, e diga para a pessoa escrever *menu* e tocar em *Enviar pedido* para mandar para a cozinha.',
          '- Taxa de entrega e tempo de preparo, só se estiverem no que você sabe da casa. Se não souber, diga que a equipe confirma.',
        ].join('\n'),
        ferramentas: ['loja_buscar', 'loja_mostrar', 'enviar_cardapio'],
        // O resumo do pedido é a última resposta antes do "menu", e é ela que
        // vai para a nota quando a pessoa toca em "Enviar pedido".
        salvarEm: 'resposta_da_ia',
        // Quinze respostas cabem um pedido com dúvida, troca de sabor e
        // endereço, e param antes de a conversa virar custo sem pedido.
        conversar: { maxTurnos: 15 },
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 460 },
      data: {
        texto: 'O que você quer fazer agora?',
        salvarEm: 'escolha',
        opcoes: [
          { id: 'enviar', rotulo: 'Enviar pedido' },
          { id: 'continuar', rotulo: 'Continuar conversa' },
          { id: 'pessoa', rotulo: 'Falar com atendente' },
        ],
      },
    },
    {
      id: 'pode-mandar',
      type: 'pergunta',
      position: { x: -320, y: 620 },
      data: { texto: 'Claro! Pode mandar. 😊', salvarEm: 'primeira_mensagem' },
    },
    {
      id: 'anotar-pedido',
      type: 'nota',
      position: { x: 0, y: 620 },
      data: { texto: 'Pedido pela conversa com a IA: {{resposta_da_ia}}' },
    },
    {
      id: 'pedido-feito',
      type: 'handoff',
      position: { x: 0, y: 780 },
      data: {
        motivo: 'Novo pedido',
        mensagens: ['Pedido enviado! 🙌 A equipe já está vendo e confirma tudo por aqui em instantes.'],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 320, y: 620 },
      data: {
        motivo: 'pediu atendente',
        mensagens: ['Já chamei alguém da equipe. Só um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'o-que-vai-ser' },
    { id: 'e2', source: 'o-que-vai-ser', target: 'conversa' },
    // A saída da conversa livre: "menu" escrito, ou o teto de respostas.
    { id: 'e3', source: 'conversa', target: 'menu' },
    { id: 'e4', source: 'menu', sourceHandle: 'enviar', target: 'anotar-pedido' },
    { id: 'e5', source: 'menu', sourceHandle: 'continuar', target: 'pode-mandar' },
    { id: 'e6', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
    { id: 'e7', source: 'pode-mandar', target: 'conversa' },
    { id: 'e8', source: 'anotar-pedido', target: 'pedido-feito' },
  ],
})
