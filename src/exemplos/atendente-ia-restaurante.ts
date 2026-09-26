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
 * A IA fecha o pedido sozinha (`conversar.concluir`, PLANO-NICHOS etapa 6):
 * com itens, endereço e pagamento conferidos pela pessoa, ela chama
 * `concluir_conversa` com o resumo, escreve a frase de fechamento, e a conversa
 * segue pela saída "concluiu" para a nota no contato e uma pessoa com o motivo
 * "Novo pedido". A pessoa não precisa saber palavra nenhuma nem tocar em botão
 * para mandar o que já combinou.
 *
 * O caminho que parece mais curto, a IA responder a marca de "não sei" para
 * passar a conversa, foi descartado: a frase de confirmação do pedido sumiria,
 * trocada pelo aviso genérico de transferência, e a equipe leria "a IA não
 * soube responder" no motivo de um pedido que deu certo.
 *
 * A outra saída, a de sempre, é *menu* escrito ou o teto de respostas: aí a
 * pessoa escolhe entre continuar ou chamar alguém, e quem atende recebe a
 * última resposta da IA na nota.
 *
 * Os produtos vêm do **catálogo próprio** (`fonteDoCatalogo: 'catalogo'`): o
 * cardápio é cadastrado em Comércio, e uma conta que também tem loja on-line
 * ligada não pode oferecer um headset no lugar de uma pizza.
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
          '- Com tudo certo, mande o resumo do pedido com itens, endereço, pagamento e o total quando souber os preços, e pergunte se pode enviar para a cozinha.',
          '- Quando a pessoa confirmar o resumo, feche com concluir_conversa, passando o resumo completo, e responda só uma frase curta dizendo que o pedido foi enviado.',
          '- Taxa de entrega e tempo de preparo, só se estiverem no que você sabe da casa. Se não souber, diga que a equipe confirma.',
        ].join('\n'),
        ferramentas: ['loja_buscar', 'loja_mostrar', 'enviar_cardapio'],
        fonteDoCatalogo: 'catalogo',
        // A última resposta, para quem atende saber onde a conversa parou
        // quando ela sai por "menu" ou pelo teto, sem pedido fechado.
        salvarEm: 'resposta_da_ia',
        // Quinze respostas cabem um pedido com dúvida, troca de sabor e
        // endereço, e param antes de a conversa virar custo sem pedido. O
        // resumo do pedido fechado vai para `pedido`.
        conversar: { maxTurnos: 15, concluir: { salvarEm: 'pedido' } },
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 320, y: 460 },
      data: {
        texto: 'O que você quer fazer agora?',
        salvarEm: 'escolha',
        opcoes: [
          { id: 'continuar', rotulo: 'Continuar conversa' },
          { id: 'pessoa', rotulo: 'Falar com atendente' },
        ],
      },
    },
    {
      id: 'pode-mandar',
      type: 'pergunta',
      position: { x: 160, y: 620 },
      data: { texto: 'Claro! Pode mandar. 😊', salvarEm: 'primeira_mensagem' },
    },
    {
      id: 'anotar-pedido',
      type: 'nota',
      position: { x: -160, y: 460 },
      data: { texto: 'Pedido pela conversa com a IA: {{pedido}}' },
    },
    {
      id: 'pedido-feito',
      type: 'handoff',
      position: { x: -160, y: 620 },
      data: {
        motivo: 'Novo pedido',
        mensagens: ['A equipe já está com o seu pedido e confirma por aqui o valor com a entrega e o tempo de preparo. 🍕'],
      },
    },
    {
      id: 'anotar-conversa',
      type: 'nota',
      position: { x: 480, y: 620 },
      data: { texto: 'Pediu atendente na conversa com a IA. Última resposta: {{resposta_da_ia}}' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 480, y: 780 },
      data: {
        motivo: 'pediu atendente',
        mensagens: ['Já chamei alguém da equipe. Só um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'o-que-vai-ser' },
    { id: 'e2', source: 'o-que-vai-ser', target: 'conversa' },
    // A IA fechou o pedido: nota com o resumo e a equipe.
    { id: 'e3', source: 'conversa', sourceHandle: 'concluido', target: 'anotar-pedido' },
    { id: 'e4', source: 'anotar-pedido', target: 'pedido-feito' },
    // A saída de sempre da conversa livre: "menu" escrito, ou o teto.
    { id: 'e5', source: 'conversa', target: 'menu' },
    { id: 'e6', source: 'menu', sourceHandle: 'continuar', target: 'pode-mandar' },
    { id: 'e7', source: 'menu', sourceHandle: 'pessoa', target: 'anotar-conversa' },
    { id: 'e8', source: 'pode-mandar', target: 'conversa' },
    { id: 'e9', source: 'anotar-conversa', target: 'humano' },
  ],
})
