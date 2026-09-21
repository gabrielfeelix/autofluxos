import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Pesquisa de satisfação depois do atendimento (NPS).
 *
 * A regra que faz esta pesquisa valer alguma coisa: **nota baixa não recebe
 * agradecimento, recebe gente.** Pesquisa que responde "obrigado pelo seu
 * feedback!" a quem deu nota 3 é o jeito mais eficiente de transformar um
 * cliente irritado em um cliente perdido, e a reclamação some numa planilha.
 *
 * Nota alta vira pedido de avaliação pública, que é onde a pesquisa se paga; e
 * o pedido só aparece para quem já disse que gostou.
 *
 * **Isto já foi cinco blocos**, a pergunta, duas condições, o Guardar e o
 * caminho de cada faixa, e a nota terminava em `contacts.campos`, que
 * sobrescreve: dava para perguntar, não dava para ter o número (0060). O bloco
 * de pesquisa faz a mesma conversa e guarda a nota com data, que é o que
 * permite comparar um mês com o outro.
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
      type: 'nps',
      position: { x: 0, y: 150 },
      data: {
        texto: 'De 0 a 10, o quanto você recomendaria a gente para um amigo?',
        salvarEm: 'nota',
        /*
         * A pergunta aberta sai para **todo mundo**, e não só para quem
         * reclamou, é o que o bloco faz, e é melhor assim: quem deu 10 tem
         * elogio para dar, e elogio é o que a equipe lê quando precisa.
         *
         * Quem não quiser responder simplesmente não responde; a nota já está
         * guardada.
         */
        perguntaAberta: 'Conta rapidinho o porquê dessa nota?',
        comentarioEm: 'motivo',
        timeoutMinutos: 1440,
      },
    },

    {
      id: 'obrigado',
      type: 'mensagem',
      position: { x: -300, y: 400 },
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
      position: { x: 60, y: 400 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Obrigado pela sinceridade, {{nome}}. Anotado aqui, a gente melhora com isso. 🙏',
          },
        ],
      },
    },

    {
      id: 'humano',
      type: 'handoff',
      position: { x: 420, y: 400 },
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
    { id: 'e2', source: 'nota', sourceHandle: 'promotor', target: 'obrigado' },
    { id: 'e3', source: 'nota', sourceHandle: 'neutro', target: 'neutro' },
    { id: 'e4', source: 'nota', sourceHandle: 'detrator', target: 'humano' },
    // Sem resposta a pesquisa simplesmente acaba: insistir com quem não quis
    // responder é o começo do bloqueio. Sem esta aresta o desfecho seria o
    // mesmo, o bloco encerra em silêncio , mas desenhada ela diz isso a quem
    // lê o fluxo, em vez de deixar a saída solta parecendo esquecimento.
    { id: 'e5', source: 'nota', sourceHandle: 'timeout', target: 'neutro' },
  ],
})
