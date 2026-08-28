import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Pesquisa de satisfação depois do atendimento (NPS).
 *
 * A regra que faz esta pesquisa valer alguma coisa: **nota baixa não recebe
 * agradecimento, recebe gente.** Pesquisa que responde "obrigado pelo seu
 * feedback!" a quem deu nota 3 é o jeito mais eficiente de transformar um
 * cliente irritado em um cliente perdido — e a reclamação some numa planilha.
 *
 * Nota alta vira pedido de avaliação pública, que é onde a pesquisa se paga; e
 * o pedido só aparece para quem já disse que gostou.
 */
export const pesquisaNps: Fluxo = fluxoSchema.parse({
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
            texto: 'Oi, {{nome}}! Uma pergunta só, prometo. 🙏',
          },
        ],
      },
    },
    {
      id: 'nota',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'De 0 a 10, o quanto você recomendaria a gente para um amigo?',
        salvarEm: 'nota',
        formato: 'numero',
        timeoutMinutos: 1440,
      },
    },
    {
      id: 'promotor',
      type: 'condicao',
      position: { x: 0, y: 300 },
      data: { variavel: 'nota', operador: 'maior', valor: '8' },
    },
    {
      id: 'detrator',
      type: 'condicao',
      position: { x: 280, y: 450 },
      data: { variavel: 'nota', operador: 'menor', valor: '7' },
    },

    {
      id: 'obrigado',
      type: 'mensagem',
      position: { x: -300, y: 450 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Que alegria, {{nome}}! 🧡 Se sobrar um minuto, deixa essa nota no Google? Ajuda demais: *cole aqui o link da sua página*.',
          },
        ],
      },
    },
    {
      id: 'neutro',
      type: 'mensagem',
      position: { x: 560, y: 600 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Obrigado pela sinceridade, {{nome}}. Anotado aqui — a gente melhora com isso. 🙏',
          },
        ],
      },
    },

    {
      id: 'o-que-faltou',
      type: 'pergunta',
      position: { x: 60, y: 600 },
      data: {
        texto: 'Poxa. O que faltou para ser uma boa experiência?',
        salvarEm: 'reclamacao',
        timeoutMinutos: 1440,
      },
    },
    {
      id: 'registro',
      type: 'salvar-campo',
      position: { x: 60, y: 750 },
      data: { campo: 'resumo', valor: 'NPS {{nota}} · {{reclamacao}}' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 60, y: 900 },
      data: {
        motivo: 'nota baixa na pesquisa · {{nota}}',
        mensagens: [
          'Obrigado por contar, {{nome}}. Isso não vai ficar só numa planilha: já estou chamando alguém do time para resolver com você.',
        ],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'nota' },
    { id: 'e2', source: 'nota', target: 'promotor' },
    // Sem resposta a pesquisa simplesmente acaba: insistir com quem não quis
    // responder é o começo do bloqueio.
    { id: 'e3', source: 'nota', sourceHandle: 'timeout', target: 'neutro' },
    { id: 'e4', source: 'promotor', sourceHandle: 'verdadeiro', target: 'obrigado' },
    { id: 'e5', source: 'promotor', sourceHandle: 'falso', target: 'detrator' },
    { id: 'e6', source: 'detrator', sourceHandle: 'verdadeiro', target: 'o-que-faltou' },
    { id: 'e7', source: 'detrator', sourceHandle: 'falso', target: 'neutro' },
    { id: 'e8', source: 'o-que-faltou', target: 'registro' },
    { id: 'e9', source: 'o-que-faltou', sourceHandle: 'timeout', target: 'registro' },
    { id: 'e10', source: 'registro', target: 'humano' },
  ],
})
