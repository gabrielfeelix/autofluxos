import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Fluxo de exemplo, para o simulador ter o que rodar antes de existir banco e
 * editor. É **dado**, não código: quando o editor chegar, um fluxo assim vem de
 * `flow_versions.grafo` e este arquivo some.
 *
 * Ele é de propósito parecido com uma triagem de produtora de vídeo, e mostra o
 * ponto que mais importa no produto: **quem tem pressa vai direto para o
 * humano; quem está só pesquisando recebe uma faixa de preço e não ocupa o
 * tempo de ninguém.** É a Regra A da arquitetura, desenhada em nós.
 *
 * Repare que não tem nó de IA nenhum. Etapa 1 é automação pura.
 */
export const triagem: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        texto:
          'Oi! 👋 Sou o assistente virtual do estúdio. Faço 3 perguntas rápidas e já te passo para alguém do time.',
      },
    },
    {
      id: 'tipo',
      type: 'pergunta',
      position: { x: 0, y: 140 },
      data: {
        texto: 'Primeiro: que tipo de vídeo você procura?',
        salvarEm: 'tipo',
        opcoes: [
          { id: 'empresa', rotulo: 'Para empresa' },
          { id: 'casamento', rotulo: 'Casamento' },
          { id: 'outro', rotulo: 'Outro assunto' },
        ],
      },
    },
    {
      id: 'nome',
      type: 'pergunta',
      position: { x: -180, y: 300 },
      data: { texto: 'Perfeito! Como posso te chamar?', salvarEm: 'nome' },
    },
    {
      id: 'prazo',
      type: 'pergunta',
      position: { x: -180, y: 440 },
      data: {
        texto: 'Legal, {{nome}}. Para quando seria?',
        salvarEm: 'prazo',
        opcoes: [
          { id: 'agora', rotulo: 'Próximas semanas' },
          { id: 'meses', rotulo: 'Em 2 ou 3 meses' },
          { id: 'pesquisando', rotulo: 'Só pesquisando' },
        ],
      },
    },
    {
      id: 'so-pesquisando',
      type: 'condicao',
      position: { x: -180, y: 580 },
      data: { variavel: 'prazo', operador: 'igual', valor: 'Só pesquisando' },
    },

    // --- morno: recebe âncora de preço em vez de "depende" ---
    {
      id: 'faixa',
      type: 'mensagem',
      position: { x: 120, y: 720 },
      data: {
        texto:
          'Tranquilo, {{nome}}! Só para você ter uma referência: projetos de {{tipo}} costumam ficar entre R$ 4 mil e R$ 18 mil, dependendo de diárias, equipe e entregáveis.',
      },
    },
    {
      id: 'quer-falar',
      type: 'pergunta',
      position: { x: 120, y: 860 },
      data: {
        texto: 'Quer que alguém do time te chame para fechar um número certo?',
        salvarEm: 'quer_falar',
        opcoes: [
          { id: 'sim', rotulo: 'Quero sim' },
          { id: 'depois', rotulo: 'Depois eu chamo' },
        ],
      },
    },
    {
      id: 'despedida',
      type: 'mensagem',
      position: { x: 340, y: 1000 },
      data: { texto: 'Combinado, {{nome}}! Quando quiser é só chamar aqui. 👋' },
    },

    // --- quente: não enrola, passa para o humano ---
    {
      id: 'resumo',
      type: 'salvar-campo',
      position: { x: -420, y: 720 },
      data: { campo: 'resumo', valor: '{{nome}} · {{tipo}} · {{prazo}}' },
    },
    {
      id: 'aviso',
      type: 'mensagem',
      position: { x: -420, y: 860 },
      data: { texto: 'Show, {{nome}}! Já estou chamando alguém do time aqui. 🙌' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: -180, y: 1140 },
      data: {
        motivo: 'lead qualificado · {{tipo}} · {{prazo}}',
        mensagem: 'Prontinho! Alguém do time assume a conversa a partir daqui. 😊',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'tipo' },
    { id: 'e2', source: 'tipo', sourceHandle: 'empresa', target: 'nome' },
    { id: 'e3', source: 'tipo', sourceHandle: 'casamento', target: 'nome' },
    { id: 'e4', source: 'tipo', sourceHandle: 'outro', target: 'humano' },
    { id: 'e5', source: 'nome', target: 'prazo' },
    { id: 'e6', source: 'prazo', sourceHandle: 'agora', target: 'so-pesquisando' },
    { id: 'e7', source: 'prazo', sourceHandle: 'meses', target: 'so-pesquisando' },
    { id: 'e8', source: 'prazo', sourceHandle: 'pesquisando', target: 'so-pesquisando' },
    { id: 'e9', source: 'so-pesquisando', sourceHandle: 'verdadeiro', target: 'faixa' },
    { id: 'e10', source: 'so-pesquisando', sourceHandle: 'falso', target: 'resumo' },
    { id: 'e11', source: 'faixa', target: 'quer-falar' },
    { id: 'e12', source: 'quer-falar', sourceHandle: 'sim', target: 'humano' },
    { id: 'e13', source: 'quer-falar', sourceHandle: 'depois', target: 'despedida' },
    { id: 'e14', source: 'resumo', target: 'aviso' },
    { id: 'e15', source: 'aviso', target: 'humano' },
  ],
})
