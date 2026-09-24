import 'server-only'
import { cache } from 'react'
import { RECURSOS_DO_PLANO, type RecursoDoPlano } from '@/core/planos'
import { planoDaConta } from './repos/plano'
import { planoVigente } from './repos/planos'

/**
 * A trava por recurso do plano (seção 8 do plano da administração).
 *
 * **Lê o plano vigente, nunca o agendado.** Quem pediu para descer continua
 * com tudo até a virada; é o prazo para salvar e exportar. Subir religa na
 * hora, porque a troca de subida grava `clients.plano` na hora.
 *
 * O que sai fica **só leitura**, e nada é apagado: a IA para de responder
 * (a configuração do fluxo fica), transcrição antiga continua legível sem
 * transcrever nova, transmissão tem histórico sem criar nova, e integração e
 * webhook de entrada ficam pausados. Consumo nunca trava: acima da faixa é
 * excedente.
 *
 * Falha ao ler o plano cai no plano de entrada (`planoDaConta`), que é o lado
 * de travar. Por isso a leitura é por requisição (`cache`) e barata: uma linha
 * de `clients` e a tabela de planos, que já é cacheada.
 */
export const recursosDaOrganizacao = cache(async (clienteId: string): Promise<{ planoNome: string; recursos: RecursoDoPlano[] }> => {
  const plano = await planoVigente(await planoDaConta(clienteId))
  return { planoNome: plano.nome, recursos: plano.recursos }
})

export async function recursoLiberado(clienteId: string, recurso: RecursoDoPlano): Promise<boolean> {
  return (await recursosDaOrganizacao(clienteId)).recursos.includes(recurso)
}

/** A frase de recusa, a mesma em todo lugar que trava. Nulo = liberado. */
export async function recusaDoPlano(clienteId: string, recurso: RecursoDoPlano): Promise<string | null> {
  const { planoNome, recursos } = await recursosDaOrganizacao(clienteId)
  if (recursos.includes(recurso)) return null
  const rotulo = RECURSOS_DO_PLANO.find((item) => item.chave === recurso)?.rotulo ?? recurso
  return `O plano ${planoNome} não inclui ${rotulo}. Para usar, suba de plano em Configurações > Plano e consumo.`
}
