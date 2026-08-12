'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fluxoSchema } from '@/core/flow/schema'
import { fluxoNovo } from '@/core/flow/novo'
import { triagem } from '@/exemplos/triagem'
import { atualizarContexto, criarCliente } from './repos/clientes'
import { criarCanal, encerrarAtendimento } from './repos/conversas'
import { criarFluxo, definirIa, publicar, salvarRascunho } from './repos/fluxos'
import { apagarConexao, criarConexao, trocarValor } from './repos/conexoes'

export async function acaoCriarCliente(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return

  const cliente = await criarCliente(nome)
  revalidatePath('/')
  redirect(`/clientes/${cliente.id}`)
}

/**
 * Atalho para a tela vazia: cria um cliente já com o fluxo de exemplo dentro,
 * para dar o que explorar sem ninguém precisar desenhar nada antes.
 */
export async function acaoCriarExemplo() {
  const cliente = await criarCliente('Estúdio de exemplo')
  await criarFluxo(cliente.id, 'Triagem de orçamento', triagem)
  revalidatePath('/')
  redirect(`/clientes/${cliente.id}`)
}

/**
 * Salva o desenho. Chamada pelo editor a cada pausa na digitação.
 *
 * Aceita rascunho incompleto de propósito: mensagem sem texto, opção sem
 * rótulo. O que impede de ir ao ar é o `validar()`, não o salvar — senão o
 * editor perderia trabalho toda vez que alguém parasse no meio de uma frase.
 * O `fluxoSchema.parse` aqui é a garantia de que a *estrutura* está sã.
 */
export async function acaoSalvarRascunho(fluxoId: string, grafo: unknown) {
  const analise = fluxoSchema.safeParse(grafo)
  if (!analise.success) {
    return { ok: false as const, erro: 'o desenho chegou com formato inválido' }
  }

  await salvarRascunho(fluxoId, analise.data)
  return { ok: true as const }
}

/**
 * A pergunta "tem IA?" é feita **aqui**, ao criar a automação, e não no
 * cadastro do cliente: é a automação que se vende com ou sem IA.
 */
export async function acaoCriarFluxo(clienteId: string, formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return

  const comIa = formData.get('ia') === 'on'

  // Nasce válido de propósito — ver core/flow/novo.ts.
  const fluxo = await criarFluxo(clienteId, nome, fluxoNovo(), comIa)
  revalidatePath(`/clientes/${clienteId}`)
  redirect(`/clientes/${clienteId}/fluxos/${fluxo.id}`)
}

/**
 * Publica o que está na tela.
 *
 * A checagem de verdade mora no repo (`publicar`), não aqui e muito menos no
 * botão desabilitado: um fluxo sem saída para humano tem que ser recusado
 * mesmo que a chamada venha de outro lugar.
 */
export async function acaoPublicar(fluxoId: string, clienteId: string, grafo: unknown) {
  const resultado = await publicar(fluxoId, grafo)

  if (resultado.ok) {
    revalidatePath(`/clientes/${clienteId}`)
    return {
      ok: true as const,
      versao: resultado.versao.versao,
      publicadoEm: resultado.versao.publicadoEm,
    }
  }

  return { ok: false as const, erros: resultado.erros }
}

export async function acaoConectarNumero(clienteId: string, formData: FormData) {
  const phoneNumberId = String(formData.get('phoneNumberId') ?? '').trim()
  const flowId = String(formData.get('flowId') ?? '').trim()
  if (phoneNumberId === '') return

  await criarCanal({ clienteId, phoneNumberId, flowId: flowId === '' ? null : flowId })
  revalidatePath(`/clientes/${clienteId}`)
}

/**
 * Liga/desliga a IA de uma automação já criada.
 *
 * Não republica nada de propósito: o que está no ar continua no ar. Desligar a
 * IA de um fluxo publicado que usa nó de IA só impede a **próxima** publicação
 * — mexer no que já roda no WhatsApp de alguém tem que ser um ato deliberado.
 */
export async function acaoAlternarIa(fluxoId: string, clienteId: string, habilitada: boolean) {
  await definirIa(fluxoId, habilitada)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true as const, iaHabilitada: habilitada }
}

/**
 * Cadastra uma credencial de um cliente.
 *
 * O valor entra por aqui, vai para o cofre, e **nunca mais volta para a tela**.
 * Trocar significa gravar de novo — não existe "ver o token atual", porque o
 * único jeito de garantir que ele não vaza pela interface é a interface não
 * ter como pedir.
 */
export async function acaoCriarConexao(
  clienteId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  const tipo = String(formData.get('tipo') ?? 'bearer')
  if (tipo !== 'bearer' && tipo !== 'cabecalho' && tipo !== 'query') {
    return { ok: false, erro: 'tipo de credencial inválido' }
  }

  // Deixar estourar daria o digest opaco do Next, e a pessoa perderia a chave
  // que acabou de colar. Erro de preenchimento vira frase.
  try {
    await criarConexao({
      clienteId,
      nome: String(formData.get('nome') ?? ''),
      tipo,
      campo: String(formData.get('campo') ?? ''),
      valor: String(formData.get('valor') ?? ''),
    })
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para guardar' }
  }

  revalidatePath(`/clientes/${clienteId}/conexoes`)
  return { ok: true }
}

/** Rotação: troca o valor mantendo o id, então nenhum fluxo precisa republicar. */
export async function acaoTrocarValorDaConexao(
  clienteId: string,
  conexaoId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await trocarValor(conexaoId, clienteId, String(formData.get('valor') ?? ''))
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para trocar' }
  }
  revalidatePath(`/clientes/${clienteId}/conexoes`)
  return { ok: true }
}

export async function acaoApagarConexao(clienteId: string, conexaoId: string) {
  await apagarConexao(conexaoId, clienteId)
  revalidatePath(`/clientes/${clienteId}/conexoes`)
}

/**
 * "Já falei com essa pessoa."
 *
 * Tira o lead da fila de quem espera e devolve o contato ao bot na próxima
 * mensagem. É o botão que faltava: sem ele, todo lead que passou por handoff
 * ficava vermelho para sempre e a tela perdia o sentido no segundo dia.
 */
export async function acaoEncerrarAtendimento(clienteId: string, contatoId: string) {
  await encerrarAtendimento(clienteId, contatoId)
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
}

/** Salva o que a IA pode dizer sobre o negócio. Ver `contexto/page.tsx`. */
export async function acaoSalvarContexto(clienteId: string, formData: FormData) {
  await atualizarContexto(clienteId, String(formData.get('contexto') ?? ''))
  revalidatePath(`/clientes/${clienteId}/contexto`)
  revalidatePath(`/clientes/${clienteId}`)
}
