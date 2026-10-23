import 'server-only'
import forge from 'node-forge'
import { Agent, fetch as fetchComCertificado } from 'undici'
import { z } from 'zod'
import { enderecoDoAviso } from './aviso-por-endereco'
import {
  ErroDeConexao,
  type AcessoAoGateway,
  type Ambiente,
  type ConexaoProvada,
  type GatewayDePagamento,
  type PagamentoLido,
} from './pagamento'

/**
 * A Efí (ex-Gerencianet) pela API Pix do Banco Central
 * (docs/gateways/pesquisa-bancos-api-pix.md, seção 2.1).
 *
 * É o primeiro banco, e o desenho serve aos próximos do mesmo padrão (Inter,
 * Sicoob): `PUT /v2/cob/{txid}`, `GET` para reler, `PATCH` para remover.
 *
 * - **Conectar**: o dono cria a aplicação no app da Efí (escopos de cobrança e
 *   webhook) e sobe aqui o certificado `.p12`, o `client_id`, o
 *   `client_secret` e a chave Pix que recebe. O `.p12` da Efí usa algoritmo
 *   antigo que o Node 24 recusa ("Unsupported PKCS12 PFX data"): o
 *   `node-forge` o converte em PEM na hora, e só o PEM vai para o cofre, num
 *   JSON com o resto. O `node-forge` só lê o arquivo; não confere assinatura.
 * - **Toda chamada é mTLS**, inclusive a do token (`client_credentials`, uma
 *   hora). O token é pedido a cada operação: são poucas, e nada fica em
 *   memória entre funções.
 * - **Aviso**: o padrão do Banco Central exige mTLS na chegada, e a Vercel não
 *   recebe certificado de cliente. A Efí permite pular essa checagem
 *   (`x-skip-mtls-checking`) desde que o endereço leve um segredo nosso; ela
 *   cola `/pix` no fim, e o `&ignorar=` o recolhe. Do corpo sai só o `txid`.
 * - O `txid` é a nossa referência sem hífens (32 caracteres, dentro dos 26 a
 *   35 do padrão): reler devolve a referência sem guardar nada a mais.
 * - Escopos de pagamento (`pix.send`) não são pedidos nem usados.
 */

const BASES: Record<Ambiente, string> = { producao: 'https://pix.api.efipay.com.br', teste: 'https://pix-h.api.efipay.com.br' }
const PRAZO_MS = 15_000

const credencialSchema = z.object({
  clienteId: z.string().min(1),
  segredo: z.string().min(1),
  chave: z.string().min(1),
  certificado: z.string().min(1),
  chavePrivada: z.string().min(1),
  venceEm: z.string().nullish(),
})
type Credencial = z.infer<typeof credencialSchema>

/** Quem faz a requisição. Fica num objeto para o teste trocar a rede sem certificado de verdade. */
export const transporte = {
  async pedir(url: string, init: { method: string; headers: Record<string, string>; body?: string }, cred: Credencial) {
    const agente = new Agent({ connect: { cert: cred.certificado, key: cred.chavePrivada } })
    try {
      const resposta = await fetchComCertificado(url, { ...init, dispatcher: agente, signal: AbortSignal.timeout(PRAZO_MS) })
      return { status: resposta.status, ok: resposta.ok, json: (await resposta.json().catch(() => ({}))) as unknown }
    } finally {
      await agente.close().catch(() => undefined)
    }
  },
}

export class ErroDaEfi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

async function token(cred: Credencial, ambiente: Ambiente): Promise<string> {
  const r = await transporte.pedir(
    `${BASES[ambiente]}/oauth/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${cred.clienteId}:${cred.segredo}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    },
    cred,
  )
  // O corpo de erro não sobe: pode ecoar o segredo.
  if (!r.ok) throw new ErroDaEfi(`a Efí recusou o pedido de token (${r.status})`, r.status)
  const lido = z.object({ access_token: z.string().min(1) }).safeParse(r.json)
  if (!lido.success) throw new ErroDaEfi('a Efí respondeu sem token', r.status)
  return lido.data.access_token
}

async function chamar<T>(
  cred: Credencial,
  ambiente: Ambiente,
  metodo: 'GET' | 'PUT' | 'PATCH' | 'DELETE',
  caminho: string,
  corpo?: unknown,
  cabecalhos: Record<string, string> = {},
): Promise<T> {
  const acesso = await token(cred, ambiente)
  const r = await transporte.pedir(
    `${BASES[ambiente]}${caminho}`,
    {
      method: metodo,
      headers: {
        Authorization: `Bearer ${acesso}`,
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...cabecalhos,
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    },
    cred,
  )
  if (!r.ok) throw new ErroDaEfi(`a Efí recusou ${metodo} ${caminho.split('?')[0]} (${r.status})`, r.status)
  return r.json as T
}

function credencialDo(acesso: AcessoAoGateway): Credencial {
  const lido = credencialSchema.safeParse(JSON.parse(acesso.token))
  if (!lido.success) throw new Error('credencial da Efí estragada no cofre')
  return lido.data
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

/** O `.p12` (base64) vira certificado e chave em PEM. Senha vazia, como a Efí entrega. */
export function lerCertificado(p12Base64: string): { certificado: string; chavePrivada: string; venceEm: Date } {
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(Buffer.from(p12Base64, 'base64').toString('binary')), '')
  } catch {
    throw new ErroDeConexao('Não foi possível abrir o certificado. Envie o arquivo .p12 que a Efí gerou, sem converter.')
  }
  const oids = { cert: forge.pki.oids.certBag!, chave: forge.pki.oids.pkcs8ShroudedKeyBag!, solta: forge.pki.oids.keyBag! }
  const cert = p12.getBags({ bagType: oids.cert })[oids.cert]?.[0]?.cert
  const chave = p12.getBags({ bagType: oids.chave })[oids.chave]?.[0]?.key ?? p12.getBags({ bagType: oids.solta })[oids.solta]?.[0]?.key
  if (!cert || !chave) throw new ErroDeConexao('O certificado veio sem a chave. Gere outro na Efí e envie o .p12 inteiro.')
  return { certificado: forge.pki.certificateToPem(cert), chavePrivada: forge.pki.privateKeyToPem(chave), venceEm: cert.validity.notAfter }
}

/**
 * Prova a credencial pedindo um token em produção e, recusado lá, em
 * homologação: o certificado de cada ambiente só abre o seu. Depois cadastra o
 * aviso na chave Pix.
 */
export async function conectarEfi(valores: Record<string, string>, clienteId: string): Promise<ConexaoProvada> {
  const clienteIdEfi = valores.clienteId?.trim() ?? ''
  const segredo = valores.segredo?.trim() ?? ''
  const chave = valores.chave?.trim() ?? ''
  if (!/^Client_Id_[A-Za-z0-9]{10,80}$/.test(clienteIdEfi))
    throw new ErroDeConexao('Isto não parece um Client_Id da Efí. Ele começa com Client_Id_.')
  if (!/^Client_Secret_[A-Za-z0-9]{10,80}$/.test(segredo))
    throw new ErroDeConexao('Isto não parece um Client_Secret da Efí. Ele começa com Client_Secret_.')
  if (chave.length < 5 || chave.length > 77) throw new ErroDeConexao('Informe a chave Pix da conta Efí que vai receber.')
  if (!valores.certificado) throw new ErroDeConexao('Envie o certificado .p12 da aplicação.')

  const lido = lerCertificado(valores.certificado)
  if (lido.venceEm.getTime() < Date.now()) throw new ErroDeConexao('Este certificado já venceu. Gere outro na Efí.')
  const cred: Credencial = {
    clienteId: clienteIdEfi,
    segredo,
    chave,
    certificado: lido.certificado,
    chavePrivada: lido.chavePrivada,
    venceEm: lido.venceEm.toISOString(),
  }

  let ambiente: Ambiente | null = null
  for (const tentativa of ['producao', 'teste'] as const) {
    try {
      await token(cred, tentativa)
      ambiente = tentativa
      break
    } catch {
      // O certificado de produção é recusado em homologação e vice-versa.
    }
  }
  if (!ambiente)
    throw new ErroDeConexao('A Efí recusou a credencial. Confira se o Client_Id, o Client_Secret e o certificado são da mesma aplicação.')

  const url = enderecoDoAviso('efi', clienteId, '&ignorar=')
  let avisoNoGateway: string | null = null
  if (url) {
    try {
      await chamar(
        cred,
        ambiente,
        'PUT',
        `/v2/webhook/${encodeURIComponent(chave)}`,
        { webhookUrl: url },
        { 'x-skip-mtls-checking': 'true' },
      )
      avisoNoGateway = chave
    } catch (erro) {
      if (process.env.VERCEL_ENV === 'production') {
        throw new ErroDeConexao(
          'A Efí não aceitou o aviso de pagamento nesta chave Pix. Confira se a chave é desta conta e se a aplicação tem o escopo de webhook.',
        )
      }
      console.warn('[efi] conectado sem aviso fora de produção', erro instanceof Error ? erro.message : erro)
    }
  }

  return { contaNoGateway: chave, apelido: `chave Pix ${chave}`, token: JSON.stringify(cred), ambiente, avisoNoGateway }
}

export async function apagarAvisoDaEfi(acesso: AcessoAoGateway, chave: string): Promise<void> {
  await chamar(credencialDo(acesso), acesso.ambiente, 'DELETE', `/v2/webhook/${encodeURIComponent(chave)}`).catch(() => undefined)
}

/** Quando o certificado guardado vence, para avisar o dono antes. */
export function vencimentoDoCertificado(acesso: AcessoAoGateway): Date | null {
  const venceEm = credencialDo(acesso).venceEm
  return venceEm ? new Date(venceEm) : null
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const TXID = /^[A-Za-z0-9]{26,35}$/

/** `{ pix: [{ txid, ... }] }`. O aviso de teste do cadastro não tem `pix` e cai fora. */
export function pagamentoDoAvisoDaEfi(corpo: unknown): string | null {
  const pix = corpo && typeof corpo === 'object' ? (corpo as { pix?: unknown }).pix : null
  const txid = Array.isArray(pix) ? (pix[0] as { txid?: unknown } | undefined)?.txid : null
  return typeof txid === 'string' && TXID.test(txid) ? txid : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

export function txidDaReferencia(referencia: string): string {
  return referencia.replaceAll('-', '')
}

function referenciaDoTxid(txid: string): string | null {
  const p = txid.match(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i)
  return p ? `${p[1]}-${p[2]}-${p[3]}-${p[4]}-${p[5]}`.toLowerCase() : null
}

const cobSchema = z.object({
  txid: z.string(),
  status: z.string(),
  pixCopiaECola: z.string().nullish(),
  valor: z.object({ original: z.string() }),
  pix: z
    .array(
      z.object({
        valor: z.string(),
        horario: z.string().nullish(),
        devolucoes: z.array(z.object({ status: z.string().nullish() })).nullish(),
      }),
    )
    .nullish(),
})

const centavos = (reais: string) => Math.round(Number(reais) * 100)

export const efi: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    const cred = credencialDo(acesso)
    const documento = pedido.pagador.documento
    const segundos = Math.max(60, Math.round((pedido.venceEm.getTime() - Date.now()) / 1_000))
    const cob = cobSchema.parse(
      await chamar(cred, acesso.ambiente, 'PUT', `/v2/cob/${txidDaReferencia(pedido.referencia)}`, {
        calendario: { expiracao: segundos },
        ...(documento
          ? { devedor: { [documento.length === 14 ? 'cnpj' : 'cpf']: documento, nome: pedido.pagador.nome.slice(0, 200) } }
          : {}),
        valor: { original: (pedido.valorCentavos / 100).toFixed(2) },
        chave: cred.chave,
        solicitacaoPagador: pedido.descricao.slice(0, 140),
      }),
    )
    if (!cob.pixCopiaECola) throw new Error('a Efí não devolveu o Pix copia e cola')
    return { pagamentoId: cob.txid, preferenciaId: null, pixCopiaCola: cob.pixCopiaECola, link: null }
  },

  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    if (!TXID.test(pagamentoId)) throw new Error('txid estranho')
    const cob = cobSchema.parse(await chamar(credencialDo(acesso), acesso.ambiente, 'GET', `/v2/cob/${pagamentoId}`))
    const recebidos = cob.pix ?? []
    const devolvido = recebidos.some((p) => (p.devolucoes ?? []).some((d) => d.status === 'DEVOLVIDO'))
    const paga = cob.status === 'CONCLUIDA' && recebidos.length > 0
    return {
      pagamentoId: cob.txid,
      referencia: referenciaDoTxid(cob.txid),
      situacao: devolvido ? 'estornada' : paga ? 'paga' : cob.status.startsWith('REMOVIDA') ? 'cancelada' : 'pendente',
      valorCentavos: paga ? recebidos.reduce((soma, p) => soma + centavos(p.valor), 0) : centavos(cob.valor.original),
      pagaEm: paga ? new Date(recebidos[0]!.horario ?? Date.now()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamar(credencialDo(acesso), acesso.ambiente, 'PATCH', `/v2/cob/${encodeURIComponent(pagamentoId)}`, {
      status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR',
    })
  },
}
