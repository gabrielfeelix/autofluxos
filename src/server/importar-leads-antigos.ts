import 'server-only'
import { listarLeadsDoFormulario } from '@/channels/marketing-api'
import { listarFormulariosDaPagina } from './anuncios/conexao'
import { alertar } from './alertar'
import { receberLeadsDoFormulario } from './receber-lead-do-formulario'
import { anotarFormulario } from './repos/paginas-de-lead'

/**
 * Trazer os leads que já existiam antes de a conta ser ligada.
 *
 * ---------------------------------------------------------------------------
 * Por que isto não é luxo
 * ---------------------------------------------------------------------------
 *
 * O webhook só avisa de lead **novo**. Quem liga a conta hoje, com campanhas
 * rodando há meses, veria uma tela vazia — e tela vazia no primeiro minuto é o
 * que faz alguém concluir que não funcionou. Importar o que já existe é o que
 * transforma "conectei e não vi nada" em "conectei e vieram quarenta".
 *
 * Tem prazo de validade, e isso é da Meta: **o lead some depois de 90 dias**,
 * do Gerenciador, do Business Suite e da API. O que não for importado dentro
 * dessa janela não existe mais em lugar nenhum.
 *
 * ---------------------------------------------------------------------------
 * Reusa o caminho do webhook, de propósito
 * ---------------------------------------------------------------------------
 *
 * Cada lead passa por `receberLeadsDoFormulario`, igual ao que chega em tempo
 * real. É uma chamada a mais por lead do que o necessário, e vale: a regra de
 * "o que é um lead válido" não pode divergir entre importar e receber. Se
 * divergisse, o mesmo formulário entraria de um jeito hoje e de outro amanhã, e
 * ninguém notaria até o dia em que um telefone virasse contato duplicado.
 *
 * A dedupe já existe nos dois lados: `criarContato` recusa telefone repetido, e
 * `passagens` tem índice por minuto. Importar duas vezes não estraga nada.
 */

export type ResultadoDaImportacao = {
  formularios: number
  criados: number
  repetidos: number
  recusados: number
}

/**
 * Importa os leads de todos os formulários de uma Página.
 *
 * `desde` recorta a janela — a tela oferece 90 dias, que é tudo o que a Meta
 * ainda tem.
 */
export async function importarLeadsAntigos(entrada: {
  clienteId: string
  pageId: string
  token: string
  desde?: Date
}): Promise<ResultadoDaImportacao> {
  const total: ResultadoDaImportacao = {
    formularios: 0,
    criados: 0,
    repetidos: 0,
    recusados: 0,
  }

  const formularios = await listarFormulariosDaPagina({
    pageId: entrada.pageId,
    token: entrada.token,
  })

  for (const formulario of formularios) {
    /*
     * Formulário sem lead nenhum não gasta chamada. Importa mais do que parece:
     * o limite da Meta é proporcional ao volume de leads da Página, então uma
     * conta nova — que é justamente quem está importando — tem teto baixo.
     */
    if (formulario.leads === 0) continue

    const busca = await listarLeadsDoFormulario({
      formId: formulario.id,
      token: entrada.token,
      desde: entrada.desde,
    })

    if (!busca.ok) {
      await alertar(
        'não deu para importar um formulário',
        `${busca.erro.mensagem} (formulário ${formulario.id})`,
        {},
      )
      continue
    }

    total.formularios += 1
    if (busca.leads.length === 0) continue

    /*
     * Anota o formulário para a reconciliação diária passar a cuidar dele.
     * Importar é o primeiro contato com esse formulário — se não anotar aqui,
     * a rede de segurança só passaria a cobri-lo depois do primeiro lead novo.
     */
    await anotarFormulario({
      clienteId: entrada.clienteId,
      pageId: entrada.pageId,
      formId: formulario.id,
    }).catch(() => {})

    const r = await receberLeadsDoFormulario({
      clienteId: entrada.clienteId,
      avisos: busca.leads.map((lead) => ({
        leadgenId: lead.id,
        formId: formulario.id,
        adId: lead.adId,
        pageId: entrada.pageId,
      })),
      token: entrada.token,
    })

    total.criados += r.criados
    total.repetidos += r.repetidos
    total.recusados += r.recusados
  }

  return total
}
