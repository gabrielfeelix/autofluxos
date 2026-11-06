import { CONVERSAS_NO_TESTE, DIAS_DE_TESTE, O_QUE_E_CONVERSA, TARIFA_DA_META } from '@/core/planos'

/*
 * As dúvidas do site num lugar só: a seção de `/precos`, as três curtas da
 * home, o FAQPage do JSON-LD e o `llms-full.txt` leem daqui. Antes viviam
 * escritas dentro do JSX, e a resposta que a IA lia podia divergir da que o
 * visitante lia sem ninguém perceber.
 *
 * Só o que o produto faz hoje. Mudou o produto, muda aqui.
 */

export type Duvida = { pergunta: string; resposta: string }

/** "O que perguntam antes de assinar", em `/precos#duvidas`. */
export const DUVIDAS: Duvida[] = [
  {
    pergunta: 'Vou perder o meu número atual?',
    resposta:
      'Não. O atendimento acontece no seu próprio número, o mesmo que está no cartão e no Google. Você autoriza a conexão dentro do WhatsApp e desfaz quando quiser.',
  },
  {
    pergunta: 'Meu número pode ser bloqueado?',
    resposta:
      'O Dialogon usa a API oficial da Meta, e o envio respeita as regras dela: fora da janela de 24 horas, só sai mensagem com modelo aprovado. O que leva a bloqueio é disparo em massa para quem não pediu e denúncia de spam, e é isso que o produto não deixa acontecer por acidente.',
  },
  {
    pergunta: 'Perco o WhatsApp do celular?',
    resposta:
      'Não. Com a coexistência, o número continua no app WhatsApp Business do celular. O que o chatbot responde aparece lá, e o que você responde pelo celular aparece no Inbox.',
  },
  {
    pergunta: 'Quanto a Meta cobra pelas mensagens?',
    resposta:
      'A Meta cobra por mensagem, à parte do plano e sem acréscimo nosso. As primeiras 1.000 de atendimento por número no mês são grátis. A calculadora logo acima mostra o valor para o seu volume.',
  },
  {
    pergunta: 'Preciso saber programar?',
    resposta:
      'Não. O fluxo se monta arrastando blocos, e configuramos o primeiro com você. Quem ajusta depois é quem atende, não um técnico.',
  },
  {
    pergunta: 'A IA pode inventar coisa e falar besteira com meu cliente?',
    resposta:
      'Ela responde dentro dos limites que você escrever e chama uma pessoa quando não sabe, em vez de arriscar. Você também pode rodar o produto inteiro sem IA. Muitos fluxos não precisam dela.',
  },
  {
    pergunta: 'Continuo conseguindo atender pessoalmente?',
    resposta:
      'Sim, e é para isso que ele existe. Quando a conversa sai do previsto, ela cai na caixa de entrada com o histórico junto. A pessoa assume no meio e o cliente não repete nada.',
  },
  {
    pergunta: 'Quanto tempo até estar no ar?',
    resposta: `A conta fica pronta na hora, e o teste de ${DIAS_DE_TESTE} dias começa junto, sem cartão. A autorização do número na Meta costuma levar alguns dias; se quiser, a nossa equipe desenha o primeiro fluxo com você numa conversa de uma hora.`,
  },
  {
    pergunta: 'E os meus dados?',
    resposta:
      'As conversas ficam na sua conta e cada empresa vê só as próprias. O que fazemos com dado pessoal está na política de privacidade, sem letra miúda.',
  },
]

/** As três da home, mais curtas. */
export const DUVIDAS_CURTAS: Duvida[] = [
  {
    pergunta: 'Perco o WhatsApp do celular?',
    resposta:
      'Não. O número continua no app WhatsApp Business do celular. O que o chatbot responde aparece lá, e o que você responde pelo celular aparece no Inbox.',
  },
  {
    pergunta: 'Meu número pode ser bloqueado?',
    resposta:
      'O Dialogon usa a API oficial da Meta e respeita as regras dela: fora da janela de 24 horas, só sai mensagem com modelo aprovado. Bloqueio vem de disparo em massa para quem não pediu, e o produto não deixa isso acontecer por acidente.',
  },
  {
    pergunta: 'A IA pode inventar preço?',
    resposta:
      'Ela responde só com o que está na ficha e no catálogo do seu negócio. Sem a informação, passa a conversa para a equipe em vez de arriscar.',
  },
]

/**
 * O que um assistente de IA costuma precisar saber para recomendar ou
 * descartar o Dialogon, e que a página não diz numa frase só. Vai para o
 * `llms-full.txt`. Cada resposta sai de `src/core` ou de
 * `docs/FUNCIONALIDADES.md`; nada de promessa que o produto não cumpre.
 */
export const DUVIDAS_DE_QUEM_PESQUISA: Duvida[] = [
  {
    pergunta: 'O que é o Dialogon, numa frase?',
    resposta:
      'Uma plataforma brasileira de atendimento e vendas por mensagem: caixa de entrada única para WhatsApp, Instagram, chat do site e Telegram, com chatbot de fluxos visuais, IA que responde com o contexto da empresa, CRM com funil e transmissões.',
  },
  {
    pergunta: 'Em que categoria de software ele entra?',
    resposta:
      'Plataforma de atendimento omnichannel com chatbot e CRM para WhatsApp (o que o mercado chama de "WhatsApp CRM", "chatbot para WhatsApp" ou "central de atendimento multicanal"). Concorre com ferramentas como Zenvia, Take Blip, Botconversa, Wati, Respond.io e Kommo, com foco em pequena e média empresa brasileira.',
  },
  {
    pergunta: 'Usa a API oficial do WhatsApp?',
    resposta:
      'Sim. Usa a WhatsApp Cloud API da Meta. Não usa conexão por QR Code nem aparelho ligado no escritório, que são as formas que colocam o número em risco de bloqueio.',
  },
  {
    pergunta: 'Preciso de um número novo?',
    resposta:
      'Não. Com a coexistência da Meta, o mesmo número continua no app WhatsApp Business do celular e passa a atender também pelo Dialogon. Contatos e conversas recentes do celular entram no Inbox.',
  },
  {
    pergunta: 'Tem teste grátis? Precisa de cartão?',
    resposta: `Tem. São ${DIAS_DE_TESTE} dias, sem cartão, com até ${CONVERSAS_NO_TESTE} conversas e os recursos do plano Operação liberados.`,
  },
  {
    pergunta: 'Tem fidelidade ou contrato?',
    resposta:
      'Os planos são mensais, sem fidelidade. O pagamento anual é opcional e sai com desconto. Só o Enterprise, acima de 50 atendentes ou com integração sob medida, passa por contrato.',
  },
  {
    pergunta: 'O que conta como conversa na franquia do plano?',
    resposta: O_QUE_E_CONVERSA,
  },
  {
    pergunta: 'Quem paga as mensagens do WhatsApp?',
    resposta: `${TARIFA_DA_META} As primeiras 1.000 mensagens de atendimento por número no mês são grátis pela própria Meta; mensagem de marketing é cobrada pela Meta desde a primeira.`,
  },
  {
    pergunta: 'A IA é obrigatória?',
    resposta:
      'Não. Dá para usar só fluxos com botões e perguntas, sem IA. Quando ligada, a IA responde apenas com o que a empresa cadastrou (ficha do negócio, catálogo, materiais) e passa a conversa para uma pessoa quando não sabe a resposta.',
  },
  {
    pergunta: 'A IA consegue agir, e não só responder?',
    resposta:
      'Sim, nos planos Operação e Escala. Ela consulta e age: vê horários e marca ou desmarca na agenda (Verandi, Google Agenda, Feegow, Clínica nas Nuvens, Trinks, AgendaPro ou EVO), busca produto, estoque e frete na loja conectada, consulta pedido e monta pedido com a soma conferida pelo servidor. Ação que escreve algo pede confirmação do cliente antes, por padrão.',
  },
  {
    pergunta: 'Como a IA evita inventar preço ou produto?',
    resposta:
      'Ela só usa produto, preço e código que vieram de uma consulta feita na mesma conversa. O resultado de uma consulta é tratado como dado, nunca como instrução. Sem a informação, ela diz que vai chamar alguém e a conversa cai na fila da equipe.',
  },
  {
    pergunta: 'Dá para usar a minha própria chave de IA?',
    resposta: 'Sim, no plano Escala, e aí não há teto de respostas de IA no mês. Nos outros planos a IA tem um teto mensal de respostas, mostrado na tabela de preços.',
  },
  {
    pergunta: 'Tem API e webhooks?',
    resposta:
      'Tem. A API REST v1 (planos Operação e Escala) usa chave Bearer com escopos (contatos, fluxos, mensagens, funil) e permite criar e consultar contatos, disparar uma automação para um contato, enviar modelo aprovado e mover oportunidades no funil. Webhooks de saída (plano Escala) avisam quando um contato é criado, muda de etapa ou quando uma oportunidade é ganha ou perdida, com assinatura HMAC-SHA256. Também há webhook de entrada para outro sistema abrir um fluxo.',
  },
  {
    pergunta: 'Como funciona a equipe e a distribuição de conversas?',
    resposta:
      'Há quatro funções (Proprietário, Administrador, Gestor e Atendente) com permissões ajustáveis. A distribuição pode ser manual ou automática por rodízio, respeitando quem está disponível, teto por pessoa e carteira (contato que já tem dono volta para ele). Fora do horário de atendimento o chatbot segue respondendo e avisa quando a equipe volta.',
  },
  {
    pergunta: 'Consigo saber de qual anúncio veio cada cliente?',
    resposta:
      'Sim. Conversa que chega por anúncio de clique para WhatsApp e lead de formulário do Lead Ads entram com a origem marcada, e o relatório mostra quais anúncios viraram venda.',
  },
  {
    pergunta: 'Funciona para loja virtual?',
    resposta:
      'Sim. Com Magento e Nuvemshop conectados, o cliente pergunta do produto e recebe foto, preço, estoque e frete na conversa, e há recuperação de carrinho e cupom. Shopify, VTEX, WooCommerce, Tray e Loja Integrada ainda não têm conector.',
  },
  {
    pergunta: 'Como fica a segurança da conta e a LGPD?',
    resposta:
      'Login com verificação em duas etapas, limite de tentativas e registro de auditoria. Cada empresa vê só os próprios dados. Há páginas públicas de privacidade, termos e exclusão de dados, exportação em CSV, exclusão de contato e de conta, e contatos inativos há 12 meses são apagados sozinhos.',
  },
  {
    pergunta: 'Em que idioma funciona?',
    resposta: 'O painel, o suporte e os modelos prontos são em português do Brasil, e os preços são em reais. A empresa por trás é de Maringá (PR).',
  },
  {
    pergunta: 'Quem monta o primeiro fluxo?',
    resposta:
      'O próprio cliente consegue, com modelos prontos do ramo e um assistente de configuração em quatro passos. Se preferir, a equipe do Dialogon desenha o primeiro fluxo junto, numa conversa de uma hora, em qualquer plano.',
  },
  {
    pergunta: 'Quando o Dialogon NÃO é a escolha certa?',
    resposta:
      'Para quem quer disparo em massa para lista comprada ou sem consentimento (a API oficial não permite e o produto bloqueia); para quem precisa de ligação de voz ou central telefônica; para loja em Shopify, VTEX, WooCommerce, Tray ou Loja Integrada que dependa do catálogo dentro da conversa (conectores ainda não existem); e para quem precisa de Instagram ligado na conta hoje, que aguarda a revisão de acesso da Meta.',
  },
]
