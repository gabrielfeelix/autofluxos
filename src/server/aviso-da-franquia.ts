import 'server-only'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { emReais, franquiaDoMes, TARIFA_DE_SERVICO_BR } from '@/core/franquia-da-meta'
import { gestoresDaConta } from './avisos-por-email'
import { consumoDaMetaDeTodas } from './consumo-da-meta'
import { enviarModelo, linkDoPainel } from './email'
import { acharCliente } from './repos/clientes'
import { marcarAviso, marcarEmailEnviado } from './repos/avisos-de-plano'
import { chaveDoMes } from './repos/plano'

/**
 * Avisa quem administra quando um número chega perto (800) ou passa (1.000)
 * das conversas de atendimento que a Meta libera sem custo por mês.
 *
 * Roda logo depois da cópia diária do `pricing_analytics`
 * (`api/manutencao/tarefas`), então lê o mesmo "até ontem" que a tela mostra.
 *
 * **Um aviso por número, por nível, por mês.** A chave
 * (`meta:2026-10-01:5544999990000:perto`) mora em `avisos_de_plano`, a mesma
 * tabela da passada do plano, e o `insert` com chave única é o que impede o
 * segundo e-mail. Quem pula direto para "estourou" não recebe o "perto" depois:
 * ele é marcado junto.
 *
 * Uma organização que falha não derruba as outras.
 */
export async function avisarFranquiaDaMeta(agora = new Date()): Promise<{ avisos: number; emails: number; falhas: number }> {
  const mes = chaveDoMes(agora)
  const resultado = { avisos: 0, emails: 0, falhas: 0 }
  const porConta = await consumoDaMetaDeTodas(agora)

  for (const [clienteId, pontos] of porConta) {
    try {
      for (const numero of franquiaDoMes(pontos, mes)) {
        if (!numero.valendo || numero.nivel === 'folga') continue
        const base = `meta:${mes}:${numero.telefone}`
        if (numero.nivel === 'estourou') await marcarAviso(clienteId, `${base}:perto`)
        const chave = `${base}:${numero.nivel}`
        if (!(await marcarAviso(clienteId, chave))) continue
        resultado.avisos += 1

        const enviado = await enviarModelo(await gestoresDaConta(clienteId), 'franquiaDaMeta', {
          organizacao: (await acharCliente(clienteId))?.nome ?? 'sua organização',
          telefone: telefoneLegivel(numero.telefone),
          usadas: numero.usadas,
          estourou: numero.nivel === 'estourou',
          excedentes: numero.excedentes,
          custo: emReais(numero.custoEstimado),
          tarifa: emReais(TARIFA_DE_SERVICO_BR),
          link: linkDoPainel(`/clientes/${clienteId}/ajustes/plano`),
        })
        if (enviado) {
          resultado.emails += 1
          await marcarEmailEnviado(clienteId, chave)
        }
      }
    } catch (erro) {
      resultado.falhas += 1
      console.error('[franquia] o aviso falhou para', clienteId, erro)
    }
  }

  return resultado
}
