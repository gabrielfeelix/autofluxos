import { ENDERECO_DA_AGENDA } from './agenda'
import type { AoFalhar, Cabecalho, Mapeamento, Metodo } from './flow/schema'

/**
 * Integrações prontas, como **preset de bloco `http`** — não como tipo de nó
 * novo (B6, §3.11 do plano).
 *
 * O bloco de Serviços externos já fala com qualquer API. Ele é mais poderoso e
 * menos usável do que o menu de integrações que os concorrentes mostram:
 * poderoso porque alcança tudo, menos usável porque obriga a montar o POST na
 * mão, com o endereço certo, o cabeçalho certo e o JSON certo — três lugares
 * para errar em silêncio.
 *
 * **Preset resolve isso sem criar superfície nova.** Escolher "RD Station"
 * preenche método, endereço, cabeçalhos, corpo e mapeamento de um bloco `http`
 * comum; a partir daí ele é um bloco `http` comum, editável, e o que fica
 * gravado no fluxo é o **bloco resolvido**, não uma referência viva ao preset.
 *
 * Isso importa por causa da regra que não se negocia aqui: versão publicada é
 * imutável. Se o preset fosse uma referência, mudar o endereço da RD amanhã
 * mudaria por baixo o que uma conversa em andamento vai chamar. Do jeito que
 * está, mudar o preset só afeta quem aplicar dali para frente — como deve ser.
 *
 * **Zapier não entra.** É o iPaaS que o print da leva anterior mostrou custando
 * 5.000 ações que ninguém usava, e mandar o cliente montar a automação lá fora
 * é dizer que a peça que falta não é nossa.
 */

/**
 * A gaveta em que o preset aparece.
 *
 * Passou a existir quando a agenda entrou com nove blocos de uma vez: uma lista
 * corrida de quatorze itens é uma lista que ninguém lê até o fim, e o de baixo
 * some. A gaveta também **conta uma história** — os nove da Verandi são um fluxo
 * inteiro na ordem da conversa, e não nove integrações soltas.
 */
export const GRUPOS_DE_PRESET = ['agenda', 'planilha', 'crm', 'outros'] as const
export type GrupoDePreset = (typeof GRUPOS_DE_PRESET)[number]

export const NOME_DO_GRUPO: Record<GrupoDePreset, string> = {
  agenda: 'Agenda (Verandi)',
  planilha: 'Planilha',
  crm: 'CRM',
  outros: 'Outros',
}

export type Preset = {
  id: string
  grupo: GrupoDePreset
  nome: string
  /** Uma linha na tela, dizendo o que ele faz. */
  resumo: string
  /** O que a pessoa precisa ter em mãos antes de escolher. */
  exige: string
  /**
   * Como a credencial entra. `query` e `cabecalho` mudam o que o cliente
   * precisa cadastrar em Configurações → Credenciais, e a tela diz isso.
   *
   * `opcional` é o quarto caso, e ele existe porque a tela mentia sem ele: um
   * endereço próprio do cliente pode ou não pedir senha, e tratar isso como
   * exigência fazia o crachá do preset acusar "falta a credencial" num bloco
   * que estava pronto. Quem lê um aviso que está errado metade das vezes
   * aprende a ignorar as duas metades.
   */
  credencial: 'query' | 'cabecalho' | 'bearer' | 'opcional' | 'nenhuma'
  dados: {
    metodo: Metodo
    url: string
    cabecalhos: Cabecalho[]
    corpo: string
    mapear: Mapeamento[]
    aoFalhar: AoFalhar
  }
}

export const PRESETS: Preset[] = [
  {
    id: 'rd-station-conversao',
    grupo: 'crm',
    nome: 'RD Station · registrar conversão',
    resumo:
      'Manda o lead para a RD como um evento de conversão. É o que faz a pessoa aparecer lá com origem e telefone.',
    exige: 'A chave pública da API na RD (Integrações → API). Cadastre em Credenciais como “query”.',
    credencial: 'query',
    dados: {
      metodo: 'POST',
      // A chave entra pela credencial do tipo `query`, resolvida no servidor —
      // ela nunca aparece aqui nem na versão publicada.
      url: 'https://api.rd.services/platform/conversions',
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: `{
  "event_type": "CONVERSION",
  "event_family": "CDP",
  "payload": {
    "conversion_identifier": "autofluxos-whatsapp",
    "name": "{{nome}}",
    "personal_phone": "{{telefone}}",
    "cf_origem": "{{origem}}"
  }
}`,
      // A RD devolve o id do evento. Guardar é o que deixa a tela de contatos
      // provar que a integração rodou, em vez de só torcer.
      mapear: [{ variavel: 'rd_evento', caminho: 'event_uuid' }],
      // **Falha de CRM não pode acordar uma pessoa.** O lead já está no nosso
      // banco; não ter chegado na RD é problema de sincronia, não de
      // atendimento — e handoff aqui encheria a fila com conversas que não
      // precisam de ninguém.
      aoFalhar: 'seguir',
    },
  },
  {
    id: 'google-sheets-linha',
    grupo: 'planilha',
    nome: 'Google Sheets · acrescentar linha',
    resumo:
      'Acrescenta uma linha numa planilha por um Web App do Apps Script. É o caminho de quem quer ver os leads numa planilha.',
    exige:
      'Um Web App publicado no Apps Script (Implantar → Novo, acesso “qualquer pessoa”). A chave já vem na URL que o Google gera — cole-a no endereço abaixo.',
    credencial: 'nenhuma',
    dados: {
      metodo: 'POST',
      url: 'https://script.google.com/macros/s/COLE-O-SEU-ID-AQUI/exec',
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: `{
  "nome": "{{nome}}",
  "telefone": "{{telefone}}",
  "origem": "{{origem}}"
}`,
      mapear: [],
      aoFalhar: 'seguir',
    },
  },
  /**
   * Ler a planilha — o que faltava.
   *
   * O preset de Sheets que existia só **escrevia** (acrescentar linha). Mas o
   * caso que aparece toda semana é o contrário: o negócio inteiro do cliente
   * mora numa planilha, e o bot precisa **consultar** — horário livre, professor
   * do dia, preço da tabela.
   *
   * A leitura é feita pelo bot, e não pela IA, e a diferença não é detalhe: a
   * IA responde por probabilidade, e horário é fato. Ela inventaria uma vaga que
   * não existe num dia ruim, e o erro só apareceria com a aluna já no estúdio.
   * Aqui o bloco lê a célula e a **pergunta dinâmica** transforma o conteúdo em
   * botões — a pessoa escolhe entre o que existe de verdade. A IA continua
   * ótima na camada de cima: entender "queria de manhã, mais pro fim da semana"
   * e virar `dia=sexta` antes da consulta rodar.
   *
   * **Duas portas, porque os clientes são dois.** O Apps Script não pede chave
   * do Google nem planilha pública, e é o mesmo gesto que quem já usa o preset
   * de escrever aprendeu. A API v4 é uma chamada direta, sem nada publicado,
   * mas exige a planilha aberta por link — o que é aceitável para uma grade de
   * horários e inaceitável para uma lista de alunos.
   *
   * O formato do que se lê está fechado em `docs/PLANILHAS.md`: uma aba
   * `AutoFluxos`, um intervalo nomeado por dia, e a célula com os valores
   * separados por ponto e vírgula — que é exatamente o que `opcoesDe` espera.
   */
  {
    id: 'google-sheets-ler',
    grupo: 'planilha',
    nome: 'Google Sheets · consultar (Apps Script)',
    resumo:
      'Lê um intervalo nomeado da planilha e devolve os valores para a conversa. É o caminho de quem gere horário, tabela ou estoque em planilha.',
    exige:
      'Um Web App publicado no Apps Script devolvendo o intervalo em JSON (Implantar → Novo, acesso “qualquer pessoa”). A chave já vem na URL que o Google gera — cole-a no endereço. A planilha não precisa ser pública.',
    credencial: 'nenhuma',
    dados: {
      metodo: 'GET',
      // `{{dia}}` no endereço: uma chamada só resolve qualquer dia da semana,
      // porque a ramificação por opção já gravou o dia escolhido. Com endereço
      // fixo seriam sete blocos ou uma corrente de condições.
      url: 'https://script.google.com/macros/s/COLE-O-SEU-ID-AQUI/exec?intervalo={{dia}}',
      cabecalhos: [],
      corpo: '',
      mapear: [{ variavel: 'horarios', caminho: 'valores' }],
      // Planilha fora do ar é integração falhando, e aqui ela é o assunto da
      // conversa: sem os horários não há o que perguntar. Uma pessoa assume.
      aoFalhar: 'humano',
    },
  },
  {
    id: 'google-sheets-api-ler',
    grupo: 'planilha',
    nome: 'Google Sheets · consultar (API do Google)',
    resumo:
      'Lê um intervalo nomeado direto pela API do Sheets. Sem publicar nada, mas exige a planilha aberta por link.',
    exige:
      'A planilha compartilhada como “qualquer pessoa com o link pode ver” e uma chave de API do Google Cloud (Sheets API ativada). Cadastre a chave em Credenciais como “query”, com campo `key`.',
    credencial: 'query',
    dados: {
      metodo: 'GET',
      // O ID da planilha é o pedaço entre `/d/` e `/edit` na URL dela.
      url: 'https://sheets.googleapis.com/v4/spreadsheets/COLE-O-ID-DA-PLANILHA/values/{{dia}}',
      cabecalhos: [],
      corpo: '',
      // A API devolve `{ "values": [["7h00;10h00;15h00"]] }` — matriz de linhas
      // por colunas. O caminho pega a primeira célula, que é onde o contrato de
      // leitura manda a planilha juntar os valores.
      mapear: [{ variavel: 'horarios', caminho: 'values.0.0' }],
      aoFalhar: 'humano',
    },
  },
  /*
   * A Verandi é a agenda da 4YU, e é o primeiro sistema que o bot conhece de
   * ponta a ponta.
   *
   * **Ela é um sistema do cliente como qualquer outro, e não uma exceção.** A
   * fronteira do ARQUITETURA.md continua de pé: o AutoFluxos não guarda turma,
   * matrícula nem presença; ele lê e escreve pela API, e o dado mora lá. O que
   * estes presets fazem é tirar da frente as três coisas que se erra em
   * silêncio ao montar a chamada na mão — o endereço, o caminho do campo, e o
   * `[]` que transforma a lista em menu.
   *
   * **Todos usam a mesma credencial**, uma só por cliente: a chave `vr_` dele,
   * cadastrada em Credenciais como `bearer`. Cadastrar uma por bloco seria
   * cinco lugares para revogar no dia em que a chave vazar.
   *
   * A ordem abaixo é a da conversa real: reconhecer quem chegou, oferecer o que
   * existe, marcar, desmarcar, e a fila de quando não há vaga.
   */
  {
    id: 'verandi-quem-e',
    grupo: 'agenda',
    nome: 'Verandi · reconhecer quem está falando',
    resumo:
      'Procura o telefone de quem escreveu na agenda e traz nome e id. É o primeiro bloco de qualquer fluxo de agendamento — sem ele, o bot pergunta o nome de quem faz aula há dois anos.',
    exige:
      'A chave da API da Verandi (Configurações → Integrações). Cadastre em Credenciais como “bearer”.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      // `{{telefone}}` é o número de quem está conversando, que o webhook já
      // grava no contato. Não achar responde 200 com lista vazia, então o
      // caminho de "não é aluno ainda" é uma condição sobre `encontrado`, e não
      // um erro.
      url: `${ENDERECO_DA_AGENDA}/pessoas?telefone={{telefone}}`,
      cabecalhos: [],
      corpo: '',
      mapear: [
        { variavel: 'encontrado', caminho: 'total' },
        { variavel: 'pessoa_id', caminho: 'pessoas.0.pessoaId' },
        { variavel: 'nome_na_agenda', caminho: 'pessoas.0.nome' },
      ],
      /*
       * Não reconhecer **não é falhar**: a rota responde 200 com `total: 0`, e
       * o fluxo segue para o ramo de quem é novo por uma condição sobre
       * `encontrado`. `aoFalhar` só vale quando a chamada em si não completa —
       * e aí seguir seria pior: o fluxo trataria uma aluna antiga como pessoa
       * nova e criaria o segundo cadastro dela.
       */
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-dias',
    grupo: 'agenda',
    nome: 'Verandi · quais dias têm vaga',
    resumo:
      'Traz os dias com horário livre num intervalo, sem repetir. Vira o menu de "para quando você quer?".',
    exige: 'A mesma credencial “bearer” com a chave da Verandi.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      // As duas datas vêm de uma pergunta com formato `data` guardando o
      // padronizado, que é `2026-08-21` — o formato que esta rota aceita.
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{data_de}}&ate={{data_ate}}`,
      cabecalhos: [],
      corpo: '',
      // `unicos` é o que faz este menu prestar: a lista traz uma linha por
      // horário, então a mesma data aparece quatro vezes num dia com quatro
      // vagas, e um menu com "18/08" repetido não é menu.
      mapear: [{ variavel: 'dias_livres', caminho: 'livres[].data', unicos: true }],
      // Sem os dias não há o que perguntar: a conversa morreria numa pergunta
      // sem resposta possível.
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-horarios',
    grupo: 'agenda',
    nome: 'Verandi · horários livres de um dia',
    resumo:
      'Traz os horários com vaga de um dia, e os ids deles. É o par que faz o menu virar agendamento de verdade.',
    exige: 'A mesma credencial “bearer” com a chave da Verandi.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{dia}}&ate={{dia}}`,
      cabecalhos: [],
      corpo: '',
      /*
       * Duas listas para o menu, e uma para o que não coube nele.
       *
       * `horarios` é o que a pessoa lê — **hora, aula e professor na mesma
       * linha**, porque "07:00" sozinho não responde "qual aula é essa?" nem
       * "com quem?", que são as duas perguntas que sempre vêm em seguida.
       * O rótulo para em dois campos porque o botão do WhatsApp aceita 20
       * caracteres: `07:00 · Pilates solo` já são os 20. O professor fica em
       * `horarios_prof`, para a mensagem antes do menu dizer quem atende — com
       * `formato: 'nomes'`, porque a rota devolve **um professor por horário** e
       * sem isso a frase saía "quem atende é: Carol;Carol;Carol;Márcia".
       *
       * `horarios_id` é o que a API entende. Na Pergunta: opções de `horarios`,
       * valores de `horarios_id`. **Nenhuma das duas pode ter "sem repetir"** —
       * tirar um item de uma desloca os valores da outra, e o agendamento vai
       * para o horário de alguém.
       *
       * `lotados` vem na mesma chamada e existe para separar duas conversas
       * diferentes que viravam a mesma: "não tem nada nesse dia" e "tem, e
       * encheu". A segunda tem saída — é o gancho da fila de espera —, e sem
       * esta lista o bot dizia "não temos horário" para um dia cheio de aula.
       */
      mapear: [
        { variavel: 'horarios', caminho: 'livres[]', rotulo: '{hora} · {servico}' },
        { variavel: 'horarios_id', caminho: 'livres[].sessaoId' },
        { variavel: 'horarios_prof', caminho: 'livres[].profissional', formato: 'nomes' },
        { variavel: 'lotados', caminho: 'cheios[]', rotulo: '{hora} · {servico}' },
        { variavel: 'lotados_id', caminho: 'cheios[].sessaoId' },
      ],
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-horarios-do-professor',
    grupo: 'agenda',
    nome: 'Verandi · horários livres com um professor',
    resumo:
      'Os horários de um dia com um profissional específico. É o que responde "quero aula com a Marina".',
    exige:
      'A mesma credencial “bearer”. O `professor_id` sai do bloco de catálogo, guardado por uma pergunta com lista de valores.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      /*
       * O filtro é da própria rota, e não uma lista peneirada aqui.
       *
       * Peneirar do nosso lado significaria trazer o dia inteiro e jogar fora o
       * que não serve — e o teto de 10 itens do menu cortaria antes da peneira,
       * escondendo justamente os horários do professor pedido.
       */
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{dia}}&ate={{dia}}&profissional={{professor_id}}`,
      cabecalhos: [],
      corpo: '',
      mapear: [
        { variavel: 'horarios', caminho: 'livres[]', rotulo: '{hora} · {servico}' },
        { variavel: 'horarios_id', caminho: 'livres[].sessaoId' },
        { variavel: 'lotados', caminho: 'cheios[]', rotulo: '{hora} · {servico}' },
        { variavel: 'lotados_id', caminho: 'cheios[].sessaoId' },
      ],
      aoFalhar: 'humano',
    },
  },
  /*
   * Filtrar por modalidade — o que faltava para o fluxo de agendamento.
   *
   * Veio de quem opera descrevendo a conversa real: *"ele consulta primeiro a
   * modalidade que a pessoa citou — pode ter clicado em personal, pode ter
   * clicado em pilates, pode ter clicado em fisioterapia — e a partir disso
   * identifica a modalidade, depois cita os dias e horários com base naquela
   * modalidade"*.
   *
   * Sem isto o bot oferecia o dia inteiro e a pessoa escolhia um horário de
   * outra modalidade — e o erro só aparecia com ela já no estúdio. O `servico`
   * é o mesmo id que o catálogo devolve em `servicos_id`, guardado por uma
   * pergunta com lista de valores.
   *
   * **O filtro é da rota, e não uma peneira nossa**, pela mesma razão do
   * preset de professor: o teto de 10 itens do menu cortaria antes da peneira,
   * escondendo justamente os horários da modalidade pedida.
   */
  {
    id: 'verandi-horarios-da-modalidade',
    grupo: 'agenda',
    nome: 'Verandi · horários livres de uma modalidade',
    resumo:
      'Os horários de um dia só da modalidade escolhida. É o que responde "quero pilates na quarta" sem oferecer aula de outra coisa.',
    exige:
      'A mesma credencial “bearer”. O `servico_id` sai do bloco de catálogo, guardado por uma pergunta com lista de valores.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{dia}}&ate={{dia}}&servico={{servico_id}}`,
      cabecalhos: [],
      corpo: '',
      mapear: [
        { variavel: 'horarios', caminho: 'livres[]', rotulo: '{hora} · {profissional|a confirmar}' },
        { variavel: 'horarios_id', caminho: 'livres[].sessaoId' },
        { variavel: 'horarios_prof', caminho: 'livres[].profissional', formato: 'nomes' },
        { variavel: 'lotados', caminho: 'cheios[]', rotulo: '{hora} · {profissional|a confirmar}' },
        { variavel: 'lotados_id', caminho: 'cheios[].sessaoId' },
      ],
      aoFalhar: 'humano',
    },
  },
  /*
   * Os dias que têm vaga numa modalidade, para o menu de "para quando?".
   *
   * É o par do de cima na outra ponta da conversa: primeiro *quais dias*, e só
   * depois *quais horários daquele dia*. Quem opera descreveu exatamente essa
   * ordem — "cita os dias e horários com base naquela modalidade".
   *
   * `unicos` aqui é obrigatório e **não** desalinha par nenhum: esta lista vai
   * sozinha para o menu, sem uma lista de ids do lado. O que a pessoa escolhe é
   * a própria data, que é o que a chamada seguinte precisa.
   */
  {
    id: 'verandi-dias-da-modalidade',
    grupo: 'agenda',
    nome: 'Verandi · quais dias têm vaga numa modalidade',
    resumo:
      'Os dias com horário livre de uma modalidade, sem repetir. Vira o menu de "para quando você quer?" já filtrado.',
    exige: 'A mesma credencial “bearer”. O `servico_id` sai do bloco de catálogo.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/disponibilidade?de={{data_de}}&ate={{data_ate}}&servico={{servico_id}}`,
      cabecalhos: [],
      corpo: '',
      mapear: [
        { variavel: 'dias_livres', caminho: 'livres[].data', unicos: true },
        { variavel: 'quantos_dias', caminho: 'livres[].data', unicos: true, quantos: true },
      ],
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-catalogo',
    grupo: 'agenda',
    nome: 'Verandi · serviços, profissionais e as palavras da conta',
    resumo:
      'Quem atende, o que se oferece e como este negócio chama cada coisa. Use quando o fluxo precisar perguntar "com qual professor?".',
    exige: 'A mesma credencial “bearer” com a chave da Verandi.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/catalogo`,
      cabecalhos: [],
      corpo: '',
      // O vocabulário vem junto porque cada conta chama as coisas do jeito
      // dela: um estúdio diz "aula" e uma clínica diz "sessão". Quem escreve a
      // mensagem deve usar a palavra da conta, e não a nossa.
      mapear: [
        { variavel: 'professores', caminho: 'profissionais[].nome' },
        { variavel: 'professores_id', caminho: 'profissionais[].profissionalId' },
        { variavel: 'servicos', caminho: 'servicos[].nome' },
        { variavel: 'servicos_id', caminho: 'servicos[].servicoId' },
      ],
      // Sem o catálogo não há o que perguntar: a conversa pararia numa pergunta
      // sem nenhuma resposta possível.
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-cadastrar',
    grupo: 'agenda',
    nome: 'Verandi · cadastrar quem ainda não existe',
    resumo:
      'Cria a pessoa na agenda quando o reconhecimento não achou ninguém. Nome é o único campo obrigatório.',
    exige: 'A mesma credencial “bearer” com a chave da Verandi.',
    credencial: 'bearer',
    dados: {
      metodo: 'POST',
      url: `${ENDERECO_DA_AGENDA}/pessoas`,
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: `{
  "nome": "{{nome}}",
  "telefone": "{{telefone}}"
}`,
      mapear: [{ variavel: 'pessoa_id', caminho: 'pessoaId' }],
      // Sem `pessoa_id` não dá para marcar nada: seguir aqui só adiaria a
      // falha para o bloco seguinte, com a pessoa já tendo respondido tudo.
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-marcar',
    grupo: 'agenda',
    nome: 'Verandi · marcar no horário escolhido',
    resumo:
      'Põe a pessoa no horário que ela escolheu. A vaga é conferida na hora de gravar, e não na hora em que o menu foi montado.',
    exige: 'A mesma credencial “bearer” com a chave da Verandi.',
    credencial: 'bearer',
    dados: {
      metodo: 'POST',
      url: `${ENDERECO_DA_AGENDA}/participacoes`,
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      // `{{sessao_id}}` sai da pergunta dinâmica com lista de valores. Escrever
      // `{{horario}}` aqui é o erro clássico: manda "07:00" onde a API quer o
      // id, e o pedido falha com tudo parecendo certo na tela.
      corpo: `{
  "pessoaId": "{{pessoa_id}}",
  "sessaoId": "{{sessao_id}}"
}`,
      mapear: [{ variavel: 'participacao_id', caminho: 'participacaoId' }],
      /*
       * Entre montar o menu e a pessoa clicar, alguém pode ter ocupado a vaga:
       * a resposta é 409, e 409 **é conversa normal**, não defeito. Handoff é o
       * certo porque prometer um horário que encheu é o pior desfecho possível,
       * e quem responde por uma vaga é quem está no balcão.
       */
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-desmarcar',
    grupo: 'agenda',
    nome: 'Verandi · desmarcar (o começo do reagendamento)',
    resumo:
      'Registra que a pessoa avisou que não vem. A vaga volta a ser oferecida na hora, e o crédito de reposição é preservado.',
    exige:
      'A mesma credencial “bearer”. O `participacaoId` sai do bloco de marcar, ou da agenda da pessoa.',
    credencial: 'bearer',
    dados: {
      // Apesar do verbo, nada é apagado do outro lado: a marcação fica no
      // histórico como falta avisada, que é o que preserva a reposição.
      metodo: 'DELETE',
      url: `${ENDERECO_DA_AGENDA}/participacoes/{{participacao_id}}`,
      cabecalhos: [],
      corpo: '',
      mapear: [{ variavel: 'situacao', caminho: 'status' }],
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-minha-agenda',
    grupo: 'agenda',
    nome: 'Verandi · a agenda de uma pessoa',
    resumo:
      'Horários fixos, o que vem pela frente e quantas reposições estão em aberto. Responde "quais são meus horários?" e "quantas aulas tenho para repor?".',
    exige: 'A mesma credencial “bearer”. O `pessoa_id` sai do bloco de reconhecer.',
    credencial: 'bearer',
    dados: {
      metodo: 'GET',
      url: `${ENDERECO_DA_AGENDA}/pessoas/{{pessoa_id}}`,
      cabecalhos: [],
      corpo: '',
      // As próximas viram menu junto com os ids delas: é assim que "quero
      // desmarcar" oferece o que dá para desmarcar, em vez de pedir um id.
      /*
       * Data **e hora** na mesma linha, e não só a data.
       *
       * Duas aulas no mesmo dia viravam duas opções idênticas no menu de
       * desmarcar — e escolher entre duas linhas iguais é escolher no escuro.
       * Com o modelo de rótulo, cada linha diz o dia, a hora e qual aula é.
       */
      mapear: [
        { variavel: 'nome_na_agenda', caminho: 'nome' },
        { variavel: 'proximas', caminho: 'proximas[]', rotulo: '{data} {hora} · {servico}' },
        { variavel: 'proximas_id', caminho: 'proximas[].participacaoId' },
        {
          variavel: 'reposicoes_abertas',
          caminho: 'reposicoesAbertas[]',
          rotulo: '{data} {hora} · {servico}',
        },
        { variavel: 'reposicoes_id', caminho: 'reposicoesAbertas[].participacaoId' },
        /*
         * O **número** de reposições, e não a lista delas.
         *
         * Pedido de quem opera, literal: *"assim que identificar o aluno, ele
         * conseguir salvar essa informação para que já possamos informar ao
         * aluno — você tem x aulas para repor"*. A lista já existia acima, e
         * ela não serve para essa frase: numa mensagem sai como
         * `18/08 07:00 · Pilates;25/08 07:00 · Pilates`.
         *
         * Ele também é o que decide a conversa: `igual 0` não oferece
         * reposição, `maior 1` oferece a recepção, porque remarcar duas de uma
         * vez é conversa de gente.
         */
        {
          variavel: 'quantas_reposicoes',
          caminho: 'reposicoesAbertas[].participacaoId',
          quantos: true,
        },
        { variavel: 'horario_fixo', caminho: 'horariosFixos[]', rotulo: '{hora} · {servico}' },
        { variavel: 'situacao_na_agenda', caminho: 'situacao' },
      ],
      aoFalhar: 'humano',
    },
  },
  {
    id: 'verandi-espera',
    grupo: 'agenda',
    nome: 'Verandi · entrar na fila de um horário cheio',
    resumo:
      'Transforma o "está lotado" em "te aviso se abrir". Quando alguém desmarca, a agenda dispara o aviso.',
    exige: 'A mesma credencial “bearer”. O `sessaoId` é o mesmo id que veio em `cheios`.',
    credencial: 'bearer',
    dados: {
      metodo: 'POST',
      url: `${ENDERECO_DA_AGENDA}/espera`,
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: `{
  "pessoaId": "{{pessoa_id}}",
  "sessaoId": "{{sessao_id}}"
}`,
      // Entrar na fila não reserva nada, e a mensagem seguinte precisa dizer
      // isso: reservar sozinho criaria a pior conversa possível, que é "você
      // foi marcada numa aula que não pediu".
      mapear: [{ variavel: 'posicao_na_fila', caminho: 'posicao' }],
      // Seguir em frente diria "te aviso quando abrir" sem ninguém ter entrado
      // em fila nenhuma. Prometer aviso que não vem é pior do que não prometer.
      aoFalhar: 'humano',
    },
  },
  {
    id: 'webhook',
    grupo: 'outros',
    /*
     * "O meu próprio sistema", e não "Webhook".
     *
     * Todos os outros presets têm nome de produto — RD Station, Google Sheets —
     * e quem tem um sistema feito sob medida procurava o nome do próprio
     * sistema nessa lista, não achava, e concluía que o produto não servia.
     * "Webhook" é a palavra de quem programa: o dono da pizzaria não sabe que
     * é isso que o sobrinho fez para ele.
     */
    nome: 'O meu próprio sistema',
    resumo:
      'Manda para um sistema seu o que a conversa coletou — o de pedidos, o de agendamento, o que alguém fez para você.',
    exige:
      'O endereço que recebe (pergunte a quem fez o sistema). Se ele pedir senha, cadastre em Credenciais como “bearer”.',
    // `opcional`, e não `bearer`: o próprio `exige` acima diz "**se** ele pedir
    // senha". Muito sistema feito sob medida aceita a chamada sem nenhuma, e
    // marcar como exigência fazia a tela cobrar uma credencial que não existe.
    credencial: 'opcional',
    dados: {
      metodo: 'POST',
      url: 'https://',
      cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
      corpo: `{
  "nome": "{{nome}}",
  "telefone": "{{telefone}}"
}`,
      mapear: [],
      aoFalhar: 'seguir',
    },
  },
]

/**
 * Este preset **exige** credencial?
 *
 * Fonte única de propósito: a regra vivia copiada em três telas (o card do
 * desenho, a prévia do hover e a gaveta de integrações), e a quarta hipótese —
 * `opcional` — teria sido acrescentada só numa delas. Aviso que diverge entre
 * duas telas é pior do que aviso nenhum: uma delas passa a mentir, e não há
 * como saber qual sem ler o código.
 *
 * `opcional` não exige. "O meu próprio sistema" fala com o endereço que o
 * cliente já tem, e muito sistema feito sob medida aceita a chamada sem senha
 * nenhuma — cobrar ali é acusar de faltar o que não falta.
 */
export function exigeCredencial(preset: Preset): boolean {
  return preset.credencial !== 'nenhuma' && preset.credencial !== 'opcional'
}

export function acharPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id)
}

/**
 * Qual preset este bloco já está usando, olhando só para o endereço.
 *
 * Existe para a gaveta fechada poder dizer o que o bloco é. Quem monta fluxo
 * relatou exatamente isto: *"se essa tela é minimizada não conseguimos
 * identificar se está funcional"* — a gaveta fechada mostrava "Começar de uma
 * integração pronta" tanto num bloco vazio quanto num bloco já preenchido pela
 * agenda, e as duas situações pedem gestos opostos.
 *
 * **Casa por endereço, e não por um id gravado no bloco**, porque preset
 * resolvido não deixa referência para trás — é a regra que faz versão publicada
 * ser imutável. O endereço é o que sobra dele, e basta: quem edita a URL depois
 * de aplicar deixou de estar no preset, e é honesto a tela parar de afirmar que
 * está.
 *
 * **O caminho sozinho não basta**, e isso custou um teste para descobrir: cinco
 * presets moram em `/disponibilidade` e só se distinguem pela consulta — os
 * dias, os horários de um dia, os de um professor, os de uma modalidade. Casar
 * só pelo caminho anunciava "quais dias têm vaga" num bloco que busca horário
 * de professor.
 *
 * Então a comparação é caminho **mais os nomes dos parâmetros**, e não os
 * valores: os presets carregam `{{variavel}}` na consulta, e trocar `{{dia}}`
 * por outra variável não faz ninguém sair da integração. Trocar o conjunto de
 * parâmetros, sim — aí é outra chamada.
 */
export function presetDoBloco(dados: {
  metodo: string
  url: string
  /** O mapeamento do bloco, quando a tela tiver. É o desempate. */
  mapear?: { variavel: string }[]
}): Preset | undefined {
  const alvo = assinatura(dados.url)
  if (alvo === '') return undefined

  const candidatos = PRESETS.filter(
    (preset) => preset.dados.metodo === dados.metodo && assinatura(preset.dados.url) === alvo,
  )

  if (candidatos.length <= 1) return candidatos[0]

  /*
   * Empate: o endereço não distingue tudo.
   *
   * `/disponibilidade?de&ate` é a mesma chamada para "quais dias têm vaga" e
   * "quais horários deste dia" — o que muda é o que se guarda dela: um traz
   * `dias_livres` sem repetir, o outro traz o par `horarios` + `horarios_id`.
   * O desempate é por isso o conjunto de variáveis guardadas, que é o que de
   * fato diferencia as duas integrações.
   *
   * Sem mapeamento para comparar, **nenhum** é anunciado: dizer o nome errado
   * na gaveta fechada é pior do que não dizer nada, porque quem lê confia.
   */
  const guardadas = new Set((dados.mapear ?? []).map((m) => m.variavel).filter((v) => v !== ''))
  if (guardadas.size === 0) return undefined

  return candidatos.find((preset) =>
    preset.dados.mapear.every((m) => guardadas.has(m.variavel)),
  )
}

/**
 * O que identifica uma chamada: o endereço e **quais** parâmetros ela usa.
 *
 * Feito na mão, sem `new URL`, porque as URLs dos presets têm `{{variavel}}` no
 * meio e nem toda interpolação sobrevive a um parser — e porque um endereço
 * pela metade, ainda sendo digitado, não pode lançar aqui.
 */
function assinatura(url: string): string {
  const limpa = url.trim()
  if (limpa === '') return ''

  const corte = limpa.indexOf('?')
  const caminho = (corte === -1 ? limpa : limpa.slice(0, corte)).replace(/\/$/, '')
  if (corte === -1) return caminho

  const chaves = limpa
    .slice(corte + 1)
    .split('&')
    .map((par) => par.split('=')[0]?.trim() ?? '')
    .filter((chave) => chave !== '')
    // Ordenado para a ordem em que os parâmetros foram escritos não contar:
    // `?ate=&de=` é a mesma chamada que `?de=&ate=`.
    .sort()

  return `${caminho}?${chaves.join('&')}`
}
