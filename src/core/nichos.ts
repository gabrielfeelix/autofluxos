import type { PerguntaDaFicha } from './ficha-do-assistente'
import type { Objetivo } from './objetivo-da-conta'
import type { StatusDePedido } from './pedidos'
import type { SistemaDoRamo } from './sistemas-dos-ramos'

/**
 * O ramo da conta, e o que ele muda na tela (docs/NICHOS.md, docs/PLANO-NICHOS.md).
 *
 * ---------------------------------------------------------------------------
 * O ramo é um pacote de configuração, não um produto à parte
 * ---------------------------------------------------------------------------
 *
 * O código é um só. O banco continua dizendo "produto"; a tela diz Pratos,
 * Produtos ou Produtos e serviços conforme o ramo. Todo comportamento que muda
 * por ramo sai **deste arquivo**, de um objeto `PacoteDoNicho`, e nunca de um
 * `if` com o nome do ramo espalhado pelo código. `nichos.test.ts` varre `src/`
 * e falha se achar um.
 *
 * O pacote muda palavra, ícone e sugestão. **Não** muda permissão, cobrança
 * nem regra de negócio: permissão depende da função da pessoa, não do ramo
 * (PROPOSTA-19-SET, §1.1).
 *
 * ---------------------------------------------------------------------------
 * Sem ramo é o sistema de hoje
 * ---------------------------------------------------------------------------
 *
 * `clients.nicho` nulo quer dizer "geral": nenhum rótulo muda, nenhuma aba
 * some. Todas as contas que existiam antes do ramo continuam iguais, e é o que
 * `pacoteDo(null)` devolve.
 *
 * Puro, sem banco e sem React, como `core/planos.ts` e `core/objetivo-da-conta.ts`.
 */

export const NICHOS = [
  'aulas',
  'ecommerce',
  'restaurante',
  'comercio',
  'saude',
  'laboratorio',
  'farmacia',
  'salao',
  'pet',
  'imobiliaria',
  'hospedagem',
] as const

export type Nicho = (typeof NICHOS)[number]

export function ehNicho(valor: unknown): valor is Nicho {
  return typeof valor === 'string' && (NICHOS as readonly string[]).includes(valor)
}

/** O desenho da seção Comércio. Nome e não SVG: o desenho mora na barra. */
export type IconeDoComercio = 'sacola' | 'talheres' | 'vitrine' | 'planos'

/**
 * Os lugares da barra lateral que um ramo pode renomear ou esconder: a chave
 * de uma seção ou o `id` de um subitem (`components/design/secoes-do-cliente.tsx`).
 * A lista mora aqui, e não lá, para o núcleo não depender de componente;
 * `secoes-do-cliente.test.ts` confere que cada um existe de verdade na barra.
 *
 * Início, Conversas, Automações e Configurações ficam de fora de propósito:
 * são o mesmo trabalho em todo ramo, e é por eles que o suporte explica o
 * sistema.
 */
export const LUGARES_DA_BARRA = [
  'crm',
  'contatos',
  'segmentos',
  'negocios',
  'atividades',
  'loja',
  'catalogo',
  'pedidos',
  'conectar-loja',
  'analise',
  'vendas',
] as const

export type LugarDaBarra = (typeof LUGARES_DA_BARRA)[number]

export type PedidosDoRamo = {
  /** As etapas do quadro, na ordem, sem `cancelado` (que é saída, não etapa). */
  etapas: readonly StatusDePedido[]
  rotulos: Partial<Record<StatusDePedido, string>>
  /** Quadro onde a equipe acompanha de longe (cozinha); lista nos outros. */
  visao: 'quadro' | 'lista'
  /** Como o aviso fala do despacho: preparo e entrega, ou separação e envio. */
  despacho: 'preparo' | 'envio'
}

export type PacoteDoNicho = {
  /** Como o cartão do onboarding e a tela de recursos chamam o ramo. */
  nome: string
  /** Uma linha de exemplo, para a pessoa se reconhecer. */
  exemplos: string
  /** O objetivo que já vem marcado. O dono pode trocar. */
  objetivoSugerido: Objetivo
  /**
   * Os nomes que o ramo dá a seções e subitens da barra. O que não está aqui
   * fica com o nome de sempre. A mesma palavra vale no título da tela e na
   * tela de sem acesso (`rotuloNaBarra`).
   */
  rotulos: Partial<Record<LugarDaBarra, string>>
  /**
   * Subitens que não fazem sentido no ramo. Somem do menu, mas a rota direta
   * continua abrindo e o dado continua lá (PLANO-NICHOS 1.6). Seção que fica
   * sem subitem some inteira, como já acontecia com a permissão.
   */
  ocultos: LugarDaBarra[]
  iconeComercio: IconeDoComercio
  /**
   * Como a tela do catálogo abre. `grade` é foto grande, agrupada por
   * categoria, que é como se lê um cardápio; `lista` é a tabela de sempre.
   * As duas continuam a um clique: isto só escolhe a primeira.
   */
  visaoDoCatalogo: VisaoDoCatalogo
  /**
   * A tela do catálogo mostra o bloco do cardápio em arquivo (PDF e imagem,
   * tabela `materiais`), que o bot manda quando pedem "o cardápio".
   */
  materiais: boolean
  /**
   * Como a galeria chama o grupo de modelos do ramo: "Para restaurantes". É
   * o título do bloco em destaque, na galeria de fluxos e na de funis.
   */
  tituloDosModelos: string
  /**
   * Os modelos de fluxo do ramo, pelo id de `src/exemplos/modelos.ts`, na
   * ordem em que aparecem. A conta com ramo vê só estes e os de qualquer
   * negócio (`MODELOS_DE_QUALQUER_RAMO`): decisão do Gabriel em 26/set, "não
   * faz sentido uma automação de e-commerce para um lugar que não vende isso".
   * São também os que o preparo da conta vai instalar (PLANO-NICHOS 4.4).
   */
  modelosDeFluxo: string[]
  /** O modelo de funil do ramo, pelo id de `core/quadros-modelos.ts`. */
  modeloDeFunil: string
  /**
   * A tela Pedidos (0146): as etapas do ramo, os nomes delas e como a tela
   * abre. `null` = o ramo não tem pedido (aulas vende matrícula e
   * mensalidade): o item some do menu e o Cobrar cobra como sempre.
   */
  pedidos: PedidosDoRamo | null
  /**
   * Os blocos de Análise > Vendas que vêm primeiro, na ordem, enquanto a
   * pessoa não arrumou a tela (sem o cookie do arranjo). Vazio = a ordem de
   * sempre. Bloco que a conta não tem é pulado.
   */
  primeirosEmVendas: readonly string[]
  /**
   * A ficha do assistente de IA (PLANO-NICHOS 1.7, `core/ficha-do-assistente.ts`):
   * as perguntas que o cliente final sempre faz neste ramo, e o que o
   * assistente pode fazer, marcado por padrão.
   */
  ficha: { perguntas: PerguntaDaFicha[]; pode: string[] }
  /**
   * Os passos que a frente acrescenta aos primeiros passos do Início
   * (PLANO-NICHOS 1.3), na ordem. Quem diz se o passo está feito é a tela do
   * Início, que tem os números; aqui mora só qual passo a frente pede.
   */
  passosDoInicio: PassoDaFrente[]
  /**
   * O ramo lida com dado de saúde, que a LGPD trata como sensível (art. 11):
   * os modelos abrem com o aviso de uso do dado, e as `regrasDaIa` entram em
   * toda IA da conta (docs/SEGMENTOS-NOVOS.md §3).
   */
  dadoSensivel?: boolean
  /** Regras que valem acima da tarefa do bloco, em toda IA da conta deste ramo. */
  regrasDaIa?: readonly string[]
  /**
   * Os sistemas de gestão do ramo, na ordem da tela de integrações
   * (`core/sistemas-dos-ramos.ts`). Vazio = o ramo integra pelo que já existe
   * (loja on-line, cardápio, Verandi).
   */
  sistemas: readonly SistemaDoRamo[]
}

/**
 * Os passos que uma frente pode pedir no Início. `ficha`: a ficha do
 * assistente com quase todas as perguntas respondidas; `pratos`: cinco itens
 * do catálogo com foto; `cardapio`: o cardápio em arquivo.
 */
export const PASSOS_DA_FRENTE = ['ficha', 'pratos', 'cardapio'] as const

export type PassoDaFrente = (typeof PASSOS_DA_FRENTE)[number]

/**
 * A ficha conta como preenchida com 80% das perguntas respondidas: exigir
 * todas faria um passo nunca fechar por causa de uma pergunta que não se
 * aplica ao negócio (a MGM não escreve reposição e responde 8 de 9).
 */
export function fichaPreenchida(respondidas: number, total: number): boolean {
  return total > 0 && respondidas / total >= 0.8
}

/** Monta uma pergunta da ficha sem repetir o nome dos campos em toda linha. */
function p(
  id: string,
  titulo: string,
  comeca: string[],
  pergunta: string,
  exemplo: string,
  doCliente: string,
): PerguntaDaFicha {
  return { id, titulo, comeca, pergunta, exemplo, doCliente }
}

const ONDE_FICA = p(
  'onde',
  'ONDE FICA',
  ['onde fica', 'endereco', 'como chegar', 'localizacao'],
  'Onde fica? Tem estacionamento ou ponto de referência?',
  'Rua das Flores, 120, Centro. Em frente à praça. Estacionamento na rua.',
  'Onde vocês ficam?',
)

const PAGAMENTO = p(
  'pagamento',
  'PAGAMENTO',
  ['pagamento', 'formas de pagamento', 'parcelamento'],
  'Quais formas de pagamento vocês aceitam?',
  'Pix, cartão de crédito e débito. Parcelamos em até 3 vezes sem juros.',
  'Aceitam cartão?',
)

/**
 * As regras de IA dos ramos de saúde (docs/SEGMENTOS-NOVOS.md §3). Dado de
 * saúde é sensível pela LGPD, e palpite clínico de chatbot é risco para quem
 * lê. Valem acima da tarefa de qualquer bloco.
 */
const REGRAS_DE_SAUDE: readonly string[] = [
  'Não dê diagnóstico, não interprete sintoma nem resultado de exame, e não indique, troque ou ajuste remédio ou dose.',
  'Relato de urgência (dor no peito, falta de ar, sangramento, desmaio, ideia de se machucar): diga para ligar 192 ou procurar o pronto-socorro agora, e passe para uma pessoa da equipe.',
  'Não peça nem repita diagnóstico, CID, nome de doença ou resultado de exame na conversa. Para resultado, indique o caminho oficial (portal do laboratório ou retorno com o profissional).',
]

/**
 * Os modelos que servem a qualquer negócio, e por isso aparecem em toda
 * galeria com ramo, sob "Para qualquer negócio". Recado, menu de dúvidas e
 * pesquisa de satisfação são o mesmo trabalho na pizzaria e no estúdio.
 */
export const MODELOS_DE_QUALQUER_RAMO = ['recado', 'recado-curto', 'menu-atendimento', 'pesquisa-nps'] as const

/** O funil que serve a qualquer negócio: organizar quem chega pelo WhatsApp. */
export const FUNIS_DE_QUALQUER_RAMO = ['atendimento'] as const

export const VISOES_DO_CATALOGO = ['grade', 'lista'] as const

export type VisaoDoCatalogo = (typeof VISOES_DO_CATALOGO)[number]

export const PACOTES: Record<Nicho, PacoteDoNicho> = {
  /*
   * Aulas e serviços com horário: a frente da MGM Pilates. As palavras são as
   * que os fluxos publicados da MGM já usam (medido em 26/set: "aula" 128
   * vezes, "aluno" 99, "matrícula" 10, "cliente" nenhuma).
   *
   * A seção Comércio vira **Planos** (pedido do Gabriel, 26/set): o que um
   * estúdio vende são planos, pacotes e modalidades, e cadastrados no
   * catálogo a IA responde preço e modalidade com o dado certo. A agenda
   * continua no sistema do cliente, por integração: o AutoFluxos não vira
   * gestão de alunos. Integração de loja on-line não se aplica e some.
   */
  aulas: {
    nome: 'Aulas e serviços com horário',
    sistemas: ['evo', 'tecnofit', 'next_fit', 'cloudgym'],
    exemplos: 'pilates, academia, estúdio, escola, clínica',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Alunos', negocios: 'Matrículas', loja: 'Planos', catalogo: 'Planos e modalidades' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'planos',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para aulas e horários',
    modelosDeFluxo: ['agendamento', 'reagendamento', 'nao-comparecimento', 'lembrete', 'aluno-inativo', 'voltei-de-licenca'],
    modeloDeFunil: 'agendamento',
    pedidos: null,
    // As aulas da Verandi (a ponte) e a matrícula, para quem cobra mensalidade pelo AutoFluxos.
    primeirosEmVendas: ['aulas', 'mensalidades'],
    passosDoInicio: ['ficha'],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Explicar modalidades, planos e aula experimental', 'Mostrar planos e valores do catálogo', 'Informar horário e endereço'],
      perguntas: [
        p('oferta', 'O QUE OFERECEMOS', ['o que oferecemos', 'modalidades', 'servicos', 'aulas'], 'Que aulas e serviços vocês oferecem?', 'Pilates em aparelho em turma de até 5 pessoas, pilates individual e fisioterapia.', 'Quais aulas vocês têm?'),
        p('horarios', 'HORÁRIOS', ['horario', 'a grade', 'grade'], 'Qual o horário de funcionamento e a grade de aulas?', 'Segunda a sexta, das 7h às 21h. Sábado, das 8h às 12h.', 'Qual o horário de vocês?'),
        p('valores', 'VALORES', ['valores', 'planos', 'precos', 'preco'], 'Quais são os planos e valores? O que pode ser dito sobre preço?', 'Planos de 1, 2 ou 3 vezes por semana. Valor exato só na avaliação.', 'Quanto custa?'),
        p('experimental', 'AULA EXPERIMENTAL', ['aula experimental', 'experimental'], 'Tem aula experimental? Como funciona?', 'Sim, gratuita, só para pilates em aparelho. Agendada pelo WhatsApp.', 'Tem aula experimental?'),
        p('matricula', 'COMO FUNCIONA A MATRÍCULA', ['como funciona a matricula', 'matricula'], 'Como a pessoa se matricula?', 'Depois da aula experimental, a recepção envia o contrato e o link de pagamento.', 'Como faço para me matricular?'),
        p('cancelamento', 'CANCELAMENTO DE AULA', ['cancelamento', 'desmarcar'], 'Qual a regra para desmarcar uma aula?', 'Avisando com 2 horas de antecedência, a aula pode ser reposta.', 'Preciso desmarcar minha aula, como faço?'),
        p('reposicao', 'REPOSIÇÃO', ['reposicao'], 'Como funciona a reposição de aula perdida?', 'Cada aula desmarcada no prazo vira uma reposição, válida por 30 dias.', 'Posso repor a aula que perdi?'),
        ONDE_FICA,
        p('levar', 'O QUE LEVAR', ['o que levar'], 'O que a pessoa precisa levar no dia da aula?', 'Roupa confortável e meia antiderrapante.', 'O que eu levo na primeira aula?'),
      ],
    },
  },
  ecommerce: {
    nome: 'Loja virtual',
    sistemas: [],
    exemplos: 'loja no site, Magento, Nuvemshop',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Clientes', loja: 'Loja' },
    ocultos: [],
    iconeComercio: 'sacola',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para lojas virtuais',
    modelosDeFluxo: ['atendimento-loja', 'carrinho-abandonado', 'status-do-pedido', 'cobranca-amigavel'],
    modeloDeFunil: 'comercial',
    pedidos: {
      etapas: ['novo', 'pago', 'em_preparo', 'saiu', 'entregue'],
      rotulos: { em_preparo: 'Separando', saiu: 'Enviado' },
      visao: 'lista',
      despacho: 'envio',
    },
    primeirosEmVendas: ['recebido-pelo-chat', 'pedidos', 'vendidos-pelo-chat'],
    passosDoInicio: ['ficha'],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar produtos, fotos e preços do catálogo', 'Consultar o status de um pedido', 'Informar prazo de envio e frete'],
      perguntas: [
        p('oferta', 'O QUE VENDEMOS', ['o que vendemos', 'produtos'], 'O que a loja vende?', 'Eletrônicos e acessórios para casa e escritório.', 'O que vocês vendem?'),
        p('site', 'SITE', ['site', 'loja virtual'], 'Qual o endereço da loja virtual?', 'www.minhaloja.com.br', 'Qual o site de vocês?'),
        p('entrega', 'ENTREGA', ['entrega', 'envio', 'frete', 'prazo de envio'], 'Qual o prazo de envio e como se calcula o frete?', 'Postamos em até 2 dias úteis. O frete é calculado no carrinho pelo CEP.', 'Quanto tempo demora para chegar?'),
        /*
         * As quatro abaixo vieram da PCYES (30/set/2026), e cada uma foi uma
         * resposta errada do bot antes de existir: "o preço é o mesmo no Pix"
         * quando o Pix tinha 5%, "não temos cupom" com cupom ativo, o bot
         * dizendo que resolvia tudo quando garantia era de outro número, e o
         * cliente desconfiado do CNPJ na hora de pagar.
         */
        p('pagamento', 'PAGAMENTO', ['pagamento', 'formas de pagamento', 'parcelamento', 'pix'], 'Quais formas de pagamento vocês aceitam? Tem desconto no Pix? O preço do site é o do cartão?', 'Pix com 5% de desconto. O preço do site é o do cartão, em até 10x sem juros.', 'Tem desconto no Pix?'),
        p('cupom', 'CUPOM', ['cupom', 'cupons', 'desconto'], 'Tem cupom para quem chega pelo WhatsApp? Qual o código, quanto dá, o que fica de fora e se soma com o Pix?', 'CHAT10: 10% em todo o site, menos placas de vídeo. Soma com o desconto do Pix.', 'Tem algum cupom?'),
        p('outros-times', 'OUTROS TIMES', ['outros times', 'como atendemos', 'suporte', 'contatos'], 'Que assuntos não são atendidos aqui, e qual o contato de cada um?', 'Suporte técnico, garantia e peça de reposição: (11) 2101-1428, no WhatsApp. Compra para empresa: (11) 2101-1485.', 'Meu produto deu defeito, com quem falo?'),
        p('nome-no-pix', 'NOME NO PAGAMENTO', ['nome no pix', 'cnpj', 'razao social'], 'Que nome ou CNPJ aparece na hora de pagar?', 'Aparece Minha Loja Comércio Ltda, CNPJ 00.000.000/0001-00.', 'O Pix saiu com outro nome, é de vocês mesmo?'),
        p('trocas', 'TROCAS E DEVOLUÇÃO', ['troca', 'devolucao'], 'Como funciona troca e devolução?', 'Até 7 dias depois de receber, pelo site, com frete por nossa conta.', 'Como faço para trocar?'),
        p('garantia', 'GARANTIA', ['garantia'], 'Qual a garantia dos produtos?', '12 meses de garantia do fabricante.', 'Tem garantia?'),
        p('rastreio', 'RASTREIO', ['rastreio', 'rastreamento', 'status do pedido'], 'Como a pessoa acompanha o pedido?', 'O código de rastreio chega por e-mail quando o pedido é postado.', 'Cadê meu pedido?'),
        p('nota', 'NOTA FISCAL', ['nota fiscal', 'nf'], 'Como a pessoa recebe a nota fiscal?', 'A nota vai junto com o produto e por e-mail.', 'Vocês emitem nota fiscal?'),
        p('retirada', 'RETIRADA', ['retirada', 'retirar'], 'Dá para retirar pessoalmente?', 'Sim, na loja física, de segunda a sexta, das 9h às 18h.', 'Posso retirar aí?'),
        p('horario', 'HORÁRIO DO TIME', ['horario do time', 'horario'], 'Qual o horário de atendimento da equipe?', 'Segunda a sexta, das 9h às 18h.', 'Até que horas vocês atendem?'),
      ],
    },
  },
  restaurante: {
    nome: 'Restaurante, lanchonete, delivery',
    sistemas: [],
    exemplos: 'pizzaria, hamburgueria, marmitaria',
    objetivoSugerido: 'vender',
    // Negócios fica com o nome de sempre: "Pedidos" agora é a tela de pedidos (0146).
    rotulos: { contatos: 'Clientes', loja: 'Cardápio', catalogo: 'Pratos' },
    ocultos: [],
    iconeComercio: 'talheres',
    visaoDoCatalogo: 'grade',
    materiais: true,
    tituloDosModelos: 'Para restaurantes',
    modelosDeFluxo: ['cardapio-botoes', 'atendente-ia-restaurante', 'horario-e-local'],
    modeloDeFunil: 'pedidos',
    pedidos: { etapas: ['novo', 'pago', 'em_preparo', 'saiu', 'entregue'], rotulos: {}, visao: 'quadro', despacho: 'preparo' },
    primeirosEmVendas: ['pedidos', 'pedidos-horarios', 'vendidos-pelo-chat', 'pedidos-entrega'],
    passosDoInicio: ['pratos', 'cardapio', 'ficha'],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mandar o cardápio e fotos dos pratos', 'Ajudar a montar um pedido', 'Informar horário, entrega e endereço'],
      perguntas: [
        p('horario', 'HORÁRIO', ['horario', 'funcionamento'], 'Qual o horário de funcionamento?', 'Terça a domingo, das 18h às 23h30.', 'Vocês estão abertos?'),
        p('entrega', 'ENTREGA', ['entrega', 'area de entrega', 'taxa de entrega', 'delivery'], 'Até onde vocês entregam e qual a taxa?', 'Entregamos até 5 km. Taxa de R$ 5 no centro e R$ 8 nos bairros.', 'Entregam no meu bairro? Qual a taxa?'),
        p('tempo', 'TEMPO DE ENTREGA', ['tempo', 'prazo'], 'Quanto tempo leva, em média, para o pedido chegar?', 'De 40 a 60 minutos. Sexta e sábado pode passar de 1 hora.', 'Quanto tempo demora?'),
        PAGAMENTO,
        p('minimo', 'PEDIDO MÍNIMO', ['pedido minimo', 'minimo'], 'Tem pedido mínimo para entrega?', 'R$ 30 para entrega. Retirada sem mínimo.', 'Tem pedido mínimo?'),
        p('meia', 'MEIA A MEIA', ['meia a meia', 'meio a meio', 'sabores'], 'Dá para pedir meia a meia? Como se cobra?', 'Sim, até 2 sabores. Cobramos o valor do sabor mais caro.', 'Pode ser meia calabresa meia mussarela?'),
        p('restricoes', 'OPÇÕES SEM LACTOSE, VEGETARIANAS E OUTRAS', ['opcoes', 'sem lactose', 'vegetarian', 'vegan', 'sem gluten', 'restricoes'], 'Tem opção sem lactose, vegetariana ou sem glúten?', 'Temos 3 pizzas vegetarianas. Sem lactose e sem glúten não fazemos.', 'Tem pizza sem lactose?'),
        p('retirada', 'RETIRADA NO BALCÃO', ['retirada', 'balcao', 'retirar'], 'Dá para retirar no balcão?', 'Sim, com 10% de desconto.', 'Posso buscar aí?'),
        ONDE_FICA,
      ],
    },
  },
  comercio: {
    nome: 'Loja física, comércio',
    sistemas: [],
    exemplos: 'loja de bairro, papelaria, pet shop',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Clientes', loja: 'Produtos', catalogo: 'Produtos e serviços' },
    // Integração é com loja on-line; quem vende no balcão não tem o que ligar.
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para o seu comércio',
    modelosDeFluxo: ['voces-tem', 'horario-e-local'],
    // Quem vende no balcão atende mais do que negocia: a venda acontece na
    // loja, e o que o WhatsApp organiza é a pergunta de quem vai passar lá.
    modeloDeFunil: 'atendimento',
    // Balcão: paga e leva na hora, sem preparo nem entrega.
    pedidos: { etapas: ['novo', 'pago', 'entregue'], rotulos: { entregue: 'Retirado' }, visao: 'lista', despacho: 'preparo' },
    primeirosEmVendas: ['pedidos', 'vendidos-pelo-chat', 'pedidos-horarios'],
    passosDoInicio: ['ficha'],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Dizer se tem o produto e quanto custa', 'Informar horário e endereço'],
      perguntas: [
        p('oferta', 'O QUE VENDEMOS', ['o que vendemos', 'o que oferecemos', 'produtos'], 'O que a loja vende?', 'Material escolar, papelaria e presentes.', 'O que vocês vendem?'),
        p('horario', 'HORÁRIO', ['horario', 'funcionamento'], 'Qual o horário de funcionamento?', 'Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.', 'Que horas vocês abrem?'),
        ONDE_FICA,
        p('entrega', 'ENTREGA', ['entrega', 'delivery'], 'Vocês entregam? Onde e por quanto?', 'Entregamos no bairro por R$ 5, pedidos até as 16h.', 'Vocês entregam?'),
        PAGAMENTO,
        p('encomenda', 'ENCOMENDA', ['encomenda', 'reserva', 'separar'], 'Dá para encomendar ou pedir para separar?', 'Separamos por até 2 dias. Encomenda com 50% de sinal.', 'Consegue separar para mim?'),
        p('estacionamento', 'ESTACIONAMENTO', ['estacionamento'], 'Tem estacionamento?', 'Não, mas tem vaga na rua e um estacionamento pago ao lado.', 'Tem onde estacionar?'),
      ],
    },
  },
  saude: {
    nome: 'Clínica, consultório, odontologia',
    sistemas: ['feegow', 'clinica_nas_nuvens', 'agendapro', 'ninsaude', 'clinicorp', 'iclinic', 'amigo', 'simples_dental'],
    exemplos: 'clínica médica, dentista, fisioterapia, psicologia',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Pacientes', negocios: 'Tratamentos', loja: 'Procedimentos', catalogo: 'Consultas e procedimentos' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'planos',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para clínicas e consultórios',
    modelosDeFluxo: ['atendente-saude', 'horario-e-local'],
    modeloDeFunil: 'agendamento',
    pedidos: null,
    primeirosEmVendas: [],
    passosDoInicio: ['ficha'],
    dadoSensivel: true,
    regrasDaIa: REGRAS_DE_SAUDE,
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar horários livres e marcar consulta', 'Informar convênios, valores e preparo', 'Informar horário e endereço'],
      perguntas: [
        p('oferta', 'ESPECIALIDADES', ['especialidades', 'o que oferecemos', 'servicos'], 'Quais especialidades e procedimentos a clínica oferece?', 'Clínica geral, dermatologia e pediatria. Exames de sangue no local.', 'Vocês têm dermatologista?'),
        p('convenios', 'CONVÊNIOS', ['convenios', 'convenio', 'planos de saude'], 'Quais convênios a clínica aceita?', 'Unimed, Bradesco Saúde e SulAmérica. Demais, só particular.', 'Aceitam Unimed?'),
        p('valores', 'VALORES', ['valores', 'precos', 'particular'], 'Qual o valor da consulta particular? O que pode ser dito sobre preço?', 'Consulta particular R$ 250. Retorno em até 30 dias sem custo.', 'Quanto custa a consulta?'),
        p('horarios', 'HORÁRIO DE ATENDIMENTO', ['horario', 'funcionamento'], 'Qual o horário de atendimento da clínica?', 'Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.', 'Que horas vocês abrem?'),
        p('preparo', 'PREPARO', ['preparo', 'jejum', 'o que levar'], 'O que o paciente precisa levar ou fazer antes da consulta?', 'Documento com foto, carteirinha do convênio e exames anteriores.', 'Preciso levar alguma coisa?'),
        p('cancelamento', 'REMARCAÇÃO E FALTA', ['cancelamento', 'remarcar', 'falta'], 'Qual a regra para remarcar ou faltar?', 'Remarcação com 24 horas de antecedência, pelo WhatsApp.', 'Preciso remarcar, como faço?'),
        p('urgencia', 'URGÊNCIA', ['urgencia', 'emergencia'], 'O que dizer a quem relata urgência?', 'A clínica não atende urgência. Em emergência, ligue 192 ou procure o pronto-socorro.', 'Estou passando mal, vocês atendem agora?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
  laboratorio: {
    nome: 'Laboratório de análises e exames',
    sistemas: ['feegow', 'clinica_nas_nuvens', 'shift', 'pixeon'],
    exemplos: 'laboratório de análises clínicas, imagem, coleta domiciliar',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Pacientes', loja: 'Exames', catalogo: 'Exames e preparo' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'planos',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para laboratórios',
    modelosDeFluxo: ['atendente-laboratorio', 'horario-e-local'],
    modeloDeFunil: 'atendimento',
    pedidos: null,
    primeirosEmVendas: [],
    passosDoInicio: ['ficha'],
    dadoSensivel: true,
    regrasDaIa: REGRAS_DE_SAUDE,
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Informar preparo, jejum e valores dos exames', 'Explicar como pegar o resultado', 'Informar horário de coleta e endereço'],
      perguntas: [
        p('oferta', 'EXAMES', ['exames', 'o que oferecemos'], 'Que exames o laboratório faz?', 'Análises clínicas, ultrassom e raio-X. Teste do pezinho e de gravidez.', 'Vocês fazem exame de sangue?'),
        p('coleta', 'HORÁRIO DE COLETA', ['coleta', 'horario'], 'Qual o horário de coleta? Precisa agendar?', 'Coleta de segunda a sábado, das 6h30 às 11h, por ordem de chegada.', 'Que horas abre a coleta?'),
        p('jejum', 'PREPARO E JEJUM', ['jejum', 'preparo'], 'Qual o preparo dos exames mais pedidos?', 'Glicemia e colesterol: jejum de 8 a 12 horas. Urina: primeira da manhã.', 'Preciso de jejum?'),
        p('resultado', 'RESULTADO', ['resultado', 'laudo'], 'Como e quando o paciente recebe o resultado?', 'Em até 3 dias úteis, no portal do laboratório, com o protocolo e a data de nascimento.', 'Meu resultado já saiu?'),
        p('domiciliar', 'COLETA DOMICILIAR', ['domiciliar', 'em casa'], 'Fazem coleta em casa? Como funciona e quanto custa?', 'Sim, com agendamento, taxa de R$ 40 na cidade.', 'Vocês coletam em casa?'),
        p('convenios', 'CONVÊNIOS', ['convenios', 'convenio'], 'Quais convênios o laboratório aceita?', 'Unimed, Bradesco Saúde e SUS com pedido da unidade de saúde.', 'Aceitam meu plano?'),
        p('pedido', 'PEDIDO MÉDICO', ['pedido medico', 'guia'], 'Precisa de pedido médico? Aceita pedido por foto?', 'Convênio exige pedido médico original. Particular aceita foto do pedido.', 'Preciso do pedido do médico?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
  farmacia: {
    nome: 'Farmácia e drogaria',
    sistemas: ['trier', 'linx_farma'],
    exemplos: 'farmácia de bairro, drogaria, manipulação',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Clientes', loja: 'Produtos', catalogo: 'Produtos' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para farmácias',
    modelosDeFluxo: ['atendente-farmacia', 'voces-tem', 'horario-e-local'],
    modeloDeFunil: 'pedidos',
    pedidos: { etapas: ['novo', 'pago', 'em_preparo', 'saiu', 'entregue'], rotulos: { em_preparo: 'Separando' }, visao: 'lista', despacho: 'preparo' },
    primeirosEmVendas: ['pedidos', 'vendidos-pelo-chat', 'pedidos-entrega'],
    passosDoInicio: ['ficha'],
    dadoSensivel: true,
    regrasDaIa: [
      ...REGRAS_DE_SAUDE,
      'Medicamento que exige receita (tarja vermelha ou preta, antibiótico, controlado): diga que precisa da receita e que o farmacêutico confere, e não confirme venda nem reserva.',
    ],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Dizer se tem o produto e quanto custa', 'Ajudar a montar um pedido de produtos sem receita', 'Informar entrega, horário e endereço'],
      perguntas: [
        p('horario', 'HORÁRIO', ['horario', 'funcionamento', 'plantao'], 'Qual o horário de funcionamento? Tem plantão?', 'Todos os dias, das 7h às 22h. Plantão no primeiro domingo do mês.', 'Vocês estão abertos?'),
        p('entrega', 'ENTREGA', ['entrega', 'delivery', 'taxa de entrega'], 'Vocês entregam? Onde, em quanto tempo e por quanto?', 'Entregamos na cidade em até 1 hora. Grátis acima de R$ 50, senão R$ 5.', 'Vocês entregam?'),
        p('receita', 'RECEITA', ['receita', 'controlado', 'tarja'], 'Como funciona a compra de remédio com receita?', 'A receita é conferida pelo farmacêutico na entrega ou no balcão. Controlados só com a receita original.', 'Posso comprar antibiótico pelo WhatsApp?'),
        p('convenios', 'CONVÊNIOS E DESCONTOS', ['convenios', 'desconto', 'farmacia popular', 'pbm'], 'Aceitam convênio de empresa, Farmácia Popular ou programa de desconto de laboratório?', 'Farmácia Popular sim, com CPF e receita. Programas de desconto de laboratório no balcão.', 'Tem desconto pelo CPF?'),
        p('manipulacao', 'MANIPULAÇÃO', ['manipulacao', 'formula'], 'Fazem manipulação? Como pedir orçamento?', 'Sim. Mande a foto da receita e retornamos o orçamento em até 2 horas.', 'Vocês manipulam?'),
        p('servicos', 'SERVIÇOS', ['servicos', 'aplicacao', 'pressao'], 'Que serviços a farmácia oferece?', 'Aferição de pressão, teste de glicemia e aplicação de injetáveis com receita.', 'Vocês aplicam injeção?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
  salao: {
    nome: 'Salão, barbearia, estética',
    sistemas: ['trinks', 'agendapro', 'booksy', 'avec'],
    exemplos: 'salão de beleza, barbearia, estética, manicure',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Clientes', loja: 'Serviços', catalogo: 'Serviços e valores' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'planos',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para salões e barbearias',
    modelosDeFluxo: ['atendente-beleza', 'horario-e-local'],
    modeloDeFunil: 'agendamento',
    pedidos: null,
    primeirosEmVendas: [],
    passosDoInicio: ['ficha'],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar horários livres e marcar', 'Informar serviços e valores do catálogo', 'Informar horário e endereço'],
      perguntas: [
        p('oferta', 'SERVIÇOS', ['servicos', 'o que oferecemos'], 'Quais serviços vocês oferecem?', 'Corte, escova, coloração, manicure e design de sobrancelha.', 'Vocês fazem luzes?'),
        p('valores', 'VALORES', ['valores', 'precos'], 'Quais os valores? O que pode ser dito sobre preço?', 'Corte feminino a partir de R$ 70. Coloração só com avaliação.', 'Quanto custa o corte?'),
        p('horarios', 'HORÁRIO', ['horario', 'funcionamento'], 'Qual o horário de funcionamento?', 'Terça a sábado, das 9h às 19h.', 'Abre segunda?'),
        p('agendamento', 'AGENDAMENTO', ['agendamento', 'encaixe', 'marcar'], 'Precisa agendar? Atendem por encaixe?', 'Só com horário marcado. Encaixe quando sobra vaga no dia.', 'Tem horário hoje?'),
        p('atraso', 'ATRASO E CANCELAMENTO', ['atraso', 'cancelamento', 'falta'], 'Qual a regra para atraso e cancelamento?', 'Tolerância de 15 minutos. Cancelamento com 4 horas de antecedência.', 'Vou me atrasar, tudo bem?'),
        p('profissionais', 'PROFISSIONAIS', ['profissionais', 'equipe'], 'Quem atende e qual a especialidade de cada um?', 'Ana: coloração. Bruno: corte masculino e barba. Carla: manicure.', 'Quem faz barba aí?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
  pet: {
    nome: 'Pet shop e veterinária',
    sistemas: ['trinks', 'agendapro', 'simplesvet'],
    exemplos: 'banho e tosa, clínica veterinária, hotel para cães',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Tutores', loja: 'Serviços e produtos', catalogo: 'Serviços e produtos' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para pet shops e veterinárias',
    modelosDeFluxo: ['atendente-pet', 'voces-tem', 'horario-e-local'],
    modeloDeFunil: 'agendamento',
    pedidos: { etapas: ['novo', 'pago', 'em_preparo', 'saiu', 'entregue'], rotulos: { em_preparo: 'Separando' }, visao: 'lista', despacho: 'preparo' },
    primeirosEmVendas: ['pedidos', 'vendidos-pelo-chat'],
    passosDoInicio: ['ficha'],
    regrasDaIa: [
      'Não dê diagnóstico, não indique remédio nem dose para animal. Sintoma ou mal-estar do animal: oriente procurar o veterinário e passe para uma pessoa da equipe.',
    ],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar horários livres e marcar banho, tosa ou consulta', 'Dizer se tem o produto e quanto custa', 'Informar busca e entrega do animal'],
      perguntas: [
        p('oferta', 'SERVIÇOS', ['servicos', 'o que oferecemos'], 'Quais serviços vocês oferecem?', 'Banho, tosa, consulta veterinária, vacinas e hotel.', 'Vocês fazem tosa?'),
        p('valores', 'VALORES', ['valores', 'precos', 'porte'], 'Quais os valores? Muda por porte ou pelagem?', 'Banho de porte pequeno R$ 50, médio R$ 70, grande R$ 90.', 'Quanto é o banho?'),
        p('busca', 'LEVA E TRAZ', ['leva e traz', 'buscar', 'taxi dog'], 'Vocês buscam e levam o animal? Por quanto?', 'Sim, no bairro, por R$ 15 ida e volta.', 'Vocês buscam o cachorro?'),
        p('vacinas', 'VACINAS', ['vacinas', 'vacina'], 'Exigem vacina em dia? Quais vacinas aplicam?', 'Banho e hotel exigem V10 e antirrábica em dia.', 'Precisa de vacina?'),
        p('horarios', 'HORÁRIO', ['horario', 'funcionamento'], 'Qual o horário de funcionamento?', 'Segunda a sábado, das 8h às 18h.', 'Que horas vocês abrem?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
  imobiliaria: {
    nome: 'Imobiliária e corretor',
    sistemas: ['vista', 'jetimob', 'kenlo'],
    exemplos: 'imobiliária, corretor autônomo, loteadora',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Clientes', loja: 'Imóveis', catalogo: 'Imóveis' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'grade',
    materiais: false,
    tituloDosModelos: 'Para imobiliárias',
    modelosDeFluxo: ['atendente-imobiliaria', 'qualificar-sdr'],
    modeloDeFunil: 'comercial',
    pedidos: null,
    primeirosEmVendas: [],
    passosDoInicio: ['ficha'],
    regrasDaIa: [
      'Nunca garanta aprovação de financiamento, valor de parcela ou disponibilidade do imóvel: quem confirma é o corretor.',
    ],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar imóveis do catálogo com foto e valor', 'Entender o que a pessoa procura e passar ao corretor', 'Combinar visita'],
      perguntas: [
        p('oferta', 'O QUE TRABALHAMOS', ['o que trabalhamos', 'regiao', 'imoveis'], 'Que tipo de imóvel e em que região vocês trabalham?', 'Venda e aluguel de casas e apartamentos na zona sul.', 'Vocês têm apartamento para alugar?'),
        p('visita', 'VISITA', ['visita', 'visitar'], 'Como funciona a visita?', 'Com hora marcada, de segunda a sábado, acompanhada por um corretor.', 'Posso ver o imóvel amanhã?'),
        p('aluguel', 'DOCUMENTOS DO ALUGUEL', ['aluguel', 'documentos', 'fiador', 'garantia'], 'O que é preciso para alugar? Que garantias aceitam?', 'Documento, comprovante de renda de 3 vezes o aluguel. Fiador, seguro fiança ou caução.', 'Precisa de fiador?'),
        p('financiamento', 'FINANCIAMENTO', ['financiamento', 'fgts', 'entrada'], 'Vocês ajudam com financiamento e FGTS?', 'Sim, o corretor simula com o banco. Aceitamos FGTS na entrada.', 'Dá para usar FGTS?'),
        p('captacao', 'ANUNCIAR UM IMÓVEL', ['anunciar', 'vender meu imovel', 'captacao'], 'Como quem quer vender ou alugar o próprio imóvel anuncia com vocês?', 'Um corretor faz a avaliação gratuita e as fotos.', 'Quero vender minha casa, como faço?'),
        p('horarios', 'HORÁRIO', ['horario', 'funcionamento'], 'Qual o horário de atendimento?', 'Segunda a sexta, das 9h às 18h. Sábado, das 9h às 13h.', 'Até que horas vocês atendem?'),
        ONDE_FICA,
      ],
    },
  },
  hospedagem: {
    nome: 'Pousada, hotel, hospedagem',
    sistemas: ['stays', 'cloudbeds', 'omnibees'],
    exemplos: 'pousada, hotel, chalés, aluguel por temporada',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Hóspedes', negocios: 'Reservas', loja: 'Acomodações', catalogo: 'Acomodações e tarifas' },
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'grade',
    materiais: false,
    tituloDosModelos: 'Para pousadas e hotéis',
    modelosDeFluxo: ['atendente-hospedagem', 'horario-e-local'],
    modeloDeFunil: 'comercial',
    pedidos: null,
    primeirosEmVendas: [],
    passosDoInicio: ['ficha'],
    regrasDaIa: [
      'Nunca confirme vaga para uma data: diga que a equipe confere a disponibilidade e passe para uma pessoa com as datas e o número de hóspedes.',
    ],
    ficha: {
      pode: ['Responder dúvidas com o que está nesta ficha', 'Mostrar acomodações e tarifas com foto', 'Anotar datas e hóspedes para a reserva', 'Informar check-in, check-out e como chegar'],
      perguntas: [
        p('oferta', 'ACOMODAÇÕES', ['acomodacoes', 'quartos', 'chales'], 'Que acomodações vocês têm e para quantas pessoas?', 'Quartos duplos e chalés para até 4 pessoas, com café da manhã.', 'Tem quarto para casal?'),
        p('tarifas', 'TARIFAS', ['tarifas', 'diaria', 'valores'], 'Quanto custa a diária? Muda em feriado e alta temporada?', 'Diária a partir de R$ 280 para casal. Feriados com pacote mínimo de 3 noites.', 'Quanto é a diária?'),
        p('checkin', 'CHECK-IN E CHECK-OUT', ['check-in', 'check-out', 'checkin'], 'Qual o horário de check-in e check-out?', 'Check-in a partir das 14h. Check-out até 12h.', 'Que horas posso chegar?'),
        p('reserva', 'RESERVA E SINAL', ['reserva', 'sinal', 'cancelamento'], 'Como se faz a reserva? Tem sinal? Qual a política de cancelamento?', 'Sinal de 50% por Pix. Cancelamento com 7 dias devolve o sinal.', 'Como faço para reservar?'),
        p('pets', 'ANIMAIS', ['pet', 'animais', 'cachorro'], 'Aceitam animais de estimação?', 'Sim, porte pequeno, com taxa de R$ 50 por estadia.', 'Posso levar meu cachorro?'),
        p('estrutura', 'ESTRUTURA', ['estrutura', 'piscina', 'estacionamento', 'cafe'], 'O que a hospedagem oferece?', 'Piscina, wi-fi, estacionamento e café da manhã incluso.', 'Tem estacionamento?'),
        ONDE_FICA,
        PAGAMENTO,
      ],
    },
  },
}

/** O pacote do ramo, ou `null` para a conta sem ramo (o sistema de hoje). */
export function pacoteDo(nicho: Nicho | null | undefined): PacoteDoNicho | null {
  return nicho ? PACOTES[nicho] : null
}

/**
 * A visão do catálogo que vale para a tela: a pedida no endereço, se for uma
 * que existe, senão a do ramo, senão a lista (a conta sem ramo abre como
 * sempre abriu).
 */
export function visaoDoCatalogo(pacote: PacoteDoNicho | null, pedida?: string | null): VisaoDoCatalogo {
  if (pedida && (VISOES_DO_CATALOGO as readonly string[]).includes(pedida)) return pedida as VisaoDoCatalogo
  return pacote?.visaoDoCatalogo ?? 'lista'
}

/**
 * O nome de um lugar da barra no ramo: o do pacote, se ele renomeia, senão o
 * de sempre. É a mesma palavra na barra, no título da tela e na tela de sem
 * acesso, para a pessoa não ler "Pratos" no menu e "Produtos" na página.
 */
export function rotuloNaBarra(pacote: PacoteDoNicho | null, lugar: LugarDaBarra, padrao: string): string {
  return pacote?.rotulos[lugar] ?? padrao
}

/** Este lugar da barra some no ramo? Sem ramo, nada some. Pedidos some no ramo sem pedido. */
export function ocultoNaBarra(pacote: PacoteDoNicho | null, lugar: string): boolean {
  if (!pacote) return false
  if (lugar === 'pedidos') return pacote.pedidos === null
  return (pacote.ocultos as readonly string[]).includes(lugar)
}

/**
 * A galeria de uma conta com ramo: o título do bloco do ramo, os ids dele na
 * ordem do pacote, e os de qualquer negócio. `null` para a conta sem ramo, que
 * vê a galeria de sempre, inteira.
 *
 * Duas galerias usam isto, a de fluxos e a de funis, e a tela não decide nada:
 * ela recebe o destaque pronto e só desenha (PLANO-NICHOS 1.6).
 */
export type DestaqueDoRamo = { titulo: string; ids: readonly string[]; tambem: readonly string[] }

export function destaqueDeFluxos(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote
    ? { titulo: pacote.tituloDosModelos, ids: pacote.modelosDeFluxo, tambem: MODELOS_DE_QUALQUER_RAMO }
    : null
}

export function destaqueDeFunis(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote
    ? { titulo: pacote.tituloDosModelos, ids: [pacote.modeloDeFunil], tambem: FUNIS_DE_QUALQUER_RAMO }
    : null
}

/**
 * Separa uma lista de modelos em "do ramo" e "de qualquer negócio"; o resto
 * não entra.
 *
 * Os do ramo saem na ordem do destaque, e não na da lista, porque a ordem do
 * pacote é a da recomendação; os de qualquer negócio mantêm a ordem de
 * sempre. Um id que está nos dois grupos fica só no do ramo. Id que não existe
 * na lista é ignorado: um modelo que saiu do código não pode virar cartão
 * vazio. Sem destaque, tudo é "outros", que é a galeria de hoje, inteira.
 */
export function separarPeloRamo<T extends { id: string }>(
  modelos: readonly T[],
  destaque: DestaqueDoRamo | null,
): { doRamo: T[]; outros: T[] } {
  if (!destaque) return { doRamo: [], outros: [...modelos] }
  const doRamo = destaque.ids.flatMap((id) => modelos.filter((modelo) => modelo.id === id))
  const outros = modelos.filter((modelo) => destaque.tambem.includes(modelo.id) && !destaque.ids.includes(modelo.id))
  return { doRamo, outros }
}
