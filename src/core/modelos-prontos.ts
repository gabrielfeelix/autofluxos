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
    id: 'ecommerce-avaliacao',
    ramo: 'ecommerce',
    titulo: 'O que achou da compra',
    resumo: 'Alguns dias depois da entrega.',
    corpo: 'Oi {nome}! O pedido {codigo} chegou bem? Conta pra gente o que achou da compra.',
    categoria: 'UTILITY',
    sinonimos: ['avaliação', 'pesquisa', 'satisfação', 'feedback'],
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
