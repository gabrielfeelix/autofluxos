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
