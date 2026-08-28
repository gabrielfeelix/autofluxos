import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Lembrete de pagamento, escrito para não parecer cobrança de banco.
 *
 * O ponto do desenho é a ordem das opções: **"já paguei" vem primeiro.** Quem
 * pagou ontem e recebe uma cobrança hoje fica irritado com razão, e o único
 * jeito de não errar com essa pessoa é deixar o desmentido dela à mão — e
 * mandar a conversa direto para uma pessoa conferir, sem discutir com robô.
 *
 * "Quero negociar" também não passa por script: proposta de parcelamento é
 * decisão de quem cobra, não de um fluxo.
 */
export const cobrancaAmigavel: Fluxo = fluxoSchema.parse({
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
              'Oi, {{nome}}! Passando para lembrar de uma parcela em aberto por aqui. Nada de grave — só para você não perder o prazo. 🙂',
          },
        ],
      },
    },
    {
      id: 'como-seguir',
      type: 'pergunta',
      position: { x: 0, y: 160 },
      data: {
        texto: 'Como você prefere seguir?',
        salvarEm: 'escolha_cobranca',
        opcoes: [
          { id: 'paguei', rotulo: 'Já paguei', valor: 'já pagou' },
          { id: 'segunda-via', rotulo: 'Quero a 2ª via', valor: '2ª via' },
          { id: 'negociar', rotulo: 'Quero negociar', valor: 'negociar' },
        ],
        timeoutMinutos: 1440,
      },
    },
    {
      id: 'link',
      type: 'mensagem',
      position: { x: -240, y: 330 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Claro! Aqui está o link para pagar: *cole aqui o link ou o Pix*.\n\nAssim que o pagamento cair, some daqui automaticamente.',
          },
        ],
      },
    },
    {
      id: 'confirma',
      type: 'pergunta',
      position: { x: -240, y: 480 },
      data: {
        texto: 'Conseguiu abrir o link?',
        salvarEm: 'abriu_link',
        opcoes: [
          { id: 'sim', rotulo: 'Consegui', valor: 'sim' },
          { id: 'nao', rotulo: 'Deu problema', valor: 'não' },
        ],
        timeoutMinutos: 1440,
      },
    },
    {
      id: 'agradece',
      type: 'mensagem',
      position: { x: -480, y: 640 },
      data: {
        partes: [{ tipo: 'texto', texto: 'Obrigado, {{nome}}! Qualquer coisa é só chamar. 🧡' }],
      },
    },
    {
      id: 'registro',
      type: 'salvar-campo',
      position: { x: 240, y: 330 },
      data: { campo: 'resumo', valor: 'cobrança · {{escolha_cobranca}}' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 60, y: 800 },
      data: {
        motivo: 'financeiro · {{escolha_cobranca}}',
        mensagens: ['Já estou chamando alguém do financeiro para resolver com você. 🙌'],
      },
    },
  ],
  edges: [
    // "Já paguei" e "negociar" não discutem com robô: vão para uma pessoa.
    { id: 'e1', source: 'abertura', target: 'como-seguir' },
    { id: 'e2', source: 'como-seguir', sourceHandle: 'paguei', target: 'registro' },
    { id: 'e3', source: 'como-seguir', sourceHandle: 'negociar', target: 'registro' },
    { id: 'e4', source: 'como-seguir', sourceHandle: 'segunda-via', target: 'link' },
    { id: 'e5', source: 'como-seguir', sourceHandle: 'timeout', target: 'agradece' },
    { id: 'e6', source: 'link', target: 'confirma' },
    { id: 'e7', source: 'confirma', sourceHandle: 'sim', target: 'agradece' },
    { id: 'e8', source: 'confirma', sourceHandle: 'nao', target: 'registro' },
    { id: 'e9', source: 'confirma', sourceHandle: 'timeout', target: 'agradece' },
    { id: 'e10', source: 'registro', target: 'humano' },
  ],
})
