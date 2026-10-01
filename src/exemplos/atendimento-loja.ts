import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O atendimento de loja virtual inteiro, num fluxo só: o que a PCYES levou
 * nove fluxos e uma semana de produção para acertar (setembro de 2026).
 *
 * O que veio de lá, cada coisa de um erro visto em conversa real:
 *
 * - **O menu entende texto.** Quem escreve "o software do mouse está com
 *   defeito" em vez de tocar numa opção ganhava o menu de novo. Agora uma IA
 *   curta lê, entende o assunto e leva ao ramo certo, sem resolver nada.
 * - **Reclamação vai para a equipe.** "Suporte não responde" voltava ao menu.
 * - **A IA de vendas não lista o que o card já mostra**, pergunta uma coisa por
 *   vez e não pergunta o que a pessoa já disse. Cada volta é uma mensagem
 *   cobrada pela Meta desde 01/out/2026.
 * - **Cada IA sabe sair do próprio assunto.** Quem está comprando e pergunta do
 *   pedido vai para o pedido, em vez de a IA de vendas improvisar um rastreio.
 * - **Garantia e defeito ficam no mesmo número**, como triagem: o bot coleta o
 *   que a equipe precisa (o que aconteceu, o pedido, uma foto se tiver) e
 *   passa. Loja que atende suporte em outro número troca este ramo por um
 *   bloco Encaminhar, como a PCYES fez.
 *
 * Preço, Pix, cupom, prazo e garantia **não estão escritos aqui**: vêm da
 * ficha da loja (SOBRE A EMPRESA). O fluxo é o mesmo para toda loja; o que
 * muda de uma para outra é a ficha.
 */

const SAIR_DO_ASSUNTO = (assuntos: string) =>
  `OUTRO ASSUNTO: se a pessoa trouxer um assunto que não é este, não tente resolver aqui. Escreva uma frase curta de transição, como "Certo, vou te direcionar.", e chame concluir_conversa com o resumo sendo só uma destas palavras: ${assuntos}.\n` +
  'FIM: quando a pessoa disser que não precisa de mais nada, agradecer ou se despedir, despeça-se em uma frase e chame concluir_conversa com o resumo fim.\n' +
  'TOM: natural e profissional, frases curtas. Não termine toda mensagem com pergunta: pergunte só quando precisar de uma informação para avançar, uma por vez.'

const ASSUNTOS = {
  compra: 'compra (quer comprar, escolher, comparar, saber preço, estoque ou se um produto serve)',
  pedido: 'pedido (pedido já feito, pagamento, entrega, rastreio, nota fiscal, cancelamento)',
  garantia: 'garantia (defeito, produto que parou de funcionar, troca, devolução, garantia, peça de reposição)',
  equipe: 'equipe (pediu para falar com uma pessoa, reclamação, compra para empresa, assunto que não é nenhum dos outros)',
}

/** As saídas de uma IA para os outros ramos, na ordem em que são testadas. */
function rotas(prefixo: string, de: 'compra' | 'pedido' | 'triagem', y: number) {
  const destinos = [
    ...(de === 'compra' ? [] : [{ assunto: 'compra', alvo: 'vendedor' }]),
    ...(de === 'pedido' ? [] : [{ assunto: 'pedido', alvo: 'numero' }]),
    { assunto: 'garantia', alvo: 'garantia-tipo' },
    { assunto: 'equipe', alvo: 'equipe' },
  ]
  const nos = destinos.map((d, i) => ({
    id: `${prefixo}-rota-${d.assunto}`,
    type: 'condicao' as const,
    position: { x: 620 + i * 260, y },
    data: { variavel: 'assunto_ia', operador: 'contem' as const, valor: d.assunto },
  }))
  const arestas = destinos.flatMap((d, i) => [
    { id: `${prefixo}-v-${d.assunto}`, source: nos[i]!.id, sourceHandle: 'verdadeiro', target: d.alvo },
    {
      id: `${prefixo}-f-${d.assunto}`,
      source: nos[i]!.id,
      sourceHandle: 'falso',
      target: nos[i + 1]?.id ?? 'fim',
    },
  ])
  return { nos, arestas, primeira: nos[0]!.id }
}

const daTriagem = rotas('triagem', 'triagem', 0)
const daCompra = rotas('compra', 'compra', 300)
const doPedido = rotas('pedido', 'pedido', 600)

export const atendimentoLoja: Fluxo = fluxoSchema.parse({
  inicio: 'menu',
  nodes: [
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 0 },
      data: {
        texto: 'Olá, {{nome}}! Como posso ajudar?',
        salvarEm: 'assunto',
        entendeTextoLivre: true,
        opcoes: [
          { id: 'comprar', rotulo: 'Quero comprar' },
          { id: 'pedido', rotulo: 'Meu pedido' },
          { id: 'garantia', rotulo: 'Troca ou garantia' },
          { id: 'equipe', rotulo: 'Falar com a equipe' },
        ],
      },
    },
    {
      id: 'triagem',
      type: 'ia',
      position: { x: 300, y: 0 },
      data: {
        instrucao:
          'A pessoa escreveu em vez de escolher uma opção do menu. Leia a mensagem dela e a conversa até aqui.\n' +
          'Seu único trabalho é entender o assunto e levar ao ramo certo. Não resolva o assunto aqui, não indique produto, não peça dado.\n' +
          `Os assuntos:\n- ${ASSUNTOS.compra};\n- ${ASSUNTOS.pedido};\n- ${ASSUNTOS.garantia};\n- ${ASSUNTOS.equipe}.\n` +
          'Se der para saber o assunto, chame concluir_conversa com o resumo sendo só a palavra do assunto, e escreva como fechamento uma frase curta que mostre que entendeu (ex.: "Entendi, é sobre o defeito do produto."). Não pergunte nada nesse caso.\n' +
          'Se for agradecimento, confirmação ou despedida ("obrigado", "ok", "valeu"), responda em uma frase cordial, sem pergunta, e chame concluir_conversa com o resumo fim.\n' +
          'Se for só um cumprimento ou não der para saber, responda em uma frase perguntando como pode ajudar, com exemplos curtos (comprar um produto, acompanhar um pedido, troca ou garantia). Uma pergunta só.',
        salvarEm: 'ultima_resposta',
        conversar: { maxTurnos: 4, concluir: { salvarEm: 'assunto_ia' } },
        ferramentas: [],
      },
    },
    ...daTriagem.nos,

    /* Comprar */
    {
      id: 'procura',
      type: 'pergunta',
      position: { x: 0, y: 300 },
      data: {
        texto: 'Certo! Me conta o que você procura e para que vai usar, que eu indico as melhores opções.',
        salvarEm: 'pergunta',
      },
    },
    {
      id: 'vendedor',
      type: 'ia',
      position: { x: 300, y: 300 },
      data: {
        instrucao:
          'Você é o vendedor da loja no WhatsApp: simpático, direto e profissional.\n' +
          'ENTENDA ANTES DE INDICAR: saiba para que a pessoa vai usar e, se fizer diferença, quanto pretende investir. Pergunte o que faltar, uma coisa por vez; o que ela já disse, não pergunte de novo. Se ela não quiser falar de preço, siga sem.\n' +
          'MOSTRE POUCO E CERTO: com o uso, busque com loja_buscar e chame loja_mostrar com os 2 que melhor atendem. Os cards já trazem nome, preço e botão: no texto não liste os produtos, escreva uma ou duas frases dizendo por que eles servem. Mostre outros só se a pessoa pedir.\n' +
          'Como buscar: se a pessoa citar um modelo, busque pelo modelo. Sem modelo, busque pela categoria em poucas palavras e escolha nos resultados os que têm o atributo pedido. Nunca diga que a loja não tem um modelo sem antes buscar pelo nome dele.\n' +
          'Dúvida técnica, compatibilidade ou diferença entre produtos: consulte loja_detalhes antes de responder.\n' +
          'SEM ESTOQUE: produto com emEstoque falso existe na loja, só está em falta. Diga isso, mande o card e ofereça até 2 alternativas em estoque, se fizer sentido.\n' +
          'Quando a pessoa escolher um produto, sugira um complemento com loja_combina_com, uma vez só. A compra é feita pelo botão do card, na loja on-line.\n' +
          'Pagamento, Pix, cupom, frete e prazo: só o que estiver em SOBRE A EMPRESA. Nunca invente produto, preço, estoque, desconto ou prazo.\n' +
          SAIR_DO_ASSUNTO(`${ASSUNTOS.pedido}; ${ASSUNTOS.garantia}; ${ASSUNTOS.equipe}`),
        salvarEm: 'ultima_resposta',
        conversar: { maxTurnos: 20, concluir: { salvarEm: 'assunto_ia' } },
        ferramentas: ['loja_buscar', 'loja_mostrar', 'loja_combina_com', 'loja_detalhes'],
      },
    },
    ...daCompra.nos,

    /* Meu pedido */
    {
      id: 'numero',
      type: 'pergunta',
      position: { x: 0, y: 600 },
      data: {
        texto: 'Me envie o número do pedido ou o CPF usado na compra, que eu confiro agora.',
        salvarEm: 'pedido_ou_cpf',
      },
    },
    {
      id: 'consulta',
      type: 'ia',
      position: { x: 300, y: 600 },
      data: {
        instrucao:
          'A pessoa quer saber do pedido e mandou: {{pedido_ou_cpf}}. Se for um número de pedido, consulte loja_pedido com numero; se for um CPF (11 dígitos, com ou sem pontos), consulte com documento e numero vazio. Se encontrar, diga em poucas linhas a situação, os itens e, se vier entrega, a transportadora, a última movimentação e a previsão; mande o código ou link de rastreio se houver. Se vier encontrado falso com o número, peça o CPF da compra e consulte de novo com os dois. Se vier falso só com o CPF, peça o número do pedido (está no e-mail de confirmação). Se mesmo assim não achar, diga que não conseguiu localizar e chame concluir_conversa com o resumo equipe. Nunca invente situação, prazo ou data de entrega.\n' +
          SAIR_DO_ASSUNTO(`${ASSUNTOS.compra}; ${ASSUNTOS.garantia}; ${ASSUNTOS.equipe}`),
        salvarEm: 'ultima_resposta',
        conversar: { maxTurnos: 20, concluir: { salvarEm: 'assunto_ia' } },
        ferramentas: ['loja_pedido'],
      },
    },
    ...doPedido.nos,

    /* Troca ou garantia: triagem no mesmo número */
    {
      id: 'garantia-tipo',
      type: 'pergunta',
      position: { x: 0, y: 900 },
      data: {
        texto: 'Certo! O que aconteceu?',
        salvarEm: 'tipo_garantia',
        opcoes: [
          { id: 'defeito', rotulo: 'Produto com defeito' },
          { id: 'errado', rotulo: 'Chegou errado' },
          { id: 'desisti', rotulo: 'Desisti da compra' },
        ],
        timeoutMinutos: 240,
      },
    },
    {
      id: 'garantia-pedido',
      type: 'pergunta',
      position: { x: 0, y: 1050 },
      data: {
        texto: 'Qual o número do pedido? Se não tiver em mãos, escreva "não tenho".',
        salvarEm: 'pedido_garantia',
        timeoutMinutos: 240,
      },
    },
    {
      id: 'garantia-descricao',
      type: 'pergunta',
      position: { x: 0, y: 1200 },
      data: {
        texto: 'Qual é o produto e o que aconteceu com ele?',
        salvarEm: 'descricao_garantia',
        timeoutMinutos: 240,
      },
    },
    {
      id: 'garantia-foto',
      type: 'pergunta',
      position: { x: 0, y: 1350 },
      data: {
        texto: 'Se puder, envie uma foto ou vídeo do produto. Se não tiver, escreva "não tenho".',
        salvarEm: 'foto_resposta',
        aceitaMidia: true,
        salvarMidiaEm: 'foto_garantia',
        timeoutMinutos: 240,
      },
    },
    {
      id: 'garantia-registro',
      type: 'nota',
      position: { x: 0, y: 1500 },
      data: {
        texto:
          'Troca ou garantia\nMotivo: {{tipo_garantia}}\nPedido: {{pedido_garantia}}\nDescrição: {{descricao_garantia}}\nFoto ou vídeo: {{foto_garantia}}',
      },
    },
    {
      id: 'garantia-equipe',
      type: 'handoff',
      position: { x: 0, y: 1650 },
      data: {
        motivo: 'troca ou garantia · {{tipo_garantia}}',
        mensagens: [
          'Registrado, {{nome}}. Nossa equipe de pós-venda analisa e responde por aqui com os próximos passos.',
        ],
      },
    },

    /* Equipe */
    {
      id: 'equipe',
      type: 'handoff',
      position: { x: 900, y: 900 },
      data: {
        motivo: 'a pessoa pediu a equipe',
        mensagens: ['Certo! Um especialista da nossa equipe continua seu atendimento por aqui.'],
      },
    },
    {
      id: 'fim',
      type: 'nota',
      position: { x: 1400, y: 900 },
      data: { texto: 'A IA encerrou a conversa ({{assunto_ia}}).' },
    },
  ],
  edges: [
    { id: 'e-menu-comprar', source: 'menu', sourceHandle: 'comprar', target: 'procura' },
    { id: 'e-menu-pedido', source: 'menu', sourceHandle: 'pedido', target: 'numero' },
    { id: 'e-menu-garantia', source: 'menu', sourceHandle: 'garantia', target: 'garantia-tipo' },
    { id: 'e-menu-equipe', source: 'menu', sourceHandle: 'equipe', target: 'equipe' },
    { id: 'e-menu-livre', source: 'menu', sourceHandle: 'texto-livre', target: 'triagem' },
    { id: 'e-triagem', source: 'triagem', sourceHandle: 'concluido', target: daTriagem.primeira },
    ...daTriagem.arestas,

    { id: 'e-procura', source: 'procura', target: 'vendedor' },
    { id: 'e-vendedor', source: 'vendedor', sourceHandle: 'concluido', target: daCompra.primeira },
    ...daCompra.arestas,

    { id: 'e-numero', source: 'numero', target: 'consulta' },
    { id: 'e-consulta', source: 'consulta', sourceHandle: 'concluido', target: doPedido.primeira },
    ...doPedido.arestas,

    { id: 'e-g-defeito', source: 'garantia-tipo', sourceHandle: 'defeito', target: 'garantia-pedido' },
    { id: 'e-g-errado', source: 'garantia-tipo', sourceHandle: 'errado', target: 'garantia-pedido' },
    { id: 'e-g-desisti', source: 'garantia-tipo', sourceHandle: 'desisti', target: 'garantia-pedido' },
    { id: 'e-g-pedido', source: 'garantia-pedido', target: 'garantia-descricao' },
    { id: 'e-g-descricao', source: 'garantia-descricao', target: 'garantia-foto' },
    { id: 'e-g-foto', source: 'garantia-foto', target: 'garantia-registro' },
    { id: 'e-g-foto-midia', source: 'garantia-foto', sourceHandle: 'midia', target: 'garantia-registro' },
    { id: 'e-g-registro', source: 'garantia-registro', target: 'garantia-equipe' },
  ],
})
