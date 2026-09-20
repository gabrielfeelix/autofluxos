import 'server-only'
import { lerLeadDoFormularioNaMeta } from '@/channels/marketing-api'
import { lerLeadDoFormulario, type AvisoDeLead } from '@/core/lead-ads'
import { alertar } from './alertar'
import { db } from './db'
import { porNoQuadroPadrao } from './quadro-de-entrada'
import { guardarCampo } from './repos/conversas'
import { criarContato } from './repos/leads'
import { anotarFormulario } from './repos/paginas-de-lead'
import { registrarPassagem } from './repos/passagens'

/**
 * O lead do formulário nativo, do aviso da Meta até o cartão no funil.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo substitui
 * ---------------------------------------------------------------------------
 *
 * Hoje a agência paga um intermediário (LeadsBridge, Pluga, Zapier) para tirar
 * o lead do Facebook e jogar num formulário ou planilha. Isso custa mensalidade,
 * atrasa de 5 a 15 minutos e coloca dado pessoal — nome, telefone, e-mail — na
 * mão de mais uma empresa. Este caminho é direto: a Meta avisa, buscamos, o
 * lead vira contato e entra no funil.
 *
 * ---------------------------------------------------------------------------
 * A ordem, e por que ela é essa
 * ---------------------------------------------------------------------------
 *
 * 1. **Buscar o lead**, porque o webhook só manda IDs.
 * 2. **Traduzir**, recusando o que não tem telefone — ver `core/lead-ads.ts`.
 * 3. **Criar o contato**, reusando `criarContato`: ele já normaliza telefone,
 *    deduplica por grafia e trata corrida. Lead Ads não precisa de caminho
 *    próprio para isso, e ter um seria ter duas regras de identidade.
 * 4. **Guardar as respostas** em `campos`, do mesmo jeito que o fluxo guarda o
 *    que o bot perguntou — a tela de leads já sabe mostrar.
 * 5. **Registrar a passagem**, para o lead saber de qual anúncio veio.
 * 6. **Pôr no quadro padrão**, que é a razão de `porNoQuadroPadrao` ter saído
 *    de `receber-mensagem.ts` mais cedo nesta mesma sessão.
 *
 * ---------------------------------------------------------------------------
 * Nada aqui pode responder erro ao webhook
 * ---------------------------------------------------------------------------
 *
 * **A Meta não reentrega depois de um `200`, e reentrega tudo depois de um
 * erro.** Um lead defeituoso no lote não pode fazer os outros dezenove
 * chegarem duas vezes. Então cada lead é tratado por conta própria, falha vira
 * alerta, e o lote sempre termina.
 */

export type ResultadoDoLote = {
  criados: number
  repetidos: number
  recusados: number
}

/**
 * Trata um lote de avisos. Sempre termina, mesmo com lead defeituoso no meio.
 *
 * `clienteId` vem de quem chamou — a rota resolve a Página para a conta antes,
 * porque **aceitar cliente vindo do corpo do webhook** seria deixar qualquer um
 * que descubra a URL escrever na conta alheia.
 */
export async function receberLeadsDoFormulario(entrada: {
  clienteId: string
  avisos: AvisoDeLead[]
  token: string
}): Promise<ResultadoDoLote> {
  const resultado: ResultadoDoLote = { criados: 0, repetidos: 0, recusados: 0 }

  for (const aviso of entrada.avisos) {
    try {
      /*
       * Anota o formulário antes de tratar: é o que a reconciliação diária vai
       * varrer amanhã. Silencioso de propósito — se falhar, o lead de hoje
       * entra do mesmo jeito, e é ele que importa agora.
       */
      await anotarFormulario({
        clienteId: entrada.clienteId,
        pageId: aviso.pageId,
        formId: aviso.formId,
      }).catch(() => {})

      const passo = await umLead(entrada.clienteId, aviso, entrada.token)
      resultado[passo] += 1
    } catch (erro) {
      /*
       * Erro inesperado num lead não derruba o lote. Sem isto, um contato com
       * telefone estranho faria a Meta reentregar os outros do mesmo POST.
       */
      resultado.recusados += 1
      const detalhe = erro instanceof Error ? erro.message : String(erro)
      await alertar('falhou ao registrar um lead do formulário', detalhe, {
        lead: aviso.leadgenId,
      })
    }
  }

  return resultado
}

async function umLead(
  clienteId: string,
  aviso: AvisoDeLead,
  token: string,
): Promise<'criados' | 'repetidos' | 'recusados'> {
  const busca = await lerLeadDoFormularioNaMeta({ leadgenId: aviso.leadgenId, token })

  if (!busca.ok) {
    /*
     * 190 é token vencido: alguém precisa reconectar, e insistir não resolve.
     * Os outros códigos podem ser o lead apagado ou um problema pontual — o
     * alerta diz qual foi, e a reconciliação diária pega o que ficou para trás.
     */
    const precisaReconectar = busca.erro.codigo === 190
    await alertar(
      precisaReconectar
        ? 'o acesso aos leads venceu; reconecte para voltar a receber do formulário'
        : 'não deu para buscar o lead do formulário na Meta',
      `${busca.erro.mensagem} (lead ${aviso.leadgenId})`,
      { lead: aviso.leadgenId },
    )
    return 'recusados'
  }

  const lido = lerLeadDoFormulario({ leadId: aviso.leadgenId, fieldData: busca.fieldData })
  if (!lido.ok) {
    await alertar('um lead do formulário não pôde entrar', lido.recusa.motivo, {
      lead: aviso.leadgenId,
    })
    return 'recusados'
  }

  const { lead } = lido
  const criado = await criarContato(clienteId, { nome: lead.nome, telefone: lead.telefone })

  /*
   * Telefone que já existe **não é erro**: é a mesma pessoa preenchendo o
   * formulário de novo, ou alguém que já conversava e agora respondeu um
   * anúncio. O contato fica como está — renomear com o nome do formulário
   * apagaria a correção que a equipe fez à mão — e o que importa desta vez é a
   * passagem, registrada abaixo.
   */
  if (!criado.ok) {
    await registrarAnuncio(clienteId, null, lead.telefone, aviso, lead)
    return 'repetidos'
  }

  /*
   * As respostas do formulário entram em `campos`, junto do que o fluxo
   * coletaria. `origem` fica marcada como Formulário para distinguir de quem
   * chegou escrevendo — as duas são "veio de anúncio", e a diferença importa
   * para quem atende: um já disse o que quer, o outro ainda vai dizer.
   */
  await guardarCampo(criado.contatoId, {
    ...lead.respostas,
    origem: 'Formulário',
    ...(aviso.adId ? { origem_anuncio: aviso.adId } : {}),
    ...(lead.email ? { email: lead.email } : {}),
    lead_da_meta: lead.leadId,
  })

  await registrarAnuncio(clienteId, criado.contatoId, lead.telefone, aviso, lead)
  await porNoQuadroPadrao({ id: criado.contatoId, clienteId })

  return 'criados'
}

/**
 * A passagem pelo anúncio, quando houve anúncio.
 *
 * Lead orgânico — formulário em post sem impulsionamento — chega sem `ad_id`, e
 * isso é legítimo: a pessoa entrou, só não veio de mídia paga. Sem anúncio não
 * há passagem a registrar.
 */
async function registrarAnuncio(
  clienteId: string,
  contatoId: string | null,
  telefone: string,
  aviso: AvisoDeLead,
  lead: { nome: string },
): Promise<void> {
  if (aviso.adId === '') return

  const alvo = contatoId ?? (await acharContatoPeloTelefone(clienteId, telefone))
  if (!alvo) return

  try {
    await registrarPassagem({
      clienteId,
      contatoId: alvo,
      adId: aviso.adId,
      /*
       * **`formulario`, e é a correção da RB-09.** Até a 0074 esta linha era
       * indistinguível da chegada por clique, e a view da 0065 lia as duas como
       * porta de entrada: o formulário abria 72h de texto livre para quem nunca
       * escreveu para o número, e quem respondesse recebia
       * `(#131047) Re-engagement message`.
       *
       * O lead continua sendo criado, continua entrando no funil e continua
       * mostrando de qual anúncio veio. O que ele não faz é abrir janela de
       * conversa, porque conversa não houve.
       */
      tipo: 'formulario',
      /*
       * O `leadgen_id` é o id da submissão na Meta, e é ele que torna a
       * reentrega idempotente **sem** confundir duas submissões reais no mesmo
       * minuto: o índice de minuto da 0050 jogaria a segunda fora, e duas
       * submissões são duas entradas (RB-10).
       */
      idExterno: aviso.leadgenId,
      titulo: lead.nome !== '' ? `Formulário — ${lead.nome}` : 'Formulário',
    })
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não deu para registrar a passagem do lead do formulário', detalhe, {
      contato: alvo,
    })
  }
}

async function acharContatoPeloTelefone(
  clienteId: string,
  telefone: string,
): Promise<string | null> {
  const { data } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .eq('wa_id', telefone)
    .maybeSingle()

  return (data as { id: string } | null)?.id ?? null
}
