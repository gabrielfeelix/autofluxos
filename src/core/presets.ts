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

export type Preset = {
  id: string
  nome: string
  /** Uma linha na tela, dizendo o que ele faz. */
  resumo: string
  /** O que a pessoa precisa ter em mãos antes de escolher. */
  exige: string
  /**
   * Como a credencial entra. `query` e `cabecalho` mudam o que o cliente
   * precisa cadastrar em Configurações → Credenciais, e a tela diz isso.
   */
  credencial: 'query' | 'cabecalho' | 'bearer' | 'nenhuma'
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
  {
    id: 'webhook',
    nome: 'Webhook · avisar um sistema seu',
    resumo:
      'Um POST com o que a conversa coletou. Serve para qualquer sistema que aceite receber JSON.',
    exige: 'O endereço que vai receber. Se ele pedir token, cadastre em Credenciais como “bearer”.',
    credencial: 'bearer',
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

export function acharPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id)
}
