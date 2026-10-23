import 'server-only'
import { cobrancaPorReferencia, criarCobrancaAvulsa, mensalidadeConfigurada } from '@/channels/asaas-da-4yu'
import { diaDeHoje, diaPorExtenso, excedente } from '@/core/contrato-do-plano'
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
 * 2. **Atraso**: no 5º dia de fatura vencida, e-mail avisando da suspensão;
 *    no 7º, suspende e manda o link de pagar. Quem reativa é o aviso de pago
 *    (`reativarSeQuitou`), sozinho.
 *
 * Sem `ASAAS_4YU_CHAVE`, não faz nada. Uma conta que falha não para as outras.
 */

export const DIAS_PARA_AVISAR = 5
export const DIAS_PARA_SUSPENDER = 7
const DIAS_PARA_PAGAR_O_EXCEDENTE = 5
const SISTEMA = { autorEmail: 'sistema@autofluxos', autorId: null }

export type ResumoDaPassadaDaMensalidade = { excedentes: number; avisos: number; suspensas: number; falhas: number }

/** Dias inteiros entre dois `aaaa-mm-dd`. */
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

function somarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

export async function passadaDaMensalidade(agora = new Date()): Promise<ResumoDaPassadaDaMensalidade | null> {
  if (!mensalidadeConfigurada()) return null
  const resumo: ResumoDaPassadaDaMensalidade = { excedentes: 0, avisos: 0, suspensas: 0, falhas: 0 }
  const hoje = diaDeHoje(agora)
  const contas = await contasQueAssinam()

  // 1. O excedente do mês que fechou.
  if (Number(hoje.slice(8, 10)) <= 5) {
    const mesPassado = new Date(Date.parse(`${hoje.slice(0, 8)}01T12:00:00Z`) - 86_400_000)
    const mes = chaveDoMes(mesPassado).slice(0, 7)
    const [consumos, planos] = await Promise.all([consumoDeTodasAsContas(mesPassado), planosVigentes()])
    const conversas = new Map(consumos.map((c) => [c.clienteId, c.conversas]))
    for (const conta of contas) {
      if (!conta.clienteAsaas || conta.estado === 'cancelada' || conta.estado === 'aguardando') continue
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
      const parametros = {
        organizacao: conta.nome,
        valor: reaisDeCentavos(fatura.valorCentavos),
        vencimento: diaPorExtenso(fatura.vencimento),
        suspendeEm: diaPorExtenso(somarDias(fatura.vencimento, DIAS_PARA_SUSPENDER)),
        link: fatura.link ?? '',
      }

      if (atraso >= DIAS_PARA_SUSPENDER) {
        // Já suspensa, pela 4YU ou por nós: nada a fazer, e o estado não muda.
        if (conta.suspensaEm) continue
        const r = await definirSuspensao(conta.clienteId, true)
        if (!r.ok) throw new Error(r.motivo ?? 'não foi possível suspender')
        await gravarAssinatura(conta.clienteId, { estado: 'suspensa' })
        resumo.suspensas += 1
        await registrar({
          ...SISTEMA,
          acao: 'suspendeu_organizacao',
          contaId: conta.clienteId,
          contaNome: conta.nome,
          detalhes: { motivo: 'mensalidade em atraso', fatura: fatura.id, dias: atraso },
        })
        if (await marcarAviso(conta.clienteId, `fatura:${fatura.id}:suspensa`)) {
          await enviarModelo(await gestoresDaConta(conta.clienteId), 'mensalidadeAtrasada', { ...parametros, momento: 'suspensa' })
        }
      } else if (atraso >= DIAS_PARA_AVISAR && (await marcarAviso(conta.clienteId, `fatura:${fatura.id}:aviso`))) {
        resumo.avisos += 1
        await enviarModelo(await gestoresDaConta(conta.clienteId), 'mensalidadeAtrasada', { ...parametros, momento: 'aviso' })
      }
    } catch (erro) {
      resumo.falhas += 1
      console.error('[mensalidade] o atraso falhou para', conta.clienteId, erro)
    }
  }

  return resumo
}
