import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * "Cadê meu pedido?" — a pergunta que mais chega em quem entrega alguma coisa.
 *
 * O desenho não finge saber o que não sabe: ele **coleta o número do pedido
 * antes de chamar gente**, porque a diferença entre um atendimento de trinta
 * segundos e um de cinco minutos é a pessoa já abrir a conversa com o número na
 * mão. Quem não tem o número responde o telefone da compra, que é o outro jeito
 * de achar.
 *
 * Quando existir credencial da loja, o bloco de Serviços externos entra entre a
 * pergunta e o aviso, e aí a resposta vem sozinha — o resto do desenho continua
 * igual.
 */
export const statusDoPedido: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Oi, {{nome}}! 👋 Vou te ajudar com o seu pedido.' },
        ],
      },
    },
    {
      id: 'tem-numero',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'Você tem o número do pedido aí?',
        salvarEm: 'tem_numero',
        opcoes: [
          { id: 'sim', rotulo: 'Tenho sim', valor: 'sim' },
          { id: 'nao', rotulo: 'Não tenho', valor: 'não' },
        ],
        timeoutMinutos: 120,
      },
    },
    {
      id: 'numero',
      type: 'pergunta',
      position: { x: -240, y: 320 },
      data: {
        texto: 'Perfeito. Me manda o número do pedido:',
        salvarEm: 'pedido',
        timeoutMinutos: 120,
      },
    },
    {
      id: 'telefone-da-compra',
      type: 'pergunta',
      position: { x: 240, y: 320 },
      data: {
        texto: 'Sem problema. Me manda o telefone usado na compra:',
        salvarEm: 'telefone_compra',
        formato: 'telefone',
        timeoutMinutos: 120,
      },
    },
    {
      id: 'registro',
      type: 'salvar-campo',
      position: { x: 0, y: 490 },
      data: { campo: 'resumo', valor: 'status do pedido {{pedido}} · tel {{telefone_compra}}' },
    },
    {
      id: 'aviso',
      type: 'mensagem',
      position: { x: 0, y: 630 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Já anotei. Vou chamar alguém do time para te dar a posição exata. Um instante! 🙌',
          },
        ],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 0, y: 770 },
      data: {
        motivo: 'quer o status do pedido',
        mensagens: ['Alguém do time assume daqui e já volta com a posição do seu pedido. 😊'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'tem-numero' },
    { id: 'e2', source: 'tem-numero', sourceHandle: 'sim', target: 'numero' },
    { id: 'e3', source: 'tem-numero', sourceHandle: 'nao', target: 'telefone-da-compra' },
    { id: 'e4', source: 'tem-numero', sourceHandle: 'timeout', target: 'humano' },
    { id: 'e5', source: 'numero', target: 'registro' },
    { id: 'e6', source: 'numero', sourceHandle: 'timeout', target: 'humano' },
    { id: 'e7', source: 'telefone-da-compra', target: 'registro' },
    { id: 'e8', source: 'telefone-da-compra', sourceHandle: 'timeout', target: 'humano' },
    { id: 'e9', source: 'registro', target: 'aviso' },
    { id: 'e10', source: 'aviso', target: 'humano' },
  ],
})
