'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { apagarAviso, criarAviso, ErroDoAsaas, validarChave } from '@/channels/asaas'
import { tagDaInfinitePay } from '@/channels/infinitepay'
import { mercadoPagoConfigurado, urlDeAutorizacao } from '@/channels/mercado-pago'
import { parDeChavesParaIugu } from '@/channels/iugu'
import { ErroDeConexao, NOME_DO_GATEWAY, type Gateway } from '@/channels/pagamento'
import { stripeConfigurado, urlDeAutorizacao as autorizacaoDoStripe } from '@/channels/stripe'
import { pagbankConfigurado, urlDeAutorizacao as autorizacaoDoPagBank } from '@/channels/pagbank'
import { alertar } from './alertar'
import { gatewayPorCampos } from './gateways-por-campos'
import { iniciarConexao } from './instagram/estado'
import { exigirCapacidade, recusou } from './permissoes'
import { recusaDoPlano } from './recursos-do-plano'
import { acessoDaConexao, apagarConexaoDePagamento, conexaoAtiva, salvarConexaoDePagamento } from './repos/pagamentos'

/**
 * Ligar e desligar a conta do Mercado Pago do dono (cobrança no chat, etapa A).
 *
 * A porta é a das outras integrações: `configurar_operacao`, e o plano precisa
 * ter "Conexão com outros sistemas" (Operação para cima). O `state` é o
 * bilhete assinado do Instagram, com o cookie que só este navegador tem: um
 * link de conexão repassado não liga a conta do Mercado Pago de ninguém na
 * conta de outra pessoa.
 */

export async function acaoConectarMercadoPago(clienteId: string): Promise<void> {
  // Sem forma de devolver erro num `<form action>`: quem não pode não sai
  // daqui, e a tela já não mostra o botão nesses casos.
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return
  if (await recusaDoPlano(clienteId, 'integracoes')) return
  if (!mercadoPagoConfigurado()) return
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== 'mercado_pago') return

  // A origem vem do cabeçalho, como no Facebook: o `redirect_uri` precisa
  // bater byte a byte com o cadastrado, em produção e em preview.
  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  redirect(urlDeAutorizacao({ origem: `${protocolo}://${host}`, state: await iniciarConexao(clienteId) }))
}

/**
 * Liga o PagBank por login (Connect), no mesmo desenho do Mercado Pago: o
 * bilhete assinado vai no `state` (reescrito sem ponto nem hífen, que o
 * PagBank recusa) e volta em `api/pagamentos/pagbank/retorno`.
 */
export async function acaoConectarPagBank(clienteId: string): Promise<void> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return
  if (await recusaDoPlano(clienteId, 'integracoes')) return
  if (!pagbankConfigurado()) return
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== 'pagbank') return

  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  redirect(autorizacaoDoPagBank({ origem: `${protocolo}://${host}`, estado: await iniciarConexao(clienteId) }))
}

/** O Stripe, pelo Connect Standard, no mesmo desenho do Mercado Pago. */
export async function acaoConectarStripe(clienteId: string): Promise<void> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return
  if (await recusaDoPlano(clienteId, 'integracoes')) return
  if (!stripeConfigurado()) return
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== 'stripe') return

  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  redirect(autorizacaoDoStripe({ origem: `${protocolo}://${host}`, estado: await iniciarConexao(clienteId) }))
}

/**
 * Liga um gateway de credencial colada (Woovi, PagHiper, Efí, Iugu,
 * Pagar.me; ver `server/gateways-por-campos.ts`). O canal prova a credencial
 * numa chamada e cadastra o aviso; só depois disso ela vai para o cofre.
 * Falhou ao salvar, o aviso criado é desfeito.
 */
export async function acaoConectarPorCampos(
  clienteId: string,
  gateway: string,
  valores: Record<string, string>,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }
  const achado = gatewayPorCampos(gateway)
  if (!achado) return { ok: false, erro: 'Gateway desconhecido.' }
  const nome = NOME_DO_GATEWAY[achado.gateway]
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== achado.gateway) {
    return { ok: false, erro: `Desconecte o ${NOME_DO_GATEWAY[ativa.gateway]} antes. O dinheiro cai numa conta por vez.` }
  }
  // Só os campos que a tela declara, e com teto: o certificado em base64 é o maior.
  const limpos: Record<string, string> = {}
  for (const campo of achado.config.tela.campos) {
    const valor = valores[campo.nome]
    if (typeof valor === 'string' && valor.length <= 40_000) limpos[campo.nome] = valor
  }

  let provada: Awaited<ReturnType<typeof achado.config.conectar>>
  try {
    provada = await achado.config.conectar(limpos, clienteId)
  } catch (erro) {
    if (erro instanceof ErroDeConexao) return { ok: false, erro: erro.message }
    await alertar(`não foi possível conferir a credencial do ${nome}`, erro, { cliente: clienteId })
    return { ok: false, erro: `Não foi possível falar com o ${nome} agora. Tente de novo em instantes.` }
  }

  const anterior = ativa ? await acessoDaConexao(clienteId, achado.gateway) : null
  try {
    await salvarConexaoDePagamento({
      clienteId,
      gateway: achado.gateway,
      contaNoGateway: provada.contaNoGateway,
      apelido: provada.apelido,
      token: provada.token,
      renovacao: null,
      expiraEm: null,
      ambiente: provada.ambiente,
      avisoNoGateway: provada.avisoNoGateway ?? null,
    })
  } catch (erro) {
    if (provada.avisoNoGateway && achado.config.apagarAviso) {
      await achado.config.apagarAviso({ token: provada.token, ambiente: provada.ambiente }, provada.avisoNoGateway)
    }
    if (erro instanceof Error && erro.message.includes('outra conta')) {
      return { ok: false, erro: `Esta conta do ${nome} já está ligada a outra organização.` }
    }
    if (erro instanceof Error && /check constraint|gateway_check/.test(erro.message)) {
      return { ok: false, erro: `O ${nome} está sendo liberado pela equipe da 4YU.` }
    }
    await alertar(`não foi possível salvar a conexão do ${nome}`, erro, { cliente: clienteId })
    return { ok: false, erro: 'Não foi possível salvar a conexão. Tente de novo.' }
  }

  // Trocou de credencial: o aviso da anterior sai, senão o gateway avisaria duas vezes.
  if (anterior?.avisoNoGateway && anterior.avisoNoGateway !== provada.avisoNoGateway && achado.config.apagarAviso) {
    await achado.config.apagarAviso(anterior, anterior.avisoNoGateway)
  }
  return { ok: true }
}

/**
 * A chave pública RSA que o dono cola na Iugu ao criar o token. A privada não
 * sai de `parDeChavesParaIugu`: criar e ler fatura não pedem assinatura.
 */
export async function acaoChavePublicaDaIugu(clienteId: string): Promise<{ ok: boolean; chave?: string; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  return { ok: true, chave: parDeChavesParaIugu() }
}

/** Para onde o Asaas manda o aviso de pagamento desta organização. */
function enderecoDoAviso(clienteId: string): string {
  const base =
    process.env.VERCEL_ENV === 'production' ? 'https://dialogon.com.br' : (process.env.BETTER_AUTH_URL ?? '')
  return `${base}/api/webhook/asaas/${clienteId}`
}

const RECUSAS_DA_CHAVE: Record<string, string> = {
  formato: 'Isto não parece uma chave do Asaas. Ela começa com $aact_.',
  invalid_access_token: 'O Asaas recusou a chave. Confira se copiou inteira, sem espaço no fim.',
  invalid_environment: 'O Asaas recusou a chave. Confira se copiou inteira, sem espaço no fim.',
}

/**
 * Liga a conta do Asaas pela chave de API do dono.
 *
 * Três passos, e a ordem é a que não deixa sobra: prova a chave numa chamada
 * (chave errada nunca é salva), pede ao Asaas o webhook de pagamento com a
 * mesma chave (o dono não configura nada lá), e só então guarda a chave no
 * cofre. Falhou no meio, o webhook criado é apagado.
 */
export async function acaoConectarAsaas(clienteId: string, chave: string): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== 'asaas') {
    return { ok: false, erro: `Desconecte o ${NOME_DO_GATEWAY[ativa.gateway]} antes. O dinheiro cai numa conta por vez.` }
  }

  let conta: Awaited<ReturnType<typeof validarChave>>
  try {
    conta = await validarChave(chave)
  } catch (erro) {
    if (erro instanceof ErroDoAsaas) {
      const motivo = (erro.detalhe.codigo && RECUSAS_DA_CHAVE[erro.detalhe.codigo]) ?? null
      if (motivo) return { ok: false, erro: motivo }
      if (erro.detalhe.status === 401) return { ok: false, erro: RECUSAS_DA_CHAVE.invalid_access_token }
    }
    await alertar('não foi possível validar a chave do Asaas', erro, { cliente: clienteId })
    return { ok: false, erro: 'Não foi possível falar com o Asaas agora. Tente de novo em instantes.' }
  }

  const novo = { token: chave.trim(), ambiente: conta.ambiente }
  const anterior = ativa ? await acessoDaConexao(clienteId, 'asaas') : null

  let avisoId: string | null = null
  try {
    avisoId = await criarAviso(novo, {
      url: enderecoDoAviso(clienteId),
      email: conta.email ?? 'contato@4yu.com.br',
      clienteId,
    })
  } catch (erro) {
    // Fora de produção o Asaas não alcança a máquina local: conecta sem aviso,
    // e o relógio do vencimento confirma o pagamento.
    if (process.env.VERCEL_ENV === 'production') {
      await alertar('o Asaas não aceitou o webhook de pagamento', erro, { cliente: clienteId })
      return { ok: false, erro: 'O Asaas não aceitou o aviso de pagamento. Tente de novo em instantes.' }
    }
    console.warn('[asaas] conectado sem webhook fora de produção', erro instanceof Error ? erro.message : erro)
  }

  try {
    await salvarConexaoDePagamento({
      clienteId,
      gateway: 'asaas',
      contaNoGateway: conta.contaId,
      apelido: conta.apelido,
      token: novo.token,
      renovacao: null,
      expiraEm: null,
      ambiente: conta.ambiente,
      avisoNoGateway: avisoId,
    })
  } catch (erro) {
    if (avisoId) await apagarAviso(novo, avisoId)
    if (erro instanceof Error && erro.message.includes('outra conta')) {
      return { ok: false, erro: 'Esta conta do Asaas já está ligada a outra organização.' }
    }
    await alertar('não foi possível salvar a conexão do Asaas', erro, { cliente: clienteId })
    return { ok: false, erro: 'Não foi possível salvar a conexão. Tente de novo.' }
  }

  // Trocou de chave: o webhook da conexão anterior sai, senão o Asaas avisaria duas vezes.
  if (anterior?.avisoNoGateway && anterior.avisoNoGateway !== avisoId) await apagarAviso(anterior, anterior.avisoNoGateway)
  return { ok: true }
}

/**
 * Liga a InfinitePay pela InfiniteTag (o `$` da conta). Não há chave nem
 * login para conferir: a tag só passa pelo formato, e a mesma tag não liga em
 * duas organizações (`unique (gateway, conta_no_gateway)`). O aviso de pago
 * não se cadastra aqui; ele vai em cada link (`channels/infinitepay.ts`).
 */
export async function acaoConectarInfinitePay(clienteId: string, tagDigitada: string): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }
  const ativa = await conexaoAtiva(clienteId)
  if (ativa && ativa.gateway !== 'infinitepay') {
    return { ok: false, erro: `Desconecte o ${NOME_DO_GATEWAY[ativa.gateway]} antes. O dinheiro cai numa conta por vez.` }
  }
  const tag = tagDaInfinitePay(tagDigitada)
  if (!tag) return { ok: false, erro: 'Isto não parece uma InfiniteTag. Ela aparece no app da InfinitePay, com $ na frente.' }

  try {
    await salvarConexaoDePagamento({
      clienteId,
      gateway: 'infinitepay',
      contaNoGateway: tag,
      apelido: `$${tag}`,
      token: tag,
      renovacao: null,
      expiraEm: null,
      ambiente: 'producao',
      avisoNoGateway: null,
    })
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes('outra conta')) {
      return { ok: false, erro: 'Esta InfiniteTag já está ligada a outra organização.' }
    }
    if (erro instanceof Error && /check constraint|gateway_check/.test(erro.message)) {
      return { ok: false, erro: 'A InfinitePay está sendo liberada pela equipe da 4YU.' }
    }
    await alertar('não foi possível salvar a conexão da InfinitePay', erro, { cliente: clienteId })
    return { ok: false, erro: 'Não foi possível salvar a conexão. Tente de novo.' }
  }
  return { ok: true }
}

/**
 * Desliga. As cobranças já feitas continuam na tela; só as novas deixam de
 * sair. No Mercado Pago o acesso continua autorizado lá até o dono revogar em
 * "Aplicações conectadas", e a tela diz isso; no PagBank, igual, até o dono
 * revogar no app dele. No Asaas o webhook que criamos
 * sai junto; a chave continua válida lá até o dono apagá-la.
 */
export async function acaoDesconectarPagamento(clienteId: string, gateway: Gateway): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  if (gateway === 'asaas') {
    const conexao = await acessoDaConexao(clienteId, 'asaas')
    if (conexao?.avisoNoGateway) await apagarAviso(conexao, conexao.avisoNoGateway)
  }
  const porCampos = gatewayPorCampos(gateway)
  if (porCampos?.config.apagarAviso) {
    const conexao = await acessoDaConexao(clienteId, gateway)
    if (conexao?.avisoNoGateway) await porCampos.config.apagarAviso(conexao, conexao.avisoNoGateway)
  }
  await apagarConexaoDePagamento(clienteId, gateway)
  return { ok: true }
}
