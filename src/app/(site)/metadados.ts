import type { Metadata } from 'next'

/** O endereço do site, num lugar só: metadataBase, canonical, OG, sitemap, robots e JSON-LD saem daqui. */
export const SITE_URL = 'https://dialogon.com.br'

/**
 * Título e descrição de cada página dedicada, só para buscador e OG. Ficam
 * separados dos textos da tela (h1, cartões, menu), que dizem outra coisa.
 * O título já vem completo, sem template no layout raiz.
 */
export const SEO_DAS_PAGINAS: Record<string, { titulo: string; descricao: string }> = {
  '/produto/fluxos': {
    titulo: 'Chatbot de WhatsApp com fluxos visuais | Dialogon',
    descricao: 'Desenhe o atendimento em blocos, valide tudo antes de publicar e teste num simulador que roda o motor de verdade. Sem programar.',
  },
  '/produto/ia': {
    titulo: 'IA de atendimento que lê o seu negócio | Dialogon',
    descricao: 'A IA responde com a ficha da empresa, o catálogo e o cardápio, consulta pedido e agenda, e passa para a equipe quando não sabe.',
  },
  '/produto/inbox': {
    titulo: 'Caixa de entrada para equipes no WhatsApp | Dialogon',
    descricao: 'WhatsApp, Instagram, site e Telegram na mesma caixa, com fila por setor. A IA ajuda a responder e a equipe devolve ao chatbot.',
  },
  '/produto/contatos-e-funil': {
    titulo: 'CRM e funil de vendas no WhatsApp | Dialogon',
    descricao: 'O que o fluxo pergunta vira campo do contato, o cartão do funil anda sozinho e a equipe acompanha tudo sem planilha.',
  },
  '/produto/transmissoes': {
    titulo: 'Transmissões em massa no WhatsApp | Dialogon',
    descricao: 'Escolha o público por etiqueta, o modelo aprovado pela Meta e o horário. Veja quem recebeu e quem leu, com envio no ritmo do número.',
  },
  '/produto/relatorios': {
    titulo: 'Relatórios de atendimento e vendas | Dialogon',
    descricao: 'Relatórios de atendimento e de vendas no período que você escolher, com a explicação de cada número.',
  },
  '/canais/whatsapp': {
    titulo: 'WhatsApp API oficial com coexistência | Dialogon',
    descricao: 'API oficial da Meta com coexistência: o número segue no app do celular e o chatbot, a IA e a equipe respondem pelo Dialogon.',
  },
  '/canais/instagram': {
    titulo: 'Atendimento no Direct do Instagram | Dialogon',
    descricao: 'Mensagens, fotos, áudios e menções em story chegam na mesma fila do WhatsApp, e a equipe responde sem abrir o celular.',
  },
  '/canais/site': {
    titulo: 'Chat para site com chatbot e IA | Dialogon',
    descricao: 'Uma linha de código e o visitante conversa com o mesmo chatbot do WhatsApp. Quando precisa de gente, chama a equipe direto da página.',
  },
  '/canais/telegram': {
    titulo: 'Chatbot para Telegram | Dialogon',
    descricao: 'Crie o bot no BotFather, cole o token e o mesmo fluxo do WhatsApp passa a atender no Telegram, sem custo por conversa.',
  },
  '/segmentos/aulas-e-horarios': {
    titulo: 'Agendamento no WhatsApp para estúdios e clínicas | Dialogon',
    descricao: 'Aula experimental, remarcação, lembrete e aluno que sumiu: o Dialogon conduz a conversa e a agenda se atualiza sozinha.',
  },
  '/segmentos/loja-virtual': {
    titulo: 'WhatsApp para loja virtual | Dialogon',
    descricao: 'O cliente pergunta do produto, recebe foto, preço, estoque e frete, e fecha a compra sem sair da conversa.',
  },
  '/segmentos/restaurantes-e-delivery': {
    titulo: 'Pedidos no WhatsApp para restaurantes e delivery | Dialogon',
    descricao: 'Cardápio com foto e botões, pedido montado na conversa, Pix na hora e tudo no quadro da cozinha.',
  },
  '/segmentos/comercio': {
    titulo: 'WhatsApp para comércio e serviços | Dialogon',
    descricao: 'Pergunta de estoque respondida com foto e preço, produto separado para retirada e orçamento por áudio, sem tirar ninguém do caixa.',
  },
}

/**
 * Os metadados das páginas do site. O painel inteiro é `noindex` pelo layout
 * raiz; estas são a exceção, existem para ser encontradas.
 */
export function metadadosDoSite(caminho: string, titulo: string, descricao: string): Metadata {
  const seo = SEO_DAS_PAGINAS[caminho]
  if (seo) {
    titulo = seo.titulo
    descricao = seo.descricao
  }
  return {
    title: titulo,
    description: descricao,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE_URL}${caminho}` },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Dialogon', url: `${SITE_URL}${caminho}`, title: titulo, description: descricao },
  }
}
