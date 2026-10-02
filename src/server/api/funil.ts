import 'server-only'
import { listarMotivos } from '../repos/motivos-de-perda'
import { acharCartao, listarQuadros, moverCartao, porNaEtapa, quadrosDoContato, type Quadro } from '../repos/quadros'
import { acharContatoPeloTelefone } from '../repos/contato-por-telefone'
import { concluirProcesso } from '../servicos/concluir-processo'
import { gravarContatoDaApi } from './contatos'
import type { CodigoDeErro } from './autenticar'

/**
 * O funil pela API pública (fase 4). Os mesmos repositórios da tela, com
 * autor "API" no histórico. "Funil" e "oportunidade" são os nomes do painel;
 * no banco são `quadros` e `quadro_cartoes`.
 */

export type FunilDaApi = {
  id: string
  nome: string
  padrao: boolean
  finalidade: 'operacional' | 'comercial'
  etapas: { id: string; nome: string; ordem: number }[]
}

export type OportunidadeDaApi = {
  id: string
  contato_id: string
  funil: { id: string; nome: string }
  etapa: { id: string; nome: string }
  situacao: 'aberta' | 'ganha' | 'perdida'
  titulo: string | null
  valor: number | null
  entrou_na_etapa_em: string
}

const AUTOR = 'API'

function paraFunil(quadro: Quadro): FunilDaApi {
  return {
    id: quadro.id,
    nome: quadro.nome,
    padrao: quadro.padrao,
    finalidade: quadro.finalidade,
    etapas: [...quadro.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem })),
  }
}

export async function listarFunisDaApi(clienteId: string): Promise<FunilDaApi[]> {
  return (await listarQuadros(clienteId)).map(paraFunil)
}

/** As oportunidades de um contato, a partir das posições que a ficha já usa. */
async function oportunidadesDoContato(clienteId: string, contatoId: string): Promise<OportunidadeDaApi[]> {
  return (await quadrosDoContato(clienteId, contatoId)).map((p) => ({
    id: p.cartaoId,
    contato_id: contatoId,
    funil: { id: p.quadroId, nome: p.quadro },
    etapa: { id: p.etapaId, nome: p.etapa },
    situacao: p.situacao,
    titulo: p.titulo,
    valor: p.valor,
    entrou_na_etapa_em: p.entrouEm,
  }))
}

export async function listarOportunidadesDaApi(
  clienteId: string,
  filtro: { telefone: string; funilId?: string; situacao: 'aberta' | 'ganha' | 'perdida' | 'todas' },
): Promise<OportunidadeDaApi[] | null> {
  const contatoId = await acharContatoPeloTelefone(clienteId, filtro.telefone)
  if (!contatoId) return null
  return (await oportunidadesDoContato(clienteId, contatoId)).filter(
    (o) => (filtro.situacao === 'todas' || o.situacao === filtro.situacao) && (!filtro.funilId || o.funil.id === filtro.funilId),
  )
}

async function oportunidadePorId(clienteId: string, contatoId: string, id: string): Promise<OportunidadeDaApi | null> {
  return (await oportunidadesDoContato(clienteId, contatoId)).find((o) => o.id === id) ?? null
}

type Recusa = { ok: false; status: number; codigo: CodigoDeErro; mensagem: string }
const recusa = (status: number, codigo: CodigoDeErro, mensagem: string): Recusa => ({ ok: false, status, codigo, mensagem })

export type ResultadoDaAbertura = { ok: true; criada: boolean; oportunidade: OportunidadeDaApi } | Recusa

/**
 * Garante uma oportunidade aberta do contato no funil, na etapa pedida.
 *
 * Já existe uma aberta ali: devolve ela (200), e muda de etapa se outra foi
 * pedida. Uma pessoa tem no máximo uma aberta por funil, e o sistema que
 * repete a chamada não pode ganhar um erro por isso. Contato que não existe é
 * criado como no `POST /contatos`, e conta nova pode já cair no funil padrão
 * sozinha: por isso a procura vem depois de gravar.
 */
export async function abrirOportunidadePelaApi(
  clienteId: string,
  pedido: { telefone: string; funilId?: string; etapaId?: string },
): Promise<ResultadoDaAbertura> {
  const funis = await listarQuadros(clienteId)
  const quadro = pedido.funilId ? funis.find((q) => q.id === pedido.funilId) : (funis.find((q) => q.padrao) ?? funis[0])
  if (!quadro) {
    return recusa(404, 'funil_nao_encontrado', pedido.funilId ? 'Nenhum funil com este id nesta conta.' : 'Esta conta ainda não tem funil.')
  }
  const etapas = [...quadro.etapas].sort((a, b) => a.ordem - b.ordem)
  const etapa = pedido.etapaId ? etapas.find((e) => e.id === pedido.etapaId) : etapas[0]
  if (!etapa) return recusa(404, 'etapa_nao_encontrada', `Nenhuma etapa com este id no funil ${quadro.nome}.`)

  const gravado = await gravarContatoDaApi(clienteId, { telefone: pedido.telefone })
  if (!gravado.ok) return recusa(422, 'telefone_invalido', 'Telefone sem DDD ou incompleto. Exemplo: 5511987654321.')
  const contatoId = gravado.contato.id

  const aberta = (await oportunidadesDoContato(clienteId, contatoId)).find((o) => o.funil.id === quadro.id && o.situacao === 'aberta')
  if (aberta) {
    if (pedido.etapaId && aberta.etapa.id !== etapa.id) {
      const movida = await moverCartao(clienteId, aberta.id, etapa.id, AUTOR)
      if (!movida.ok) return recusa(409, 'oportunidade_fechada', `Não deu para mudar de etapa: ${movida.motivo}.`)
    }
    const atual = await oportunidadePorId(clienteId, contatoId, aberta.id)
    return { ok: true, criada: false, oportunidade: atual ?? aberta }
  }

  const posto = await porNaEtapa(clienteId, quadro.id, etapa.id, [contatoId])
  if (!posto.ok) return recusa(409, 'oportunidade_fechada', `Não deu para abrir: ${posto.motivo}.`)

  const nova = (await oportunidadesDoContato(clienteId, contatoId)).find((o) => o.funil.id === quadro.id && o.situacao === 'aberta')
  if (!nova) throw new Error('a oportunidade sumiu depois de criada')
  return { ok: true, criada: posto.postos > 0, oportunidade: nova }
}

export type MudancaDaOportunidade =
  | { etapaId: string }
  | { situacao: 'ganha'; valor?: number | null }
  | { situacao: 'perdida'; motivo: string }

export type ResultadoDaMudanca = { ok: true; oportunidade: OportunidadeDaApi } | Recusa

export async function mudarOportunidadePelaApi(
  clienteId: string,
  oportunidadeId: string,
  mudanca: MudancaDaOportunidade,
): Promise<ResultadoDaMudanca> {
  const cartao = await acharCartao(clienteId, oportunidadeId)
  if (!cartao) return recusa(404, 'oportunidade_nao_encontrada', 'Nenhuma oportunidade com este id nesta conta.')
  if ((cartao.situacao ?? 'aberta') !== 'aberta') {
    return recusa(409, 'oportunidade_fechada', `Esta oportunidade já está ${cartao.situacao}. Reabra no painel para mudar.`)
  }

  if ('etapaId' in mudanca) {
    const quadro = (await listarQuadros(clienteId)).find((q) => q.id === cartao.quadroId)
    if (!quadro?.etapas.some((e) => e.id === mudanca.etapaId)) {
      return recusa(404, 'etapa_nao_encontrada', 'Nenhuma etapa com este id no funil desta oportunidade.')
    }
    const movida = await moverCartao(clienteId, oportunidadeId, mudanca.etapaId, AUTOR)
    if (!movida.ok) return recusa(409, 'oportunidade_fechada', `Não deu para mudar de etapa: ${movida.motivo}.`)
  } else {
    if (mudanca.situacao === 'perdida') {
      const motivos = (await listarMotivos(clienteId)).map((m) => m.nome)
      if (!motivos.some((m) => m.trim().toLowerCase() === mudanca.motivo.trim().toLowerCase())) {
        return recusa(422, 'motivo_invalido', `Use um dos motivos de perda da conta: ${motivos.join(', ')}.`)
      }
    }
    const r = await concluirProcesso({
      clienteId,
      cartaoId: oportunidadeId,
      situacao: mudanca.situacao,
      valor: mudanca.situacao === 'ganha' ? (mudanca.valor ?? null) : null,
      motivo: mudanca.situacao === 'perdida' ? mudanca.motivo : null,
      autor: AUTOR,
    })
    if (!r.ok) return recusa(409, 'oportunidade_fechada', `Não deu para concluir: ${r.motivo}.`)
  }

  const atual = await oportunidadePorId(clienteId, cartao.contatoId, oportunidadeId)
  if (!atual) throw new Error('a oportunidade sumiu depois de mudar')
  return { ok: true, oportunidade: atual }
}
