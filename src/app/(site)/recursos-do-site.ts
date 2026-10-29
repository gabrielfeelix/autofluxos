/**
 * As partes do produto, uma página cada em `/produto/[slug]`, e o menu Produto.
 * Fatos em `docs/FUNCIONALIDADES.md` §3 a §10 e nas telas de relatório
 * (`src/app/clientes/[clienteId]/relatorios`). Só entra número conferido no
 * código ou medido; o que muda com frequência (quantidade de blocos, de
 * ferramentas da IA, de verificações) fica sem número de propósito.
 */
export type RecursoDoSite = {
  slug: string
  nome: string
  linha: string
  titulo: string
  subtitulo: string
  destaques: { titulo: string; texto: string }[]
  itens: { titulo: string; texto: string }[]
  ficha: { barra: string; titulo: string; linhas: { rotulo: string; valor: string }[] }
}

export const RECURSOS: RecursoDoSite[] = [
  {
    slug: 'fluxos',
    nome: 'Fluxos e chatbot',
    linha: 'Blocos que você arrasta, liga e testa na hora.',
    titulo: 'Fluxos que você desenha, testa e publica sem programar',
    subtitulo:
      'Blocos que se ligam numa tela, um validador que confere tudo antes de ir ao ar e um simulador que roda o motor de verdade.',
    destaques: [
      { titulo: 'Arraste, ligue, publique', texto: 'Blocos em quatro grupos: conversar, decidir, organizar e integrar. O rascunho se salva sozinho.' },
      {
        titulo: 'Conferido antes de ir ao ar',
        texto: 'Bloco solto, caminho sem saída para a equipe, variável que não existe e botão acima do limite do canal travam a publicação.',
      },
      { titulo: 'Cada versão guardada', texto: 'Toda publicação fica registrada. Dá para abrir uma versão antiga e voltar para ela.' },
    ],
    itens: [
      { titulo: 'Perguntas que validam', texto: 'Botões, listas e texto livre, com conferência de data, e-mail, telefone e CPF.' },
      { titulo: 'Gatilhos', texto: 'Palavra-chave, frase do anúncio, evento de outro sistema, formulário do Lead Ads ou chamada pela API.' },
      { titulo: 'Saída para a equipe', texto: 'Quem escreve "atendente" ou "falar com uma pessoa" chega a alguém em qualquer ponto do fluxo.' },
      { titulo: 'Pesquisa de satisfação', texto: 'NPS de 0 a 10, com caminho próprio para quem elogia, quem fica neutro e quem reclama.' },
      { titulo: 'Serviços externos', texto: 'Chamada a outro sistema com a credencial guardada no cofre e a resposta virando variável.' },
      { titulo: 'Sequências', texto: 'Até 5 passos para quem sumiu ou encerrou o atendimento, e saem sozinhas quando o cliente responde.' },
      { titulo: 'Link de teste', texto: 'Mande o fluxo para alguém testar, com prazo, contador de aberturas e botão de importar.' },
      { titulo: 'Respostas em planilha', texto: 'Cada passagem pelo fluxo vira uma linha, com as variáveis em coluna e exportação em CSV.' },
      { titulo: 'Modelos prontos', texto: 'Agendamento, carrinho abandonado, qualificação, lembrete, pós-atendimento e outros.' },
    ],
    ficha: {
      barra: 'Editor de fluxos',
      titulo: 'Antes de publicar',
      linhas: [
        { rotulo: 'Rascunho', valor: 'Salvo sozinho' },
        { rotulo: 'Desfazer e refazer', valor: 'Ctrl+Z e Ctrl+Y' },
        { rotulo: 'Limites do canal', valor: 'Conferidos no editor' },
        { rotulo: 'Teste', valor: 'Simulador com o motor real' },
        { rotulo: 'Versões', valor: 'Todas guardadas' },
        { rotulo: 'Levar para outra conta', valor: 'Link ou arquivo' },
      ],
    },
  },
  {
    slug: 'ia',
    nome: 'IA que lê o seu negócio',
    linha: 'Responde pelo catálogo e pelas regras. Sem resposta, chama a equipe.',
    titulo: 'Uma IA que responde pelo seu negócio, e só por ele',
    subtitulo: 'Ela lê a ficha da empresa, o catálogo e o cardápio, consulta pedido e agenda, e passa para a equipe quando não sabe.',
    destaques: [
      { titulo: 'Lê o que é seu', texto: 'A ficha do assistente com as perguntas do seu ramo, o catálogo, o cardápio em PDF e o texto sobre a empresa.' },
      { titulo: 'Faz, não só responde', texto: 'Busca produto, calcula frete, consulta pedido, marca e desmarca horário e monta a cobrança.' },
      { titulo: 'Não inventa', texto: 'Fora do assunto da empresa, não responde. Sem a resposta na ficha, chama a equipe.' },
    ],
    itens: [
      { titulo: 'Autonomia por ação', texto: 'Para cada ação, você escolhe: faz sozinha, pergunta ao cliente antes ou passa para a equipe.' },
      { titulo: 'Conta conferida', texto: 'Na cobrança, o total é somado pelo servidor, não pela IA.' },
      { titulo: 'Só o que existe', texto: 'A IA só usa produto e código que vieram de uma consulta real, nunca um que ela imaginou.' },
      { titulo: 'Lê foto e áudio', texto: 'Entende a foto que o cliente manda e o áudio depois de transcrito.' },
      { titulo: 'Aprende com a equipe', texto: 'Toda noite as conversas são agrupadas por tema. O que ficou sem resposta, a equipe ensina uma vez.' },
      { titulo: 'Registro de cada ação', texto: 'Cada consulta e cada ação da IA fica registrada, como pede a LGPD.' },
    ],
    ficha: {
      barra: 'Configurações · IA',
      titulo: 'Assistente da empresa',
      linhas: [
        { rotulo: 'Fonte', valor: 'Ficha, catálogo e cardápio' },
        { rotulo: 'Assunto', valor: 'Só o do seu negócio' },
        { rotulo: 'Ação que altera dados', valor: 'Pede confirmação' },
        { rotulo: 'Sem resposta', valor: 'Passa para a equipe' },
        { rotulo: 'Provedor fora do ar', valor: 'Troca sozinho' },
        { rotulo: 'Registro', valor: 'Cada ação' },
      ],
    },
  },
  {
    slug: 'inbox',
    nome: 'Inbox da equipe',
    linha: 'Todas as conversas numa fila, com a ficha do cliente ao lado.',
    titulo: 'Todas as conversas numa fila, com a ficha do cliente ao lado',
    subtitulo:
      'WhatsApp, Instagram, site e Telegram na mesma caixa. A equipe assume, responde, anota e devolve ao chatbot sem trocar de tela.',
    destaques: [
      { titulo: 'Tempo real', texto: 'A mensagem nova aparece na hora, sem recarregar a página.' },
      { titulo: 'Um atendente por conversa', texto: 'Dois atendentes não assumem a mesma conversa. Encerrou, ela volta para o chatbot.' },
      { titulo: 'Nada fica esquecido', texto: 'Adie, agende uma resposta, fixe no topo ou marque como não lida. A conversa volta sozinha na hora marcada.' },
    ],
    itens: [
      { titulo: 'Áudio gravado no navegador', texto: 'Até 5 minutos, no formato que o WhatsApp aceita.' },
      { titulo: 'Anexos', texto: 'Foto, vídeo, áudio e documento, arrastando para a conversa, com legenda.' },
      { titulo: 'Respostas rápidas', texto: 'Digite / e escolha. Dá para importar a lista por planilha.' },
      { titulo: 'Mensagem agendada', texto: 'Para até um ano depois, com aviso quando a janela de 24 horas fechou.' },
      { titulo: 'Supervisão', texto: 'O gestor vê a caixa de cada atendente como ele vê, sem marcar nada como lido.' },
      { titulo: 'Aviso com o painel fechado', texto: 'Notificação no navegador quando um cliente pede atendimento. De madrugada, não toca.' },
      { titulo: 'Busca', texto: 'Por nome, telefone ou o texto de qualquer mensagem.' },
      { titulo: 'Origem visível', texto: 'Cada conversa mostra o canal e se o cliente veio de um anúncio.' },
      { titulo: 'Quem respondeu', texto: 'O nome do atendente vai na mensagem, e a bolha mostra se foi o chatbot, a IA ou uma pessoa.' },
    ],
    ficha: {
      barra: 'Conversas · Inbox',
      titulo: 'A fila da equipe',
      linhas: [
        { rotulo: 'Atualização', valor: 'Em tempo real' },
        { rotulo: 'Canais', valor: 'Quatro, numa fila só' },
        { rotulo: 'Fixadas no topo', valor: 'Até 5' },
        { rotulo: 'Áudio gravado', valor: 'Até 5 minutos' },
        { rotulo: 'Mídia recebida', valor: 'Guardada, até 16 MB' },
        { rotulo: 'Resposta agendada', valor: 'Até 365 dias' },
      ],
    },
  },
  {
    slug: 'contatos-e-funil',
    nome: 'Contatos e funil',
    linha: 'Etiquetas, etapas e negócios de cada cliente.',
    titulo: 'A ficha de cada cliente e o funil, preenchidos pela conversa',
    subtitulo: 'O que o fluxo pergunta vira campo do contato, o cartão do funil anda sozinho e a equipe vê tudo sem planilha.',
    destaques: [
      { titulo: 'A conversa preenche', texto: 'Nome, e-mail, interesse e o que mais o fluxo perguntar viram campos na ficha.' },
      { titulo: 'Funil que anda sozinho', texto: 'Um bloco do fluxo muda o cartão de etapa, e o ganho de um funil abre o próximo.' },
      { titulo: 'A correção da equipe vale mais', texto: 'O que a equipe corrige não é sobrescrito por importação nem por automação.' },
    ],
    itens: [
      { titulo: 'Vários funis', texto: 'Seis modelos prontos: atendimento, comercial, captação, agenda, pós-venda e pedidos.' },
      { titulo: 'Kanban e lista', texto: 'Arraste o cartão entre etapas, com alerta do que está parado há dias demais.' },
      { titulo: 'Ganho e perda', texto: 'Ganhar com valor, perder com motivo e reabrir. A venda é registrada com os itens.' },
      { titulo: 'Segmentos', texto: 'Regras por estágio, valor comprado, produto, data e temperatura, com contagem ao vivo.' },
      { titulo: 'Nível de cliente', texto: 'Ouro, prata e bronze pelo valor comprado, com faixas que você define.' },
      { titulo: 'Importar planilha', texto: 'Reconhece nome e telefone sozinho, com ou sem o nono dígito.' },
      { titulo: 'Exportar', texto: 'CSV com os filtros aplicados, até 20 mil linhas.' },
      { titulo: 'Etiquetas', texto: 'Seis cores, juntar duas em uma e três etiquetas que se aplicam sozinhas.' },
      { titulo: 'Origem do contato', texto: 'O anúncio de onde o cliente veio, na ficha e nos relatórios.' },
    ],
    ficha: {
      barra: 'CRM · Negociações',
      titulo: 'Funil e contatos',
      linhas: [
        { rotulo: 'Funis por conta', valor: 'Vários' },
        { rotulo: 'Modelos de funil', valor: '6' },
        { rotulo: 'Etapas por funil', valor: 'Até 8' },
        { rotulo: 'Importar', valor: 'CSV até 4 MB' },
        { rotulo: 'Exportar', valor: 'Até 20 mil linhas' },
        { rotulo: 'Nível de cliente', valor: 'Ouro, prata e bronze' },
      ],
    },
  },
  {
    slug: 'transmissoes',
    nome: 'Transmissões',
    linha: 'Campanhas com modelo aprovado pela Meta e retorno por contato.',
    titulo: 'Campanhas no WhatsApp, com o retorno de cada contato',
    subtitulo:
      'Escolha o público pela etiqueta, o modelo aprovado pela Meta e a hora. O envio respeita o ritmo do número e mostra quem recebeu e quem leu.',
    destaques: [
      { titulo: 'Modelo pronto para aprovar', texto: 'Lembrete, confirmação, vencimento, pedido a caminho e outros, prontos para enviar à Meta.' },
      { titulo: 'Ritmo que protege o número', texto: 'Envio aos poucos, dentro do limite da Meta e só no horário de atendimento.' },
      { titulo: 'Retorno por contato', texto: 'Na fila, enviado, entregue, lido ou não recebido, um por um.' },
    ],
    itens: [
      { titulo: 'Público por etiqueta', texto: 'Com a contagem de contatos antes de enviar.' },
      { titulo: 'Texto de cada pessoa', texto: 'Nome e outros campos de cada contato entram na mensagem.' },
      { titulo: 'Agora ou agendado', texto: 'Envie na hora ou marque o dia e o horário.' },
      { titulo: 'Mais barato na janela', texto: 'Quem conversou nas últimas 24 horas recebe como mensagem comum, cobrada como serviço.' },
      { titulo: 'Para sozinho', texto: 'Se a Meta derrubar o modelo no meio do envio, o resto não sai.' },
      { titulo: 'Novas tentativas', texto: 'Falha temporária é tentada de novo, conforme o tipo de erro.' },
    ],
    ficha: {
      barra: 'Automações · Transmissões',
      titulo: 'Nova transmissão',
      linhas: [
        { rotulo: 'Público', valor: 'Por etiqueta' },
        { rotulo: 'Modelo', valor: 'Aprovado pela Meta' },
        { rotulo: 'Envio', valor: 'Agora ou agendado' },
        { rotulo: 'Ritmo', valor: 'Teto por hora' },
        { rotulo: 'Limite diário da Meta', valor: 'De 250 a ilimitado' },
        { rotulo: 'Custo', valor: 'Tarifa da Meta, sem acréscimo' },
      ],
    },
  },
  {
    slug: 'relatorios',
    nome: 'Relatórios',
    linha: 'O que o atendimento resolveu, vendeu e deixou esperando.',
    titulo: 'O que o atendimento resolveu, vendeu e deixou esperando',
    subtitulo: 'Relatórios de atendimento e de vendas, no período que você escolher, com a explicação de cada número.',
    destaques: [
      { titulo: 'Quem resolveu', texto: 'Quantas conversas a automação terminou sozinha e quantas foram para a equipe.' },
      { titulo: 'Quanto esperaram', texto: 'Da ida para a equipe até a primeira resposta, conversa por conversa.' },
      { titulo: 'O que vendeu', texto: 'Ganho nos negócios, recebido pelo chat, mais vendidos e ticket médio.' },
    ],
    itens: [
      { titulo: 'Quando as conversas chegam', texto: 'Dia e hora de cada conversa, para saber quando ter alguém no Inbox.' },
      { titulo: 'Por onde chegam', texto: 'Conversas do período por canal.' },
      { titulo: 'De onde vêm os contatos', texto: 'Contatos novos pela campanha do anúncio em que clicaram.' },
      { titulo: 'Quem atendeu', texto: 'Conversas da equipe por responsável.' },
      { titulo: 'Satisfação', texto: 'NPS das pesquisas feitas no próprio fluxo.' },
      { titulo: 'Gasto com WhatsApp', texto: 'O que as mensagens custaram na Meta no período.' },
      { titulo: 'Produtos mais clicados', texto: 'Toques em "Ver produto" nos cards enviados pelo chatbot e pela equipe.' },
      { titulo: 'Principais dúvidas', texto: 'Os temas que mais aparecem e as perguntas que ficaram sem resposta.' },
      { titulo: 'Os números do seu ramo', texto: 'Pedidos e tempo de preparo, aulas e presença, mensalidades em dia.' },
    ],
    /*
     * Os mesmos números medidos da home (`NUMEROS` em `secoes-do-site.tsx`):
     * 90 dias até 28/out/2026, todas as contas. Refazer a conta antes de mudar.
     */
    ficha: {
      barra: 'Análise · Atendimento',
      titulo: 'Todas as contas, 90 dias',
      linhas: [
        { rotulo: 'Terminaram sem a equipe', valor: '74%' },
        { rotulo: 'Resposta do chatbot', valor: '4 s na mediana' },
        { rotulo: 'Resposta da equipe', valor: '1 min 46 s' },
        { rotulo: 'Fora do horário comercial', valor: '1 em 6 mensagens' },
      ],
    },
  },
]

export const recursoPorSlug = (slug: string) => RECURSOS.find((r) => r.slug === slug)
