'use server'

import { revalidatePath } from 'next/cache'
import { lerValor, type Estagio, type Situacao, type TipoDeEtapa } from '@/core/crm'
import { anotar, linhaDoTempo } from './repos/eventos'
import { listarMotivos, criarMotivo, apagarMotivo } from './repos/motivos-de-perda'
import { definirEstagio, resumoDoContato } from './repos/crm'
import { atribuirContato } from './repos/conversas'
import { membrosDaConta } from './repos/usuarios'
import {
  atribuirCartao,
  criarQuadro,
  definirTipoDaEtapa,
  descreverCartao,
  encadearQuadro,
  fecharCartao,
  reabrirCartao,
  trazerTodosParaOQuadro,
} from './repos/quadros'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * As ações do funil (0058), em arquivo próprio.
 *
 * Separadas de `acoes.ts` pelo mesmo motivo que o agendamento foi: aquele
 * arquivo já passou de 2.500 linhas, e cada bloco novo lá é mais uma chance de
 * dois trabalhos paralelos colidirem no mesmo lugar.
 */

function quadros(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/quadros`)
}

/**
 * Ganhar ou perder.
 *
 * O valor chega como texto porque é o que a mão digita — "1.500", "R$ 89,90" —
 * e quem o entende é `core/crm.ts`. Recusar por formato seria transformar a
 * caixa de valor num teste de datilografia.
 */
export async function acaoFecharCartao(
  clienteId: string,
  cartaoId: string,
  situacao: Exclude<Situacao, 'aberta'>,
  dados: { valor?: string; motivo?: string; titulo?: string },
): Promise<{ ok: boolean; erro?: string; abriuEm?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const lido = lerValor(dados.valor ?? '')
  if (!lido.ok) return { ok: false, erro: lido.motivo }

  const quem = await sessaoAtual()
  const r = await fecharCartao(
    clienteId,
    cartaoId,
    situacao,
    { valor: lido.valor, motivo: dados.motivo ?? null, titulo: dados.titulo ?? null },
    quem?.usuario.nome ?? null,
  )

  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, abriuEm: r.abriuEm }
}

/** Fechar é um clique, e errar o clique é rotina. */
export async function acaoReabrirCartao(
  clienteId: string,
  cartaoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await reabrirCartao(clienteId, cartaoId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** `null` devolve o cartão à fila de ninguém — e isso é uma ação legítima. */
export async function acaoAtribuirCartao(
  clienteId: string,
  cartaoId: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; erro?: string; quem?: string | null }> {
  await exigirAcessoAoCliente(clienteId)

  const quemFez = await sessaoAtual()
  const r = await atribuirCartao(clienteId, cartaoId, usuarioId, quemFez?.usuario.nome ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, quem: r.quem }
}

/** O que está sendo vendido, e por quanto. Texto livre: não há catálogo. */
export async function acaoDescreverCartao(
  clienteId: string,
  cartaoId: string,
  dados: { titulo?: string; valor?: string },
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const lido = lerValor(dados.valor ?? '')
  if (!lido.ok) return { ok: false, erro: lido.motivo }

  const r = await descreverCartao(clienteId, cartaoId, {
    titulo: dados.titulo ?? null,
    valor: lido.valor,
  })
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/**
 * Liga este funil ao seguinte: o SDR entrega ao vendedor, o vendedor ao
 * pós-venda. Ganhar aqui abre o cartão lá.
 */
export async function acaoEncadearQuadro(
  clienteId: string,
  quadroId: string,
  seguinteId: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await encadearQuadro(clienteId, quadroId, seguinteId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** O papel da etapa: cair em `ganho` fecha a venda; em `perdido`, pede motivo. */
export async function acaoDefinirTipoDaEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  tipo: TipoDeEtapa,
  limiteDeDias: number | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  if (limiteDeDias !== null && (!Number.isInteger(limiteDeDias) || limiteDeDias < 1 || limiteDeDias > 365)) {
    return { ok: false, erro: 'o limite vai de 1 a 365 dias' }
  }

  const r = await definirTipoDaEtapa(clienteId, quadroId, etapaId, tipo, limiteDeDias)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** A lista de motivos da conta, semeada na primeira leitura. */
export async function acaoListarMotivos(
  clienteId: string,
): Promise<{ motivos: { id: string; nome: string }[] }> {
  await exigirAcessoAoCliente(clienteId)
  const motivos = await listarMotivos(clienteId)
  return { motivos: motivos.map(({ id, nome }) => ({ id, nome })) }
}

export async function acaoCriarMotivo(
  clienteId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await criarMotivo(clienteId, nome)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** Apagar o motivo **não reescreve as perdas antigas** — elas guardam o texto. */
export async function acaoApagarMotivo(
  clienteId: string,
  motivoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const apagou = await apagarMotivo(clienteId, motivoId)
  quadros(clienteId)
  return apagou ? { ok: true } : { ok: false, erro: 'este motivo não existe mais' }
}

/**
 * O que abre no painel lateral: a linha do tempo e o que essa pessoa já rendeu.
 *
 * As duas numa chamada só porque o painel abre com as duas — dois cliques de
 * espera seria a tela piscando em dois tempos.
 */
export async function acaoAbrirPainelDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{
  eventos: Awaited<ReturnType<typeof linhaDoTempo>>
  resumo: { total: number; compras: number; ultimaEm: string | null }
}> {
  await exigirAcessoAoCliente(clienteId)

  const [eventos, resumo] = await Promise.all([
    linhaDoTempo(clienteId, contatoId),
    resumoDoContato(clienteId, contatoId),
  ])

  return { eventos, resumo }
}

/** O ajuste na mão do estágio. Existe, e é exceção. */
export async function acaoDefinirEstagio(
  clienteId: string,
  contatoId: string,
  estagio: Estagio,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const quem = await sessaoAtual()
  const mudou = await definirEstagio(clienteId, contatoId, estagio, quem?.usuario.nome ?? null)
  if (!mudou) return { ok: false, erro: 'este contato não existe mais' }

  quadros(clienteId)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/**
 * Traz para o funil todo mundo que ainda está de fora.
 *
 * Existe porque a entrada automática só alcança contato **criado agora** — e
 * está certo assim: quem já existia e voltou a escrever não pode ser jogado de
 * volta para a primeira etapa a cada mensagem. O preço disso é quadro novo em
 * conta antiga abrindo vazio com o inbox cheio, e este botão é o conserto.
 */
export async function acaoTrazerTodosParaOQuadro(
  clienteId: string,
  quadroId: string,
): Promise<{ ok: boolean; erro?: string; postos?: number; faltaram?: number }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await trazerTodosParaOQuadro(clienteId, quadroId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, postos: r.postos, faltaram: r.faltaram }
}

/**
 * Cria o quadro a partir de um modelo, e devolve o que aconteceu.
 *
 * Existe separada de `acaoCriarQuadro` porque o modal de criação **não é mais um
 * formulário**: ele precisa fechar sozinho no sucesso e mostrar a recusa sem
 * recarregar — "já existe um quadro com este nome" chegava como nada, e a tela
 * ficava parada com o botão clicado, parecendo travada.
 */
export async function acaoCriarQuadroComModelo(
  clienteId: string,
  nome: string,
  modeloId: string | null,
): Promise<{ ok: boolean; erro?: string; id?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await criarQuadro(clienteId, String(nome ?? ''), modeloId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, id: r.id }
}

/**
 * Quem cuida desta pessoa, mudado da ficha dela.
 *
 * O Inbox já tinha o gesto ("Assumir"), e ele era sobre si mesmo: eu pego, eu
 * largo. Na ficha a pergunta é outra — quem *deveria* cuidar —, e a resposta
 * costuma ser outra pessoa. Por isso aqui a lista é a equipe inteira, e
 * `null` devolve o contato à fila de ninguém, que é estado legítimo.
 *
 * Grava o mesmo evento `assumiu` que o cartão grava: a linha do tempo não tem
 * por que distinguir se o nome mudou pelo funil ou pela ficha.
 */
export async function acaoAtribuirContato(
  clienteId: string,
  contatoId: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const equipe = await membrosDaConta(clienteId)
  const escolhido = usuarioId === null ? null : equipe.find((membro) => membro.id === usuarioId)
  if (usuarioId !== null && !escolhido) {
    return { ok: false, erro: 'essa pessoa não atende nesta conta' }
  }

  const ok = await atribuirContato(clienteId, contatoId, usuarioId)
  if (!ok) return { ok: false, erro: 'este contato não é deste cliente' }

  const quemFez = await sessaoAtual()
  await anotar(
    clienteId,
    contatoId,
    'assumiu',
    { quem: escolhido?.nome ?? '' },
    quemFez?.usuario.nome ?? null,
  )

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
}
