'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fluxoSchema } from '@/core/flow/schema'
import type { Problema } from '@/core/flow/validar'
import { db } from './db'
import { exigirAcessoAoCliente, exigirOperadorDa4YU } from './sessao'
import { fluxoNovo } from '@/core/flow/novo'
import { DIAS_DA_SEMANA, emMinutos, horarioSchema } from '@/core/horario'
import { triagem } from '@/exemplos/triagem'
import {
  apagarCliente,
  atualizarCadastro,
  atualizarContexto,
  atualizarHorario,
  atualizarLogo,
  criarCliente,
} from './repos/clientes'
import {
  apagarDoAcervo,
  guardarNoAcervo,
  LIMITE_DO_ARQUIVO,
  TIPOS_ACEITOS,
} from './repos/acervo'
import { acharColunas, conciliar, lerCsv } from '@/core/contatos/planilha'
import {
  aplicarImportacao,
  contatosConhecidos,
  corrigirNome,
  salvarNotas,
} from './repos/leads'
import { canalCloudApi } from '@/channels/cloud-api'
import { dentroDaJanela } from '@/channels/janela'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import {
  atribuirContato,
  contextoDeResposta,
  criarCanal,
  confirmarEntrega,
  definirFluxosDoNumero,
  definirStatusDaSessao,
  desconectarNumero,
  encerrarAtendimento,
  alterarAutomacaoDoContato,
  registrarSaida,
} from './repos/conversas'
import { travarContato } from './repos/travas'
import { membrosDaConta } from './repos/usuarios'
import { sessaoAtual } from './sessao'
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
import { alternarGatilho, apagarGatilho, criarGatilho } from './repos/gatilhos'
import { OPERADORES_DE_GATILHO, type OperadorDeGatilho } from '@/core/gatilhos'
import { rodarPosAtendimento } from './receber-mensagem'
import { PAPEIS_DO_NUMERO, type PapelDoNumero } from '@/core/papeis-do-numero'

/**
 * **Toda ação deste arquivo confere quem é antes de tocar em qualquer coisa.**
 *
 * A que recebe `clienteId` chama `exigirAcessoAoCliente`; a que cria cliente
 * chama `exigirOperadorDa4YU`. Não é redundância com o `proxy.ts`: Server
 * Action é um POST na rota onde ela é usada, o `clienteId` chega do formulário,
 * e nada impede alguém de postar o id de outro cliente. Enquanto havia uma
 * senha só isso era inofensivo — quem entrava já podia tudo. Com login por
 * usuário, é escalada de privilégio.
 *
 * `src/server/acoes.test.ts` recusa ação nova que esqueça a linha. Vinte e sete
 * repetições é exatamente onde a vigésima oitava fica de fora.
 */
export async function acaoCriarCliente(formData: FormData) {
  await exigirOperadorDa4YU()

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
  await exigirOperadorDa4YU()

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

  const r = await desconectarNumero(clienteId, canalId)
  revalidatePath(`/clientes/${clienteId}`)
  return r.ok ? { ok: true } : { ok: false, erro: r.motivo }
}

/** Apaga uma automação. Ver `apagarFluxo` sobre o que ele recusa. */
export async function acaoApagarFluxo(
  clienteId: string,
  fluxoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

  await definirIa(fluxoId, clienteId, habilitada)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true as const, iaHabilitada: habilitada }
}

/**
 * Troca os fluxos que um número executa — os quatro papéis de uma vez (A6).
 *
 * Campo em branco significa "sem fluxo neste papel", e não "não mexa": a tela
 * manda os quatro sempre, então tirar um fluxo é escolher a opção vazia. Um
 * formulário que ignorasse o vazio não teria como desfazer uma configuração.
 */
export async function acaoDefinirFluxosDoNumero(
  clienteId: string,
  canalId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const fluxos: Partial<Record<PapelDoNumero, string | null>> = {}
  for (const papel of PAPEIS_DO_NUMERO) {
    const valor = String(formData.get(papel) ?? '').trim()
    fluxos[papel] = valor === '' ? null : valor
  }

  const r = await definirFluxosDoNumero(clienteId, canalId, fluxos)
  if (!r.ok) return { erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/numero`)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

/** Cadastra uma palavra-chave que abre um fluxo. */
export async function acaoCriarGatilho(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const frase = String(formData.get('frase') ?? '').trim()
  const operadorPedido = String(formData.get('operador') ?? 'contem')
  const fluxoId = String(formData.get('fluxoId') ?? '').trim()

  if (frase === '') return { erro: 'escreva a palavra ou frase' }
  if (fluxoId === '') return { erro: 'escolha para qual fluxo esta palavra leva' }
  // O operador chega de um formulário e o banco tem `check`, mas o erro do
  // banco chegaria na tela como "alguma coisa quebrou". Recusar aqui devolve a
  // frase certa para quem está olhando.
  if (!(OPERADORES_DE_GATILHO as readonly string[]).includes(operadorPedido)) {
    return { erro: 'operador inválido' }
  }

  const r = await criarGatilho(clienteId, {
    frase,
    operador: operadorPedido as OperadorDeGatilho,
    fluxoId,
  })
  if (!r.ok) return { erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return { ok: true }
}

/** Liga/desliga sem apagar — a contagem de execuções é o histórico dele. */
export async function acaoAlternarGatilho(
  clienteId: string,
  gatilhoId: string,
  ativo: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const mudou = await alternarGatilho(clienteId, gatilhoId, ativo)
  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return mudou ? { ok: true } : { ok: false, erro: 'este gatilho não existe mais' }
}

export async function acaoApagarGatilho(
  clienteId: string,
  gatilhoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const apagou = await apagarGatilho(clienteId, gatilhoId)
  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return apagou ? { ok: true } : { ok: false, erro: 'este gatilho não existe mais' }
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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

  try {
    await trocarValor(conexaoId, clienteId, String(formData.get('valor') ?? ''))
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para trocar' }
  }
  revalidatePath(`/clientes/${clienteId}/conexoes`)
  return { ok: true }
}

export async function acaoApagarConexao(clienteId: string, conexaoId: string) {
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

  await encerrarAtendimento(clienteId, contatoId)

  // O quarto papel do número (A6). Vem **depois** de encerrar, e nunca antes:
  // encerrar é o que tira a pessoa da fila, e é a única coisa aqui que não pode
  // deixar de acontecer. O fluxo de pós-atendimento engole os próprios erros
  // pelo mesmo motivo — ver `rodarPosAtendimento`.
  await rodarPosAtendimento(clienteId, contatoId)

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
  await exigirAcessoAoCliente(clienteId)

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
 * Apaga o cliente inteiro.
 *
 * A confirmação por digitação mora na tela — ver `components/cliente/apagar.tsx`
 * sobre por que ela não é um `confirm()`. Aqui não há segunda checagem do que
 * foi digitado de propósito: repetir a comparação no servidor daria a impressão
 * de que ela é uma trava de segurança, e não é. Quem alcança esta ação já tem a
 * sessão do painel, e com ela já podia apagar tudo item por item. A confirmação
 * protege contra engano, não contra intruso.
 */
export async function acaoApagarCliente(clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  if (!z.string().uuid().safeParse(clienteId).success) {
    return { ok: false, erro: 'cliente inválido' }
  }

  const apagou = await apagarCliente(clienteId)
  if (!apagou) return { ok: false, erro: 'este cliente não existe mais' }

  revalidatePath('/')
  redirect('/')
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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

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
  await exigirAcessoAoCliente(clienteId)

  await atualizarLogo(clienteId, '')
  revalidatePath('/')
  revalidatePath(`/clientes/${clienteId}`, 'layout')
}

/**
 * Sobe um arquivo para o acervo do cliente.
 *
 * O acervo existe porque o bloco de mídia sozinho era metade de uma
 * funcionalidade: ele pede uma URL `https://`, e quem desenha o fluxo do
 * estúdio não tem onde hospedar a foto da sala.
 */
export async function acaoSubirParaAcervo(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha um arquivo.' }
  }

  if (!TIPOS_ACEITOS[arquivo.type]) {
    return { erro: 'O WhatsApp não envia este tipo. Use imagem, MP4, MP3, OGG ou PDF.' }
  }
  if (arquivo.size > LIMITE_DO_ARQUIVO) {
    // O teto é da Cloud API, não nosso: aceitar mais seria guardar arquivo que
    // a Meta recusaria na hora de entregar, e o erro apareceria na conversa de
    // um cliente em vez de aqui.
    return {
      erro: `O arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O WhatsApp aceita até 16 MB.`,
    }
  }

  try {
    await guardarNoAcervo(clienteId, arquivo)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para guardar o arquivo' }
  }

  revalidatePath(`/clientes/${clienteId}/acervo`)
  return { ok: true }
}

/**
 * Tira um arquivo do acervo.
 *
 * **Não confere se algum fluxo aponta para ele, e isso é escolha.** Conferir
 * exigiria varrer o rascunho e todas as versões publicadas de todos os fluxos a
 * cada exclusão, e ainda assim uma versão antiga poderia apontar para o arquivo.
 * A tela avisa; a decisão é de quem apaga.
 */
export async function acaoApagarDoAcervo(
  clienteId: string,
  caminho: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  try {
    await apagarDoAcervo(clienteId, caminho)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para apagar' }
  }
  revalidatePath(`/clientes/${clienteId}/acervo`)
  return { ok: true }
}

/**
 * Corrige o nome do contato.
 *
 * Vai para `nome_real` e não para `nome`: o do perfil continua sendo o que a
 * Meta manda, e é ele que identifica a conta do WhatsApp quando a pessoa troca
 * de número. Vazio limpa a correção e devolve a exibição para o perfil.
 */
export async function acaoCorrigirNome(
  clienteId: string,
  contatoId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const nome = String(formData.get('nome') ?? '')
  const ok = await corrigirNome(clienteId, contatoId, nome)
  if (!ok) return { erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
}

export async function acaoSalvarNotas(
  clienteId: string,
  contatoId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const notas = String(formData.get('notas') ?? '')
  const ok = await salvarNotas(clienteId, contatoId, notas)
  if (!ok) return { erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/**
 * Importa a planilha de contatos do cliente.
 *
 * Faz tudo numa passada — ler, conciliar e aplicar — em vez de uma prévia com
 * confirmação depois. A prévia seria melhor e custaria guardar o arquivo entre
 * duas requisições; o resultado devolvido cobre a mesma necessidade, porque
 * **nada aqui é destrutivo**: renomear é reversível apagando o campo, criar
 * contato é reversível apagando o contato, e pendência não escreve nada.
 */
export async function acaoImportarContatos(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar & { resumo?: string; pendentes?: string[] }> {
  await exigirAcessoAoCliente(clienteId)

  const arquivo = formData.get('planilha')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo CSV.' }
  if (arquivo.size > 4 * 1024 * 1024) return { erro: 'O arquivo passa de 4 MB.' }

  const { cabecalho, linhas } = lerCsv(await arquivo.text())
  const colunas = acharColunas(cabecalho)

  if (colunas.telefone === -1) {
    return {
      erro: `Não achei a coluna do telefone. O cabeçalho tem: ${cabecalho.join(', ') || '(vazio)'}. Renomeie uma coluna para "Telefone".`,
    }
  }
  if (linhas.length === 0) return { erro: 'A planilha não tem nenhuma linha além do cabeçalho.' }

  const daPlanilha = linhas.map((celulas, i) => ({
    // +2: a primeira linha do arquivo é o cabeçalho e o editor conta de 1.
    numero: i + 2,
    nome: colunas.nome === -1 ? '' : (celulas[colunas.nome] ?? '').trim(),
    telefone: (celulas[colunas.telefone] ?? '').trim(),
  }))

  const conciliacoes = conciliar(daPlanilha, await contatosConhecidos(clienteId))
  const resultado = await aplicarImportacao(clienteId, conciliacoes)

  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/inbox`)

  const partes = [
    `${daPlanilha.length} ${daPlanilha.length === 1 ? 'linha lida' : 'linhas lidas'}`,
    `${resultado.renomeados} ${resultado.renomeados === 1 ? 'nome corrigido' : 'nomes corrigidos'}`,
    `${resultado.criados} ${resultado.criados === 1 ? 'contato novo' : 'contatos novos'}`,
  ]
  if (resultado.pendentes.length > 0) {
    partes.push(`${resultado.pendentes.length} sem importar`)
  }

  return {
    ok: true,
    resumo: partes.join(' · '),
    // As pendências voltam com o número da linha para a pessoa consertar na
    // planilha dela. Sem isso, "40 sem importar" não diz quais.
    pendentes: resultado.pendentes.map(
      (p) => `linha ${p.numero}${p.nome ? ` (${p.nome})` : ''} — ${p.motivo}`,
    ),
  }
}

/**
 * Grava o expediente do atendimento humano.
 *
 * O formulário manda o objeto inteiro como JSON num campo só: são sete dias com
 * quantas faixas quiserem, e um campo por faixa por dia seria trinta nomes
 * calculados que o servidor teria que remontar do outro lado.
 *
 * **Campo vazio volta a "atende sempre"**, que é o que `null` significa na
 * coluna — e não "nunca atende". Confundir os dois faria o bot anunciar que
 * está fechado para quem só quis desligar a regra.
 */
export async function acaoSalvarHorario(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const bruto = String(formData.get('horario') ?? '').trim()

  if (bruto === '') {
    await atualizarHorario(clienteId, null)
    revalidatePath(`/clientes/${clienteId}`)
    return { ok: true }
  }

  let analise
  try {
    analise = horarioSchema.safeParse(JSON.parse(bruto))
  } catch {
    return { erro: 'o horário chegou com formato inválido' }
  }
  if (!analise.success) return { erro: 'o horário chegou com formato inválido' }

  /**
   * Faixa invertida é recusada aqui, e não ignorada em silêncio.
   *
   * O motor já a ignora — ele fecha o atendimento em vez de abrir —, mas
   * deixar salvar entrega uma tela que mostra "18:00 até 08:00" como se
   * valesse. O erro tem que aparecer onde a pessoa consegue consertar.
   */
  for (const [dia, faixas] of analise.data.dias.entries()) {
    for (const faixa of faixas) {
      const de = emMinutos(faixa.de)
      const ate = emMinutos(faixa.ate)
      if (de === null || ate === null || ate <= de) {
        return {
          erro: `${DIAS_DA_SEMANA[dia]}: "${faixa.de} até ${faixa.ate}" não é um horário válido.`,
        }
      }
    }
  }

  await atualizarHorario(clienteId, analise.data)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

/**
 * "Assumir" — o botão que faltava para alguém **virar** atendente.
 *
 * A pergunta do dono era essa: *"como que o atendente vai virar atendente?"*.
 * Até aqui ninguém virava — a sessão ia para `humano`, o bot calava, e a
 * conversa ficava esperando qualquer pessoa. Esperar "qualquer pessoa" é o
 * mesmo que esperar ninguém quando há mais de uma.
 *
 * Assumir não muda o que a pessoa do outro lado vê: é organização interna. Por
 * isso não manda mensagem nenhuma — anunciar no WhatsApp que "a Ana assumiu"
 * seria expor a nossa mesa para quem só quer ser respondido.
 */
export async function acaoAssumirAtendimento(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const sessao = await sessaoAtual()
  if (!sessao) {
    // Acontece de verdade enquanto a senha única existe: não há usuário para
    // assumir. Dizer isso é melhor que um botão que não faz nada.
    return { ok: false, erro: 'entre com a sua conta para assumir uma conversa' }
  }

  const ok = await atribuirContato(clienteId, contatoId, sessao.usuario.id)
  if (!ok) return { ok: false, erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/** Devolve a conversa para a fila de todo mundo. */
export async function acaoLiberarAtendimento(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const ok = await atribuirContato(clienteId, contatoId, null)
  if (!ok) return { ok: false, erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/**
 * Passa a conversa para outra pessoa do time.
 *
 * Existe separado do "assumir" porque os dois casos não têm o mesmo peso:
 * assumir é o de todo dia e tem que ser um clique; passar para alguém é raro,
 * e exige escolher quem. Fundir os dois numa lista só faria o caso comum
 * custar dois cliques.
 *
 * O destino é conferido contra os membros da conta: id que não é da equipe não
 * vira responsável, mesmo vindo de dentro do painel.
 */
export async function acaoAtribuirPara(
  clienteId: string,
  contatoId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const usuarioId = String(formData.get('usuarioId') ?? '')
  if (usuarioId === '') return { ok: false, erro: 'escolha para quem passar' }

  const equipe = await membrosDaConta(clienteId)
  if (!equipe.some((membro) => membro.id === usuarioId)) {
    return { ok: false, erro: 'essa pessoa não atende nesta conta' }
  }

  const ok = await atribuirContato(clienteId, contatoId, usuarioId)
  if (!ok) return { ok: false, erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
}
