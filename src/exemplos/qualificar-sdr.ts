import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Qualificação de lead antes de ocupar o time comercial (SDR).
 *
 * O que este desenho resolve não é falar bonito: é **separar quem compra agora
 * de quem está pesquisando**, sem que ninguém do time gaste meia hora para
 * descobrir isso. Quem tem orçamento e prazo vai para uma pessoa com o resumo
 * pronto; quem está começando a pesquisar recebe material e um "chama quando
 * quiser", que é o desfecho honesto.
 *
 * `resumo` existe para quem assume a conversa ler **uma linha** em vez de rolar
 * o histórico: nome, o que precisa, para quando e quanto pretende investir.
 */
export const qualificarSdr: Fluxo = fluxoSchema.parse({
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
              'Oi! 👋 Que bom que você chamou. Faço *três perguntas rápidas* para já te passar para a pessoa certa.',
          },
        ],
      },
    },
    {
      id: 'nome',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: { texto: 'Como posso te chamar?', salvarEm: 'nome' },
    },
    {
      id: 'necessidade',
      type: 'pergunta',
      position: { x: 0, y: 290 },
      data: {
        texto: 'Prazer, {{nome}}! O que você está buscando?',
        salvarEm: 'necessidade',
        opcoes: [
          { id: 'comecar', rotulo: 'Começar do zero', valor: 'começar do zero' },
          { id: 'trocar', rotulo: 'Trocar o que já uso', valor: 'trocar de fornecedor' },
          { id: 'entender', rotulo: 'Só entendendo', valor: 'só entendendo' },
        ],
      },
    },
    {
      id: 'prazo',
      type: 'pergunta',
      position: { x: -220, y: 440 },
      data: {
        texto: 'Para quando você precisa disso funcionando?',
        salvarEm: 'prazo',
        opcoes: [
          { id: 'agora', rotulo: 'Este mês', valor: 'este mês' },
          { id: 'trimestre', rotulo: 'Nos próximos 3 meses', valor: 'em 3 meses' },
          { id: 'sem-data', rotulo: 'Ainda sem data', valor: 'sem data' },
        ],
      },
    },
    {
      id: 'orcamento',
      type: 'pergunta',
      position: { x: -220, y: 590 },
      data: {
        texto: 'E quanto você pretende investir por mês? (só o número, em reais)',
        salvarEm: 'orcamento',
        formato: 'numero',
      },
    },
    {
      id: 'tem-verba',
      type: 'condicao',
      position: { x: -220, y: 740 },
      data: { variavel: 'orcamento', operador: 'maior', valor: '499' },
    },

    {
      id: 'resumo',
      type: 'salvar-campo',
      position: { x: -460, y: 890 },
      data: {
        campo: 'resumo',
        valor: '{{nome}} · {{necessidade}} · {{prazo}} · R$ {{orcamento}}/mês',
      },
    },
    {
      id: 'aviso',
      type: 'mensagem',
      position: { x: -460, y: 1030 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Perfeito, {{nome}}. Já estou chamando alguém do time — a pessoa entra na conversa sabendo do seu caso. 🙌',
          },
        ],
      },
    },

    {
      id: 'material',
      type: 'mensagem',
      position: { x: 20, y: 890 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Show, {{nome}}! Como ainda está no começo, te mando o material que explica tudo: *cole aqui o link*.\n\nQuando quiser falar com alguém, é só responder por aqui. 😉',
          },
        ],
      },
    },
    {
      id: 'quer-falar',
      type: 'pergunta',
      position: { x: 20, y: 1030 },
      data: {
        texto: 'Quer que alguém do time te chame mesmo assim?',
        salvarEm: 'quer_falar',
        opcoes: [
          { id: 'sim', rotulo: 'Quero sim', valor: 'sim' },
          { id: 'depois', rotulo: 'Depois eu chamo', valor: 'depois' },
        ],
      },
    },
    {
      id: 'despedida',
      type: 'mensagem',
      position: { x: 300, y: 1180 },
      data: {
        partes: [{ tipo: 'texto', texto: 'Combinado! Fico por aqui, {{nome}}. 👋' }],
      },
    },

    {
      id: 'humano',
      type: 'handoff',
      position: { x: -220, y: 1320 },
      data: {
        motivo: 'lead qualificado · {{necessidade}} · {{prazo}}',
        mensagens: ['Prontinho! Alguém do time assume a conversa a partir daqui. 😊'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'nome' },
    { id: 'e2', source: 'nome', target: 'necessidade' },
    { id: 'e3', source: 'necessidade', sourceHandle: 'comecar', target: 'prazo' },
    { id: 'e4', source: 'necessidade', sourceHandle: 'trocar', target: 'prazo' },
    // Quem só quer entender não passa por orçamento: perguntar preço a quem
    // está pesquisando é o jeito mais rápido de encerrar a conversa.
    { id: 'e5', source: 'necessidade', sourceHandle: 'entender', target: 'material' },
    { id: 'e6', source: 'prazo', sourceHandle: 'agora', target: 'orcamento' },
    { id: 'e7', source: 'prazo', sourceHandle: 'trimestre', target: 'orcamento' },
    { id: 'e8', source: 'prazo', sourceHandle: 'sem-data', target: 'material' },
    { id: 'e9', source: 'orcamento', target: 'tem-verba' },
    { id: 'e10', source: 'tem-verba', sourceHandle: 'verdadeiro', target: 'resumo' },
    { id: 'e11', source: 'tem-verba', sourceHandle: 'falso', target: 'material' },
    { id: 'e12', source: 'resumo', target: 'aviso' },
    { id: 'e13', source: 'aviso', target: 'humano' },
    { id: 'e14', source: 'material', target: 'quer-falar' },
    { id: 'e15', source: 'quer-falar', sourceHandle: 'sim', target: 'humano' },
    { id: 'e16', source: 'quer-falar', sourceHandle: 'depois', target: 'despedida' },
  ],
})
