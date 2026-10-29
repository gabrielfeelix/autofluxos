import { fluxoSchema, type Fluxo } from '@/core/flow/schema'

/**
 * O menu que manda a conversa para a fila do setor certo (0157).
 *
 * Três setores de exemplo, os mais comuns em qualquer empresa: Vendas, Suporte
 * e Financeiro. Cada opção termina num "Passar para a equipe" com o setor
 * dela, e quem não escolhe nada vai para a fila geral, para ninguém ficar
 * esperando por não ter tocado num botão.
 *
 * O setor não pode vir escrito no modelo, porque é um id da conta. Ele é
 * ligado na criação pelo nome da equipe (`SETORES_DO_MENU`): a conta que já
 * tem "Vendas", "Suporte" e "Financeiro" recebe o fluxo pronto, e a que não
 * tem recebe os blocos na fila geral, com o campo Setor esperando a escolha.
 */
export const menuPorSetor: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          { tipo: 'atraso', segundos: 1 },
          { tipo: 'texto', texto: 'Olá, {{nome}}! Para te direcionar ao time certo, me diga:' },
        ],
      },
    },
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 150 },
      data: {
        texto: 'Qual é o assunto?',
        salvarEm: 'setor',
        opcoes: [
          { id: 'vendas', rotulo: 'Comprar ou orçamento', valor: 'vendas' },
          { id: 'suporte', rotulo: 'Suporte', valor: 'suporte' },
          { id: 'financeiro', rotulo: 'Financeiro', valor: 'financeiro' },
        ],
        timeoutMinutos: 30,
      },
    },
    {
      id: 'setor-vendas',
      type: 'handoff',
      position: { x: -360, y: 340 },
      data: {
        motivo: 'Vendas · quer comprar ou pedir orçamento',
        mensagens: ['Certo! Já estou chamando alguém de Vendas. Um instante.'],
      },
    },
    {
      id: 'setor-suporte',
      type: 'handoff',
      position: { x: -120, y: 340 },
      data: {
        motivo: 'Suporte · precisa de ajuda',
        mensagens: ['Certo! Já estou chamando alguém do Suporte. Um instante.'],
      },
    },
    {
      id: 'setor-financeiro',
      type: 'handoff',
      position: { x: 120, y: 340 },
      data: {
        motivo: 'Financeiro · boleto, pagamento ou nota',
        mensagens: ['Certo! Já estou chamando alguém do Financeiro. Um instante.'],
      },
    },
    {
      id: 'fila-geral',
      type: 'handoff',
      position: { x: 360, y: 340 },
      data: {
        motivo: 'não escolheu o assunto',
        mensagens: ['Vou chamar alguém do time para te atender. Um instante.'],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'abertura', target: 'menu' },
    { id: 'e2', source: 'menu', sourceHandle: 'vendas', target: 'setor-vendas' },
    { id: 'e3', source: 'menu', sourceHandle: 'suporte', target: 'setor-suporte' },
    { id: 'e4', source: 'menu', sourceHandle: 'financeiro', target: 'setor-financeiro' },
    { id: 'e5', source: 'menu', sourceHandle: 'timeout', target: 'fila-geral' },
  ],
})

/** Bloco do modelo → nome da equipe que ele procura na conta. */
export const SETORES_DO_MENU: Record<string, string> = {
  'setor-vendas': 'Vendas',
  'setor-suporte': 'Suporte',
  'setor-financeiro': 'Financeiro',
}
