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
import { enviarEmail } from './email'
import { registrar } from './repos/auditoria'
import { marcarAviso, marcarEmailEnviado } from './repos/avisos-de-plano'
import { aplicarPreco, chaveDoMes, consumoDeTodasAsContas, contratosDeTodas, definirPlano } from './repos/plano'
import { planosVigentes, type PlanoVigente } from './repos/planos'
import { mudarEstadoDaTransmissao } from './repos/transmissoes'
import { membrosDaConta } from './repos/usuarios'

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
  const [contratos, planos, consumos] = await Promise.all([contratosDeTodas(), planosVigentes(), consumoDeTodasAsContas(agora)])
  const plano = (id: string) => planos.find((item) => item.id === id)
  const conversas = new Map(consumos.map((consumo) => [consumo.clienteId, consumo.conversas]))
  const resumo: ResumoDaPassadaDoPlano = { descidas: 0, transmissoesCanceladas: 0, precos: 0, avisos: 0, emails: 0, falhas: 0 }

  const avisar = async (clienteId: string, chave: string, assunto: string, texto: string) => {
    if (!(await marcarAviso(clienteId, chave))) return
    resumo.avisos += 1
    const quem = (await membrosDaConta(clienteId)).filter((membro) => membro.papel === 'owner' || membro.papel === 'admin')
    if (await enviarEmail(quem, assunto, texto)) {
      resumo.emails += 1
      await marcarEmailEnviado(clienteId, chave)
    }
  }

  for (const contrato of contratos) {
    try {
      let vigente = plano(contrato.plano)

      // 1. A descida que venceu.
      if (contrato.planoAgendado && contrato.planoAgendadoPara && contrato.planoAgendadoPara <= hoje) {
        const destino = plano(contrato.planoAgendado)
        if (destino) {
          const r = await definirPlano(contrato.clienteId, destino.id, destino.preco)
          if (!r.ok) throw new Error(r.erro)
          resumo.descidas += 1
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
          await avisar(
            contrato.clienteId,
            `descida:${contrato.planoAgendadoPara}:aplicada`,
            `Sua organização está no plano ${destino.nome}`,
            [
              `A partir de hoje, ${contrato.nome} está no plano ${destino.nome} (${reais(destino.preco)} por mês).`,
              oQueFicaSoLeitura(vigente, destino),
              canceladas > 0 ? `${canceladas} ${canceladas === 1 ? 'transmissão agendada foi cancelada' : 'transmissões agendadas foram canceladas'}, porque o plano novo não inclui transmissões.` : '',
              'Nada foi apagado. Se subir de plano, tudo volta na hora.',
            ]
              .filter(Boolean)
              .join('\n\n'),
          )
          vigente = destino
        }
      } else if (contrato.planoAgendado && contrato.planoAgendadoPara) {
        // 3a. A véspera da descida.
        const destino = plano(contrato.planoAgendado)
        const dias = avisoDaDescida(contrato.planoAgendadoPara, agora)
        if (destino && dias) {
          await avisar(
            contrato.clienteId,
            `descida:${contrato.planoAgendadoPara}:${dias}d`,
            `Em ${dias === 1 ? '1 dia' : `${dias} dias`} sua organização desce para o plano ${destino.nome}`,
            [
              `Em ${diaPorExtenso(contrato.planoAgendadoPara)}, ${contrato.nome} passa do plano ${vigente?.nome ?? contrato.plano} para o ${destino.nome}.`,
              oQueFicaSoLeitura(vigente, destino),
              'Até lá, tudo continua funcionando: é o prazo para salvar e exportar o que precisar. Nada é apagado.',
            ]
              .filter(Boolean)
              .join('\n\n'),
          )
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
          await avisar(
            contrato.clienteId,
            `preco:${contrato.precoAgendadoPara}`,
            `O preço do plano ${vigente?.nome ?? ''} muda em ${diaPorExtenso(contrato.precoAgendadoPara)}`,
            `A partir de ${diaPorExtenso(contrato.precoAgendadoPara)}, o plano de ${contrato.nome} passa a custar ${reais(contrato.precoAgendado)} por mês${contrato.precoContratado !== null ? ` (hoje, ${reais(contrato.precoContratado)})` : ''}.`,
          )
        }
      }

      // 3b. O consumo do mês.
      if (vigente) {
        const usadas = conversas.get(contrato.clienteId) ?? 0
        const faixa = faixaDoConsumo(usadas, vigente.conversas)
        if (faixa === 100) await marcarAviso(contrato.clienteId, `consumo:${mes}:80`)
        if (faixa) {
          const conta = fraseDoExcedente(excedente(usadas, vigente))
          await avisar(
            contrato.clienteId,
            `consumo:${mes}:${faixa}`,
            faixa === 100 ? `Sua organização passou da faixa do plano ${vigente.nome}` : `Sua organização usou 80% da faixa do plano ${vigente.nome}`,
            [
              `${contrato.nome} teve ${usadas.toLocaleString('pt-BR')} conversas neste mês, de ${vigente.conversas.toLocaleString('pt-BR')} do plano ${vigente.nome}.`,
              faixa === 100
                ? `Nada é bloqueado. Cada conversa acima da faixa custa ${reais(vigente.precoExcedente)}, na fatura seguinte. ${conta ?? ''}`.trim()
                : `Nada é bloqueado. Acima da faixa, cada conversa custa ${reais(vigente.precoExcedente)}, na fatura seguinte.`,
            ].join('\n\n'),
          )
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
function oQueFicaSoLeitura(de: PlanoVigente | undefined, para: PlanoVigente): string {
  if (!de) return ''
  const sai = de.recursos.filter((recurso) => !para.recursos.includes(recurso))
  if (sai.length === 0) return ''
  const rotulos = sai.map((recurso) => RECURSOS_DO_PLANO.find((item) => item.chave === recurso)?.rotulo ?? recurso)
  return `Sai do plano e fica só leitura, com a configuração guardada: ${rotulos.join(', ')}.`
}

/** Cancela as transmissões ainda agendadas da organização. Devolve quantas. */
async function cancelarAgendadas(clienteId: string): Promise<number> {
  const { data, error } = await db().from('transmissoes').select('id').eq('cliente_id', clienteId).eq('estado', 'agendada')
  if (error) throw new Error(`não deu para ler as transmissões agendadas: ${error.message}`)
  const ids = ((data ?? []) as { id: string }[]).map((linha) => linha.id)
  for (const id of ids) await mudarEstadoDaTransmissao(id, 'cancelada', { erro: 'cancelada na descida de plano: o plano novo não inclui transmissões' })
  return ids.length
}
