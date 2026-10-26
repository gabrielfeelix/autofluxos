import 'server-only'
import { alertar } from './alertar'
import { db } from './db'
import { chamarHttp } from './efeitos/http'
import { camposDoContato, gravarCampos } from './repos/campos'
import { lerCredencial } from './repos/conexoes'
import { lojaDaConta } from './repos/lojas'

/**
 * Pontos de fidelidade da loja (Mirasvit Rewards, na Magento da PCYES) pela
 * resposta da pesquisa pós-compra.
 *
 * **Por que uma rota nossa e não o nó de API direto no Mirasvit:** o nó não
 * pode usar o token da loja (`listarConexoesParaFluxos`), de propósito: um
 * token de administrador num nó sairia no `Authorization` para qualquer URL. O
 * nó chama a nossa rota, e quem fala com a loja é o servidor.
 *
 * **Quem pode pedir:** só existe crédito para um par pedido + cliente que tem
 * conversa de pesquisa aberta nesta conta nos últimos 7 dias (as variáveis
 * que `evento-com-modelo.ts` gravou na sessão), e uma vez por pedido. Quem
 * não sabe um par desses não ganha nada chamando a rota.
 *
 * `POST /rest/V1/rewards/transaction` provado em 26/out/2026 (lançamento 288,
 * conta de teste do Gabriel). `amount` é em pontos.
 */

const CAMPO_DOS_PEDIDOS = 'pedidos_com_pontos'
const VALIDADE_DA_PESQUISA_MS = 7 * 24 * 60 * 60 * 1000

export type ResultadoDosPontos = 'creditado' | 'ja_creditado' | 'sem_pesquisa' | 'falhou'

export async function creditarPontosDaPesquisa(
  clienteId: string,
  pedido: string,
  customerId: string,
  pontos: number,
  /**
   * Em que variável da conversa estão o pedido e o cliente. O bloco Dar pontos
   * deixa escolher; a rota antiga usa os nomes do evento da PCYES.
   */
  chaves: { pedido: string; cliente: string } = { pedido: 'pedido', cliente: 'customer_id' },
): Promise<ResultadoDosPontos> {
  // O nome vira caminho de filtro no PostgREST: só letra, número e sublinhado.
  if (!/^\w{1,40}$/.test(chaves.pedido) || !/^\w{1,40}$/.test(chaves.cliente)) return 'sem_pesquisa'
  if (!pedido || !/^\d{1,12}$/.test(customerId)) return 'sem_pesquisa'
  const desde = new Date(Date.now() - VALIDADE_DA_PESQUISA_MS).toISOString()
  const { data, error } = await db()
    .from('sessions')
    .select('id, contact_id, contacts!inner(client_id)')
    .eq('contacts.client_id', clienteId)
    .eq(`vars->>${chaves.pedido}`, pedido)
    .eq(`vars->>${chaves.cliente}`, customerId)
    .gte('criado_em', desde)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`não foi possível conferir a pesquisa: ${error.message}`)
  if (!data) return 'sem_pesquisa'
  const contatoId = (data as { contact_id: string }).contact_id

  const campos = await camposDoContato(clienteId, contatoId)
  const creditados = (campos?.[CAMPO_DOS_PEDIDOS]?.valor ?? '').split(',').filter(Boolean)
  if (creditados.includes(pedido)) return 'ja_creditado'

  const loja = await lojaDaConta(clienteId)
  if (!loja?.ativa || !loja.conexaoId) return 'falhou'
  const credencial = await lerCredencial(loja.conexaoId, clienteId)
  if (!credencial) return 'falhou'

  const r = await chamarHttp(
    {
      tipo: 'chamar_http',
      metodo: 'POST',
      url: `${loja.endereco.replace(/\/+$/, '')}/rest/V1/rewards/transaction`,
      cabecalhos: [],
      corpo: JSON.stringify({
        transaction: {
          customer_id: Number(customerId),
          amount: pontos,
          comment: `Pesquisa de satisfação do pedido #${pedido}`,
        },
      }),
      mapear: [],
      aoFalhar: 'humano',
    },
    { deTeste: false, credencial, comJson: true },
  )
  if (!r.ok) {
    // O fluxo avisa a pessoa que os pontos atrasaram; quem lança na mão é o time.
    await alertar('os PC Points da pesquisa não entraram', r.motivo, { cliente: clienteId, pedido, customerId })
    return 'falhou'
  }

  await gravarCampos(clienteId, contatoId, {
    [CAMPO_DOS_PEDIDOS]: {
      valor: [...creditados, pedido].slice(-50).join(','),
      origem: 'automacao',
      autorId: null,
      em: new Date().toISOString(),
    },
  })
  return 'creditado'
}
