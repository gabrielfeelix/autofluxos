'use server'

import { revalidatePath } from 'next/cache'
import { criarTemplateNaMeta, apagarTemplateNaMeta } from '@/channels/templates-api'
import { podeTransmitir } from '@/core/disparo'
import {
  CAMPOS,
  camposUsados,
  exemplosPara,
  nomeAutomatico,
  paraFormatoDaMeta,
} from '@/core/modelos-prontos'
import {
  normalizarNome,
  temErro,
  validarTemplate,
  variaveisDe,
  type Categoria,
  type Componentes,
} from '@/core/templates'
import { coexistenciaDoCliente } from './repos/coexistencia'
import { lerTokenDoCanal, listarCanais } from './repos/conversas'
import {
  apagarTemplate,
  criarRascunho,
  lerTemplate,
  listarTemplates,
  marcarSubmetido,
} from './repos/templates'
import {
  criarTransmissao,
  enfileirarDestinatarios,
  lerTransmissao,
  mudarEstadoDaTransmissao,
  progressoDa,
} from './repos/transmissoes'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * As ações de modelo aprovado e transmissão, em arquivo próprio.
 *
 * Separadas de `acoes.ts` pelo mesmo motivo que o CRM e o agendamento foram:
 * aquele arquivo já passou de 2.500 linhas, e cada bloco novo lá é mais uma
 * chance de dois trabalhos paralelos colidirem no mesmo lugar.
 */

function telas(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/transmissoes`)
}

/**
 * A WABA e o token deste cliente — o par que toda chamada à Meta precisa.
 *
 * Os dois vêm juntos porque separá-los daria dois jeitos de errar: mandar o
 * token de um cliente para a WABA de outro é exatamente o tipo de mistura que
 * um banco compartilhado torna possível.
 */
async function contaNaMeta(
  clienteId: string,
): Promise<{ wabaId: string; token: string } | { erro: string }> {
  const canais = await listarCanais(clienteId)
  const doWhats = canais.find((c) => c.provider !== 'instagram' && c.status === 'ativo')
  if (!doWhats) return { erro: 'Este cliente não tem um número de WhatsApp conectado.' }

  const coexistencia = await coexistenciaDoCliente(clienteId)
  const wabaId = coexistencia[doWhats.id]?.wabaId
  if (!wabaId) {
    return {
      erro: 'Não sabemos a conta do WhatsApp deste cliente na Meta. Refaça a conexão do número.',
    }
  }

  const token = await lerTokenDoCanal(doWhats)
  return { wabaId, token }
}

export type ResultadoDoTemplate = {
  ok: boolean
  erro?: string
  /** Os reparos que não impedem submeter — a pessoa merece vê-los mesmo assim. */
  avisos?: string[]
  templateId?: string
}

/**
 * Cria o modelo aqui e submete à Meta.
 *
 * **São dois passos e não um, de propósito.** O rascunho é gravado antes de
 * falar com a Meta: um timeout no meio não pode apagar o texto que a pessoa
 * escreveu. Se a submissão falhar, o rascunho fica e ela tenta de novo sem
 * redigitar nada.
 */
export async function acaoCriarTemplate(
  clienteId: string,
  dados: {
    nome: string
    idioma?: string
    categoria: Categoria
    componentes: Componentes
    /** Os valores de exemplo de cada variável — a Meta os exige. */
    exemplos?: string[]
  },
): Promise<ResultadoDoTemplate> {
  await exigirAcessoAoCliente(clienteId)

  // Normalizar em vez de recusar: a pessoa escreve o nome pensando em título
  // ("Lembrete de consulta"), e a Meta só aceita minúscula e underscore.
  const nome = normalizarNome(dados.nome)
  const idioma = dados.idioma || 'pt_BR'

  const reparos = validarTemplate(nome, dados.componentes, dados.categoria)
  if (temErro(reparos)) {
    return { ok: false, erro: reparos.find((r) => r.gravidade === 'erro')!.recado }
  }
  const avisos = reparos.filter((r) => r.gravidade === 'aviso').map((r) => r.recado)

  /*
   * O exemplo é conferido aqui e não em `validarTemplate` porque ele não é
   * parte do template: é material para o revisor da Meta. Mas sem ele a recusa
   * vem como INVALID_FORMAT horas depois, então barrar agora economiza um dia.
   */
  const quantasVariaveis = variaveisDe(dados.componentes.corpo ?? '').length
  const exemplos = (dados.exemplos ?? []).filter((e) => e.trim())
  if (quantasVariaveis > 0 && exemplos.length < quantasVariaveis) {
    return {
      ok: false,
      erro: `Preencha um exemplo para cada variável (${quantasVariaveis}). Sem exemplo, a Meta recusa por formato — e a recusa demora horas.`,
    }
  }

  const conta = await contaNaMeta(clienteId)
  if ('erro' in conta) return { ok: false, erro: conta.erro }

  let rascunho
  try {
    rascunho = await criarRascunho({
      clienteId,
      nome,
      idioma,
      categoria: dados.categoria,
      componentes: dados.componentes,
    })
  } catch (erro) {
    // O `unique (cliente_id, nome, idioma)` é a causa quase certa.
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return {
      ok: false,
      erro: detalhe.includes('duplicate')
        ? `Já existe um modelo chamado "${nome}" em ${idioma} para este cliente.`
        : 'Não deu para salvar o modelo.',
    }
  }

  const resposta = await criarTemplateNaMeta({
    wabaId: conta.wabaId,
    token: conta.token,
    nome,
    idioma,
    categoria: dados.categoria,
    componentes: dados.componentes,
    exemplos: { corpo: exemplos },
  })

  if (!resposta.ok) {
    // O rascunho FICA. A pessoa tenta de novo sem redigitar.
    telas(clienteId)
    return {
      ok: false,
      erro: `A Meta recusou: ${resposta.erro.mensagem}`,
      templateId: rascunho.id,
      ...(avisos.length > 0 ? { avisos } : {}),
    }
  }

  await marcarSubmetido(rascunho.id, {
    wabaTemplateId: resposta.template.wabaTemplateId,
    status: resposta.template.status === 'desconhecido' ? 'pendente' : resposta.template.status,
    // A categoria que a META decidiu — ela reclassifica o que julga
    // promocional, e isso muda o preço da mensagem.
    categoria: resposta.template.categoria,
  })

  telas(clienteId)
  return { ok: true, templateId: rascunho.id, ...(avisos.length > 0 ? { avisos } : {}) }
}

/**
 * Cria um modelo a partir do que a pessoa escreveu **em português**.
 *
 * É a ação que a tela nova usa, e ela existe para que o jargão da Meta não
 * chegue a quem escreve: aqui o `{nome}` vira `{{1}}`, os exemplos saem do
 * catálogo de campos, e o nome do template é gerado a partir do título.
 *
 * `acaoCriarTemplate` continua existindo para quem precisa do controle fino
 * (nome próprio, cabeçalho, botões) — mas nenhuma tela a usa hoje.
 */
export async function acaoCriarModelo(
  clienteId: string,
  dados: { titulo: string; corpo: string; categoria: Categoria },
): Promise<ResultadoDoTemplate> {
  await exigirAcessoAoCliente(clienteId)

  const escrito = dados.corpo.trim()
  if (!escrito) return { ok: false, erro: 'Escreva a mensagem.' }

  /*
   * Campo que não existe no catálogo viraria `{{n}}` sem exemplo, e a Meta
   * recusaria por formato horas depois. Melhor recusar agora, dizendo qual.
   */
  const desconhecido = camposUsados(escrito).find(
    (id) => !CAMPOS.some((campo) => campo.id === id),
  )
  if (desconhecido) {
    return {
      ok: false,
      erro: `Não conheço o campo {${desconhecido}}. Use os botões para inserir os campos.`,
    }
  }

  const { corpo, campos } = paraFormatoDaMeta(escrito)

  return acaoCriarTemplate(clienteId, {
    nome: nomeAutomatico(dados.titulo),
    categoria: dados.categoria,
    componentes: { corpo },
    exemplos: exemplosPara(campos),
  })
}

/**
 * Apaga o modelo aqui e na Meta.
 *
 * **Apagar não devolve o nome na hora**: a Meta o segura por 30 dias antes de
 * liberá-lo. Quem apaga por engano fica um mês sem poder recriar com o mesmo
 * nome, e a tela tem que dizer isso antes do clique.
 */
export async function acaoApagarTemplate(
  clienteId: string,
  templateId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const template = await lerTemplate(templateId)
  if (!template || template.clienteId !== clienteId) {
    return { ok: false, erro: 'Este modelo não existe.' }
  }

  if (template.wabaTemplateId) {
    const conta = await contaNaMeta(clienteId)
    if (!('erro' in conta)) {
      const r = await apagarTemplateNaMeta({
        wabaId: conta.wabaId,
        token: conta.token,
        nome: template.nome,
      })
      /*
       * A Meta recusou: não apagamos aqui. Apagar só do nosso lado deixaria um
       * template vivo lá que ninguém mais vê — e o nome preso por 30 dias sem
       * que ninguém saiba por quê.
       */
      if (!r.ok) return { ok: false, erro: `A Meta recusou apagar: ${r.erro.mensagem}` }
    }
  }

  await apagarTemplate(templateId)
  telas(clienteId)
  return { ok: true }
}

export type ResultadoDaTransmissao = {
  ok: boolean
  erro?: string
  /** O aviso de fatiamento: "cabem 2.000 hoje, o resto sai amanhã". */
  recado?: string
  transmissaoId?: string
}

/**
 * Cria a transmissão com o público já na fila.
 *
 * **Confere o teto de 24h ANTES de enfileirar.** Uma campanha de 5.000 com
 * tier de 2.000 não é um erro a descobrir na mensagem 2.001: é uma campanha
 * que leva 3 dias, e a pessoa tem o direito de saber disso na hora de agendar.
 */
export async function acaoCriarTransmissao(
  clienteId: string,
  dados: {
    nome: string
    templateId: string
    contatoIds: string[]
    parametros?: Record<string, string>
    quando?: string | null
    /** O teto de 24h do cliente. Vem da tela porque a Meta não o expõe por API. */
    limiteDiario?: number
    jaEnviadasHoje?: number
  },
): Promise<ResultadoDaTransmissao> {
  await exigirAcessoAoCliente(clienteId)

  const nome = dados.nome.trim()
  if (!nome) return { ok: false, erro: 'Dê um nome para esta transmissão.' }

  const template = await lerTemplate(dados.templateId)
  if (!template || template.clienteId !== clienteId) {
    return { ok: false, erro: 'Este modelo não existe.' }
  }

  const veredito = podeTransmitir({
    statusDoTemplate: template.status,
    publico: dados.contatoIds.length,
    // 250 é o degrau de quem está começando, e é onde a maioria fica: só sobe
    // quem usa 50% do limite em 7 dias.
    limiteDiario: dados.limiteDiario ?? 250,
    jaEnviadasHoje: dados.jaEnviadasHoje ?? 0,
  })

  if (!veredito.pode) return { ok: false, erro: veredito.recado ?? 'Não dá para transmitir agora.' }

  const quem = await sessaoAtual()
  const transmissao = await criarTransmissao({
    clienteId,
    nome,
    templateId: dados.templateId,
    parametros: dados.parametros ?? {},
    quando: dados.quando ?? null,
    criadaPor: quem?.usuario.id ?? null,
    criadaPorNome: quem?.usuario.nome ?? null,
  })

  await enfileirarDestinatarios(transmissao.id, dados.contatoIds)
  await mudarEstadoDaTransmissao(transmissao.id, 'agendada')

  telas(clienteId)
  return {
    ok: true,
    transmissaoId: transmissao.id,
    ...(veredito.recado ? { recado: veredito.recado } : {}),
  }
}

/**
 * Cancela o que ainda não saiu.
 *
 * **Não desfaz o que já saiu**, e a tela precisa dizer isso: mensagem entregue
 * não volta. Cancelar aqui só impede as que ainda estão na fila.
 */
export async function acaoCancelarTransmissao(
  clienteId: string,
  transmissaoId: string,
): Promise<{ ok: boolean; erro?: string; jaSairam?: number }> {
  await exigirAcessoAoCliente(clienteId)

  const transmissao = await lerTransmissao(transmissaoId)
  if (!transmissao || transmissao.clienteId !== clienteId) {
    return { ok: false, erro: 'Esta transmissão não existe.' }
  }

  if (transmissao.estado === 'concluida') {
    return { ok: false, erro: 'Esta transmissão já terminou.' }
  }

  const progresso = await progressoDa(transmissaoId)
  await mudarEstadoDaTransmissao(transmissaoId, 'cancelada')

  telas(clienteId)
  return {
    ok: true,
    // O que já saiu não volta, e o número é o que deixa isso concreto.
    jaSairam: progresso.aceita + progresso.retida + progresso.entregue + progresso.lida,
  }
}

/** A lista para a tela. */
export async function acaoListarTemplates(clienteId: string) {
  await exigirAcessoAoCliente(clienteId)
  return listarTemplates(clienteId)
}
