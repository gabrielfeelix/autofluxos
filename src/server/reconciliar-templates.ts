import 'server-only'
import { listarTemplatesDaMeta } from '@/channels/templates-api'
import { casarPorNome, clientesComTemplatesPendentes } from './repos/templates'
import { lerTokenDoCanal, listarCanais } from './repos/conversas'

/**
 * A reconciliação: perguntar à Meta o que ela sabe dos nossos templates.
 *
 * ---------------------------------------------------------------------------
 * Por que ela existe, mesmo com o webhook funcionando
 * ---------------------------------------------------------------------------
 *
 * **Webhook perdido é questão de quando, não de se.** A Meta entrega
 * `message_template_status_update` uma vez; se a nossa função estiver fora do
 * ar, em deploy ou estourando o tempo naquele segundo, o aviso não volta. O
 * template fica `pendente` no nosso banco para sempre, e a pessoa vê "em
 * análise" num modelo aprovado há três dias, sem nada no log, porque do nosso
 * lado não houve erro nenhum.
 *
 * É a mesma lição do contêiner GTM errado em `4yu-apps/CLAUDE.md`: o console
 * dizer "publicado" não é evidência. Aqui, o webhook não ter chegado não é
 * evidência de que nada mudou.
 *
 * ---------------------------------------------------------------------------
 * Casa por nome+idioma, e não por id
 * ---------------------------------------------------------------------------
 *
 * Justamente porque o caso que se está consertando é o do id que nunca chegou:
 * o template foi criado, o webhook com o `waba_template_id` se perdeu, e casar
 * por id não encontraria nada. `(cliente, nome, idioma)` é a chave natural da
 * tabela e é a única que sobrevive a essa perda, e de quebra grava o id que
 * faltava, para os webhooks seguintes acharem pelo caminho rápido.
 */

export type ResumoDaReconciliacao = {
  clientes: number
  conferidos: number
  corrigidos: number
  falhas: number
}

/**
 * Passa por todos os clientes com template em estado mutável.
 *
 * **Uma conta que falha não derruba as outras.** São clientes diferentes: um
 * token vencido numa conta não pode impedir a correção de outra. Por isso o
 * `try` é por cliente, e não em volta do laço, o mesmo desenho de
 * `rodarTarefas` e `enviarAgendadas`.
 */
export async function reconciliarTemplates(): Promise<ResumoDaReconciliacao> {
  const resumo: ResumoDaReconciliacao = {
    clientes: 0,
    conferidos: 0,
    corrigidos: 0,
    falhas: 0,
  }

  const contas = await clientesComTemplatesPendentes()
  resumo.clientes = contas.length

  for (const conta of contas) {
    try {
      const corrigidos = await reconciliarUmCliente(conta.clienteId, conta.wabaId, resumo)
      resumo.corrigidos += corrigidos
    } catch (erro) {
      resumo.falhas += 1
      console.error('[templates] não deu para reconciliar', conta.clienteId, erro)
    }
  }

  return resumo
}

async function reconciliarUmCliente(
  clienteId: string,
  wabaId: string,
  resumo: ResumoDaReconciliacao,
): Promise<number> {
  const token = await tokenDoCliente(clienteId)
  if (!token) return 0

  const resposta = await listarTemplatesDaMeta({ wabaId, token })
  if (!resposta.ok) {
    /*
     * Erro da Meta **não** é "este cliente não tem template". Tratar como lista
     * vazia aqui faria a reconciliação concluir o oposto da verdade, e é por
     * isso que `listarTemplatesDaMeta` devolve o erro em vez de `[]`.
     */
    throw new Error(`a Meta recusou a listagem: ${resposta.erro.mensagem}`)
  }

  let corrigidos = 0

  for (const naMeta of resposta.templates) {
    resumo.conferidos += 1

    // Status que esta versão não conhece: não mexe. Ver `statusDaMeta`.
    if (naMeta.status === 'desconhecido') continue

    const mudou = await casarPorNome(clienteId, naMeta.nome, naMeta.idioma, {
      status: naMeta.status,
      wabaTemplateId: naMeta.wabaTemplateId,
      qualidade: naMeta.qualidade,
      categoria: naMeta.categoria,
      // Só grava motivo quando há recusa: sobrescrever com `null` um motivo que
      // o webhook já trouxe apagaria a melhor informação que a Meta dá.
      ...(naMeta.status === 'recusado' && naMeta.motivoRecusa
        ? { motivoRecusa: naMeta.motivoRecusa }
        : {}),
    })

    if (mudou) corrigidos += 1
  }

  return corrigidos
}

/**
 * O token do número deste cliente.
 *
 * `null` quando não há canal de WhatsApp ativo, que é normal: cliente que só
 * usa Instagram não tem template nenhum para reconciliar, e a conta cai fora
 * sem virar falha.
 */
async function tokenDoCliente(clienteId: string): Promise<string | null> {
  const canais = await listarCanais(clienteId)
  const doWhats = canais.find((c) => c.provider !== 'instagram' && c.status === 'ativo')
  if (!doWhats) return null
  return lerTokenDoCanal(doWhats)
}
