import 'server-only'
import { cancelarAssinatura, cobrancaPorReferencia, criarCobrancaAvulsa, mensalidadeConfigurada } from '@/channels/asaas-da-4yu'
import { diaDeHoje, diaPorExtenso, excedente } from '@/core/contrato-do-plano'
import type { MomentoDoAtraso } from '@/core/email/modelos'
import { reaisDeCentavos } from '@/core/mensalidade-da-4yu'
import { gestoresDaConta } from './avisos-por-email'
import { enviarModelo } from './email'
import { registrar } from './repos/auditoria'
import { marcarAviso } from './repos/avisos-de-plano'
import { contasQueAssinam, faturasVencidasDeTodas, gravarAssinatura } from './repos/faturas-da-conta'
import { definirSuspensao } from './repos/organizacoes'
import { chaveDoMes, consumoDeTodasAsContas } from './repos/plano'
import { planosVigentes } from './repos/planos'

/**
 * A passada diária da mensalidade (docs/PLANO-MENSALIDADE-ASAAS.md, fase 3),
 * na carona da manutenção, logo **antes** de `passadaDoPlano` (ver o excedente).
 *
 * 1. **Excedente**: do dia 1 ao 5, cobra à parte as conversas acima da faixa
 *    do mês que fechou. A referência `excedente:<conta>:<mês>` é consultada
 *    no Asaas antes de criar, então rodar cinco vezes cobra uma.
 * 2. **Atraso**: a régua de `REGUA`, no desenho do mercado (pesquisa de
 *    23/out/2026: guias de cobrança de SaaS, Stripe, Bling e Asaas). Lembrete
 *    no dia 1, outro no 3, último aviso no 7, painel suspenso no 10, IA e
 *    transmissões pausadas no 30 (com aviso no 25) e a assinatura cancelada
 *    no 60. O robô sem IA nunca para: quem sofre seria o cliente do cliente.
 *    Quem reativa é o aviso de pago (`reativarSeQuitou`), sozinho.
 *
 * Sem `ASAAS_4YU_CHAVE`, não faz nada. Uma conta que falha não para as outras.
 */

/**
 * A régua, em dias de atraso da fatura mais antiga. `proxima` é a etapa que o
 * e-mail anuncia ("suspenso em 2 de novembro"). Só a etapa mais recente
 * alcançada manda e-mail: se a passada falhar uns dias, ninguém recebe três
 * e-mails de uma vez.
 */
export const REGUA: { dia: number; momento: MomentoDoAtraso; proxima: number | null }[] = [
  { dia: 1, momento: 'lembrete', proxima: null },
  { dia: 3, momento: 'segundo', proxima: null },
  { dia: 7, momento: 'final', proxima: 10 },
  { dia: 10, momento: 'suspensa', proxima: 30 },
  { dia: 25, momento: 'pausaAviso', proxima: 30 },
  { dia: 30, momento: 'pausada', proxima: 60 },
  { dia: 60, momento: 'cancelada', proxima: null },
]
export const DIA_DE_SUSPENDER = 10
export const DIA_DE_PAUSAR = 30
export const DIA_DE_CANCELAR = 60
const DIAS_PARA_PAGAR_O_EXCEDENTE = 5
const SISTEMA = { autorEmail: 'sistema@autofluxos', autorId: null }

export type ResumoDaPassadaDaMensalidade = {
  excedentes: number
  avisos: number
  suspensas: number
  pausadas: number
  canceladas: number
  falhas: number
}

/** Dias inteiros entre dois `aaaa-mm-dd`. */
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

function somarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

export async function passadaDaMensalidade(agora = new Date()): Promise<ResumoDaPassadaDaMensalidade | null> {
  if (!mensalidadeConfigurada()) return null
  const resumo: ResumoDaPassadaDaMensalidade = { excedentes: 0, avisos: 0, suspensas: 0, pausadas: 0, canceladas: 0, falhas: 0 }
  const hoje = diaDeHoje(agora)
  const contas = await contasQueAssinam()

  // 1. O excedente do mês que fechou.
  if (Number(hoje.slice(8, 10)) <= 5) {
    const mesPassado = new Date(Date.parse(`${hoje.slice(0, 8)}01T12:00:00Z`) - 86_400_000)
    const mes = chaveDoMes(mesPassado).slice(0, 7)
    const [consumos, planos] = await Promise.all([consumoDeTodasAsContas(mesPassado), planosVigentes()])
    const conversas = new Map(consumos.map((c) => [c.clienteId, c.conversas]))
    for (const conta of contas) {
      if (!conta.clienteAsaas || conta.estado?.startsWith('cancelada') || conta.estado === 'aguardando') continue
      try {
        // O plano em vigor. Esta passada roda **antes** de `passadaDoPlano`,
        // então no dia 1 a descida da virada ainda não foi aplicada e a faixa
        // é a do mês que fechou. Nos dias 2 a 5 só se repete o que falhou.
        const plano = planos.find((p) => p.id === conta.planoDaConta)
        if (!plano) continue
        const cobranca = excedente(conversas.get(conta.clienteId) ?? 0, plano)
        if (cobranca.valor <= 0) continue
        const referencia = `excedente:${conta.clienteId}:${mes}`
        if (await cobrancaPorReferencia(referencia)) continue
        await criarCobrancaAvulsa({
          clienteAsaas: conta.clienteAsaas,
          valorCentavos: Math.round(cobranca.valor * 100),
          vencimento: somarDias(hoje, DIAS_PARA_PAGAR_O_EXCEDENTE),
          descricao: `AutoFluxos: ${cobranca.conversas.toLocaleString('pt-BR')} conversas acima da faixa do ${plano.nome} em ${mes}`,
          referencia,
        })
        resumo.excedentes += 1
        await registrar({ ...SISTEMA, acao: 'cobrou_excedente', contaId: conta.clienteId, contaNome: conta.nome, detalhes: { mes, ...cobranca } })
      } catch (erro) {
        resumo.falhas += 1
        console.error('[mensalidade] o excedente falhou para', conta.clienteId, erro)
      }
    }
  }

  // 2. O atraso: uma fatura por conta, a mais antiga.
  const porConta = new Map(contas.map((conta) => [conta.clienteId, conta]))
  const vistas = new Set<string>()
  for (const fatura of await faturasVencidasDeTodas()) {
    if (vistas.has(fatura.clienteId)) continue
    vistas.add(fatura.clienteId)
    const conta = porConta.get(fatura.clienteId)
    if (!conta) continue
    try {
      const atraso = diasEntre(fatura.vencimento, hoje)
      const etapa = [...REGUA].reverse().find((e) => atraso >= e.dia)
      if (!etapa) continue
      const registrarAto = (acao: string) =>
        registrar({
          ...SISTEMA,
          acao,
          contaId: conta.clienteId,
          contaNome: conta.nome,
          detalhes: { motivo: 'mensalidade em atraso', fatura: fatura.id, dias: atraso },
        })

      // As ações são por estado, não por dia exato: uma passada perdida não pula etapa.
      if (atraso >= DIA_DE_SUSPENDER && !conta.suspensaEm) {
        const r = await definirSuspensao(conta.clienteId, true)
        if (!r.ok) throw new Error(r.motivo ?? 'não foi possível suspender')
        await gravarAssinatura(conta.clienteId, { estado: 'suspensa' })
        resumo.suspensas += 1
        await registrarAto('suspendeu_organizacao')
      }
      if (atraso >= DIA_DE_PAUSAR && atraso < DIA_DE_CANCELAR && conta.estado !== 'pausada') {
        // `recursosDaOrganizacao` lê este estado e pausa o que custa, como no fim do teste.
        await gravarAssinatura(conta.clienteId, { estado: 'pausada' })
        resumo.pausadas += 1
        await registrarAto('pausou_recursos_por_atraso')
      }
      if (atraso >= DIA_DE_CANCELAR && conta.assinaturaRef) {
        await cancelarAssinatura(conta.assinaturaRef)
        // Fica pausada e suspensa: só a 4YU retoma, combinando com o cliente.
        await gravarAssinatura(conta.clienteId, { assinaturaRef: null, estado: 'cancelada_por_atraso' })
        resumo.canceladas += 1
        await registrarAto('cancelou_assinatura_por_atraso')
      }

      if (await marcarAviso(conta.clienteId, `fatura:${fatura.id}:${etapa.momento}`)) {
        resumo.avisos += 1
        await enviarModelo(await gestoresDaConta(conta.clienteId), 'mensalidadeAtrasada', {
          organizacao: conta.nome,
          valor: reaisDeCentavos(fatura.valorCentavos),
          vencimento: diaPorExtenso(fatura.vencimento),
          momento: etapa.momento,
          proxima: etapa.proxima === null ? '' : diaPorExtenso(somarDias(fatura.vencimento, etapa.proxima)),
          link: fatura.link ?? '',
        })
      }
    } catch (erro) {
      resumo.falhas += 1
      console.error('[mensalidade] o atraso falhou para', conta.clienteId, erro)
    }
  }

  return resumo
}
