'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fluxoSchema } from '@/core/flow/schema'
import type { Problema } from '@/core/flow/validar'
import { db } from './db'
import { fluxoNovo } from '@/core/flow/novo'
import { triagem } from '@/exemplos/triagem'
import { atualizarCadastro, atualizarContexto, atualizarLogo, criarCliente } from './repos/clientes'
import { canalCloudApi } from '@/channels/cloud-api'
import { dentroDaJanela } from '@/channels/janela'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import {
  contextoDeResposta,
  criarCanal,
  confirmarEntrega,
  definirStatusDaSessao,
  desconectarNumero,
  encerrarAtendimento,
  alterarAutomacaoDoContato,
  registrarSaida,
} from './repos/conversas'
import { travarContato } from './repos/travas'
import {
  acharVersaoDoFluxo,
  apagarFluxo,
  criarFluxo,
  definirIa,
  publicar,
  salvarRascunho,
} from './repos/fluxos'
import { apagarConexao, criarConexao, trocarValor } from './repos/conexoes'
import { apagarContato } from './repos/retencao'
import { apagarRespostaRapida, criarRespostaRapida } from './repos/respostas-rapidas'

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
export async function acaoSalvarRascunho(fluxoId: string, clienteId: string, grafo: unknown) {
  const analise = fluxoSchema.safeParse(grafo)
  if (!analise.success) {
    return { ok: false as const, erro: 'o desenho chegou com formato inválido' }
  }

  await salvarRascunho(fluxoId, clienteId, analise.data)
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
  const resultado = await publicar(fluxoId, clienteId, grafo)

  if (resultado.ok) {
    revalidatePath(`/clientes/${clienteId}`)
    return {
      ok: true as const,
      id: resultado.versao.id,
      versao: resultado.versao.versao,
      publicadoEm: resultado.versao.publicadoEm,
    }
  }

  return { ok: false as const, erros: resultado.erros }
}

/**
 * Volta o desenho para uma versão antiga.
 *
 * **Voltar publica de novo; não aponta de volta.** Apontar `versao_publicada_id`
 * para uma linha antiga deixaria buracos na numeração e faria "o que está no ar"
 * ter duas respostas. Aqui a v2 vira a v5: o histórico só cresce, nunca se
 * reescreve, e quem já estava conversando termina na versão em que começou.
 *
 * Passa pelo mesmo `publicar()` de propósito. Uma versão antiga pode ter ficado
 * inválida depois de publicada — a conexão que ela usa foi apagada, a IA foi
 * descontratada, o contexto do negócio sumiu. Republicar sem revalidar poria no
 * ar um fluxo que o editor recusaria hoje.
 */
export async function acaoVoltarParaVersao(fluxoId: string, clienteId: string, versaoId: string) {
  const antiga = await acharVersaoDoFluxo(versaoId, fluxoId)
  if (!antiga) {
    return {
      ok: false as const,
      erros: [
        { codigo: 'VERSAO_SUMIU', mensagem: 'Esta versão não existe nesta automação.' },
      ] satisfies Problema[],
    }
  }

  const resultado = await publicar(fluxoId, clienteId, antiga.grafo)
  if (!resultado.ok) return { ok: false as const, erros: resultado.erros }

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath(`/clientes/${clienteId}/fluxos/${fluxoId}`)
  return {
    ok: true as const,
    id: resultado.versao.id,
    versao: resultado.versao.versao,
    publicadoEm: resultado.versao.publicadoEm,
    grafo: resultado.versao.grafo,
    voltouDe: antiga.versao,
  }
}

export async function acaoConectarNumero(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const phoneNumberId = String(formData.get('phoneNumberId') ?? '').trim()
  const flowId = String(formData.get('flowId') ?? '').trim()
  if (phoneNumberId === '') return { erro: 'cole a identificação do número' }

  // Número já conectado dispara o `unique` do banco. Sem tratar, virava a tela
  // de "alguma coisa quebrou" para um erro que é só "esse já está aí".
  try {
    await criarCanal({ clienteId, phoneNumberId, flowId: flowId === '' ? null : flowId })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : ''
    return {
      erro: /duplicate key|23505/.test(mensagem)
        ? 'este número já está conectado a algum cliente'
        : mensagem || 'não deu para conectar',
    }
  }

  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

/** Tira um número do cliente. Ver `desconectarNumero` sobre o que ele recusa. */
export async function acaoDesconectarNumero(
  clienteId: string,
  canalId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const r = await desconectarNumero(clienteId, canalId)
  revalidatePath(`/clientes/${clienteId}`)
  return r.ok ? { ok: true } : { ok: false, erro: r.motivo }
}

/** Apaga uma automação. Ver `apagarFluxo` sobre o que ele recusa. */
export async function acaoApagarFluxo(
  clienteId: string,
  fluxoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const r = await apagarFluxo(clienteId, fluxoId)
  revalidatePath(`/clientes/${clienteId}`)
  return r.ok ? { ok: true } : { ok: false, erro: r.motivo }
}

/**
 * Liga/desliga a IA de uma automação já criada.
 *
 * Não republica nada de propósito: o que está no ar continua no ar. Desligar a
 * IA de um fluxo publicado que usa nó de IA só impede a **próxima** publicação
 * — mexer no que já roda no WhatsApp de alguém tem que ser um ato deliberado.
 */
export async function acaoAlternarIa(fluxoId: string, clienteId: string, habilitada: boolean) {
  await definirIa(fluxoId, clienteId, habilitada)
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

/** O maior texto que a Cloud API aceita numa mensagem. */
const LIMITE_DA_MENSAGEM = 4096

const respostaRapidaSchema = z.object({
  atalho: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, 'use até 40 letras minúsculas, números, _ ou -'),
  texto: z.string().trim().min(1, 'escreva a mensagem').max(LIMITE_DA_MENSAGEM),
})

/** Cria uma frase reutilizável no Inbox, sempre no cliente atual. */
export async function acaoCriarRespostaRapida(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const resultado = respostaRapidaSchema.safeParse({
    atalho: String(formData.get('atalho') ?? ''),
    texto: String(formData.get('texto') ?? ''),
  })
  if (!resultado.success) return { erro: resultado.error.issues[0]?.message ?? 'resposta inválida' }

  try {
    await criarRespostaRapida(clienteId, resultado.data)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para criar a resposta rápida' }
  }

  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/ajustes`)
  revalidatePath(`/clientes/${clienteId}/ajustes/respostas-rapidas`)
  return { ok: true }
}

export async function acaoApagarRespostaRapida(
  clienteId: string,
  respostaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const apagou = await apagarRespostaRapida(respostaId, clienteId)
    if (!apagou) return { ok: false, erro: 'esta resposta não existe neste cliente' }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para apagar' }
  }

  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/ajustes`)
  revalidatePath(`/clientes/${clienteId}/ajustes/respostas-rapidas`)
  return { ok: true }
}

/**
 * Responder o lead pelo painel.
 *
 * Até aqui, o handoff era um beco: o bot calava, a tela avisava que alguém
 * precisava assumir, e assumir tinha que acontecer fora do sistema. Como o
 * número roda na Cloud API, o celular do cliente não é caixa de entrada — não
 * existia lugar nenhum de onde responder.
 *
 * **Responder daqui assume a conversa.** A sessão vai para `humano`, e o bot
 * para de falar com aquela pessoa até alguém clicar em "Já atendi". Duas bocas
 * na mesma conversa é pior do que uma só, e entre calar o bot e calar a pessoa,
 * cala o bot.
 *
 * A janela de 24h é conferida **aqui**, e não só na tela: a tela desabilita o
 * campo por conveniência, mas quem garante é o servidor — mesma postura de
 * `publicar()` e de `efeitos/rede.ts`.
 */
export async function acaoResponderLead(
  clienteId: string,
  contatoId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  const texto = String(formData.get('texto') ?? '').trim()
  if (texto === '') return { ok: false, erro: 'escreva a mensagem antes de enviar' }
  if (texto.length > LIMITE_DA_MENSAGEM) {
    return {
      ok: false,
      erro: `o WhatsApp aceita no máximo ${LIMITE_DA_MENSAGEM} caracteres, e esta tem ${texto.length}`,
    }
  }

  // A ordem importa: primeiro o que é sobre esta conversa, depois o que é sobre
  // o servidor. Dizer "falta WHATSAPP_TOKEN" para quem esbarrou na janela de
  // 24h manda a pessoa investigar a caixa errada.
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }

  if (!dentroDaJanela(contexto.ultimaEntradaEm)) {
    return {
      ok: false,
      erro: contexto.ultimaEntradaEm
        ? 'passaram mais de 24h desde a última mensagem dela, e o WhatsApp só deixa retomar por um modelo aprovado'
        : 'esta pessoa nunca escreveu, e o WhatsApp não deixa começar a conversa com texto livre',
    }
  }

  const token = process.env.WHATSAPP_TOKEN
  if (!token) return { ok: false, erro: 'falta WHATSAPP_TOKEN no ambiente deste servidor' }

  const canal = canalCloudApi({ phoneNumberId: contexto.canal.phoneNumberId, token })

  // Grava antes para não perder do histórico uma mensagem que saiu no instante
  // em que a função morreu. Enquanto a API não confirmar, a tela a marca como
  // envio não confirmado — ela nunca a apresenta como entregue por certeza.
  const registro = await registrarSaida({ contatoId, sessaoId: contexto.sessaoId, texto })

  try {
    await canal.enviarTexto(contexto.waId, texto)
  } catch (erro) {
    // O texto da Meta é específico e é ele que resolve. Engolir aqui devolveria
    // "não deu certo" para quem precisa saber que o token expirou.
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para enviar' }
  }

  await confirmarEntrega(registro)

  // Só o status: o que a conversa já coletou continua na sessão, e é ele que
  // volta a valer se o bot reassumir depois do "Já atendi".
  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
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
  revalidatePath(`/clientes/${clienteId}/inbox`)
}

/** Pausa ou religa o motor sem transformar a pausa em um handoff fictício. */
export async function acaoAlternarAutomacaoDoLead(
  clienteId: string,
  contatoId: string,
  ativa: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  if (!z.string().uuid().safeParse(clienteId).success || !z.string().uuid().safeParse(contatoId).success) {
    return { ok: false, erro: 'contato inválido' }
  }
  if (typeof ativa !== 'boolean') return { ok: false, erro: 'estado da automação inválido' }

  const destravar = await travarContato(contatoId)
  if (!destravar) return { ok: false, erro: 'a conversa está ocupada; tente novamente em instantes' }

  try {
    const resultado = await alterarAutomacaoDoContato(clienteId, contatoId, ativa)
    if (!resultado.ok) {
      return {
        ok: false,
        erro:
          resultado.motivo === 'handoff_aberto'
            ? 'esta conversa ainda aguarda uma pessoa; conclua o atendimento antes de religar o bot'
            : 'este contato não existe neste cliente',
      }
    }
  } finally {
    await destravar()
  }

  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
}

/**
 * Apaga um contato e tudo que veio com ele.
 *
 * É o pedido de exclusão da LGPD virando botão. Não existe arquivamento por
 * baixo: `contacts` cascateia sessão, mensagem, handoff e trava, e não há cópia
 * do histórico em outro lugar. A tela precisa dizer isso **antes** de perguntar
 * — desfazer não é uma opção que exista aqui.
 */
export async function acaoApagarContato(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (
    !z.string().uuid().safeParse(clienteId).success ||
    !z.string().uuid().safeParse(contatoId).success
  ) {
    return { ok: false, erro: 'contato inválido' }
  }

  const apagou = await apagarContato(clienteId, contatoId)
  if (!apagou) return { ok: false, erro: 'este contato não existe neste cliente' }

  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}`)
  redirect(`/clientes/${clienteId}/leads`)
}

/**
 * Salva o que a IA pode dizer sobre o negócio. Ver `contexto/page.tsx`.
 *
 * Devolve estado em vez de não devolver nada: este campo é a única fonte de
 * verdade da IA, e salvar em silêncio deixa quem escreveu sem saber se gravou.
 */
export async function acaoSalvarContexto(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  try {
    await atualizarContexto(clienteId, String(formData.get('contexto') ?? ''))
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para salvar' }
  }

  revalidatePath(`/clientes/${clienteId}/contexto`)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

/**
 * Salva a ficha do cliente. Ver `clientes/[clienteId]/page.tsx`.
 *
 * Devolve estado, como o contexto: formulário que grava em silêncio deixa quem
 * digitou sem saber se pegou — e nome de cliente é o tipo de campo que a pessoa
 * corrige, sai da tela e volta para conferir.
 */
export async function acaoSalvarCadastro(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return { erro: 'O cliente precisa de um nome.' }

  try {
    await atualizarCadastro(clienteId, {
      nome,
      responsavel: String(formData.get('responsavel') ?? ''),
      telefone: String(formData.get('telefone') ?? ''),
      email: String(formData.get('email') ?? ''),
      cnpj: String(formData.get('cnpj') ?? ''),
      observacoes: String(formData.get('observacoes') ?? ''),
    })
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para salvar' }
  }

  // A lista de clientes e o cabeçalho de toda tela deste cliente mostram o
  // nome: revalidar só esta página deixaria o nome antigo no menu ao lado.
  revalidatePath('/')
  revalidatePath(`/clientes/${clienteId}`, 'layout')
  return { ok: true }
}

/** Tamanho e tipos que o bucket `logos` aceita. Repetidos aqui para o erro
 *  chegar em português na tela em vez de vir cru do storage. */
const LIMITE_LOGO = 512 * 1024
const TIPOS_DE_LOGO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * Guarda a logo do cliente e aponta a linha para ela.
 *
 * O arquivo vai para um bucket público — logo de empresa é identidade, não
 * segredo, e URL assinada exigiria assinar de novo a cada linha da lista de
 * clientes sem proteger nada que já não esteja no site do cliente.
 *
 * O nome no bucket é o id do cliente, então trocar a logo sobrescreve em vez de
 * acumular arquivo órfão. Como o endereço não muda, ele ganha `?v=` com o
 * instante — sem isso o navegador continuaria mostrando a logo antiga.
 */
export async function acaoSalvarLogo(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const arquivo = formData.get('logo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha uma imagem.' }
  }

  const extensao = TIPOS_DE_LOGO[arquivo.type]
  if (!extensao) return { erro: 'A logo precisa ser PNG, JPG ou WebP.' }
  if (arquivo.size > LIMITE_LOGO) {
    return { erro: `A imagem tem ${Math.round(arquivo.size / 1024)} KB. O limite é 512 KB.` }
  }

  try {
    const caminho = `${clienteId}.${extensao}`
    const { error } = await db()
      .storage.from('logos')
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true })

    if (error) throw new Error(error.message)

    const { data } = db().storage.from('logos').getPublicUrl(caminho)
    await atualizarLogo(clienteId, `${data.publicUrl}?v=${Date.now()}`)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para guardar a logo' }
  }

  revalidatePath('/')
  revalidatePath(`/clientes/${clienteId}`, 'layout')
  return { ok: true }
}

/** Tira a logo e volta para as iniciais. O arquivo fica — trocar depois sobrescreve. */
export async function acaoRemoverLogo(clienteId: string) {
  await atualizarLogo(clienteId, '')
  revalidatePath('/')
  revalidatePath(`/clientes/${clienteId}`, 'layout')
}
