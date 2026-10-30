import type { Nicho } from './nichos'
import type { Categoria } from './templates'

/**
 * Os modelos prontos de mensagem, a galeria que abre no lugar de um formulário
 * em branco.
 *
 * ---------------------------------------------------------------------------
 * Por que existem, mesmo com a biblioteca da Meta ao lado
 * ---------------------------------------------------------------------------
 *
 * A biblioteca dela aprova quase na hora, e por isso vem primeiro na tela. Mas
 * ela é global, em inglês na maior parte, e escrita para o mercado americano:
 * "your appointment is confirmed" não é como um consultório brasileiro fala.
 *
 * Estes são nossos: em português, no tom que um cliente daqui usa, e cobrindo
 * os casos que aparecem de verdade nas contas que atendemos. Custam a espera de
 * revisão da Meta, e é por isso que a tela diz isso antes da escolha em vez de
 * depois.
 *
 * ---------------------------------------------------------------------------
 * `{{1}}` não aparece aqui, e essa é a decisão
 * ---------------------------------------------------------------------------
 *
 * O corpo é escrito com marcadores em português, `{nome}`, `{data}`, porque é
 * o que a pessoa lê na tela. A tradução para o `{{1}}` da Meta acontece na hora
 * de submeter, e o número nunca chega aos olhos de quem escreve.
 *
 * Quem desenhou a tela anterior expôs o `{{1}}` direto e pedia "exemplo da
 * variável 2" depois, jargão de API vazando para quem só quer mandar um
 * lembrete.
 */

/** Um campo que muda por pessoa. O `id` é o que aparece no texto, entre chaves. */
export type CampoDoModelo = {
  id: string
  /** Como o botão de inserir se chama na tela. */
  rotulo: string
  /** O valor que a Meta vê como exemplo, e que a prévia mostra. */
  exemplo: string
  /**
   * Vem do contato, sem ninguém preencher?
   *
   * `nome` é o único hoje. A diferença importa na tela de transmissão: campo
   * automático não é perguntado, os outros são.
   */
  automatico?: boolean
}

export const CAMPOS: readonly CampoDoModelo[] = [
  { id: 'nome', rotulo: 'Nome do cliente', exemplo: 'Maria', automatico: true },
  { id: 'data', rotulo: 'Data', exemplo: '15/10' },
  { id: 'hora', rotulo: 'Horário', exemplo: '14h' },
  { id: 'valor', rotulo: 'Valor', exemplo: 'R$ 150,00' },
  { id: 'codigo', rotulo: 'Código ou número', exemplo: '1234' },
  { id: 'link', rotulo: 'Link', exemplo: 'exemplo.com/abrir' },
]

export type ModeloPronto = {
  id: string
  /** O que a pessoa escolhe na galeria. */
  titulo: string
  /** Uma linha dizendo quando usar. */
  resumo: string
  corpo: string
  categoria: Categoria
  /**
   * O ramo da conta para quem o modelo faz sentido (`core/nichos.ts`). Sem
   * ramo, serve a qualquer negócio.
   */
  ramo?: Nicho
  /** Para a busca achar pelo que a pessoa chama, e não pelo que nomeamos. */
  sinonimos?: readonly string[]
  /** Botões de resposta que já vêm preenchidos, quando o modelo é uma pergunta. */
  respostas?: readonly string[]
}

/**
 * A categoria vem com o modelo, e não é escolha da pessoa.
 *
 * Ela muda **quanto a Meta cobra** e o quanto ela implica na revisão: um
 * lembrete é `UTILITY`, barato e aprovado fácil; uma promoção é `MARKETING`,
 * mais caro e exige opt-in. Pedir isso a quem só quer avisar de uma consulta é
 * transferir uma decisão de cobrança para quem não tem como tomá-la, e errar
 * aqui é caro, porque a Meta reclassifica e a conta vem diferente.
 */
export const MODELOS_PRONTOS: readonly ModeloPronto[] = [
  // -------------------------------------------------------------------------
  // Qualquer negócio
  // -------------------------------------------------------------------------
  {
    /*
     * **Marketing, e não utilidade, de propósito.** A Meta só aceita como
     * utilidade a mensagem presa a uma transação específica (pedido, horário,
     * pagamento). "Voltando à nossa conversa" não é, e ela reclassifica para
     * marketing sozinha: declarar utilidade só adiaria a mesma cobrança.
     */
    id: 'retomar-conversa',
    titulo: 'Retomar a conversa',
    resumo: 'Depois de 24h sem resposta, para continuar o atendimento. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, tudo bem? Estou retomando a nossa conversa por aqui. Ainda posso te ajudar com o que você precisava?',
    categoria: 'MARKETING',
    sinonimos: ['retomar', 'continuar', 'follow up', 'sumiu', 'janela', '24h'],
  },

  // -------------------------------------------------------------------------
  // Aulas e serviços com horário: pilates, academia, estúdio, escola, clínica
  // -------------------------------------------------------------------------
  {
    id: 'aulas-lembrete',
    ramo: 'aulas',
    titulo: 'Lembrete de aula',
    resumo: 'Avisa na véspera e pede confirmação.',
    corpo: 'Oi {nome}! Passando para lembrar da sua aula dia {data} às {hora}. Pode confirmar sua presença?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'véspera', 'presença', 'consulta'],
  },
  {
    id: 'aulas-horario-confirmado',
    ramo: 'aulas',
    titulo: 'Horário confirmado',
    resumo: 'Confirma na hora que o horário foi marcado.',
    corpo: 'Oi {nome}, seu horário está confirmado para {data} às {hora}. Até lá!',
    categoria: 'UTILITY',
    sinonimos: ['agendamento', 'marcado', 'agendou'],
  },
  {
    id: 'aulas-experimental',
    ramo: 'aulas',
    titulo: 'Aula experimental marcada',
    resumo: 'Para quem vai conhecer o espaço pela primeira vez.',
    corpo:
      'Oi {nome}! Sua aula experimental está marcada para {data} às {hora}. Venha com roupa confortável e chegue 10 minutos antes.',
    categoria: 'UTILITY',
    sinonimos: ['experimental', 'primeira aula', 'conhecer', 'teste'],
  },
  {
    id: 'aulas-remarcar',
    ramo: 'aulas',
    titulo: 'Remarcar aula',
    resumo: 'Quando é preciso trocar o horário combinado.',
    corpo: 'Oi {nome}, precisamos remarcar sua aula do dia {data}. Qual outro horário fica melhor para você?',
    categoria: 'UTILITY',
    sinonimos: ['remarcar', 'reagendar', 'trocar horário'],
  },
  {
    id: 'aulas-cancelada',
    ramo: 'aulas',
    titulo: 'Aula cancelada',
    resumo: 'Avisa um cancelamento e oferece reposição.',
    corpo:
      'Oi {nome}, a aula do dia {data} às {hora} foi cancelada. Sua reposição está garantida: me diga qual horário prefere.',
    categoria: 'UTILITY',
    sinonimos: ['cancelamento', 'reposição', 'feriado'],
  },
  {
    id: 'aulas-falta',
    ramo: 'aulas',
    titulo: 'Faltou na aula',
    resumo: 'No mesmo dia, para quem não apareceu.',
    corpo: 'Oi {nome}, sentimos sua falta na aula de hoje. Quer remarcar para outro dia desta semana?',
    categoria: 'UTILITY',
    sinonimos: ['falta', 'não compareceu', 'ausência', 'no show'],
  },
  {
    id: 'aulas-matricula',
    ramo: 'aulas',
    titulo: 'Matrícula confirmada',
    resumo: 'Boas-vindas para quem acabou de fechar.',
    corpo:
      'Oi {nome}, sua matrícula está confirmada! Suas aulas começam dia {data}. Qualquer dúvida, é só chamar aqui.',
    categoria: 'UTILITY',
    sinonimos: ['matrícula', 'boas-vindas', 'novo aluno', 'inscrição'],
  },
  {
    id: 'aulas-mensalidade',
    ramo: 'aulas',
    titulo: 'Mensalidade vencendo',
    resumo: 'Lembra da mensalidade antes de vencer.',
    corpo: 'Oi {nome}, sua mensalidade de {valor} vence dia {data}. Qualquer coisa, é só chamar aqui.',
    categoria: 'UTILITY',
    sinonimos: ['cobrança', 'boleto', 'pagamento', 'mensalidade', 'vencimento'],
  },
  {
    id: 'aulas-renovacao',
    ramo: 'aulas',
    titulo: 'Renovação do plano',
    resumo: 'Avisa que o plano está terminando.',
    corpo: 'Oi {nome}, seu plano termina dia {data}. Quer renovar e manter os seus horários?',
    categoria: 'UTILITY',
    sinonimos: ['renovar', 'plano', 'pacote', 'vencimento'],
  },
  {
    id: 'aulas-volta',
    ramo: 'aulas',
    titulo: 'Convite para voltar',
    resumo: 'Para aluno que parou de vir. Exige aceite de marketing.',
    corpo: 'Oi {nome}, faz um tempo que não te vemos por aqui. Que tal voltar? Temos horários livres nesta semana.',
    categoria: 'MARKETING',
    sinonimos: ['inativo', 'sumiu', 'reativar', 'voltar'],
  },

  // -------------------------------------------------------------------------
  // Loja virtual
  // -------------------------------------------------------------------------
  {
    id: 'ecommerce-pedido-recebido',
    ramo: 'ecommerce',
    titulo: 'Pedido recebido',
    resumo: 'Confirma a compra logo depois de fechada.',
    corpo: 'Oi {nome}! Recebemos seu pedido {codigo}. Assim que ele for enviado, avisamos por aqui.',
    categoria: 'UTILITY',
    sinonimos: ['compra', 'confirmação', 'pedido'],
  },
  {
    id: 'ecommerce-aguardando-pagamento',
    ramo: 'ecommerce',
    titulo: 'Aguardando pagamento',
    resumo: 'Pix ou boleto gerado e ainda não pago.',
    corpo:
      'Oi {nome}, seu pedido {codigo} está aguardando o pagamento de {valor}. Para concluir, acesse {link} e finalize por lá.',
    categoria: 'UTILITY',
    sinonimos: ['pix', 'boleto', 'pendente', 'pagamento'],
  },
  {
    id: 'ecommerce-pagamento-aprovado',
    ramo: 'ecommerce',
    titulo: 'Pagamento aprovado',
    resumo: 'Avisa que o pagamento caiu e o pedido segue.',
    corpo: 'Oi {nome}, o pagamento do pedido {codigo} foi aprovado. Já estamos separando os seus produtos.',
    categoria: 'UTILITY',
    sinonimos: ['aprovado', 'pago', 'pagamento'],
  },
  {
    id: 'ecommerce-enviado',
    ramo: 'ecommerce',
    titulo: 'Pedido enviado',
    resumo: 'Manda o rastreio quando o pedido sai.',
    corpo: 'Oi {nome}! Seu pedido {codigo} foi enviado. Acompanhe a entrega em {link} quando quiser.',
    categoria: 'UTILITY',
    sinonimos: ['envio', 'rastreio', 'transportadora', 'correios'],
  },
  {
    id: 'ecommerce-entregue',
    ramo: 'ecommerce',
    titulo: 'Pedido entregue',
    resumo: 'Confirma a entrega e abre espaço para problema.',
    corpo: 'Oi {nome}, seu pedido {codigo} foi entregue. Se algo não estiver certo, é só responder esta mensagem.',
    categoria: 'UTILITY',
    sinonimos: ['entrega', 'chegou', 'recebido'],
  },
  {
    id: 'ecommerce-troca',
    ramo: 'ecommerce',
    titulo: 'Troca ou devolução',
    resumo: 'Confirma que o pedido de troca foi recebido.',
    corpo:
      'Oi {nome}, recebemos a sua solicitação de troca do pedido {codigo}. Vamos te orientar sobre os próximos passos por aqui.',
    categoria: 'UTILITY',
    sinonimos: ['troca', 'devolução', 'defeito', 'arrependimento'],
  },
  {
    id: 'ecommerce-reembolso',
    ramo: 'ecommerce',
    titulo: 'Reembolso feito',
    resumo: 'Avisa que o dinheiro foi devolvido.',
    corpo:
      'Oi {nome}, o reembolso de {valor} do pedido {codigo} foi feito. Pode levar alguns dias para aparecer na sua fatura.',
    categoria: 'UTILITY',
    sinonimos: ['estorno', 'reembolso', 'devolução do dinheiro'],
  },
  {
    /*
     * A pesquisa que abre um fluxo: os botões são a primeira pergunta dele, e
     * o toque chega como resposta (Automações > Eventos, "Começar pelo
     * modelo"). Nasceu da PCYES, em 26/out/2026.
     */
    id: 'ecommerce-avaliacao',
    ramo: 'ecommerce',
    titulo: 'Pesquisa pós-compra',
    resumo: 'Pergunta como foi a compra, com botões de resposta.',
    corpo: 'Oi {nome}! Como foi sua experiência de compra no pedido {codigo}?',
    categoria: 'UTILITY',
    sinonimos: ['avaliação', 'pesquisa', 'satisfação', 'feedback', 'nps', 'experiência'],
    respostas: ['Foi ótima', 'Foi ok', 'Tive um problema'],
  },
  {
    id: 'ecommerce-carrinho',
    ramo: 'ecommerce',
    titulo: 'Carrinho abandonado',
    resumo: 'Para quem parou antes de pagar. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, você deixou alguns produtos no carrinho. Para finalizar a compra, acesse {link} quando quiser.',
    categoria: 'MARKETING',
    sinonimos: ['carrinho', 'abandono', 'desistiu', 'checkout'],
  },
  {
    id: 'ecommerce-novidade',
    ramo: 'ecommerce',
    titulo: 'Novidade ou promoção',
    resumo: 'Divulga lançamento ou oferta. Exige aceite de marketing.',
    corpo: 'Oi {nome}! Chegaram novidades que combinam com você. Para ver, acesse {link} antes que acabe.',
    categoria: 'MARKETING',
    sinonimos: ['oferta', 'desconto', 'lançamento', 'campanha', 'cupom'],
  },

  // -------------------------------------------------------------------------
  // Restaurante, lanchonete, delivery
  // -------------------------------------------------------------------------
  {
    id: 'restaurante-pedido-recebido',
    ramo: 'restaurante',
    titulo: 'Pedido recebido',
    resumo: 'Confirma que o pedido entrou na cozinha.',
    corpo: 'Oi {nome}! Recebemos seu pedido {codigo} e ele já está sendo preparado.',
    categoria: 'UTILITY',
    sinonimos: ['pedido', 'confirmação', 'cozinha'],
  },
  {
    id: 'restaurante-saiu',
    ramo: 'restaurante',
    titulo: 'Saiu para entrega',
    resumo: 'Avisa que o motoboy está a caminho.',
    corpo: 'Oi {nome}, seu pedido {codigo} saiu para entrega e chega em breve. Bom apetite!',
    categoria: 'UTILITY',
    sinonimos: ['entrega', 'motoboy', 'delivery', 'a caminho'],
  },
  {
    id: 'restaurante-retirada',
    ramo: 'restaurante',
    titulo: 'Pronto para retirada',
    resumo: 'Para quem vem buscar no balcão.',
    corpo: 'Oi {nome}, seu pedido {codigo} está pronto para retirada no balcão. Até já!',
    categoria: 'UTILITY',
    sinonimos: ['retirada', 'balcão', 'buscar', 'pronto'],
  },
  {
    id: 'restaurante-atraso',
    ramo: 'restaurante',
    titulo: 'Pedido vai atrasar',
    resumo: 'Avisa antes que o cliente pergunte.',
    corpo: 'Oi {nome}, seu pedido {codigo} vai atrasar alguns minutos. Pedimos desculpas, ele já está quase pronto.',
    categoria: 'UTILITY',
    sinonimos: ['atraso', 'demora', 'desculpas'],
  },
  {
    id: 'restaurante-reserva',
    ramo: 'restaurante',
    titulo: 'Reserva confirmada',
    resumo: 'Confirma a mesa na hora que foi reservada.',
    corpo: 'Oi {nome}, sua reserva está confirmada para {data} às {hora}. Estamos te esperando!',
    categoria: 'UTILITY',
    sinonimos: ['reserva', 'mesa', 'confirmação'],
  },
  {
    id: 'restaurante-lembrete-reserva',
    ramo: 'restaurante',
    titulo: 'Lembrete de reserva',
    resumo: 'No dia, para confirmar se a mesa continua de pé.',
    corpo: 'Oi {nome}! Lembrete da sua reserva de hoje às {hora}. Podemos manter a mesa?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'reserva', 'mesa'],
  },
  {
    id: 'restaurante-avaliacao',
    ramo: 'restaurante',
    titulo: 'O que achou do pedido',
    resumo: 'Depois da refeição, pede a opinião.',
    corpo: 'Oi {nome}! O que achou do pedido de hoje? Sua opinião ajuda a gente a melhorar.',
    categoria: 'UTILITY',
    sinonimos: ['avaliação', 'pesquisa', 'satisfação', 'feedback'],
  },
  {
    id: 'restaurante-cardapio',
    ramo: 'restaurante',
    titulo: 'Cardápio do dia',
    resumo: 'Divulga o prato ou a promoção de hoje. Exige aceite de marketing.',
    corpo: 'Oi {nome}! O cardápio de hoje já está no ar. Para pedir, acesse {link} e escolha o seu.',
    categoria: 'MARKETING',
    sinonimos: ['cardápio', 'prato do dia', 'promoção', 'menu'],
  },
  {
    id: 'restaurante-volta',
    ramo: 'restaurante',
    titulo: 'Convite para pedir de novo',
    resumo: 'Para cliente que não pede há um tempo. Exige aceite de marketing.',
    corpo: 'Oi {nome}, faz tempo que você não pede com a gente. Que tal matar a saudade hoje?',
    categoria: 'MARKETING',
    sinonimos: ['inativo', 'sumiu', 'saudade', 'voltar'],
  },

  // -------------------------------------------------------------------------
  // Loja física, comércio: loja de bairro, papelaria, pet shop
  // -------------------------------------------------------------------------
  {
    id: 'comercio-orcamento',
    ramo: 'comercio',
    titulo: 'Orçamento pronto',
    resumo: 'Responde o orçamento pedido.',
    corpo: 'Oi {nome}, seu orçamento ficou no valor de {valor}. Posso separar os itens para você?',
    categoria: 'UTILITY',
    sinonimos: ['orçamento', 'cotação', 'preço'],
  },
  {
    id: 'comercio-separado',
    ramo: 'comercio',
    titulo: 'Pedido separado',
    resumo: 'Avisa que dá para buscar na loja.',
    corpo: 'Oi {nome}, seu pedido {codigo} está separado e pronto para retirada na loja.',
    categoria: 'UTILITY',
    sinonimos: ['retirada', 'separado', 'buscar', 'pronto'],
  },
  {
    id: 'comercio-encomenda',
    ramo: 'comercio',
    titulo: 'Encomenda chegou',
    resumo: 'O produto que faltava chegou na loja.',
    corpo: 'Oi {nome}! O produto que você encomendou chegou. Pode passar na loja para retirar quando quiser.',
    categoria: 'UTILITY',
    sinonimos: ['encomenda', 'chegou', 'reposição', 'estoque'],
  },
  {
    id: 'comercio-entrega',
    ramo: 'comercio',
    titulo: 'Saiu para entrega',
    resumo: 'Avisa que a entrega está a caminho.',
    corpo: 'Oi {nome}! Seu pedido {codigo} saiu para entrega e chega hoje.',
    categoria: 'UTILITY',
    sinonimos: ['entrega', 'a caminho', 'motoboy'],
  },
  {
    id: 'comercio-horario',
    ramo: 'comercio',
    titulo: 'Horário confirmado',
    resumo: 'Para serviço com hora marcada, como banho e tosa.',
    corpo: 'Oi {nome}, seu horário está confirmado para {data} às {hora}. Até lá!',
    categoria: 'UTILITY',
    sinonimos: ['agendamento', 'banho', 'tosa', 'serviço', 'marcado'],
  },
  {
    id: 'comercio-pagamento',
    ramo: 'comercio',
    titulo: 'Pagamento recebido',
    resumo: 'Confirma o Pix ou o pagamento feito.',
    corpo: 'Oi {nome}, recebemos seu pagamento de {valor}. Obrigado pela compra!',
    categoria: 'UTILITY',
    sinonimos: ['pix', 'pagamento', 'comprovante', 'recebido'],
  },
  {
    id: 'comercio-parcela',
    ramo: 'comercio',
    titulo: 'Parcela vencendo',
    resumo: 'Lembra do crediário antes de vencer.',
    corpo: 'Oi {nome}, sua parcela de {valor} vence dia {data}. Qualquer coisa, é só chamar aqui.',
    categoria: 'UTILITY',
    sinonimos: ['crediário', 'parcela', 'cobrança', 'boleto', 'fiado'],
  },
  {
    id: 'comercio-pos-venda',
    ramo: 'comercio',
    titulo: 'Depois da compra',
    resumo: 'Alguns dias depois, pergunta se deu tudo certo.',
    corpo: 'Oi {nome}! Gostou da sua compra? Se precisar de alguma coisa, é só responder por aqui.',
    categoria: 'UTILITY',
    sinonimos: ['pós-venda', 'satisfação', 'feedback', 'avaliação'],
  },
  {
    id: 'comercio-promocao',
    ramo: 'comercio',
    titulo: 'Promoção da semana',
    resumo: 'Divulga as ofertas. Exige aceite de marketing.',
    corpo: 'Oi {nome}! Esta semana tem promoção na loja. Para ver as ofertas, acesse {link} e aproveite.',
    categoria: 'MARKETING',
    sinonimos: ['oferta', 'desconto', 'promoção', 'campanha'],
  },
  {
    id: 'comercio-volta',
    ramo: 'comercio',
    titulo: 'Convite para voltar',
    resumo: 'Para cliente que não aparece há um tempo. Exige aceite de marketing.',
    corpo: 'Oi {nome}, sentimos sua falta por aqui! Passe na loja para ver as novidades da semana.',
    categoria: 'MARKETING',
    sinonimos: ['inativo', 'sumiu', 'saudade', 'voltar'],
  },
  // -------------------------------------------------------------------------
  // Clínica, consultório, odontologia. Nada de diagnóstico, exame ou doença no texto: dado de saúde é sensível (docs/SEGMENTOS-NOVOS.md §3).
  // -------------------------------------------------------------------------
  {
    id: 'saude-lembrete',
    ramo: 'saude',
    titulo: 'Lembrete de consulta',
    resumo: 'Avisa na véspera e pede confirmação.',
    corpo:
      'Oi {nome}! Lembrando da sua consulta dia {data} às {hora}. Pode confirmar sua presença?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'véspera', 'confirmar', 'consulta'],
  },
  {
    id: 'saude-confirmada',
    ramo: 'saude',
    titulo: 'Consulta marcada',
    resumo: 'Confirma na hora que a consulta foi marcada.',
    corpo:
      'Oi {nome}, sua consulta está marcada para o dia {data} às {hora}. Chegue com 15 minutos de antecedência.',
    categoria: 'UTILITY',
    sinonimos: ['agendamento', 'marcada', 'agendou'],
  },
  {
    id: 'saude-remarcar',
    ramo: 'saude',
    titulo: 'Remarcar consulta',
    resumo: 'Quando a clínica precisa trocar o horário.',
    corpo:
      'Oi {nome}, precisamos remarcar sua consulta do dia {data}. Qual outro horário fica melhor para você?',
    categoria: 'UTILITY',
    sinonimos: ['remarcar', 'reagendar', 'trocar horário'],
  },
  {
    id: 'saude-falta',
    ramo: 'saude',
    titulo: 'Faltou na consulta',
    resumo: 'No mesmo dia, para quem não compareceu.',
    corpo:
      'Oi {nome}, sentimos sua falta na consulta de hoje. Quer marcar um novo horário?',
    categoria: 'UTILITY',
    sinonimos: ['falta', 'não compareceu', 'no show'],
  },
  {
    id: 'saude-documentos',
    ramo: 'saude',
    titulo: 'Documentos para a consulta',
    resumo: 'Lembra o que levar no dia.',
    corpo:
      'Oi {nome}, para a consulta do dia {data}, traga um documento com foto e a carteirinha do convênio.',
    categoria: 'UTILITY',
    sinonimos: ['documentos', 'carteirinha', 'convênio', 'levar'],
  },
  {
    id: 'saude-retorno',
    ramo: 'saude',
    titulo: 'Lembrete de retorno',
    resumo: 'Para o retorno combinado com o profissional.',
    corpo:
      'Oi {nome}, está chegando a data do seu retorno. Responda esta mensagem para escolher o melhor dia.',
    categoria: 'UTILITY',
    sinonimos: ['retorno', 'revisão', 'volta'],
  },
  {
    id: 'saude-pagamento',
    ramo: 'saude',
    titulo: 'Cobrança da consulta',
    resumo: 'Envia o valor e o link de pagamento.',
    corpo:
      'Oi {nome}, o valor da sua consulta é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['pagamento', 'cobrança', 'pix', 'particular'],
  },
  {
    id: 'saude-campanha',
    ramo: 'saude',
    titulo: 'Campanha de prevenção',
    resumo: 'Convida para um check-up. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Este mês a clínica tem horários especiais para check-up. Responda esta mensagem para agendar o seu.',
    categoria: 'MARKETING',
    sinonimos: ['campanha', 'check-up', 'prevenção', 'promoção'],
  },

  // -------------------------------------------------------------------------
  // Laboratório. O resultado nunca vai na mensagem: só o aviso e o caminho do portal.
  // -------------------------------------------------------------------------
  {
    id: 'lab-coleta',
    ramo: 'laboratorio',
    titulo: 'Coleta agendada',
    resumo: 'Confirma o dia e o horário da coleta.',
    corpo:
      'Oi {nome}, sua coleta está agendada para o dia {data} às {hora}. Siga o preparo que enviamos.',
    categoria: 'UTILITY',
    sinonimos: ['coleta', 'agendada', 'exame'],
  },
  {
    id: 'lab-preparo',
    ramo: 'laboratorio',
    titulo: 'Lembrete de preparo',
    resumo: 'Na véspera, lembra jejum e preparo.',
    corpo:
      'Oi {nome}, lembrete para a sua coleta de amanhã: siga o jejum e o preparo indicados no pedido.',
    categoria: 'UTILITY',
    sinonimos: ['jejum', 'preparo', 'véspera'],
  },
  {
    id: 'lab-resultado',
    ramo: 'laboratorio',
    titulo: 'Resultado disponível',
    resumo: 'Avisa que saiu, sem nada do conteúdo.',
    corpo:
      'Oi {nome}, seu resultado já está disponível. Acesse {link} com o seu protocolo para ver.',
    categoria: 'UTILITY',
    sinonimos: ['resultado', 'laudo', 'pronto'],
  },
  {
    id: 'lab-protocolo',
    ramo: 'laboratorio',
    titulo: 'Protocolo de atendimento',
    resumo: 'Envia o protocolo depois da coleta.',
    corpo:
      'Oi {nome}, o seu protocolo é o número {codigo}. Guarde para acessar o resultado.',
    categoria: 'UTILITY',
    sinonimos: ['protocolo', 'senha', 'código'],
  },
  {
    id: 'lab-domiciliar',
    ramo: 'laboratorio',
    titulo: 'Coleta em casa confirmada',
    resumo: 'Confirma a visita da coleta domiciliar.',
    corpo:
      'Oi {nome}, a coleta em casa está confirmada para o dia {data} às {hora}. Nossa equipe vai até você.',
    categoria: 'UTILITY',
    sinonimos: ['domiciliar', 'em casa', 'visita'],
  },
  {
    id: 'lab-remarcar',
    ramo: 'laboratorio',
    titulo: 'Remarcar coleta',
    resumo: 'Quando é preciso trocar o horário.',
    corpo:
      'Oi {nome}, precisamos remarcar sua coleta do dia {data}. Qual outro horário fica melhor?',
    categoria: 'UTILITY',
    sinonimos: ['remarcar', 'reagendar'],
  },
  {
    id: 'lab-pagamento',
    ramo: 'laboratorio',
    titulo: 'Cobrança dos exames',
    resumo: 'Envia o total e o link de pagamento.',
    corpo:
      'Oi {nome}, o total dos seus exames é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['pagamento', 'orçamento', 'pix'],
  },
  {
    id: 'lab-campanha',
    ramo: 'laboratorio',
    titulo: 'Campanha de check-up',
    resumo: 'Divulga pacote de exames. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Este mês temos pacote de check-up com condição especial. Responda para saber mais.',
    categoria: 'MARKETING',
    sinonimos: ['campanha', 'check-up', 'promoção'],
  },

  // -------------------------------------------------------------------------
  // Farmácia e drogaria.
  // -------------------------------------------------------------------------
  {
    id: 'farmacia-pedido-recebido',
    ramo: 'farmacia',
    titulo: 'Pedido recebido',
    resumo: 'Confirma o pedido feito pelo WhatsApp.',
    corpo:
      'Oi {nome}, recebemos o seu pedido número {codigo}. Já estamos separando os produtos.',
    categoria: 'UTILITY',
    sinonimos: ['pedido', 'recebido', 'separando'],
  },
  {
    id: 'farmacia-saiu',
    ramo: 'farmacia',
    titulo: 'Pedido saiu para entrega',
    resumo: 'Avisa que o entregador está a caminho.',
    corpo:
      'Oi {nome}, seu pedido número {codigo} saiu para entrega e chega em breve.',
    categoria: 'UTILITY',
    sinonimos: ['entrega', 'saiu', 'motoboy'],
  },
  {
    id: 'farmacia-retirada',
    ramo: 'farmacia',
    titulo: 'Pronto para retirar',
    resumo: 'Avisa que o pedido espera no balcão.',
    corpo:
      'Oi {nome}, seu pedido número {codigo} está pronto para retirada no balcão.',
    categoria: 'UTILITY',
    sinonimos: ['retirada', 'balcão', 'pronto'],
  },
  {
    id: 'farmacia-receita',
    ramo: 'farmacia',
    titulo: 'Receita para conferir',
    resumo: 'Pede a receita antes de separar.',
    corpo:
      'Oi {nome}, para separar o seu pedido o farmacêutico precisa conferir a receita. Pode enviar uma foto por aqui?',
    categoria: 'UTILITY',
    sinonimos: ['receita', 'farmacêutico', 'conferir'],
  },
  {
    id: 'farmacia-recompra',
    ramo: 'farmacia',
    titulo: 'Lembrete de recompra',
    resumo: 'Para uso contínuo, quando está acabando.',
    corpo:
      'Oi {nome}, o seu medicamento de uso contínuo deve estar acabando. Quer que a gente separe para você?',
    categoria: 'UTILITY',
    sinonimos: ['recompra', 'uso contínuo', 'acabando'],
  },
  {
    id: 'farmacia-pagamento',
    ramo: 'farmacia',
    titulo: 'Link de pagamento',
    resumo: 'Envia o total e o link.',
    corpo:
      'Oi {nome}, o total do seu pedido é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['pagamento', 'pix', 'link'],
  },
  {
    id: 'farmacia-ofertas',
    ramo: 'farmacia',
    titulo: 'Ofertas da semana',
    resumo: 'Divulga as ofertas. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Esta semana tem oferta em produtos de higiene e beleza. Acesse {link} e confira.',
    categoria: 'MARKETING',
    sinonimos: ['oferta', 'promoção', 'desconto'],
  },
  {
    id: 'farmacia-plantao',
    ramo: 'farmacia',
    titulo: 'Aviso de plantão',
    resumo: 'Avisa o dia de plantão da farmácia.',
    corpo:
      'Oi {nome}, estaremos de plantão no dia {data}. Conte com a gente.',
    categoria: 'MARKETING',
    sinonimos: ['plantão', 'domingo', 'feriado'],
  },

  // -------------------------------------------------------------------------
  // Salão, barbearia, estética.
  // -------------------------------------------------------------------------
  {
    id: 'salao-lembrete',
    ramo: 'salao',
    titulo: 'Lembrete de horário',
    resumo: 'Avisa na véspera e pede confirmação.',
    corpo:
      'Oi {nome}! Lembrando do seu horário dia {data} às {hora}. Pode confirmar?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'véspera', 'confirmar'],
  },
  {
    id: 'salao-confirmado',
    ramo: 'salao',
    titulo: 'Horário marcado',
    resumo: 'Confirma na hora que o horário foi marcado.',
    corpo:
      'Oi {nome}, seu horário está marcado para o dia {data} às {hora}. Até lá!',
    categoria: 'UTILITY',
    sinonimos: ['agendamento', 'marcado'],
  },
  {
    id: 'salao-remarcar',
    ramo: 'salao',
    titulo: 'Remarcar horário',
    resumo: 'Quando é preciso trocar o horário.',
    corpo:
      'Oi {nome}, precisamos remarcar seu horário do dia {data}. Qual outro horário fica melhor para você?',
    categoria: 'UTILITY',
    sinonimos: ['remarcar', 'reagendar'],
  },
  {
    id: 'salao-falta',
    ramo: 'salao',
    titulo: 'Faltou no horário',
    resumo: 'No mesmo dia, para quem não apareceu.',
    corpo:
      'Oi {nome}, sentimos sua falta hoje. Quer marcar um novo horário?',
    categoria: 'UTILITY',
    sinonimos: ['falta', 'no show'],
  },
  {
    id: 'salao-pagamento',
    ramo: 'salao',
    titulo: 'Link de pagamento',
    resumo: 'Envia o valor e o link.',
    corpo:
      'Oi {nome}, o valor do seu atendimento é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['pagamento', 'pix'],
  },
  {
    id: 'salao-retorno',
    ramo: 'salao',
    titulo: 'Hora de voltar',
    resumo: 'Para manutenção de corte, unha ou coloração.',
    corpo:
      'Oi {nome}, já faz um tempo desde o seu último atendimento. Quer marcar a manutenção?',
    categoria: 'MARKETING',
    sinonimos: ['retorno', 'manutenção', 'voltar'],
  },
  {
    id: 'salao-aniversario',
    ramo: 'salao',
    titulo: 'Feliz aniversário',
    resumo: 'Parabéns com um mimo. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, feliz aniversário! Neste mês você tem um mimo especial no seu próximo atendimento.',
    categoria: 'MARKETING',
    sinonimos: ['aniversário', 'parabéns', 'mimo'],
  },
  {
    id: 'salao-vagas',
    ramo: 'salao',
    titulo: 'Horários livres hoje',
    resumo: 'Divulga encaixe do dia. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Abrimos horários para hoje. Responda esta mensagem para garantir o seu.',
    categoria: 'MARKETING',
    sinonimos: ['encaixe', 'vaga', 'hoje'],
  },

  // -------------------------------------------------------------------------
  // Pet shop e veterinária.
  // -------------------------------------------------------------------------
  {
    id: 'pet-lembrete',
    ramo: 'pet',
    titulo: 'Lembrete de banho e tosa',
    resumo: 'Avisa na véspera e pede confirmação.',
    corpo:
      'Oi {nome}! Lembrando do banho e tosa dia {data} às {hora}. Pode confirmar?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'banho', 'tosa'],
  },
  {
    id: 'pet-pronto',
    ramo: 'pet',
    titulo: 'Pet pronto para buscar',
    resumo: 'Avisa que o animal está pronto.',
    corpo:
      'Oi {nome}, seu pet já está pronto e esperando por você. Pode vir buscar quando quiser.',
    categoria: 'UTILITY',
    sinonimos: ['pronto', 'buscar', 'retirar'],
  },
  {
    id: 'pet-leva-traz',
    ramo: 'pet',
    titulo: 'Busca a caminho',
    resumo: 'Avisa que o leva e traz saiu.',
    corpo:
      'Oi {nome}, nosso motorista está a caminho para buscar o seu pet. Chegamos em breve.',
    categoria: 'UTILITY',
    sinonimos: ['leva e traz', 'busca', 'motorista'],
  },
  {
    id: 'pet-vacina',
    ramo: 'pet',
    titulo: 'Lembrete de vacina',
    resumo: 'Avisa a data da próxima dose.',
    corpo:
      'Oi {nome}, a próxima vacina do seu pet está marcada para o dia {data}. Responda para confirmar o horário.',
    categoria: 'UTILITY',
    sinonimos: ['vacina', 'dose', 'reforço'],
  },
  {
    id: 'pet-consulta',
    ramo: 'pet',
    titulo: 'Consulta veterinária marcada',
    resumo: 'Confirma a consulta.',
    corpo:
      'Oi {nome}, a consulta do seu pet está marcada para o dia {data} às {hora}.',
    categoria: 'UTILITY',
    sinonimos: ['consulta', 'veterinário'],
  },
  {
    id: 'pet-pagamento',
    ramo: 'pet',
    titulo: 'Link de pagamento',
    resumo: 'Envia o valor e o link.',
    corpo:
      'Oi {nome}, o valor do atendimento é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['pagamento', 'pix'],
  },
  {
    id: 'pet-retorno',
    ramo: 'pet',
    titulo: 'Hora do próximo banho',
    resumo: 'Para quem já está no período. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, já está na hora do próximo banho do seu pet. Quer marcar?',
    categoria: 'MARKETING',
    sinonimos: ['retorno', 'banho', 'voltar'],
  },
  {
    id: 'pet-ofertas',
    ramo: 'pet',
    titulo: 'Ofertas de ração e acessórios',
    resumo: 'Divulga ofertas. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Esta semana tem oferta em ração e acessórios. Acesse {link} e confira.',
    categoria: 'MARKETING',
    sinonimos: ['oferta', 'ração', 'promoção'],
  },

  // -------------------------------------------------------------------------
  // Imobiliária e corretor.
  // -------------------------------------------------------------------------
  {
    id: 'imob-visita',
    ramo: 'imobiliaria',
    titulo: 'Visita marcada',
    resumo: 'Confirma dia e horário da visita.',
    corpo:
      'Oi {nome}, sua visita ao imóvel está marcada para o dia {data} às {hora}. O corretor encontra você no local.',
    categoria: 'UTILITY',
    sinonimos: ['visita', 'marcada', 'corretor'],
  },
  {
    id: 'imob-lembrete',
    ramo: 'imobiliaria',
    titulo: 'Lembrete de visita',
    resumo: 'Na véspera, pede confirmação.',
    corpo:
      'Oi {nome}! Lembrando da visita ao imóvel dia {data} às {hora}. Pode confirmar?',
    categoria: 'UTILITY',
    sinonimos: ['lembrete', 'véspera', 'visita'],
  },
  {
    id: 'imob-proposta',
    ramo: 'imobiliaria',
    titulo: 'Proposta recebida',
    resumo: 'Confirma que a proposta chegou.',
    corpo:
      'Oi {nome}, recebemos sua proposta de número {codigo}. O corretor retorna assim que o proprietário responder.',
    categoria: 'UTILITY',
    sinonimos: ['proposta', 'oferta', 'negociação'],
  },
  {
    id: 'imob-documentos',
    ramo: 'imobiliaria',
    titulo: 'Documentos pendentes',
    resumo: 'Pede o que falta para seguir.',
    corpo:
      'Oi {nome}, para seguir com o processo faltam alguns documentos. Acesse {link} para ver a lista.',
    categoria: 'UTILITY',
    sinonimos: ['documentos', 'pendente', 'cadastro'],
  },
  {
    id: 'imob-aluguel',
    ramo: 'imobiliaria',
    titulo: 'Lembrete de aluguel',
    resumo: 'Lembra o vencimento do aluguel.',
    corpo:
      'Oi {nome}, o aluguel no valor de {valor} vence dia {data}. Qualquer dúvida, estamos por aqui.',
    categoria: 'UTILITY',
    sinonimos: ['aluguel', 'vencimento', 'boleto'],
  },
  {
    id: 'imob-novidades',
    ramo: 'imobiliaria',
    titulo: 'Imóveis novos para você',
    resumo: 'Envia opções do perfil. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Chegaram imóveis novos no perfil que você procura. Acesse {link} e veja as opções.',
    categoria: 'MARKETING',
    sinonimos: ['novos', 'lançamento', 'opções'],
  },
  {
    id: 'imob-retomar',
    ramo: 'imobiliaria',
    titulo: 'Ainda procurando imóvel?',
    resumo: 'Retoma quem parou de responder. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, você ainda está procurando imóvel? Posso separar algumas opções para você.',
    categoria: 'MARKETING',
    sinonimos: ['retomar', 'procurando', 'sumiu'],
  },
  {
    id: 'imob-avaliacao',
    ramo: 'imobiliaria',
    titulo: 'Avaliação do seu imóvel',
    resumo: 'Para quem quer vender ou alugar. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Fazemos a avaliação do seu imóvel sem custo. Responda esta mensagem para agendar.',
    categoria: 'MARKETING',
    sinonimos: ['avaliação', 'anunciar', 'captação'],
  },

  // -------------------------------------------------------------------------
  // Pousada, hotel, hospedagem.
  // -------------------------------------------------------------------------
  {
    id: 'hosp-reserva',
    ramo: 'hospedagem',
    titulo: 'Reserva confirmada',
    resumo: 'Confirma a reserva com o código.',
    corpo:
      'Oi {nome}, sua reserva de número {codigo} está confirmada. Estamos esperando por você!',
    categoria: 'UTILITY',
    sinonimos: ['reserva', 'confirmada'],
  },
  {
    id: 'hosp-sinal',
    ramo: 'hospedagem',
    titulo: 'Sinal da reserva',
    resumo: 'Envia o valor do sinal e o link.',
    corpo:
      'Oi {nome}, para garantir a sua reserva o sinal é de {valor}. Para pagar, acesse {link} quando preferir.',
    categoria: 'UTILITY',
    sinonimos: ['sinal', 'pagamento', 'pix'],
  },
  {
    id: 'hosp-checkin',
    ramo: 'hospedagem',
    titulo: 'Lembrete de check-in',
    resumo: 'Na véspera, com horário e endereço.',
    corpo:
      'Oi {nome}! Sua chegada está marcada para o dia {data}. O check-in começa às {hora}.',
    categoria: 'UTILITY',
    sinonimos: ['check-in', 'chegada', 'véspera'],
  },
  {
    id: 'hosp-boas-vindas',
    ramo: 'hospedagem',
    titulo: 'Boas-vindas',
    resumo: 'No dia da chegada.',
    corpo:
      'Oi {nome}, seja bem-vindo! Qualquer coisa durante a estadia, é só chamar por aqui.',
    categoria: 'UTILITY',
    sinonimos: ['boas-vindas', 'estadia'],
  },
  {
    id: 'hosp-checkout',
    ramo: 'hospedagem',
    titulo: 'Check-out',
    resumo: 'Na manhã da saída.',
    corpo:
      'Oi {nome}, lembrando que o check-out é até as {hora}. Obrigado pela estadia!',
    categoria: 'UTILITY',
    sinonimos: ['check-out', 'saída'],
  },
  {
    id: 'hosp-avaliacao',
    ramo: 'hospedagem',
    titulo: 'Avaliação da estadia',
    resumo: 'Pede avaliação depois da saída.',
    corpo:
      'Oi {nome}, obrigado por se hospedar com a gente. Para contar como foi a sua estadia, acesse {link} quando puder.',
    categoria: 'UTILITY',
    sinonimos: ['avaliação', 'feedback'],
  },
  {
    id: 'hosp-feriado',
    ramo: 'hospedagem',
    titulo: 'Pacote de feriado',
    resumo: 'Divulga pacotes. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Abrimos as reservas para o feriado com pacote especial. Responda para saber as datas.',
    categoria: 'MARKETING',
    sinonimos: ['feriado', 'pacote', 'promoção'],
  },
  {
    id: 'hosp-volta',
    ramo: 'hospedagem',
    titulo: 'Convite para voltar',
    resumo: 'Para hóspede antigo. Exige aceite de marketing.',
    corpo:
      'Oi {nome}, que tal voltar a se hospedar com a gente? Temos condição especial para quem já é hóspede.',
    categoria: 'MARKETING',
    sinonimos: ['voltar', 'retorno', 'hóspede'],
  },
]

/**
 * Os modelos que a galeria mostra para a conta.
 *
 * Com ramo, **só os do ramo**: pedido do Gabriel em 05/out, "se eu sou do
 * nicho de e-commerce NÃO é para aparecer template de remarcar aula". É a
 * mesma regra dos fluxos (`modelosDeFluxo` em `core/nichos.ts`). Os sem ramo
 * vão para todos. Conta sem ramo vê todos, porque não há como saber qual serve.
 */
export function modelosDoRamo(nicho: Nicho | null | undefined): readonly ModeloPronto[] {
  return nicho ? MODELOS_PRONTOS.filter((m) => !m.ramo || m.ramo === nicho) : MODELOS_PRONTOS
}

// ---------------------------------------------------------------------------
// A tradução dos marcadores
// ---------------------------------------------------------------------------

/** Acha os `{campo}` de um texto, na ordem em que aparecem e sem repetir. */
export function camposUsados(corpo: string): string[] {
  const achados: string[] = []
  for (const casamento of corpo.matchAll(/\{([a-z_]+)\}/g)) {
    const id = casamento[1]!
    if (!achados.includes(id)) achados.push(id)
  }
  return achados
}

/**
 * Troca `{nome}` por `{{1}}`, na ordem de aparição.
 *
 * É aqui que o jargão da Meta entra, e é o único lugar onde ele existe, a
 * pessoa nunca digita um número entre chaves duplas.
 *
 * A ordem é a de aparição no texto porque é assim que a Meta numera: o primeiro
 * buraco é `{{1}}`. Numerar por outra regra faria o valor do nome aparecer no
 * lugar da data.
 */
export function paraFormatoDaMeta(corpo: string): {
  corpo: string
  /** Os campos na ordem em que a Meta os numerou. */
  campos: string[]
} {
  const campos = camposUsados(corpo)
  let saida = corpo
  campos.forEach((id, i) => {
    saida = saida.replaceAll(`{${id}}`, `{{${i + 1}}}`)
  })
  return { corpo: saida, campos }
}

/** Os exemplos de cada campo, na ordem da Meta. É o que ela exige na revisão. */
export function exemplosPara(campos: string[]): string[] {
  return campos.map((id) => CAMPOS.find((c) => c.id === id)?.exemplo ?? 'exemplo')
}

/**
 * O texto como o cliente vai ler, a prévia.
 *
 * Existe porque `Oi {nome}` não responde "o que a pessoa recebe?". Ver o nome
 * de alguém no lugar é o que faz a pessoa perceber que faltou vírgula, ou que o
 * texto ficou seco.
 */
export function previa(corpo: string): string {
  let saida = corpo
  for (const campo of CAMPOS) {
    saida = saida.replaceAll(`{${campo.id}}`, campo.exemplo)
  }
  return saida
}

/**
 * De volta do formato da Meta: que campo é cada `{{n}}`?
 *
 * ---------------------------------------------------------------------------
 * Por que isto precisa existir
 * ---------------------------------------------------------------------------
 *
 * `paraFormatoDaMeta` sabe que `{data}` virou `{{2}}`, mas o que fica gravado
 * no banco é só `{{2}}`. Quando a tela de transmissão abre um modelo aprovado e
 * precisa perguntar os valores, tudo o que ela tem é o corpo com números.
 *
 * Sem isto, a única pergunta possível seria **"valor da variável 2"**, que é
 * exatamente o jargão de API que a tela de modelos foi refeita para não ter.
 *
 * ---------------------------------------------------------------------------
 * Como adivinha, e o que faz quando não sabe
 * ---------------------------------------------------------------------------
 *
 * Pelas palavras imediatamente antes do buraco, que é como o texto de verdade
 * se comporta: "sua consulta é dia {{2}}" tem "dia" colado no buraco da data.
 * É heurística, e por isso ela **nunca inventa**: sem pista clara devolve
 * `null`, e quem chama pergunta de um jeito genérico em português ("O que entra
 * aqui"), nunca com o número da Meta.
 *
 * `{{1}}` é o caso especial e o mais comum: quase todo modelo começa
 * cumprimentando, e o primeiro buraco é o nome. Ele é `automatico`, então a
 * tela não o pergunta: sai do contato, um diferente por pessoa.
 */
export function camposDoCorpoDaMeta(corpo: string): (CampoDoModelo | null)[] {
  const quantos = (corpo.match(/\{\{(\d+)\}\}/g) ?? []).length
  const achados: (CampoDoModelo | null)[] = []

  for (let i = 1; i <= quantos; i += 1) {
    const posicao = corpo.indexOf(`{{${i}}}`)
    /*
     * Só o pedaço **entre o buraco anterior e este**, e nunca o texto inteiro
     * antes. A primeira versão olhava 40 caracteres para trás e lia o "dia" de
     * "dia {{2}} às {{3}}" ao adivinhar o `{{3}}`: a hora virava data.
     *
     * A pista de um buraco é a palavra que o antecede, não a que antecede o
     * vizinho.
     */
    const anterior = i > 1 ? corpo.indexOf(`{{${i - 1}}}`) : -1
    const comeco = anterior >= 0 ? anterior + `{{${i - 1}}}`.length : 0
    const antes = corpo.slice(comeco, posicao).toLowerCase()
    achados.push(adivinhar(antes, i))
  }

  return achados
}

/** Onde a última ocorrência começa, ou -1. */
function acharUltimo(texto: string, padrao: RegExp): number {
  let onde = -1
  for (const casamento of texto.matchAll(padrao)) onde = casamento.index
  return onde
}

/**
 * As pistas de cada campo: as palavras que aparecem **coladas** no buraco.
 *
 * Elas foram escolhidas contra os modelos prontos, e o teste de ida e volta é o
 * que as mantém honestas. Duas lições dele:
 *
 * - **palavra ambígua sai.** `em` era pista de data e roubava o link de
 *   "acompanhe em {{3}}"; `horário` era pista de hora e roubava a data de "seu
 *   horário está confirmado para {{2}}", onde ele nomeia a consulta, não a hora;
 * - **a preposição que antecede é a pista de verdade.** "de {{valor}}", "para
 *   {{data}}", "abrir {{link}}": é o verbo ou a preposição colada que diz o que
 *   vem, não o substantivo do começo da frase.
 */
const PISTAS: readonly { id: string; palavras: readonly string[] }[] = [
  { id: 'data', palavras: ['dia', 'data', 'para', 'vence'] },
  { id: 'hora', palavras: ['hora', 'horas', 'às', 'as'] },
  { id: 'valor', palavras: ['valor', 'preço', 'preco', 'total', 'parcela', 'de', 'r$'] },
  { id: 'codigo', palavras: ['código', 'codigo', 'número', 'numero', 'pedido', 'protocolo'] },
  { id: 'link', palavras: ['link', 'acesse', 'acompanhe', 'abrir', 'clique', 'http'] },
]

function adivinhar(antes: string, posicao: number): CampoDoModelo | null {
  // O primeiro buraco é o nome na esmagadora maioria dos modelos, e ele é o
  // único automático: errar aqui custaria perguntar o nome de 400 pessoas.
  if (posicao === 1 && /\b(oi|olá|ola|prezad|sr|sra|bom dia|boa tarde|boa noite)\b/.test(antes)) {
    return CAMPOS.find((c) => c.id === 'nome') ?? null
  }

  /*
   * A pista **mais próxima** do buraco ganha, e não a primeira da lista.
   *
   * "sua parcela de {{1}} vence dia {{2}}" tem "valor" e "dia" no mesmo pedaço;
   * quem decide é qual está colado no buraco.
   */
  let melhor: { id: string; onde: number } | null = null

  for (const pista of PISTAS) {
    for (const palavra of pista.palavras) {
      /*
       * Palavra inteira, e não pedaço de palavra. Com `includes`, o `as` de
       * "hora" casava dentro de **"sua"** e de "consulta", e a data virava
       * horário em metade dos modelos prontos.
       *
       * O limite é escrito à mão em vez de `\b` porque **`\b` não enxerga
       * acento**: para o JavaScript `à` não é caractere de palavra, então
       * `\bàs\b` nunca casa com "às", e era justo a pista do horário que sumia.
       */
      const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const letra = '[a-zà-ú0-9]'
      const limite = /^[a-zà-ú]/.test(palavra)
        ? `(?<!${letra})${escapada}(?!${letra})`
        : escapada
      const onde = acharUltimo(antes, new RegExp(limite, 'g'))
      if (onde === -1) continue
      if (!melhor || onde > melhor.onde) melhor = { id: pista.id, onde }
    }
  }

  return melhor ? (CAMPOS.find((c) => c.id === melhor.id) ?? null) : null
}

/**
 * Um nome para a Meta, tirado do texto.
 *
 * A pessoa não precisa inventar apelido: o nome é identificador interno da API,
 * não título. Sai das primeiras palavras do corpo, normalizado, com um sufixo
 * de tempo para não colidir com um modelo que já exista com o mesmo começo.
 */
export function nomeAutomatico(titulo: string, agora: Date = new Date()): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .slice(0, 4)
    .join('_')

  const carimbo = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`

  return `${base || 'modelo'}_${carimbo}`.slice(0, 512)
}
