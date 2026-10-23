import 'server-only'
import { apagarAvisoDaEfi, conectarEfi, pagamentoDoAvisoDaEfi } from '@/channels/efi'
import { apagarAvisoDaIugu, conectarIugu, pagamentoDoAvisoDaIugu } from '@/channels/iugu'
import { conectarPagarme, pagamentoDoAvisoDoPagarme } from '@/channels/pagarme'
import { conectarPagHiper, pagamentoDoAvisoDaPagHiper } from '@/channels/paghiper'
import type { AcessoAoGateway, ConexaoProvada, Gateway } from '@/channels/pagamento'
import { apagarAvisoDaWoovi, conectarWoovi, pagamentoDoAvisoDaWoovi } from '@/channels/woovi'
import type { ConexaoPorCampos } from '@/core/pagamentos/conexao-por-campos'

/**
 * Os gateways que ligam por credencial colada e avisam no endereço por
 * organização (`api/webhook/pagamento/[gateway]/[clienteId]`).
 *
 * Cada um diz o que a tela pede (`tela`), como provar e guardar
 * (`conectar`), como desfazer o aviso ao desligar (`apagarAviso`) e o que
 * tirar do corpo do aviso (`pagamentoDoAviso`: só um id, relido depois).
 * Mercado Pago, Asaas, InfinitePay, PagBank e Stripe têm caminho próprio e
 * ficam fora daqui.
 */

export type GatewayPorCampos = {
  tela: ConexaoPorCampos
  conectar(valores: Record<string, string>, clienteId: string): Promise<ConexaoProvada>
  apagarAviso?(acesso: AcessoAoGateway, avisoId: string): Promise<void>
  pagamentoDoAviso(corpo: unknown): string | null
}

export const GATEWAYS_POR_CAMPOS: Partial<Record<Gateway, GatewayPorCampos>> = {
  woovi: {
    tela: {
      campos: [{ nome: 'appId', rotulo: 'AppID', tipo: 'segredo' }],
      ondeAchar: 'Na Woovi: API/Plugins, Nova API/Plugin, tipo API. Copie o AppID logo depois de salvar.',
    },
    conectar: conectarWoovi,
    apagarAviso: apagarAvisoDaWoovi,
    pagamentoDoAviso: pagamentoDoAvisoDaWoovi,
  },
  paghiper: {
    tela: {
      campos: [
        { nome: 'apiKey', rotulo: 'apiKey', exemplo: 'Exemplo: apk_12345678-AbCdEf', tipo: 'texto' },
        { nome: 'token', rotulo: 'Token', tipo: 'segredo' },
      ],
      ondeAchar: 'Na PagHiper: Minha conta, Credenciais. A apiKey e o token ficam na mesma tela.',
    },
    conectar: (valores) => conectarPagHiper(valores),
    pagamentoDoAviso: pagamentoDoAvisoDaPagHiper,
  },
  efi: {
    tela: {
      campos: [
        { nome: 'clienteId', rotulo: 'Client_Id', exemplo: 'Exemplo: Client_Id_abc123', tipo: 'texto' },
        { nome: 'segredo', rotulo: 'Client_Secret', tipo: 'segredo' },
        { nome: 'chave', rotulo: 'Chave Pix que recebe', exemplo: 'Exemplo: financeiro@suaempresa.com.br', tipo: 'texto' },
        { nome: 'certificado', rotulo: 'Certificado (.p12)', tipo: 'arquivo', aceita: '.p12,.pfx' },
      ],
      ondeAchar:
        'Na Efí: API, Criar aplicação, com a API Pix e os escopos de cobrança e webhook. O certificado sai em API, Meus Certificados, e só baixa uma vez.',
    },
    conectar: conectarEfi,
    apagarAviso: apagarAvisoDaEfi,
    pagamentoDoAviso: pagamentoDoAvisoDaEfi,
  },
  iugu: {
    tela: {
      campos: [{ nome: 'token', rotulo: 'Token de API', tipo: 'segredo' }],
      ondeAchar:
        'Na Iugu: Configurações, Integração via API, Novo, tipo produção. Cole a chave pública abaixo quando a Iugu pedir. Um administrador da conta precisa aprovar o token antes de conectar.',
      pedeChavePublica: true,
    },
    conectar: conectarIugu,
    apagarAviso: apagarAvisoDaIugu,
    pagamentoDoAviso: pagamentoDoAvisoDaIugu,
  },
  pagarme: {
    tela: {
      campos: [{ nome: 'chave', rotulo: 'Chave secreta', exemplo: 'Exemplo: sk_abc123', tipo: 'segredo' }],
      ondeAchar: 'No Pagar.me: Desenvolvimento, Chaves. Deixe a lista de IPs permitidos desligada.',
      avisoManual:
        'No Pagar.me, em Configurações, Webhooks, crie um webhook com este endereço e os eventos de cobrança (charge.paid e charge.refunded).',
    },
    conectar: (valores) => conectarPagarme(valores),
    pagamentoDoAviso: pagamentoDoAvisoDoPagarme,
  },
}

export function gatewayPorCampos(gateway: string): { gateway: Gateway; config: GatewayPorCampos } | null {
  const config = GATEWAYS_POR_CAMPOS[gateway as Gateway]
  return config ? { gateway: gateway as Gateway, config } : null
}
