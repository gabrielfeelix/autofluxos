import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * Recuperação de carrinho — a conversa que volta atrás de quem quase comprou.
 *
 * **Como este fluxo começa importa mais que o texto dele.** Ninguém abre uma
 * conversa dizendo "esqueci o carrinho": quem começa é a loja, por campanha.
 * Fora da janela de 24h do WhatsApp isso exige modelo aprovado da Meta — a
 * mesma lacuna do lembrete de aula. Dentro da janela (a pessoa acabou de
 * escrever), ele roda como qualquer outro.
 *
 * O desenho evita o erro clássico de dar desconto a quem ia comprar de
 * qualquer jeito: primeiro pergunta **o que travou**. Preço ganha cupom; dúvida
 * ganha gente; frete ganha explicação. Desconto é a última carta, não a
 * primeira.
 */
export const carrinhoAbandonado: Fluxo = fluxoSchema.parse({
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
              'Oi, {{nome}}! 👋 Vi que você deixou uns itens no carrinho e vim só conferir se está tudo certo.',
          },
        ],
      },
    },
    {
      id: 'o-que-travou',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'Rolou alguma dúvida na hora de finalizar?',
        salvarEm: 'motivo_parada',
        opcoes: [
          { id: 'preco', rotulo: 'Achei caro', valor: 'preço' },
          { id: 'frete', rotulo: 'Frete ou prazo', valor: 'frete' },
          { id: 'duvida', rotulo: 'Fiquei com dúvida', valor: 'dúvida' },
          { id: 'comprei', rotulo: 'Já comprei, obrigado', valor: 'já comprou' },
        ],
        // Um dia: recuperação que cobra resposta em 30 minutos vira pressão, e
        // pressão em quem já hesitou não converte.
        timeoutMinutos: 1440,
      },
    },

    {
      id: 'cupom',
      type: 'mensagem',
      position: { x: -420, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Entendo, {{nome}}. Consigo um cupom de *10% off* para você fechar hoje: use o código *VOLTEI10* no carrinho.\n\n_Troque o código pelo seu._',
          },
        ],
      },
    },
    {
      id: 'frete',
      type: 'mensagem',
      position: { x: -140, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'O frete sai por conta da transportadora e o prazo aparece no carrinho depois do CEP. Acima de R$ 000 o envio é por nossa conta.\n\n_Troque este texto pela sua regra de frete._',
          },
        ],
      },
    },
    {
      id: 'fechou',
      type: 'pergunta',
      position: { x: -280, y: 480 },
      data: {
        texto: 'Consegue finalizar agora ou prefere que alguém te ajude?',
        salvarEm: 'quer_ajuda',
        opcoes: [
          { id: 'sozinho', rotulo: 'Consigo sozinho', valor: 'sozinho' },
          { id: 'ajuda', rotulo: 'Quero ajuda', valor: 'ajuda' },
        ],
      },
    },
    {
      id: 'boa-compra',
      type: 'mensagem',
      position: { x: -560, y: 640 },
      data: {
        partes: [
          { tipo: 'texto', texto: 'Boa compra, {{nome}}! Qualquer coisa é só chamar por aqui. 🧡' },
        ],
      },
    },
    {
      id: 'parabens',
      type: 'mensagem',
      position: { x: 340, y: 320 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Que ótimo, {{nome}}! Obrigado pela compra. Qualquer coisa, é só chamar. 🧡',
          },
        ],
      },
    },

    {
      id: 'humano',
      type: 'handoff',
      position: { x: 40, y: 640 },
      data: {
        motivo: 'carrinho abandonado · travou em {{motivo_parada}}',
        mensagens: ['Já chamei alguém do time para te ajudar a fechar. Um instante! 🙌'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'o-que-travou' },
    { id: 'e2', source: 'o-que-travou', sourceHandle: 'preco', target: 'cupom' },
    { id: 'e3', source: 'o-que-travou', sourceHandle: 'frete', target: 'frete' },
    // Dúvida de produto é conversa, não script: vai direto para uma pessoa.
    { id: 'e4', source: 'o-que-travou', sourceHandle: 'duvida', target: 'humano' },
    { id: 'e5', source: 'o-que-travou', sourceHandle: 'comprei', target: 'parabens' },
    { id: 'e6', source: 'o-que-travou', sourceHandle: 'timeout', target: 'boa-compra' },
    { id: 'e7', source: 'cupom', target: 'fechou' },
    { id: 'e8', source: 'frete', target: 'fechou' },
    { id: 'e9', source: 'fechou', sourceHandle: 'sozinho', target: 'boa-compra' },
    { id: 'e10', source: 'fechou', sourceHandle: 'ajuda', target: 'humano' },
  ],
})
