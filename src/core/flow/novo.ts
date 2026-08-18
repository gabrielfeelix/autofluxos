import { fluxoSchema, type Fluxo } from './schema'

/**
 * O fluxo que todo fluxo novo começa sendo.
 *
 * Ele já nasce **válido**: tem início, tem caminho até um humano, e toda opção
 * leva a algum lugar. Começar de uma tela em branco garantiria que a primeira
 * coisa que a pessoa vê ao clicar em "Publicar" é uma lista de erros.
 *
 * Nada aqui é de cliente nenhum — é o esqueleto genérico. O que for específico
 * de um negócio entra editando, nunca em código.
 */
export function fluxoNovo(): Fluxo {
  return fluxoSchema.parse({
    inicio: 'abertura',
    nodes: [
      {
        id: 'abertura',
        type: 'mensagem',
        position: { x: 0, y: 0 },
        data: { partes: [{ tipo: 'texto', texto: 'Oi! 👋 Sou o assistente virtual. Posso te ajudar?' }] },
      },
      {
        id: 'assunto',
        type: 'pergunta',
        position: { x: 0, y: 160 },
        data: {
          texto: 'Do que você precisa?',
          salvarEm: 'assunto',
          opcoes: [
            { id: 'falar', rotulo: 'Falar com alguém' },
            { id: 'depois', rotulo: 'Só olhando' },
          ],
        },
      },
      {
        id: 'humano',
        type: 'handoff',
        position: { x: -160, y: 320 },
        data: { motivo: 'pedido pelo fluxo · {{assunto}}' },
      },
      {
        id: 'despedida',
        type: 'mensagem',
        position: { x: 160, y: 320 },
        data: { partes: [{ tipo: 'texto', texto: 'Tranquilo! Quando precisar é só chamar aqui. 👋' }] },
      },
    ],
    edges: [
      { id: 'a1', source: 'abertura', target: 'assunto' },
      { id: 'a2', source: 'assunto', sourceHandle: 'falar', target: 'humano' },
      { id: 'a3', source: 'assunto', sourceHandle: 'depois', target: 'despedida' },
    ],
  })
}
