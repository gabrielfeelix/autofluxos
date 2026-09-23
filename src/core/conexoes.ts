import { AVISO_DE_VENCIMENTO_DIAS } from './saude-da-conexao'

/**
 * O estado de uma conexão em quatro camadas separadas (tarefa 6.4, C01, C04,
 * C05): **configurado**, **autorização**, **último evento** e **falha**.
 *
 * Antes, cada tela resumia tudo num selo só ("ligada", "Atendendo agora"), e o
 * selo verde era lido como "está recebendo agora" quando só dizia "existe
 * cadastro". As quatro perguntas têm respostas independentes: uma página de
 * anúncio pode estar cadastrada, com token válido, e nada chegar porque a
 * inscrição do webhook caiu.
 *
 * **Sem tráfego recente não é falha.** Canal quieto há três dias pode ser só
 * uma semana fraca; chamar isso de defeito ensina a ignorar o aviso (regra do
 * H05). O último evento aparece com a data, e quem lê decide. Falha é só o que
 * se sabe que quebra: número desembarcado, token vencido, inscrição perdida.
 *
 * Os `href` são relativos à conta (`/ajustes/whatsapp`), como os do Início.
 */

export type Autorizacao = 'valida' | 'vence_em_breve' | 'vencida' | 'nao_se_aplica'

export type EstadoDaConexao = {
  configurado: boolean
  autorizacao: Autorizacao
  /** ISO do último evento recebido, ou `null` quando nunca houve ou não se sabe. */
  ultimoEvento: string | null
  /** O que se sabe que quebra, em português. `null` = nada conhecido. */
  falha: string | null
  proximaAcao: { texto: string; href: string } | null
}

export type DadosDaConexao =
  | {
      tipo: 'whatsapp'
      /** Um por número. Vazio = não configurado. */
      numeros: { displayPhoneNumber: string | null; desembarcadoEm: string | null }[]
      ultimoEvento: string | null
    }
  | {
      tipo: 'instagram'
      conta: { igUsername: string | null; tokenExpiraEm: string | null } | null
      ultimoEvento: string | null
    }
  | {
      tipo: 'anuncios'
      paginas: number
      temToken: boolean
      /** `null` = não sabemos (a inscrição não é gravada hoje). Só `false` é falha. */
      webhookInscrito: boolean | null
      ultimoEvento: string | null
    }
  | {
      /** Chaves de API, loja: só existe ou não existe. */
      tipo: 'cadastro'
      configurado: boolean
      href: string
    }

const DIA = 86_400_000

export function estadoDaConexao(dados: DadosDaConexao, agora: Date = new Date()): EstadoDaConexao {
  switch (dados.tipo) {
    case 'whatsapp': {
      const configurado = dados.numeros.length > 0
      const caido = dados.numeros.find((n) => n.desembarcadoEm)
      return {
        configurado,
        // O token do WhatsApp é o do sistema da Meta, não vence por conta.
        autorizacao: 'nao_se_aplica',
        ultimoEvento: dados.ultimoEvento,
        falha: caido
          ? `O número ${caido.displayPhoneNumber ?? ''} foi desconectado do celular: nada é enviado até reconectar.`.replace(
              /\s+/g,
              ' ',
            )
          : null,
        proximaAcao: !configurado
          ? { texto: 'Conectar o WhatsApp', href: '/ajustes/whatsapp' }
          : caido
            ? { texto: 'Reconectar o número', href: '/ajustes/whatsapp' }
            : null,
      }
    }

    case 'instagram': {
      if (!dados.conta) {
        return {
          configurado: false,
          autorizacao: 'nao_se_aplica',
          ultimoEvento: null,
          falha: null,
          proximaAcao: { texto: 'Conectar o Instagram', href: '/ajustes/instagram' },
        }
      }
      const autorizacao = porValidade(dados.conta.tokenExpiraEm, agora)
      const nome = dados.conta.igUsername ? `@${dados.conta.igUsername}` : 'do Instagram'
      return {
        configurado: true,
        autorizacao,
        ultimoEvento: dados.ultimoEvento,
        falha:
          autorizacao === 'vencida'
            ? `A autorização ${nome} venceu: o direct não responde até reconectar.`
            : null,
        proximaAcao:
          autorizacao === 'vencida' || autorizacao === 'vence_em_breve'
            ? { texto: 'Reconectar o Instagram', href: '/ajustes/instagram' }
            : null,
      }
    }

    case 'anuncios': {
      const configurado = dados.paginas > 0
      const semWebhook = configurado && dados.webhookInscrito === false
      return {
        configurado,
        // Sem a conta de anúncios não há o que vencer: a falha abaixo diz o que falta.
        autorizacao: dados.temToken ? 'valida' : 'nao_se_aplica',
        ultimoEvento: dados.ultimoEvento,
        falha: semWebhook
          ? 'A página não está mais inscrita para mandar os leads: nenhum formulário chega.'
          : configurado && !dados.temToken
            ? 'Falta a conta de anúncios: a página está ligada, mas não dá para ler os leads.'
            : null,
        proximaAcao: !configurado
          ? { texto: 'Ligar uma página', href: '/ajustes/anuncios' }
          : semWebhook
            ? { texto: 'Inscrever a página de novo', href: '/ajustes/anuncios' }
            : !dados.temToken
              ? { texto: 'Ligar a conta de anúncios', href: '/ajustes/anuncios' }
              : null,
      }
    }

    case 'cadastro':
      return {
        configurado: dados.configurado,
        autorizacao: 'nao_se_aplica',
        ultimoEvento: null,
        falha: null,
        proximaAcao: dados.configurado ? null : { texto: 'Configurar', href: dados.href },
      }
  }
}

function porValidade(expiraEm: string | null, agora: Date): Autorizacao {
  // Sem data não é vencido: chutar defeito mandaria reconectar o que funciona.
  if (!expiraEm) return 'valida'
  const resta = Date.parse(expiraEm) - agora.getTime()
  if (Number.isNaN(resta)) return 'valida'
  if (resta <= 0) return 'vencida'
  if (resta <= AVISO_DE_VENCIMENTO_DIAS * DIA) return 'vence_em_breve'
  return 'valida'
}

/** O selo único do cartão, derivado das camadas e nunca o contrário. */
export function seloDaConexao(
  estado: EstadoDaConexao,
): { texto: string; tom: 'ok' | 'alerta' | 'perigo' | 'neutro' } {
  if (!estado.configurado) return { texto: 'não conectada', tom: 'neutro' }
  if (estado.falha) return { texto: 'precisa de ação', tom: 'perigo' }
  if (estado.autorizacao === 'vence_em_breve') return { texto: 'vence em breve', tom: 'alerta' }
  return { texto: 'configurada', tom: 'ok' }
}

/**
 * "Última mensagem há 2 h", "há 3 dias", ou "nenhuma ainda". Sem juízo: canal
 * quieto não vira alerta aqui.
 */
export function idadeDoEvento(iso: string | null, agora: Date = new Date()): string {
  if (!iso) return 'nenhuma ainda'
  const ms = agora.getTime() - Date.parse(iso)
  if (Number.isNaN(ms)) return 'nenhuma ainda'
  const minutos = Math.max(0, Math.floor(ms / 60_000))
  if (minutos < 1) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

/**
 * "3 de 5" do índice de Configurações, contado da **mesma lista** que a tela
 * de Integrações desenha (C02). O que não está disponível (Telegram) fica
 * fora da conta: não é desconectado, é inexistente ainda.
 */
export function resumoDoCatalogo(
  itens: { disponivel: boolean; estado: EstadoDaConexao }[],
): { conectadas: number; total: number } {
  const disponiveis = itens.filter((i) => i.disponivel)
  return {
    conectadas: disponiveis.filter((i) => i.estado.configurado).length,
    total: disponiveis.length,
  }
}

/**
 * O estado de teste de uma chave de API, em texto de tela (tarefa 6.7).
 *
 * Só a da agenda é `testavel`: é a única cujo endereço conhecemos. Testar
 * uma URL qualquer que a pessoa digitasse continua proibido (C08), então as
 * outras dizem que não dá, em vez de fingir que nunca ninguém testou.
 */
export function testeDaChave(
  chave: { testadaEm: string | null; testeOk: boolean | null },
  testavel: boolean,
): { texto: string; tom: 'bom' | 'ruim' | 'neutro' } {
  if (!testavel) return { texto: 'não dá para testar daqui', tom: 'neutro' }
  if (!chave.testadaEm) return { texto: 'nunca testada', tom: 'neutro' }
  const quando = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(chave.testadaEm))
    .replace(', ', ' às ')
  return chave.testeOk === false
    ? { texto: `falhou no teste de ${quando}`, tom: 'ruim' }
    : { texto: `testada em ${quando}`, tom: 'bom' }
}
