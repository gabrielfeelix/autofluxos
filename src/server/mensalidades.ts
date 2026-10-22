import 'server-only'
import { dentroDaJanela } from '@/channels/janela'
import {
  competenciaParaCobrar,
  diaDeMandar,
  descricaoDoMes,
  fimDoDia,
  hojeEmSaoPaulo,
  vencimentoDa,
  type RegraDoMes,
} from '@/core/mensalidade'
import type { Gateway, PagamentoLido } from '@/channels/pagamento'
import { competenciaDe, mesSeguinte } from '@/core/mensalidade'
import { alertar } from './alertar'
import { criarCobranca, documentoDaFicha, gatewayDe, pagadorDoLead, reais } from './cobrancas'
import { mandarCobrancaNaConversa, mandarLembretePorModelo } from './mandar-cobranca'
import {
  assinaturaNoGateway,
  assinaturasDoRelogio,
  cobrancaDaCompetencia,
  mudarStatusDaAssinatura,
  type Assinatura,
} from './repos/assinaturas'
import { acharCobranca, completarCobranca, inserirCobranca, mudarStatus, type CobrancaRegistrada } from './repos/cobrancas'
import { acessoDaConexao } from './repos/pagamentos'
import { contextoDeResposta } from './repos/conversas'
import { anotar } from './repos/eventos'
import { acharLead } from './repos/leads'

/**
 * O relógio da mensalidade (0145): uma passada por dia, no cron de tarefas.
 *
 * Para cada mensalidade ativa no modo Pix do mês, vê se hoje é dia de cobrar
 * (`core/mensalidade.ts`), cria a cobrança do mês e manda na conversa. Dentro
 * das 24 horas vai como o botão Cobrar manda; fora, pelo modelo de lembrete
 * da conta; sem modelo, a cobrança fica criada e a ficha avisa a equipe.
 *
 * Uma mensalidade que falha não pode derrubar as outras: são contas
 * diferentes. E a mesma passada rodando duas vezes cobra uma vez só, pelo
 * índice único da competência.
 */

const POR_PAGINA = 200

export type ResumoDasMensalidades = { olhadas: number; cobradas: number; semEnvio: number; falhas: number }

export async function passadaDeMensalidades(agora: Date = new Date()): Promise<ResumoDasMensalidades> {
  const hoje = hojeEmSaoPaulo(agora)
  const resumo: ResumoDasMensalidades = { olhadas: 0, cobradas: 0, semEnvio: 0, falhas: 0 }
  let depoisDe: string | null = null
  for (;;) {
    const pagina = await assinaturasDoRelogio(depoisDe, POR_PAGINA)
    for (const assinatura of pagina) {
      resumo.olhadas += 1
      try {
        // Aguardando adesão (cartão, Pix Automático): só confere no gateway.
        if (assinatura.status === 'aguardando') {
          await sincronizarAdesao(assinatura)
          continue
        }
        // Cartão: quem cobra todo mês é a assinatura do gateway.
        if (assinatura.modo === 'cartao') continue
        const r = await cobrarOMes(assinatura, hoje)
        if (r === 'cobrada') resumo.cobradas += 1
        if (r === 'sem_envio') resumo.semEnvio += 1
      } catch (erro) {
        resumo.falhas += 1
        await alertar('a mensalidade do mês não saiu', erro, { cliente: assinatura.clienteId, contato: assinatura.contatoId })
      }
    }
    if (pagina.length < POR_PAGINA) break
    depoisDe = pagina[pagina.length - 1]!.id
  }
  return resumo
}

function regraDe(a: Assinatura): RegraDoMes {
  return { inicio: a.inicio, fim: a.fim, diaDoVencimento: a.diaDoVencimento, antecedenciaDias: a.antecedenciaDias }
}

export async function cobrarOMes(assinatura: Assinatura, hoje: string): Promise<'nada' | 'cobrada' | 'sem_envio'> {
  const competencia = competenciaParaCobrar(regraDe(assinatura), hoje)
  if (!competencia) return 'nada'
  if (await cobrancaDaCompetencia(assinatura.id, competencia)) return 'nada'

  const contexto = await contextoDeResposta(assinatura.clienteId, assinatura.contatoId)
  const debito = assinatura.modo === 'pix_automatico' ? assinatura.idNoGateway : null
  const criada = await criarCobranca({
    clienteId: assinatura.clienteId,
    contatoId: assinatura.contatoId,
    valorCentavos: assinatura.valorCentavos,
    descricao: descricaoDoMes(assinatura.descricao, competencia),
    venceEm: fimDoDia(vencimentoDa(competencia, assinatura.diaDoVencimento)),
    origem: 'mensalidade',
    criadaPor: null,
    sessaoId: contexto?.sessaoId ?? null,
    assinaturaId: assinatura.id,
    competencia,
    autorizacaoPix: debito,
  }).catch((erro: unknown) => {
    // Outra passada criou o mesmo mês um instante antes: o índice único barrou.
    if (erro instanceof Error && /duplicate key|cobrancas_da_competencia/.test(erro.message)) return null
    throw erro
  })
  if (!criada) return 'nada'
  if (!criada.ok) {
    // Sem conta de recebimento ou sem CPF: a passada tenta de novo amanhã, e a
    // ficha recebe o aviso uma vez por mês, no primeiro dia.
    if (hoje === diaDeMandar(assinatura, competencia)) await anotar(assinatura.clienteId, assinatura.contatoId, 'cobranca', {
      status: 'nao_enviada',
      valor: reais(assinatura.valorCentavos),
      motivo: criada.erro,
    })
    if (criada.motivo === 'gateway') throw new Error(criada.erro)
    return 'sem_envio'
  }

  // Pix Automático: o banco debita no vencimento, não há Pix para mandar.
  if (debito) return 'cobrada'

  if (contexto && dentroDaJanela(contexto)) {
    const enviada = await mandarCobrancaNaConversa(assinatura.contatoId, contexto, criada.cobranca, null)
    return enviada.ok ? 'cobrada' : 'sem_envio'
  }
  if (contexto) {
    const lead = await acharLead(assinatura.clienteId, assinatura.contatoId)
    const r = await mandarLembretePorModelo(assinatura.clienteId, assinatura.contatoId, contexto, criada.cobranca, lead?.nome ?? null)
    if (r === 'ok') return 'cobrada'
  }
  await anotar(assinatura.clienteId, assinatura.contatoId, 'cobranca', {
    status: 'nao_enviada',
    valor: reais(assinatura.valorCentavos),
    motivo: 'fora das 24 horas e sem o modelo de lembrete aprovado',
  })
  return 'sem_envio'
}

// ---------------------------------------------------------------------------
// Cartão recorrente e Pix Automático (adesão no gateway)
// ---------------------------------------------------------------------------

/**
 * A cobrança do mês para um pagamento que a assinatura do gateway gerou
 * (cartão). Nasce aqui, na primeira notícia do pagamento, porque o mês é o
 * gateway quem cobra. Pagou o primeiro, a mensalidade deixa de aguardar.
 */
export async function cobrancaDaRecorrencia(
  clienteId: string,
  gateway: Gateway,
  lido: PagamentoLido,
): Promise<CobrancaRegistrada | null> {
  if (!lido.recorrencia) return null
  const assinatura = await assinaturaNoGateway(gateway, lido.recorrencia)
  if (!assinatura || assinatura.clienteId !== clienteId) return null
  const competencia = competenciaDe(lido.vencimento ?? hojeEmSaoPaulo())
  const ja = await cobrancaDaCompetencia(assinatura.id, competencia)
  let id = ja
  if (!id) {
    id = await inserirCobranca({
      clienteId,
      contatoId: assinatura.contatoId,
      gateway,
      valorCentavos: assinatura.valorCentavos,
      descricao: descricaoDoMes(assinatura.descricao, competencia),
      itens: null,
      venceEm: fimDoDia(lido.vencimento ?? vencimentoDa(competencia, assinatura.diaDoVencimento)),
      origem: 'mensalidade',
      criadaPor: null,
      sessaoId: null,
      assinaturaId: assinatura.id,
      competencia,
    }).catch(async (erro: unknown) => {
      if (erro instanceof Error && /duplicate key|cobrancas_da_competencia/.test(erro.message)) return cobrancaDaCompetencia(assinatura.id, competencia)
      throw erro
    })
    if (!id) return null
    await completarCobranca(id, { pagamentoId: lido.pagamentoId, preferenciaId: null, pixCopiaCola: null, link: null })
  }
  if (lido.situacao === 'paga' && assinatura.status === 'aguardando') {
    await mudarStatusDaAssinatura(clienteId, assinatura.id, ['aguardando'], 'ativa')
  }
  return acharCobranca(clienteId, id)
}

export type ResultadoDaAdesao = { ok: true; link: string | null; pixCopiaCola: string | null } | { ok: false; erro: string }

/**
 * Cria no gateway a assinatura no cartão ou a autorização do Pix Automático
 * de uma mensalidade que acabou de nascer `aguardando`. O pagador adere pelo
 * link (cartão) ou pelo QR (Pix Automático), que vão para a conversa.
 */
export async function aderirNoGateway(assinatura: Assinatura): Promise<ResultadoDaAdesao> {
  if (assinatura.modo === 'pix_do_mes' || !assinatura.gateway) return { ok: false, erro: 'Esta mensalidade não tem adesão.' }
  const gateway = gatewayDe(assinatura.gateway)
  const criar = assinatura.modo === 'cartao' ? gateway.criarAssinaturaNoCartao : gateway.criarAutorizacaoPix
  if (!criar) return { ok: false, erro: assinatura.modo === 'cartao' ? 'Cartão recorrente ainda só pelo Asaas.' : 'Pix Automático só pelo Asaas.' }
  const acesso = await acessoDaConexao(assinatura.clienteId, assinatura.gateway)
  if (!acesso) return { ok: false, erro: 'A conexão de pagamento perdeu o acesso. Reconecte em Ajustes > Pagamentos.' }
  const lead = await acharLead(assinatura.clienteId, assinatura.contatoId)
  if (!lead) return { ok: false, erro: 'Contato não encontrado.' }
  const documento = documentoDaFicha(lead.campos)
  if (!documento) return { ok: false, erro: 'O Asaas exige o CPF ou CNPJ de quem paga. Preencha o campo cpf na ficha.' }

  try {
    const adesao = await criar.call(gateway, acesso, {
      referencia: assinatura.id,
      valorCentavos: assinatura.valorCentavos,
      descricao: assinatura.descricao,
      // Pix Automático: o QR já paga o primeiro mês, e o débito começa no seguinte.
      primeiroVencimento: vencimentoDa(
        assinatura.modo === 'pix_automatico' ? mesSeguinte(assinatura.inicio) : assinatura.inicio,
        assinatura.diaDoVencimento,
      ),
      pagador: pagadorDoLead(lead, documento),
    })
    await mudarStatusDaAssinatura(assinatura.clienteId, assinatura.id, ['aguardando'], 'aguardando', {
      idNoGateway: adesao.idNoGateway,
      linkDeAdesao: adesao.link ?? adesao.pixCopiaCola,
    })
    return { ok: true, link: adesao.link, pixCopiaCola: adesao.pixCopiaCola }
  } catch (erro) {
    await alertar('a adesão da mensalidade não saiu no gateway', erro, { cliente: assinatura.clienteId, contato: assinatura.contatoId })
    return { ok: false, erro: 'O gateway recusou a mensalidade. Confira o CPF da ficha e tente de novo.' }
  }
}

/**
 * Relê no gateway as mensalidades que aguardam adesão, e ativa ou encerra.
 * Roda ao abrir a ficha e na passada diária: o aviso do Pix Automático não
 * chega pelo webhook de cobranças, e assim ele não precisa.
 */
export async function sincronizarAdesao(assinatura: Assinatura): Promise<Assinatura['status']> {
  if (assinatura.status !== 'aguardando' || !assinatura.idNoGateway || !assinatura.gateway || assinatura.modo === 'pix_do_mes') {
    return assinatura.status
  }
  const gateway = gatewayDe(assinatura.gateway)
  const acesso = await acessoDaConexao(assinatura.clienteId, assinatura.gateway)
  if (!acesso || !gateway.lerAdesao) return assinatura.status
  const situacao = await gateway.lerAdesao(acesso, assinatura.modo, assinatura.idNoGateway).catch(() => 'aguardando' as const)
  if (situacao === 'aguardando') return 'aguardando'
  const para = situacao === 'ativa' ? 'ativa' : 'cancelada'
  await mudarStatusDaAssinatura(assinatura.clienteId, assinatura.id, ['aguardando'], para)
  // Pix Automático ativo: o QR inicial pagou o primeiro mês. Fica registrado como pago.
  if (para === 'ativa' && assinatura.modo === 'pix_automatico') {
    await registrarPrimeiroMesPago(assinatura).catch((erro) =>
      alertar('o primeiro mês do Pix Automático não ficou registrado', erro, { cliente: assinatura.clienteId }),
    )
  }
  return para
}

async function registrarPrimeiroMesPago(assinatura: Assinatura): Promise<void> {
  if (await cobrancaDaCompetencia(assinatura.id, assinatura.inicio)) return
  const id = await inserirCobranca({
    clienteId: assinatura.clienteId,
    contatoId: assinatura.contatoId,
    gateway: assinatura.gateway!,
    valorCentavos: assinatura.valorCentavos,
    descricao: descricaoDoMes(assinatura.descricao, assinatura.inicio),
    itens: null,
    venceEm: fimDoDia(vencimentoDa(assinatura.inicio, assinatura.diaDoVencimento)),
    origem: 'mensalidade',
    criadaPor: null,
    sessaoId: null,
    assinaturaId: assinatura.id,
    competencia: assinatura.inicio,
  })
  await mudarStatus(assinatura.clienteId, id, ['pendente'], 'paga', new Date())
  await anotar(assinatura.clienteId, assinatura.contatoId, 'cobranca', { status: 'paga', valor: reais(assinatura.valorCentavos) })
}

/** Cancelar a mensalidade encerra a adesão no gateway: o cartão para de ser cobrado. */
export async function encerrarNoGateway(assinatura: Assinatura): Promise<void> {
  if (assinatura.modo === 'pix_do_mes' || !assinatura.idNoGateway || !assinatura.gateway) return
  const gateway = gatewayDe(assinatura.gateway)
  const acesso = await acessoDaConexao(assinatura.clienteId, assinatura.gateway)
  if (!acesso || !gateway.encerrarAdesao) return
  await gateway.encerrarAdesao(acesso, assinatura.modo, assinatura.idNoGateway)
}
