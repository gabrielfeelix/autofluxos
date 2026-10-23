import 'server-only'
import {
  avisoDaDescida,
  diaDeHoje,
  diaPorExtenso,
  excedente,
  faixaDoConsumo,
  fraseDoExcedente,
  reais,
} from '@/core/contrato-do-plano'
import { RECURSOS_DO_PLANO } from '@/core/planos'
import { db } from './db'
import type { IdDoModelo, ParametrosDo } from '@/core/email/modelos'
import { gestoresDaConta } from './avisos-por-email'
import { enviarModelo, linkDoPainel } from './email'
import { registrar } from './repos/auditoria'
import { marcarAviso, marcarEmailEnviado } from './repos/avisos-de-plano'
import { aplicarPreco, chaveDoMes, consumoDeTodasAsContas, contratosDeTodas, definirPlano, testesDeTodas } from './repos/plano'
import { planosVigentes, type PlanoVigente } from './repos/planos'
import { PLANO_DO_TESTE } from '@/core/planos'
import { mudarEstadoDaTransmissao } from './repos/transmissoes'
import { alertar } from './alertar'
import { sincronizarAssinatura } from './mensalidade-da-4yu'

/**
 * A passada diária do plano, na carona da manutenção (`api/manutencao/retencao`).
 *
 * 1. Aplica a descida agendada que venceu (virada do mês) e cancela as
 *    transmissões ainda agendadas, se o plano novo não inclui transmissões.
 * 2. Aplica o preço agendado que venceu (30 dias de aviso).
 * 3. Avisa, no app e por e-mail: 7 e 1 dia antes da descida, o preço novo,
 *    e o consumo em 80% e 100% da faixa do mês, com a conta do excedente.
 *
 * Uma organização que falha não derruba as outras: `try` por organização,
 * como `passadaDeTransmissoes`.
 */

export type ResumoDaPassadaDoPlano = {
  descidas: number
  transmissoesCanceladas: number
  precos: number
  avisos: number
  emails: number
  falhas: number
}

const SISTEMA = { autorEmail: 'sistema@autofluxos', autorId: null }

export async function passadaDoPlano(agora = new Date()): Promise<ResumoDaPassadaDoPlano> {
  const hoje = diaDeHoje(agora)
  const mes = chaveDoMes(agora)
  const [contratos, planos, consumos, testes] = await Promise.all([contratosDeTodas(), planosVigentes(), consumoDeTodasAsContas(agora), testesDeTodas()])
  const plano = (id: string) => planos.find((item) => item.id === id)
  const conversas = new Map(consumos.map((consumo) => [consumo.clienteId, consumo.conversas]))
  const resumo: ResumoDaPassadaDoPlano = { descidas: 0, transmissoesCanceladas: 0, precos: 0, avisos: 0, emails: 0, falhas: 0 }

  const avisar = async <I extends IdDoModelo>(clienteId: string, chave: string, modelo: I, parametros: ParametrosDo<I>) => {
    if (!(await marcarAviso(clienteId, chave))) return
    resumo.avisos += 1
    if (await enviarModelo(await gestoresDaConta(clienteId), modelo, parametros)) {
      resumo.emails += 1
      await marcarEmailEnviado(clienteId, chave)
    }
  }

  for (const contrato of contratos) {
    const link = linkDoPainel(`/clientes/${contrato.clienteId}/ajustes/plano`)
    try {
      let vigente = plano(contrato.plano)

      // 1. A descida que venceu.
      if (contrato.planoAgendado && contrato.planoAgendadoPara && contrato.planoAgendadoPara <= hoje) {
        const destino = plano(contrato.planoAgendado)
        if (destino) {
          const r = await definirPlano(contrato.clienteId, destino.id, destino.preco)
          if (!r.ok) throw new Error(r.erro)
          resumo.descidas += 1
          // Quem paga pelo Asaas passa a pagar o valor do plano novo.
          await sincronizarAssinatura(contrato.clienteId).catch((erro) =>
            alertar('a assinatura não acompanhou a descida', erro, { cliente: contrato.clienteId }),
          )
          const canceladas = destino.recursos.includes('transmissoes') ? 0 : await cancelarAgendadas(contrato.clienteId)
          resumo.transmissoesCanceladas += canceladas
          await registrar({
            ...SISTEMA,
            acao: 'aplicou_descida_de_plano',
            contaId: contrato.clienteId,
            contaNome: contrato.nome,
            alvoTipo: 'plano',
            alvoId: destino.id,
            alvoNome: destino.nome,
            detalhes: { de: contrato.plano, para: destino.id, transmissoesCanceladas: canceladas },
          })
          await avisar(contrato.clienteId, `descida:${contrato.planoAgendadoPara}:aplicada`, 'trocaDePlanoAplicada', {
            organizacao: contrato.nome,
            plano: destino.nome,
            preco: reais(destino.preco),
            oQueSai: oQueFicaSoLeitura(vigente, destino),
            canceladas,
            link,
          })
          vigente = destino
        }
      } else if (contrato.planoAgendado && contrato.planoAgendadoPara) {
        // 3a. A véspera da descida.
        const destino = plano(contrato.planoAgendado)
        const dias = avisoDaDescida(contrato.planoAgendadoPara, agora)
        if (destino && dias) {
          await avisar(contrato.clienteId, `descida:${contrato.planoAgendadoPara}:${dias}d`, 'trocaDePlanoAgendada', {
            organizacao: contrato.nome,
            de: vigente?.nome ?? contrato.plano,
            para: destino.nome,
            data: diaPorExtenso(contrato.planoAgendadoPara),
            faltam: dias,
            oQueSai: oQueFicaSoLeitura(vigente, destino),
            link,
          })
        }
      }

      // 2. O preço agendado que venceu, ou o aviso dele.
      if (contrato.precoAgendado !== null && contrato.precoAgendadoPara) {
        if (contrato.precoAgendadoPara <= hoje) {
          const r = await aplicarPreco(contrato.clienteId, contrato.precoAgendado)
          if (!r.ok) throw new Error(r.erro)
          resumo.precos += 1
          await registrar({
            ...SISTEMA,
            acao: 'aplicou_preco_agendado',
            contaId: contrato.clienteId,
            contaNome: contrato.nome,
            alvoTipo: 'plano',
            alvoId: contrato.plano,
            alvoNome: vigente?.nome ?? contrato.plano,
            detalhes: { de: contrato.precoContratado, para: contrato.precoAgendado },
          })
        } else {
          await avisar(contrato.clienteId, `preco:${contrato.precoAgendadoPara}`, 'precoVaiMudar', {
            organizacao: contrato.nome,
            plano: vigente?.nome ?? contrato.plano,
            data: diaPorExtenso(contrato.precoAgendadoPara),
            atual: contrato.precoContratado !== null ? reais(contrato.precoContratado) : null,
            novo: reais(contrato.precoAgendado),
            link,
          })
        }
      }

      // 3b. O consumo do mês.
      if (vigente) {
        const usadas = conversas.get(contrato.clienteId) ?? 0
        const faixa = faixaDoConsumo(usadas, vigente.conversas)
        if (faixa === 100) await marcarAviso(contrato.clienteId, `consumo:${mes}:80`)
        if (faixa) {
          await avisar(contrato.clienteId, `consumo:${mes}:${faixa}`, 'consumoDoPlano', {
            organizacao: contrato.nome,
            plano: vigente.nome,
            usadas,
            total: vigente.conversas,
            faixa,
            precoExcedente: reais(vigente.precoExcedente),
            conta: faixa === 100 ? (fraseDoExcedente(excedente(usadas, vigente)) ?? '') : '',
            link,
          })
        }
      }

      // 4. O teste grátis: 3 dias antes, na véspera, e no dia seguinte ao fim.
      // O teste vale até o dia `teste_ate` inteiro (`recursos-do-plano.ts`).
      const testeAte = testes.get(contrato.clienteId)
      if (testeAte) {
        const faltam = Math.round((Date.parse(`${testeAte}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000)
        // Teste que acabou há mais de dois dias não avisa: é organização antiga, não notícia.
        const momento = faltam === 3 ? 'faltam3' : faltam === 1 ? 'faltam1' : faltam < 0 && faltam >= -2 ? 'acabou' : null
        if (momento) {
          await avisar(contrato.clienteId, `teste:${testeAte}:${momento}`, 'testeGratis', {
            organizacao: contrato.nome,
            plano: plano(PLANO_DO_TESTE)?.nome ?? PLANO_DO_TESTE,
            ate: diaPorExtenso(testeAte),
            momento,
            link,
          })
        }
      }
    } catch (erro) {
      resumo.falhas += 1
      console.error('[plano] a passada falhou para', contrato.clienteId, erro)
    }
  }

  return resumo
}

/** O que sai e fica só leitura na descida, em uma frase. Vazio se nada sai. */
export function oQueFicaSoLeitura(de: PlanoVigente | undefined, para: PlanoVigente): string {
  if (!de) return ''
  const sai = de.recursos.filter((recurso) => !para.recursos.includes(recurso))
  if (sai.length === 0) return ''
  const rotulos = sai.map((recurso) => RECURSOS_DO_PLANO.find((item) => item.chave === recurso)?.rotulo ?? recurso)
  return `Sai do plano e fica só leitura, com a configuração guardada: ${rotulos.join(', ')}.`
}

/** Cancela as transmissões ainda agendadas da organização. Devolve quantas. */
async function cancelarAgendadas(clienteId: string): Promise<number> {
  const { data, error } = await db().from('transmissoes').select('id').eq('cliente_id', clienteId).eq('estado', 'agendada')
  if (error) throw new Error(`não foi possível ler as transmissões agendadas: ${error.message}`)
  const ids = ((data ?? []) as { id: string }[]).map((linha) => linha.id)
  for (const id of ids) await mudarEstadoDaTransmissao(id, 'cancelada', { erro: 'cancelada na descida de plano: o plano novo não inclui transmissões' })
  return ids.length
}
