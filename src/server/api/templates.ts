import 'server-only'
import { hojeNaConta } from '@/core/horario'
import { linkComLacuna, podeEnviar, preencherLacunas as preencher, recadoDoLinkComLacuna, variaveisDe, type Categoria, type StatusDoTemplate } from '@/core/templates'
import type { AutorDaSaida } from '@/core/autor-da-mensagem'
import { adaptadorDoCanal } from '../adaptador-do-canal'
import { db } from '../db'
import { consumirLimite } from '../limite'
import { confirmarEntrega, contextoDeResposta, registrarSaida } from '../repos/conversas'
import { anotar } from '../repos/eventos'
import { listarTemplates, listarTemplatesAprovados, type Template } from '../repos/templates'
import { gravarContatoDaApi } from './contatos'
import type { CodigoDeErro } from './autenticar'

/**
 * Modelos aprovados pela API pública (fase 2). A rota cuida de quem pode chamar
 * e da `Idempotency-Key`; daqui para baixo é o mesmo caminho do "Retomar com
 * modelo" da conversa (`acaoRetomarComModelo`): status conferido agora, saída
 * gravada antes de mandar, entrega confirmada depois.
 */

/** Padrão do teto diário quando a administração não definiu outro. */
export const TETO_DIARIO_PADRAO = 500

/** O modelo como a API devolve. */
export type TemplateDaApi = {
  nome: string
  idioma: string
  categoria: Categoria
  corpo: string
  cabecalho: 'texto' | 'imagem' | 'video' | 'documento' | null
  variaveis: { corpo: number; cabecalho: number }
}

function variaveisDoCabecalho(template: Template): number {
  const cabecalho = template.componentes.cabecalho
  return cabecalho?.tipo === 'texto' ? variaveisDe(cabecalho.texto).length : 0
}

export function paraTemplateDaApi(template: Template): TemplateDaApi {
  return {
    nome: template.nome,
    idioma: template.idioma,
    categoria: template.categoria,
    corpo: template.componentes.corpo,
    cabecalho: template.componentes.cabecalho?.tipo ?? null,
    variaveis: {
      corpo: variaveisDe(template.componentes.corpo).length,
      cabecalho: variaveisDoCabecalho(template),
    },
  }
}

export async function listarTemplatesDaApi(clienteId: string): Promise<TemplateDaApi[]> {
  return (await listarTemplatesAprovados(clienteId)).map(paraTemplateDaApi)
}

/**
 * Quantos modelos a organização manda pela API por dia. A coluna nasce na
 * 0121; antes dela, ou com ela nula, vale o padrão.
 */
export async function tetoDiarioDaApi(clienteId: string): Promise<number> {
  return (await tetoConfiguradoDaApi(clienteId)) ?? TETO_DIARIO_PADRAO
}

/** O que a administração gravou, ou `null` (padrão, ou coluna ainda ausente). */
export async function tetoConfiguradoDaApi(clienteId: string): Promise<number | null> {
  const { data, error } = await db().from('clients').select('teto_api_diario').eq('id', clienteId).maybeSingle()
  if (error || !data) return null
  const teto = (data as { teto_api_diario: number | null }).teto_api_diario
  return typeof teto === 'number' && teto >= 0 ? teto : null
}

export type PedidoDeEnvio = {
  telefone: string
  template: string
  idioma?: string
  valores?: { corpo?: string[]; cabecalho?: string[] }
}

export type ResultadoDoEnvio =
  | {
      ok: true
      corpo: {
        status: 'enviada' | 'retida'
        mensagem_id: string
        contato_id: string
        contato_criado: boolean
        template: { nome: string; idioma: string }
      }
    }
  | { ok: false; status: number; codigo: CodigoDeErro; mensagem: string }

const recusa = (status: number, codigo: CodigoDeErro, mensagem: string): ResultadoDoEnvio => ({
  ok: false,
  status,
  codigo,
  mensagem,
})

/** A API aparece no histórico da conversa com este nome, embaixo da bolha. */
const AUTOR_DA_API: AutorDaSaida = { tipo: 'pessoa', id: null, nome: 'API' }

/** Acha o modelo pelo nome e, se houver mais de um idioma, pelo idioma. */
function escolherModelo(
  todos: Template[],
  nome: string,
  idioma: string | undefined,
): { template: Template } | { erro: ResultadoDoEnvio } {
  const doNome = todos.filter((t) => t.nome === nome)
  const candidatos = idioma ? doNome.filter((t) => t.idioma === idioma) : doNome
  if (candidatos.length === 0) {
    return {
      erro: recusa(404, 'template_nao_encontrado', idioma ? `Nenhum modelo "${nome}" em ${idioma} nesta conta.` : `Nenhum modelo "${nome}" nesta conta.`),
    }
  }
  if (candidatos.length > 1) {
    const idiomas = candidatos.map((t) => t.idioma).join(', ')
    return { erro: recusa(422, 'idioma_obrigatorio', `O modelo "${nome}" existe em mais de um idioma (${idiomas}). Envie o campo idioma.`) }
  }
  return { template: candidatos[0] as Template }
}

function confereValores(esperado: number, recebido: string[] | undefined, onde: 'corpo' | 'cabecalho'): ResultadoDoEnvio | null {
  const quantos = recebido?.length ?? 0
  if (quantos === esperado) return null
  return recusa(
    422,
    'valores_incompletos',
    `O ${onde === 'corpo' ? 'corpo' : 'cabeçalho'} do modelo tem ${esperado} ${esperado === 1 ? 'variável' : 'variáveis'} e chegaram ${quantos} em valores.${onde}.`,
  )
}

/**
 * Envia um modelo aprovado. A ordem é das recusas que não custam nada para a
 * que custa: modelo, variáveis, teto do dia, contato, canal, e só então a Meta.
 */
export async function enviarModeloPelaApi(clienteId: string, pedido: PedidoDeEnvio): Promise<ResultadoDoEnvio> {
  const escolha = escolherModelo(await listarTemplates(clienteId), pedido.template, pedido.idioma)
  if ('erro' in escolha) return escolha.erro
  const { template } = escolha

  /*
   * O status vem da linha, conferido agora: a Meta pausa modelo por qualidade
   * sem avisar, e quem integra pode ter guardado o nome há meses.
   */
  if (!podeEnviar(template.status)) {
    return recusa(409, 'template_nao_aprovado', `O modelo "${template.nome}" está ${template.status as StatusDoTemplate} na Meta. Só modelo aprovado entrega.`)
  }
  if (template.componentes.cabecalho && template.componentes.cabecalho.tipo !== 'texto') {
    return recusa(422, 'template_com_midia', 'Modelos com imagem, vídeo ou documento no cabeçalho ainda não podem ser enviados pela API.')
  }
  const lacuna = linkComLacuna(template.componentes)
  if (lacuna) return recusa(422, 'link_com_lacuna', recadoDoLinkComLacuna(lacuna))

  const valoresDoCorpo = pedido.valores?.corpo ?? []
  const valoresDoCabecalho = pedido.valores?.cabecalho ?? []
  const faltaNoCorpo = confereValores(variaveisDe(template.componentes.corpo).length, pedido.valores?.corpo, 'corpo')
  if (faltaNoCorpo) return faltaNoCorpo
  const faltaNoCabecalho = confereValores(variaveisDoCabecalho(template), pedido.valores?.cabecalho, 'cabecalho')
  if (faltaNoCabecalho) return faltaNoCabecalho

  const teto = await tetoDiarioDaApi(clienteId)
  const dia = hojeNaConta('America/Sao_Paulo')
  // A chave leva o dia: o contador zera à meia-noite de Brasília, não 24h depois da primeira.
  if (teto === 0 || !(await consumirLimite(`api:modelos:${clienteId}:${dia}`, teto, 24 * 3600))) {
    return recusa(429, 'teto_diario', `A organização chegou ao teto de ${teto} modelos por dia pela API. O contador volta a zero à meia-noite (horário de Brasília).`)
  }

  const gravado = await gravarContatoDaApi(clienteId, { telefone: pedido.telefone })
  if (!gravado.ok) return recusa(422, 'telefone_invalido', 'Telefone sem DDD ou incompleto. Exemplo: 5511987654321.')
  const contatoId = gravado.contato.id

  const contexto = await contextoDeResposta(clienteId, contatoId)
  const canal = contexto ? await adaptadorDoCanal(contexto.canal) : null
  if (!contexto || !canal?.enviarTemplate) {
    return recusa(409, 'sem_numero', 'A organização não tem um número de WhatsApp conectado para enviar modelos.')
  }

  const texto = preencher(
    template.componentes.cabecalho?.tipo === 'texto'
      ? `${preencher(template.componentes.cabecalho.texto, valoresDoCabecalho)}\n\n${template.componentes.corpo}`
      : template.componentes.corpo,
    valoresDoCorpo,
  )

  // Grava antes de mandar: a função que morre entre o envio e o registro não
  // pode apagar do histórico o que o contato já recebeu.
  const registro = await registrarSaida({ contatoId, sessaoId: contexto.sessaoId, texto, autor: AUTOR_DA_API })

  let envio
  try {
    envio = await canal.enviarTemplate(contexto.waId, {
      nome: template.nome,
      idioma: template.idioma,
      ...(valoresDoCorpo.length > 0 || valoresDoCabecalho.length > 0
        ? {
            valores: {
              ...(valoresDoCorpo.length > 0 ? { corpo: valoresDoCorpo } : {}),
              ...(valoresDoCabecalho.length > 0 ? { cabecalho: valoresDoCabecalho } : {}),
            },
          }
        : {}),
    })
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return recusa(502, 'meta_recusou', `A Meta recusou o envio: ${detalhe}`)
  }
  if (envio.situacao === 'falhou') {
    return recusa(502, 'meta_recusou', 'A Meta recusou o envio deste modelo para este número.')
  }

  await confirmarEntrega(registro, envio.wamid)
  await anotar(clienteId, contatoId, 'mensagem-enviada', { modelo: template.nome, via: 'API' }, 'API')

  return {
    ok: true,
    corpo: {
      status: envio.situacao === 'retida' ? 'retida' : 'enviada',
      mensagem_id: envio.wamid,
      contato_id: contatoId,
      contato_criado: gravado.criado,
      template: { nome: template.nome, idioma: template.idioma },
    },
  }
}
