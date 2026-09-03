import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { fluxoNovo } from '@/core/flow/novo'
import { agendamento } from './agendamento'
import { carrinhoAbandonado } from './carrinho-abandonado'
import { cobrancaAmigavel } from './cobranca-amigavel'
import { lembrete } from './lembrete'
import { menuAtendimento } from './menu-atendimento'
import { pesquisaNps } from './pesquisa-nps'
import { qualificarSdr } from './qualificar-sdr'
import { reagendamento } from './reagendamento'
import { statusDoPedido } from './status-do-pedido'
import { triagem } from './triagem'

/**
 * Os modelos que a tela oferece ao criar um fluxo (B5).
 *
 * **São dado, não banco.** Um modelo é um grafo de partida; guardá-lo em tabela
 * criaria uma segunda fonte de fluxos para manter, versionar e migrar junto do
 * schema — e o que se ganha é editar sem deploy, que ninguém pediu.
 *
 * O que o modelo entrega é o começo, e nada além dele: assim que o fluxo é
 * criado, ele é um rascunho normal. Não existe "atualizar o modelo depois" —
 * pelo mesmo motivo do preset de integração, e da versão publicada: o que ficou
 * gravado é o desenho, não uma referência viva.
 *
 * Todos nascem **válidos**: se um modelo produzisse um fluxo que o `publicar()`
 * recusa, a primeira coisa que a pessoa veria ao clicar em Publicar seria uma
 * lista de erros sobre um desenho que ela não fez.
 */

/**
 * As etiquetas da galeria.
 *
 * São **uma lista fechada**, e não texto livre por modelo: etiqueta digitada à
 * mão vira "Pós venda", "pós-venda" e "Pos-Venda" no mesmo filtro, e aí o
 * filtro deixa de filtrar. A ordem daqui é a ordem em que elas aparecem na
 * tela — canal primeiro, porque é a primeira pergunta de quem procura.
 */
export const ETIQUETAS = [
  'WhatsApp',
  'Instagram',
  'Atendimento',
  'Vendas',
  'SDR',
  'Agenda',
  'Pós-venda',
  'Financeiro',
  'E-commerce',
  'Precisa de integração',
] as const

export type Etiqueta = (typeof ETIQUETAS)[number]

export type Modelo = {
  id: string
  nome: string
  resumo: string
  /** Para a busca e os filtros da galeria. Ver `ETIQUETAS`. */
  etiquetas: readonly Etiqueta[]
  /**
   * Palavras que a pessoa digita e que não estão no nome nem no resumo —
   * "cobrança" para o lembrete de pagamento, "faq" para o menu. Não aparecem na
   * tela; existem para a busca não devolver vazio no termo mais óbvio.
   */
  sinonimos?: readonly string[]
  grafo: Fluxo
}

/**
 * Recado + agendamento humano.
 *
 * O caso mais comum de quem começa: o bot não tenta resolver, ele qualifica em
 * uma pergunta e entrega. Vale mais do que parece — é o desenho que transforma
 * "alguém responde quando puder" em "alguém responde sabendo do que se trata".
 */
const recado: Fluxo = fluxoSchema.parse({
  inicio: 'abertura',
  nodes: [
    {
      id: 'abertura',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi! 👋 Sou o assistente virtual. Faço *uma pergunta rápida* e já chamo alguém do time.',
          },
        ],
      },
    },
    {
      id: 'assunto',
      type: 'pergunta',
      position: { x: 0, y: 170 },
      data: {
        texto: 'Sobre o que você quer falar?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'orcamento', rotulo: 'Orçamento' },
          { id: 'agendar', rotulo: 'Agendar horário' },
          { id: 'outro', rotulo: 'Outro assunto' },
        ],
        // Meia hora: tempo de quem saiu para responder e voltou, e curto o
        // bastante para a pessoa ainda lembrar do que se tratava.
        timeoutMinutos: 30,
      },
    },
    {
      id: 'nome',
      type: 'pergunta',
      position: { x: 0, y: 340 },
      data: { texto: 'Como posso te chamar?', salvarEm: 'nome' },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 0, y: 510 },
      data: {
        mensagem: 'Perfeito, {{nome}}! Já estou chamando alguém do time. 🙌',
        motivo: '{{assunto}} · {{nome}}',
      },
    },
    {
      id: 'sumiu',
      type: 'mensagem',
      position: { x: 320, y: 340 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Sem problema! Quando quiser, é só mandar uma mensagem aqui. 👋',
          },
        ],
      },
    },
  ],
  edges: [
    { id: 'r1', source: 'abertura', target: 'assunto' },
    { id: 'r2', source: 'assunto', sourceHandle: 'orcamento', target: 'nome' },
    { id: 'r3', source: 'assunto', sourceHandle: 'agendar', target: 'nome' },
    { id: 'r4', source: 'assunto', sourceHandle: 'outro', target: 'nome' },
    { id: 'r5', source: 'assunto', sourceHandle: 'timeout', target: 'sumiu' },
    { id: 'r6', source: 'nome', target: 'humano' },
  ],
})

/**
 * Fora do expediente.
 *
 * Um fluxo curto para ser o **padrão para mídia** ou a resposta de quem escreve
 * de madrugada: diz o que é verdade e não promete ninguém. O aviso de horário
 * o motor acrescenta sozinho quando o expediente está configurado (A4).
 */
const recadoCurto: Fluxo = fluxoSchema.parse({
  inicio: 'aviso',
  nodes: [
    {
      id: 'aviso',
      type: 'mensagem',
      position: { x: 0, y: 0 },
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Recebi sua mensagem! 🙌 Nosso time responde por aqui assim que possível — pode deixar tudo escrito que já fica registrado.',
          },
        ],
      },
    },
    {
      id: 'humano',
      type: 'handoff',
      position: { x: 0, y: 170 },
      data: { mensagem: 'Já deixei registrado aqui com o time.', motivo: 'recado deixado' },
    },
  ],
  edges: [{ id: 'c1', source: 'aviso', target: 'humano' }],
})

export const MODELOS: Modelo[] = [
  {
    id: 'vazio',
    nome: 'Em branco',
    resumo: 'O esqueleto mínimo: uma saudação, uma pergunta e a saída para uma pessoa.',
    etiquetas: ['WhatsApp', 'Instagram'],
    grafo: fluxoNovo(),
  },
  {
    id: 'recado',
    nome: 'Qualificar e passar para alguém',
    resumo:
      'Pergunta o assunto e o nome, e entrega para o time já sabendo do que se trata. Tem prazo de resposta.',
    etiquetas: ['WhatsApp', 'Instagram', 'Atendimento', 'SDR'],
    sinonimos: ['sdr', 'qualificar', 'recado', 'lead', 'orçamento', 'triagem'],
    grafo: recado,
  },
  {
    id: 'recado-curto',
    nome: 'Recebi seu recado',
    resumo:
      'Duas linhas, sem perguntar nada. Serve como padrão para mídia recebida ou para fora do expediente.',
    etiquetas: ['WhatsApp', 'Instagram', 'Atendimento'],
    sinonimos: ['fora do expediente', 'madrugada', 'ausência', 'recado', 'feriado'],
    grafo: recadoCurto,
  },
  {
    id: 'agendamento',
    nome: 'Agendar e remarcar na agenda',
    resumo:
      'Reconhece quem já é cliente, confere o telefone, pergunta a modalidade e oferece só os horários dela. Confirma antes de gravar. Precisa da credencial da Verandi.',
    etiquetas: ['WhatsApp', 'Agenda', 'Precisa de integração'],
    sinonimos: ['marcar', 'horário', 'consulta', 'aula', 'agenda', 'reserva'],
    grafo: agendamento,
  },
  {
    id: 'reagendamento',
    nome: 'Reagendar uma reposição',
    resumo:
      'Reconhece o aluno, já diz quantas aulas ele tem para repor e remarca uma. Mais de uma reposição vai para a recepção. Precisa da credencial da Verandi.',
    etiquetas: ['WhatsApp', 'Agenda', 'Precisa de integração'],
    sinonimos: ['remarcar', 'reposição', 'trocar horário', 'aula', 'agenda'],
    grafo: reagendamento,
  },
  {
    id: 'lembrete',
    nome: 'Lembrete de aula',
    resumo:
      'Lembra da aula e oferece confirmar ou avisar que não vem — avisar desmarca e devolve a vaga na hora. Precisa da credencial da Verandi.',
    etiquetas: ['WhatsApp', 'Agenda', 'Precisa de integração'],
    sinonimos: ['lembrete', 'confirmação', 'véspera', 'aula', 'no-show', 'falta'],
    grafo: lembrete,
  },
  {
    id: 'triagem',
    nome: 'Triagem completa (exemplo)',
    resumo:
      'O exemplo do produto: separa quem tem pressa de quem está pesquisando, com faixa de preço.',
    etiquetas: ['WhatsApp', 'Vendas', 'SDR'],
    sinonimos: ['triagem', 'orçamento', 'preço', 'lead', 'sdr', 'comercial'],
    grafo: triagem,
  },
  {
    id: 'menu-atendimento',
    nome: 'Menu de dúvidas frequentes',
    resumo:
      'Horário, endereço e preços respondidos na hora, com volta ao menu e a saída para uma pessoa sempre à vista.',
    etiquetas: ['WhatsApp', 'Instagram', 'Atendimento'],
    sinonimos: ['faq', 'dúvidas frequentes', 'menu', 'horário', 'endereço', 'preço', 'atendimento'],
    grafo: menuAtendimento,
  },
  {
    id: 'qualificar-sdr',
    nome: 'Qualificar lead antes do time comercial',
    resumo:
      'Três perguntas — o que precisa, para quando e quanto pretende investir — e só quem tem verba e prazo chega ao vendedor, com resumo pronto.',
    etiquetas: ['WhatsApp', 'Instagram', 'SDR', 'Vendas'],
    sinonimos: ['sdr', 'qualificação', 'lead', 'prospecção', 'comercial', 'orçamento', 'b2b'],
    grafo: qualificarSdr,
  },
  {
    id: 'carrinho-abandonado',
    nome: 'Recuperar carrinho abandonado',
    resumo:
      'Pergunta o que travou antes de dar desconto: preço ganha cupom, dúvida ganha gente, frete ganha explicação.',
    etiquetas: ['WhatsApp', 'Vendas', 'E-commerce'],
    sinonimos: ['carrinho', 'checkout', 'cupom', 'desconto', 'loja', 'recuperação', 'venda perdida'],
    grafo: carrinhoAbandonado,
  },
  {
    id: 'status-do-pedido',
    nome: 'Cadê meu pedido',
    resumo:
      'Coleta o número do pedido (ou o telefone da compra) antes de chamar alguém — o atendimento começa com o dado na mão.',
    etiquetas: ['WhatsApp', 'Atendimento', 'E-commerce'],
    sinonimos: ['pedido', 'rastreio', 'entrega', 'delivery', 'cadê', 'encomenda', 'nota'],
    grafo: statusDoPedido,
  },
  {
    id: 'pesquisa-nps',
    nome: 'Pesquisa de satisfação (NPS)',
    resumo:
      'Nota de 0 a 10. Quem gostou é convidado a avaliar no Google; quem não gostou vai para uma pessoa, não para uma planilha.',
    etiquetas: ['WhatsApp', 'Pós-venda', 'Atendimento'],
    sinonimos: ['nps', 'satisfação', 'avaliação', 'google', 'feedback', 'pesquisa', 'pós-venda'],
    grafo: pesquisaNps,
  },
  {
    id: 'cobranca-amigavel',
    nome: 'Lembrete de pagamento',
    resumo:
      'Lembra da parcela em aberto com "já paguei" como primeira opção, manda a 2ª via e passa negociação para o financeiro.',
    etiquetas: ['WhatsApp', 'Financeiro'],
    sinonimos: ['cobrança', 'boleto', 'pix', 'pagamento', 'inadimplência', 'segunda via', 'financeiro'],
    grafo: cobrancaAmigavel,
  },
]

export function acharModelo(id: string): Modelo | undefined {
  return MODELOS.find((modelo) => modelo.id === id)
}
