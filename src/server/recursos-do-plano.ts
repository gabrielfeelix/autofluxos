import 'server-only'
import { cache } from 'react'
import { RECURSOS_DO_PLANO, type RecursoDoPlano } from '@/core/planos'
import { planoDaConta, testeDaConta } from './repos/plano'
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
export const recursosDaOrganizacao = cache(
  async (clienteId: string): Promise<{ planoNome: string; recursos: RecursoDoPlano[]; testeEncerrado: boolean }> => {
    const [plano, testeAte] = await Promise.all([planoDaConta(clienteId).then(planoVigente), testeDaConta(clienteId)])
    /*
     * Teste vencido sem plano escolhido (0128): os recursos pagos param, pela
     * mesma regra de quem perde recurso. Inbox, robôs e CRM seguem, porque
     * `crm` nunca é conferido; o que para é o que custa (IA, transcrição,
     * transmissão, integração, API). Escolher plano limpa `teste_ate`.
     */
    if (testeAte !== null && testeAte < hojeEmBrasilia()) {
      return { planoNome: plano.nome, recursos: plano.recursos.filter((recurso) => recurso === 'crm'), testeEncerrado: true }
    }
    return { planoNome: plano.nome, recursos: plano.recursos, testeEncerrado: false }
  },
)

/** `aaaa-mm-dd` em Brasília, o mesmo formato de `teste_ate`. */
function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export async function recursoLiberado(clienteId: string, recurso: RecursoDoPlano): Promise<boolean> {
  return (await recursosDaOrganizacao(clienteId)).recursos.includes(recurso)
}

/** A frase de recusa, a mesma em todo lugar que trava. Nulo = liberado. */
export async function recusaDoPlano(clienteId: string, recurso: RecursoDoPlano): Promise<string | null> {
  const { planoNome, recursos, testeEncerrado } = await recursosDaOrganizacao(clienteId)
  if (recursos.includes(recurso)) return null
  const rotulo = RECURSOS_DO_PLANO.find((item) => item.chave === recurso)?.rotulo ?? recurso
  if (testeEncerrado) {
    return `O teste grátis terminou, e ${rotulo} ficou pausado. Escolha um plano em Configurações > Plano e consumo para religar.`
  }
  return `O plano ${planoNome} não inclui ${rotulo}. Para usar, suba de plano em Configurações > Plano e consumo.`
}
