import type { ChaveDaConversa } from './previa-whatsapp'

/*
 * Os nichos do site, um por página em `/segmentos/[slug]`. São os quatro de
 * `src/core/nichos.ts`, o mesmo pacote que a conta recebe ao escolher o ramo:
 * o que a IA pode fazer vem de `ficha.pode`, os modelos de `modelosDeFluxo`
 * (nomes em `src/exemplos/modelos.ts`), e o jeito do app chamar as coisas de
 * `rotulos` e `pedidos`. Mudou lá, confira aqui.
 */

export type GrupoDeIntegracao = 'lojas' | 'pagamentos' | 'cardapios' | 'canais'

export type NichoDoSite = {
  slug: string
  nome: string
  quem: string
  foto: string
  cor: string
  titulo: string
  subtitulo: string
  conversas: ChaveDaConversa[]
  dores: { dor: string; resposta: string }[]
  ia: string[]
  modelos: string[]
  noApp: { titulo: string; texto: string }[]
  integracoes: GrupoDeIntegracao[]
}

/** Os modelos que toda conta recebe, em qualquer ramo (`MODELOS_DE_QUALQUER_RAMO`). */
export const MODELOS_DE_TODOS = ['Recado fora do horário', 'Menu de atendimento', 'Pesquisa de satisfação']

export const NICHOS_DO_SITE: NichoDoSite[] = [
  {
    slug: 'aulas-e-horarios',
    nome: 'Aulas e horários',
    quem: 'Pilates, academia, estúdio, escola e clínica',
    foto: '/fotos-do-site/seg-estudio.webp',
    cor: '#c2410c',
    titulo: 'Agenda cheia sem passar o dia no WhatsApp',
    subtitulo:
      'Aula experimental, remarcação, lembrete e aluno que sumiu: o AutoFluxos conduz a conversa e a agenda se atualiza sozinha.',
    conversas: ['estudio', 'clinica'],
    dores: [
      { dor: '"Tem horário amanhã?" o dia inteiro', resposta: 'O chatbot mostra os horários livres em botões e marca direto na agenda.' },
      { dor: 'Aluno que falta sem avisar', resposta: 'Lembrete antes da aula e um botão para avisar que não vai, liberando a vaga.' },
      { dor: 'Quem parou de vir some de vez', resposta: 'O fluxo de aluno inativo chama de volta quem não aparece há semanas.' },
    ],
    ia: [
      'Explica modalidades, planos e aula experimental',
      'Mostra planos e valores do catálogo',
      'Informa horário e endereço',
      'Responde pelo que está na ficha do seu negócio',
    ],
    modelos: ['Agendar e remarcar na agenda', 'Reagendar uma reposição', 'Avisar que não vai à aula', 'Lembrete de aula', 'Aluno que parou de vir', 'Voltei de licença'],
    noApp: [
      { titulo: 'Alunos', texto: 'Os contatos aparecem como alunos, com plano e histórico.' },
      { titulo: 'Matrículas', texto: 'O funil acompanha da aula experimental à matrícula.' },
      { titulo: 'Planos e modalidades', texto: 'O catálogo guarda planos e valores que a IA consulta.' },
    ],
    integracoes: ['pagamentos'],
  },
  {
    slug: 'loja-virtual',
    nome: 'Loja virtual',
    quem: 'Lojas no Magento, na Nuvemshop ou com catálogo próprio',
    foto: '/fotos-do-site/seg-loja.webp',
    cor: '#1f6feb',
    titulo: 'Venda no WhatsApp com o estoque de verdade',
    subtitulo: 'O cliente pergunta do produto, recebe foto, preço, estoque e frete, e fecha a compra sem sair da conversa.',
    conversas: ['loja', 'posVenda'],
    dores: [
      { dor: '"Tem no 42?" sem ninguém para olhar o estoque', resposta: 'O chatbot consulta a loja e responde com foto, preço e estoque reais.' },
      { dor: '"Cadê meu pedido?" lotando o atendimento', resposta: 'Consulta de pedido e rastreio pelo CPF ou telefone, sem passar pela equipe.' },
      { dor: 'Carrinho abandonado sem segunda chance', resposta: 'Uma campanha no WhatsApp traz de volta quem deixou o carrinho.' },
    ],
    ia: [
      'Mostra produtos, fotos e preços do catálogo',
      'Consulta o status de um pedido',
      'Informa prazo de envio e frete',
      'Responde pelo que está na ficha do seu negócio',
    ],
    modelos: ['Atendimento de loja virtual', 'Recuperar carrinho abandonado', 'Cadê meu pedido', 'Lembrete de pagamento'],
    noApp: [
      { titulo: 'Loja conectada', texto: 'Magento e Nuvemshop entram pelo menu Loja, sem planilha.' },
      { titulo: 'Pedidos em lista', texto: 'De novo a separando, enviado e entregue, com aviso ao cliente.' },
      { titulo: 'Vendas pelo chat', texto: 'O relatório mostra o que foi recebido e vendido na conversa.' },
    ],
    integracoes: ['lojas', 'pagamentos'],
  },
  {
    slug: 'restaurantes-e-delivery',
    nome: 'Restaurantes e delivery',
    quem: 'Pizzaria, hamburgueria, marmitaria e lanchonete',
    foto: '/fotos-do-site/seg-restaurante.webp',
    cor: '#b91c1c',
    titulo: 'Pedido no WhatsApp sem anotar no papel',
    subtitulo: 'Cardápio com foto e botões, pedido montado na conversa, Pix na hora e tudo no quadro da cozinha.',
    conversas: ['restaurante'],
    dores: [
      { dor: 'Pedido anotado errado no horário de pico', resposta: 'O cliente monta o pedido em botões e o sistema soma o total.' },
      { dor: '"Ainda está aberto?" depois das 23h', resposta: 'Horário, taxa de entrega e endereço respondidos sem ninguém no balcão.' },
      { dor: 'Pedido do cardápio online que ninguém viu', resposta: 'Cardápio Web, Goomer e OlaClick jogam o pedido no mesmo quadro.' },
    ],
    ia: ['Manda o cardápio e as fotos dos pratos', 'Ajuda a montar um pedido', 'Informa horário, entrega e endereço', 'Responde pelo que está na ficha do seu negócio'],
    modelos: ['Cardápio e pedido com botões', 'Atendente de restaurante com IA', 'Horário e como chegar'],
    noApp: [
      { titulo: 'Cardápio', texto: 'Os pratos ficam no catálogo, com foto e preço.' },
      { titulo: 'Quadro de pedidos', texto: 'Novo, pago, em preparo, saiu e entregue, arrastando o cartão.' },
      { titulo: 'Horários de pico', texto: 'O relatório mostra quando chegam mais pedidos pelo chat.' },
    ],
    integracoes: ['cardapios', 'pagamentos'],
  },
  {
    slug: 'comercio',
    nome: 'Comércio e serviços',
    quem: 'Loja de bairro, pet shop, papelaria e prestador de serviço',
    foto: '/fotos-do-site/seg-comercio.webp',
    cor: '#15803d',
    titulo: 'Seu balcão atendendo pelo WhatsApp',
    subtitulo: '"Vocês têm?" respondido com foto e preço, produto separado para retirar e orçamento por áudio, sem tirar ninguém do caixa.',
    conversas: ['petshop', 'servicos'],
    dores: [
      { dor: '"Vocês têm?" enquanto você atende o balcão', resposta: 'O chatbot diz se tem, quanto custa e manda a foto do produto.' },
      { dor: 'Cliente chega e o produto não está separado', resposta: 'O pedido para retirar entra na lista e avisa quando estiver pronto.' },
      { dor: 'Áudio de dois minutos pedindo orçamento', resposta: 'O áudio chega transcrito no Inbox, e a equipe responde lendo.' },
    ],
    ia: ['Diz se tem o produto e quanto custa', 'Informa horário e endereço', 'Responde pelo que está na ficha do seu negócio'],
    modelos: ['Vocês têm?', 'Horário e como chegar'],
    noApp: [
      { titulo: 'Produtos e serviços', texto: 'O catálogo guarda o que você vende, com foto e preço.' },
      { titulo: 'Pedidos para retirar', texto: 'Novo, pago e retirado, numa lista simples.' },
      { titulo: 'Áudio transcrito', texto: 'Toda mensagem de voz vira texto na conversa.' },
    ],
    integracoes: ['pagamentos'],
  },
]

export function nichoPorSlug(slug: string): NichoDoSite | undefined {
  return NICHOS_DO_SITE.find((n) => n.slug === slug)
}
