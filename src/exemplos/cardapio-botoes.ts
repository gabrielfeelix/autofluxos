import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O cardápio com botões: o atendimento de restaurante que não depende de a
 * pessoa saber o que escrever (PLANO-NICHOS 1.5 e 4.5).
 *
 * O menu tem as quatro coisas que chegam o dia inteiro no WhatsApp de uma
 * pizzaria: o cardápio, o pedido, o horário com a taxa de entrega e alguém da
 * casa. "Falar com atendente" fica no menu, e não escondido no fim, pela mesma
 * regra do menu de dúvidas.
 *
 * ---------------------------------------------------------------------------
 * O cardápio sai pela IA, e não por um bloco de arquivo
 * ---------------------------------------------------------------------------
 *
 * O arquivo do cardápio é o que o dono subiu na tela do Cardápio (tabela
 * `materiais`), e o endereço dele não existe na hora de desenhar o modelo. Um
 * bloco de arquivo aqui teria de nascer com um endereço de mentira, e é o tipo
 * de coisa que só aparece quando o cliente pede o cardápio e recebe um erro.
 *
 * Por isso os dois blocos de IA daqui são **restritos**: cada um tem uma
 * ferramenta e uma tarefa, e responde uma vez só (sem `conversar`). Um manda o
 * arquivo com `enviar_cardapio`; o outro mostra os pratos da categoria
 * escolhida com foto e preço. Quem conversa é o botão; a IA só busca. O preço
 * disso é o modelo pedir a IA ligada, e a etiqueta avisa.
 *
 * ---------------------------------------------------------------------------
 * O pedido não passa pela IA
 * ---------------------------------------------------------------------------
 *
 * Itens, endereço e pagamento são perguntas comuns, e o resumo é montado com as
 * respostas. O pedido termina numa pessoa, com o motivo "Novo pedido" e uma
 * nota no contato: quem confirma valor, taxa e tempo é a casa. O bloco de etapa
 * do funil não vem no modelo porque aponta para um funil **desta** conta, que
 * não existe quando o modelo é escrito; a instalação do pacote (etapa 7) é quem
 * liga o pedido ao funil de pedidos.
 */
export const cardapioBotoes: Fluxo = fluxoSchema.parse({
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
            texto: 'Oi, {{nome}}! 👋 Que bom te ver por aqui. Dá para ver o cardápio e pedir por aqui mesmo.',
          },
        ],
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'Como posso te ajudar?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'cardapio', rotulo: 'Ver cardápio', valor: 'cardapio' },
          { id: 'pedido', rotulo: 'Fazer pedido', valor: 'pedido' },
          { id: 'horario', rotulo: 'Horário e entrega', valor: 'horario' },
          { id: 'pessoa', rotulo: 'Falar com atendente', valor: 'pessoa' },
        ],
        // Meia hora: quem abriu o menu e saiu ainda lembra o que queria.
        timeoutMinutos: 30,
      },
    },

    /* ------------------------------------------------------------ cardápio */
    {
      id: 'mandar-cardapio',
      type: 'ia',
      position: { x: -520, y: 330 },
      data: {
        instrucao:
          'A pessoa pediu o cardápio. Mande o cardápio da casa com enviar_cardapio e apresente numa frase curta, como "Olha o nosso cardápio!". Se não houver cardápio em arquivo, diga que dá para ver os pratos por parte do cardápio logo abaixo.',
        ferramentas: ['enviar_cardapio'],
      },
    },
    {
      id: 'categorias',
      type: 'pergunta',
      position: { x: -520, y: 490 },
      data: {
        /*
         * As partes do cardápio são as de uma pizzaria comum. Cada uma tem de
         * bater com a categoria cadastrada nos pratos, que é por onde a busca
         * filtra: quem vende marmita troca por "Marmitas" e "Bebidas".
         */
        texto: 'Quer ver os pratos de alguma parte do cardápio?',
        salvarEm: 'categoria',
        opcoes: [
          { id: 'pizzas', rotulo: 'Pizzas' },
          { id: 'lanches', rotulo: 'Lanches' },
          { id: 'bebidas', rotulo: 'Bebidas' },
          { id: 'sobremesas', rotulo: 'Sobremesas' },
          { id: 'pedido', rotulo: 'Fazer pedido' },
          { id: 'menu', rotulo: 'Voltar ao menu' },
        ],
      },
    },
    {
      id: 'mostrar-categoria',
      type: 'ia',
      position: { x: -520, y: 650 },
      data: {
        instrucao:
          'A pessoa quer ver "{{categoria}}" do cardápio. Busque com loja_buscar usando {{categoria}} como termo e como categoria, e mostre até 3 itens com loja_mostrar, com foto e preço. Responda com uma frase curta e simpática. Se não achar nada, diga que essa parte do cardápio ainda não está cadastrada.',
        ferramentas: ['loja_buscar', 'loja_mostrar'],
      },
    },
    {
      id: 'depois-da-categoria',
      type: 'pergunta',
      position: { x: -520, y: 810 },
      data: {
        texto: 'E aí, o que vai ser?',
        salvarEm: 'depois_do_cardapio',
        opcoes: [
          { id: 'pedido', rotulo: 'Fazer pedido' },
          { id: 'outra', rotulo: 'Ver outra categoria' },
          { id: 'pessoa', rotulo: 'Falar com atendente' },
        ],
      },
    },
    {
      id: 'voltar-ao-menu',
      type: 'voltar',
      position: { x: -820, y: 650 },
      data: { destino: 'menu', rotulo: 'Como posso te ajudar?' },
    },

    /* -------------------------------------------------------------- pedido */
    {
      id: 'itens',
      type: 'pergunta',
      position: { x: -120, y: 330 },
      data: {
        texto:
          'Me conta o que você vai querer, do seu jeito. 😋\nPor exemplo: _1 pizza grande meia calabresa meia mussarela e 1 refri de 2 litros_.',
        salvarEm: 'itens',
      },
    },
    {
      id: 'endereco',
      type: 'pergunta',
      position: { x: -120, y: 490 },
      data: {
        texto:
          'Qual o endereço de entrega? Rua, número, bairro e um ponto de referência.\nSe for retirar aqui, é só escrever *retirar*.',
        salvarEm: 'endereco',
      },
    },
    {
      id: 'pagamento',
      type: 'pergunta',
      position: { x: -120, y: 650 },
      data: {
        texto: 'Como você vai pagar?',
        salvarEm: 'pagamento',
        opcoes: [
          { id: 'pix', rotulo: 'Pix' },
          { id: 'cartao', rotulo: 'Cartão na entrega' },
          { id: 'dinheiro', rotulo: 'Dinheiro' },
        ],
      },
    },
    {
      /*
       * O resumo é mensagem, e a conferência é outra pergunta: o texto do
       * pedido é o que a pessoa escreveu, pode ser longo, e mensagem com
       * botões cabe um quarto do que cabe no texto puro.
       */
      id: 'resumo',
      type: 'mensagem',
      position: { x: -120, y: 810 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: '*Confere seu pedido:*\n\n{{itens}}\n\n*Entrega:* {{endereco}}\n*Pagamento:* {{pagamento}}',
          },
        ],
      },
    },
    {
      id: 'confere',
      type: 'pergunta',
      position: { x: -120, y: 970 },
      data: {
        texto: 'Está tudo certo?',
        salvarEm: 'confere',
        opcoes: [
          { id: 'confirmar', rotulo: 'Confirmar pedido' },
          { id: 'corrigir', rotulo: 'Corrigir' },
          { id: 'pessoa', rotulo: 'Falar com atendente' },
        ],
      },
    },
    {
      id: 'anotar-pedido',
      type: 'nota',
      position: { x: -120, y: 1130 },
      data: { texto: 'Pedido pelo WhatsApp: {{itens}}. Entrega: {{endereco}}. Pagamento: {{pagamento}}.' },
    },
    {
      id: 'pedido-feito',
      type: 'handoff',
      position: { x: -120, y: 1290 },
      data: {
        motivo: 'Novo pedido · {{pagamento}}',
        mensagens: [
          'Pedido anotado! 🙌 Já passei para a cozinha.',
          'Daqui a pouco a gente confirma por aqui o valor com a taxa de entrega e o tempo de preparo.',
        ],
      },
    },

    /* ----------------------------------------------------- horário e entrega */
    {
      id: 'resposta-horario',
      type: 'mensagem',
      position: { x: 280, y: 330 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Horário*\nTerça a domingo, das 18h às 23h.\n\n*Entrega*\nTaxa de R$ 000 para os bairros próximos, e o pedido chega em uns 40 minutos.\n\n_Troque este texto pelo seu horário, sua taxa e sua área de entrega._',
          },
        ],
      },
    },
    {
      id: 'mais-alguma',
      type: 'pergunta',
      position: { x: 280, y: 490 },
      data: {
        texto: 'Posso ajudar em mais alguma coisa?',
        salvarEm: 'quer_mais',
        opcoes: [
          { id: 'pedido', rotulo: 'Fazer pedido' },
          { id: 'cardapio', rotulo: 'Ver cardápio' },
          { id: 'pessoa', rotulo: 'Falar com atendente' },
        ],
      },
    },

    {
      id: 'humano',
      type: 'handoff',
      position: { x: 620, y: 490 },
      data: {
        motivo: 'pediu atendente · {{assunto}}',
        mensagens: ['Já chamei alguém da equipe. Só um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'menu' },
    { id: 'e2', source: 'menu', sourceHandle: 'cardapio', target: 'mandar-cardapio' },
    { id: 'e3', source: 'menu', sourceHandle: 'pedido', target: 'itens' },
    { id: 'e4', source: 'menu', sourceHandle: 'horario', target: 'resposta-horario' },
    { id: 'e5', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
    // Sem resposta, ninguém fica esperando: a conversa vai para uma pessoa.
    { id: 'e6', source: 'menu', sourceHandle: 'timeout', target: 'humano' },

    { id: 'c1', source: 'mandar-cardapio', target: 'categorias' },
    { id: 'c2', source: 'categorias', sourceHandle: 'pizzas', target: 'mostrar-categoria' },
    { id: 'c3', source: 'categorias', sourceHandle: 'lanches', target: 'mostrar-categoria' },
    { id: 'c4', source: 'categorias', sourceHandle: 'bebidas', target: 'mostrar-categoria' },
    { id: 'c5', source: 'categorias', sourceHandle: 'sobremesas', target: 'mostrar-categoria' },
    { id: 'c6', source: 'categorias', sourceHandle: 'pedido', target: 'itens' },
    { id: 'c7', source: 'categorias', sourceHandle: 'menu', target: 'voltar-ao-menu' },
    { id: 'c8', source: 'mostrar-categoria', target: 'depois-da-categoria' },
    { id: 'c9', source: 'depois-da-categoria', sourceHandle: 'pedido', target: 'itens' },
    { id: 'c10', source: 'depois-da-categoria', sourceHandle: 'outra', target: 'categorias' },
    { id: 'c11', source: 'depois-da-categoria', sourceHandle: 'pessoa', target: 'humano' },

    { id: 'p1', source: 'itens', target: 'endereco' },
    { id: 'p2', source: 'endereco', target: 'pagamento' },
    { id: 'p3', source: 'pagamento', sourceHandle: 'pix', target: 'resumo' },
    { id: 'p4', source: 'pagamento', sourceHandle: 'cartao', target: 'resumo' },
    { id: 'p5', source: 'pagamento', sourceHandle: 'dinheiro', target: 'resumo' },
    { id: 'p6', source: 'resumo', target: 'confere' },
    { id: 'p7', source: 'confere', sourceHandle: 'confirmar', target: 'anotar-pedido' },
    // Corrigir volta aos itens: é onde mora quase todo engano, e endereço e
    // pagamento são dois toques para responder de novo.
    { id: 'p8', source: 'confere', sourceHandle: 'corrigir', target: 'itens' },
    { id: 'p9', source: 'confere', sourceHandle: 'pessoa', target: 'humano' },
    { id: 'p10', source: 'anotar-pedido', target: 'pedido-feito' },

    { id: 'h1', source: 'resposta-horario', target: 'mais-alguma' },
    { id: 'h2', source: 'mais-alguma', sourceHandle: 'pedido', target: 'itens' },
    { id: 'h3', source: 'mais-alguma', sourceHandle: 'cardapio', target: 'mandar-cardapio' },
    { id: 'h4', source: 'mais-alguma', sourceHandle: 'pessoa', target: 'humano' },
  ],
})
