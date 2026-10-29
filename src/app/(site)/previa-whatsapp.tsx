
/*
 * A conversa de cada segmento como aparece no WhatsApp do cliente, no painel
 * Segmentos do menu (pedido do Gabriel, 28/out/2026: "com foto dos produtos,
 * como ficam as opções, tudo completinho"). Cada uma mostra a peça que mais
 * representa o segmento: cartão de produto, horários em botão, foto da aula,
 * cardápio com Pix, áudio transcrito, rastreio.
 *
 * Os negócios e nomes são inventados. As fotos são do Unsplash (uso comercial
 * livre), em `public/fotos-do-site/`.
 */

export type Mensagem =
  | { de: 'cliente'; texto: string }
  | { de: 'audio'; duracao: string; transcricao: string }
  | { de: 'bot'; texto?: string; foto?: string; produto?: { nome: string; preco: string; detalhe: string }; botoes?: string[] }
  | { de: 'cardapio'; texto: string; itens: { foto: string; nome: string; preco: string }[] }
  | { de: 'pix'; itens: [string, string][]; total: string }
  | { de: 'rastreio'; pedido: string; etapas: string[]; feitas: number; previsao: string }

export type Conversa = { negocio: string; cor: string; mensagens: Mensagem[] }

export type ChaveDaConversa = 'loja' | 'clinica' | 'estudio' | 'restaurante' | 'servicos' | 'posVenda' | 'petshop'

const LISTA: (Conversa & { chave: ChaveDaConversa })[] = [
  {
    chave: 'loja',
    negocio: 'Ponto Som',
    cor: '#1f6feb',
    mensagens: [
      { de: 'cliente', texto: 'Tem esse fone na cor preta?' },
      {
        de: 'bot',
        foto: '/fotos-do-site/fone.webp',
        produto: { nome: 'Fone Over-ear Bluetooth', preco: 'R$ 249,90', detalhe: 'Preto · 7 em estoque' },
      },
      {
        de: 'bot',
        texto: 'Para o seu CEP o frete fica R$ 18,90, com entrega na quinta.',
        botoes: ['Comprar agora', 'Ver outras cores'],
      },
      { de: 'cliente', texto: 'Comprar agora' },
      { de: 'bot', texto: 'Pedido separado! Paga por Pix ou cartão neste link, e eu confirmo aqui quando cair.', botoes: ['Pagar R$ 268,80'] },
    ],
  },
  {
    chave: 'clinica',
    negocio: 'Clínica Bem Viver',
    cor: '#0f9d76',
    mensagens: [
      { de: 'cliente', texto: 'Consigo consulta amanhã cedo?' },
      { de: 'bot', texto: 'Tenho estes horários com a Dra. Ana Lima, clínica geral:', botoes: ['8h30', '9h15', '10h00'] },
      { de: 'cliente', texto: '9h15' },
      { de: 'bot', texto: 'Confirmado para amanhã às 9h15. Envio um lembrete duas horas antes.' },
    ],
  },
  {
    chave: 'estudio',
    negocio: 'Studio Movimento',
    cor: '#c2410c',
    mensagens: [
      { de: 'cliente', texto: 'Vocês têm aula experimental?' },
      {
        de: 'bot',
        foto: '/fotos-do-site/aula.webp',
        texto: 'Temos. A primeira aula de pilates é por nossa conta. Qual horário fica melhor?',
        botoes: ['Terça, 19h', 'Quinta, 7h'],
      },
      { de: 'cliente', texto: 'Terça, 19h' },
      { de: 'bot', texto: 'Reservado. Venha com roupa confortável e chegue 10 minutos antes.' },
    ],
  },
  {
    chave: 'restaurante',
    negocio: 'Forno da Vila',
    cor: '#b91c1c',
    mensagens: [
      { de: 'cliente', texto: 'Ainda dá para pedir?' },
      {
        de: 'cardapio',
        texto: 'Dá sim, a cozinha fecha às 23h. Os mais pedidos de hoje:',
        itens: [
          { foto: '/fotos-do-site/pizza.webp', nome: 'Pizza margherita', preco: 'R$ 54,00' },
          { foto: '/fotos-do-site/hamburguer.webp', nome: 'Burger da casa', preco: 'R$ 38,00' },
        ],
      },
      { de: 'cliente', texto: 'Uma margherita para entrega' },
      { de: 'pix', itens: [['Pizza margherita', 'R$ 54,00'], ['Entrega', 'R$ 6,00']], total: 'R$ 60,00' },
    ],
  },
  {
    chave: 'servicos',
    negocio: 'Clima Instalações',
    cor: '#0e7490',
    mensagens: [
      { de: 'audio', duracao: '0:38', transcricao: 'Quanto fica para instalar um ar de 12 mil BTUs no quarto?' },
      {
        de: 'bot',
        texto: 'Para 12.000 BTUs a instalação fica a partir de R$ 180, com até 3 metros de tubulação.',
        botoes: ['Marcar visita', 'Falar com técnico'],
      },
      { de: 'cliente', texto: 'Marcar visita' },
      { de: 'bot', texto: 'Visita marcada para quinta às 14h. O técnico avisa por aqui quando sair.' },
    ],
  },
  {
    chave: 'posVenda',
    negocio: 'Casa Bela Decor',
    cor: '#a16207',
    mensagens: [
      { de: 'cliente', texto: 'Meu pedido já saiu?' },
      {
        de: 'rastreio',
        pedido: '#4821',
        etapas: ['Pago', 'Separado', 'Enviado', 'Entregue'],
        feitas: 3,
        previsao: 'Chega na quinta, até as 18h.',
      },
      { de: 'bot', texto: 'Quer receber um aviso quando sair para entrega?', botoes: ['Sim, me avise'] },
      { de: 'cliente', texto: 'Sim, me avise' },
      { de: 'bot', texto: 'Combinado! Aviso aqui assim que o pedido sair para entrega.' },
    ],
  },
  {
    chave: 'petshop',
    negocio: 'Pet Amigo',
    cor: '#15803d',
    mensagens: [
      { de: 'cliente', texto: 'Vocês têm ração para filhote de porte médio?' },
      {
        de: 'bot',
        foto: '/fotos-do-site/racao.webp',
        produto: { nome: 'Ração Filhote Porte Médio 10 kg', preco: 'R$ 189,90', detalhe: '4 na prateleira' },
      },
      { de: 'bot', texto: 'Separo uma para você retirar hoje? Ficamos abertos até as 19h.', botoes: ['Separar para hoje', 'Ver outras marcas'] },
      { de: 'cliente', texto: 'Separar para hoje' },
      { de: 'bot', texto: 'Separado! Fica no seu nome no balcão até as 19h.' },
    ],
  },
]

export const CONVERSAS = Object.fromEntries(LISTA.map((c) => [c.chave, c])) as unknown as Record<ChaveDaConversa, Conversa>

// A conversa animada mora num arquivo de cliente: os dados aqui seguem objetos
// comuns, que as páginas de servidor também leem (`CONVERSAS[...]`).
export { PreviaWhatsApp } from './previa-whatsapp-viva'
