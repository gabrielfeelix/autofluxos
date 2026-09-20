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
 *
 * ---------------------------------------------------------------------------
 * O que este modelo não decide pela empresa
 * ---------------------------------------------------------------------------
 *
 * **O valor mínimo de orçamento.** O bloco `tem-verba` compara com `0`, que não
 * filtra ninguém, porque um modelo não tem como saber quanto vale um cliente
 * para quem vai usá-lo. Aqui havia `499`, um número que ninguém escolheu, e que
 * virava política real de toda conta que copiasse o modelo. É a RB-22.
 *
 * **Quem é qualificado.** Há dois nós de handoff, e não um: quem passou pelos
 * critérios sai por `humano`, e quem apenas pediu para falar com alguém sai por
 * `humano-a-pedido`. Eram o mesmo nó, rotulado `lead qualificado`, e por isso
 * pedir ajuda emitia qualificação positiva por consequência. É a RB-21.
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
      /*
       * **O valor é `0`, e isso é deliberado.**
       *
       * Aqui havia `499`, um número que ninguém escolheu: não saiu de pesquisa,
       * de preço de tabela nem de conversa com cliente. Como este fluxo é
       * **modelo**, ele era copiado inteiro para dentro da conta de quem
       * clicasse em "usar este modelo", e o 499 virava a política de qualificação
       * de uma empresa que nunca decidiu esse número. Um estúdio de pilates
       * passava a descartar toda aluna de mensalidade abaixo de 499 reais.
       *
       * É a RB-22: "Campos, valores mínimos e restrições precisam estar
       * preenchidos antes de publicar a regra; valores de demonstração não podem
       * virar política real."
       *
       * `0` não é um limiar melhor: é um limiar que **não filtra ninguém**, e
       * que por isso obriga quem for usar o modelo a escolher o dele. Errar
       * deixando todo mundo passar custa uma conversa a mais; errar descartando
       * custa o cliente, e ninguém descobre qual foi.
       */
      data: { variavel: 'orcamento', operador: 'maior', valor: '0' },
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
    /*
     * **O segundo handoff existe porque o primeiro mentia.**
     *
     * Quem respondia "quero falar com alguém" na tela de material caía neste
     * mesmo nó `humano`, rotulado `lead qualificado`. Quer dizer: pedir ajuda
     * emitia uma qualificação positiva por consequência, sem nenhum critério ter
     * sido conferido. Quem abrisse o Inbox lia "lead qualificado" numa conversa
     * de alguém que tinha acabado de dizer que estava só pesquisando.
     *
     * É a RB-21: "Pedir humano não transforma a avaliação em positiva. O modelo
     * SDR atual deve perder essa associação implícita."
     *
     * A passagem ao humano continua acontecendo, e acontece em qualquer
     * resultado — é o mesmo atendimento. O que muda é o que ela **declara**.
     */
    {
      id: 'humano-a-pedido',
      type: 'handoff',
      position: { x: 20, y: 1320 },
      data: {
        motivo: 'pediu para falar com alguém · ainda não qualificado',
        mensagens: ['Claro! Alguém do time assume a conversa a partir daqui. 😊'],
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
    // Vai para o handoff que **não** afirma qualificação: ver o nó acima.
    { id: 'e15', source: 'quer-falar', sourceHandle: 'sim', target: 'humano-a-pedido' },
    { id: 'e16', source: 'quer-falar', sourceHandle: 'depois', target: 'despedida' },
  ],
})
