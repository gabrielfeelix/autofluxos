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
import { alertar } from './alertar'
import { criarCobranca, reais } from './cobrancas'
import { mandarCobrancaNaConversa, mandarLembretePorModelo } from './mandar-cobranca'
import { assinaturasDoRelogio, cobrancaDaCompetencia, type Assinatura } from './repos/assinaturas'
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
