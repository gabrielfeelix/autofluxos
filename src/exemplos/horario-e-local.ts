import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Horário e localização, com botões (PLANO-NICHOS 4.5, comércio de rua).
 *
 * O primo curto do menu de dúvidas, feito para quem vende no balcão: as três
 * perguntas que decidem se a pessoa sai de casa (abre agora? onde fica? entrega
 * aqui?) e a saída para alguém da loja. Não precisa de IA nem de catálogo, e
 * por isso serve de primeiro bot para qualquer loja, publicado no mesmo dia.
 *
 * As mesmas duas regras do menu de dúvidas: toda resposta volta ao menu, e
 * "Falar com alguém" está sempre à vista.
 */
export const horarioELocal: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Oi, {{nome}}! 👋 Aqui vai tudo para você achar a gente.' },
        ],
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'O que você quer saber?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'horario', rotulo: 'Horário', valor: 'horario' },
          { id: 'endereco', rotulo: 'Como chegar', valor: 'endereco' },
          { id: 'entrega', rotulo: 'Faz entrega?', valor: 'entrega' },
          { id: 'pessoa', rotulo: 'Falar com alguém', valor: 'pessoa' },
        ],
        timeoutMinutos: 30,
      },
    },
    {
      id: 'resposta-horario',
      type: 'mensagem',
      position: { x: -420, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Horário*\nSegunda a sexta, das 8h às 18h.\nSábado, das 8h às 12h.\nDomingo e feriado, fechado.\n\n_Troque este texto pelo seu horário._',
          },
        ],
      },
    },
    {
      id: 'resposta-endereco',
      type: 'mensagem',
      position: { x: -140, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Onde estamos*\nRua Exemplo, 123, bairro, cidade.\nPertinho da praça.\n\nNo mapa: *cole aqui o link do Google Maps*',
          },
        ],
      },
    },
    {
      id: 'resposta-entrega',
      type: 'mensagem',
      position: { x: 140, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Entrega*\nEntregamos no bairro e arredores, com taxa de R$ 000.\n\n_Troque este texto pela sua regra de entrega, ou tire este botão se a loja não entrega._',
          },
        ],
      },
    },
    {
      id: 'mais-alguma',
      type: 'pergunta',
      position: { x: -140, y: 480 },
      data: {
        texto: 'Posso ajudar em mais alguma coisa?',
        salvarEm: 'quer_mais',
        opcoes: [
          { id: 'menu', rotulo: 'Ver o menu de novo', valor: 'menu' },
          { id: 'pessoa', rotulo: 'Falar com alguém', valor: 'pessoa' },
          { id: 'nao', rotulo: 'Era só isso 🙂', valor: 'nao' },
        ],
      },
    },
    {
      id: 'voltar-ao-menu',
      type: 'voltar',
      position: { x: -420, y: 640 },
      data: { destino: 'menu', rotulo: 'O que você quer saber?' },
    },
    {
      id: 'despedida',
      type: 'mensagem',
      position: { x: 140, y: 640 },
      data: {
        partes: [{ tipo: 'texto', texto: 'Combinado, {{nome}}! Te esperamos por aqui. 👋' }],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 420, y: 480 },
      data: {
        motivo: 'quer falar com a loja · {{assunto}}',
        mensagens: ['Já chamei alguém da loja. Só um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'menu' },
    { id: 'e2', source: 'menu', sourceHandle: 'horario', target: 'resposta-horario' },
    { id: 'e3', source: 'menu', sourceHandle: 'endereco', target: 'resposta-endereco' },
    { id: 'e4', source: 'menu', sourceHandle: 'entrega', target: 'resposta-entrega' },
    { id: 'e5', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
    // Sem resposta, ninguém fica esperando: a conversa vai para uma pessoa.
    { id: 'e6', source: 'menu', sourceHandle: 'timeout', target: 'humano' },
    { id: 'e7', source: 'resposta-horario', target: 'mais-alguma' },
    { id: 'e8', source: 'resposta-endereco', target: 'mais-alguma' },
    { id: 'e9', source: 'resposta-entrega', target: 'mais-alguma' },
    { id: 'e10', source: 'mais-alguma', sourceHandle: 'menu', target: 'voltar-ao-menu' },
    { id: 'e11', source: 'mais-alguma', sourceHandle: 'pessoa', target: 'humano' },
    { id: 'e12', source: 'mais-alguma', sourceHandle: 'nao', target: 'despedida' },
  ],
})
