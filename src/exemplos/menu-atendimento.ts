import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O menu que responde o que se pergunta o dia inteiro.
 *
 * É o template mais pedido de todos, e o motivo é chato de admitir: a maior
 * parte das mensagens que chegam num WhatsApp de negócio não é venda nem
 * problema — é horário, endereço e preço, repetidos. Cada uma custa a atenção
 * de quem estava fazendo outra coisa.
 *
 * O desenho tem duas regras que valem mais que o texto:
 *
 * - **toda resposta volta ao menu** (bloco `voltar`), senão quem quer duas
 *   informações precisa começar a conversa de novo;
 * - **"falar com uma pessoa" é a primeira opção visível**, não a última. Menu
 *   que esconde a saída humana é o que faz alguém escrever "ATENDENTE" três
 *   vezes em letra maiúscula.
 */
export const menuAtendimento: Fluxo = fluxoSchema.parse({
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
            texto: 'Oi, {{nome}}! 👋 Sou o assistente virtual. Posso te ajudar agora mesmo:',
          },
        ],
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'O que você precisa?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'horario', rotulo: 'Horários', valor: 'horario' },
          { id: 'endereco', rotulo: 'Onde vocês ficam', valor: 'endereco' },
          { id: 'precos', rotulo: 'Preços e pagamento', valor: 'precos' },
          { id: 'pessoa', rotulo: 'Falar com uma pessoa', valor: 'pessoa' },
        ],
        // Meia hora: quem abriu o menu e saiu ainda lembra do que se tratava.
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
              '*Nosso horário*\nSegunda a sexta, das 9h às 19h.\nSábado, das 9h às 13h.\n\n_Troque este texto pelo horário real._',
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
              '*Onde estamos*\nRua Exemplo, 123 — bairro, cidade.\nTem estacionamento na porta.\n\n_Troque este texto pelo endereço real._',
          },
        ],
      },
    },
    {
      id: 'resposta-precos',
      type: 'mensagem',
      position: { x: 140, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              '*Valores*\nA partir de R$ 000, e aceitamos Pix, cartão em até 3x e dinheiro.\n\n_Troque este texto pela sua tabela._',
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
          { id: 'pessoa', rotulo: 'Falar com uma pessoa', valor: 'pessoa' },
          { id: 'nao', rotulo: 'Era só isso 🙂', valor: 'nao' },
        ],
      },
    },
    {
      id: 'voltar-ao-menu',
      type: 'voltar',
      position: { x: -420, y: 640 },
      data: { destino: 'menu', rotulo: 'O que você precisa?' },
    },
    {
      id: 'despedida',
      type: 'mensagem',
      position: { x: 140, y: 640 },
      data: {
        partes: [
          { tipo: 'texto', texto: 'Combinado, {{nome}}! Quando precisar é só chamar aqui. 👋' },
        ],
      },
    },

    {
      id: 'humano',
      type: 'handoff',
      position: { x: 420, y: 480 },
      data: {
        motivo: 'pediu atendimento humano · {{assunto}}',
        mensagens: ['Já estou chamando alguém do time. Um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'menu' },
    { id: 'e2', source: 'menu', sourceHandle: 'horario', target: 'resposta-horario' },
    { id: 'e3', source: 'menu', sourceHandle: 'endereco', target: 'resposta-endereco' },
    { id: 'e4', source: 'menu', sourceHandle: 'precos', target: 'resposta-precos' },
    { id: 'e5', source: 'menu', sourceHandle: 'pessoa', target: 'humano' },
    // Sem resposta, ninguém fica esperando: a conversa vai para uma pessoa.
    { id: 'e6', source: 'menu', sourceHandle: 'timeout', target: 'humano' },
    { id: 'e7', source: 'resposta-horario', target: 'mais-alguma' },
    { id: 'e8', source: 'resposta-endereco', target: 'mais-alguma' },
    { id: 'e9', source: 'resposta-precos', target: 'mais-alguma' },
    { id: 'e10', source: 'mais-alguma', sourceHandle: 'menu', target: 'voltar-ao-menu' },
    { id: 'e11', source: 'mais-alguma', sourceHandle: 'pessoa', target: 'humano' },
    { id: 'e12', source: 'mais-alguma', sourceHandle: 'nao', target: 'despedida' },
  ],
})
