'use server'

import { revalidatePath } from 'next/cache'
import type { Anotacao } from '@/core/anotacoes'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { registrarAnotacao } from './repos/eventos'
import { contatoEhDoCliente } from './repos/crm'
import { lerValor } from '@/core/crm'
import { acharCartao, criarNegocioAvulso, definirOrigemDoNegocio, preverFechamento, trocarDeFunil } from './repos/quadros'
import {
  apagar as apagarArquivo,
  caminhoEhDoNegocio,
  caminhoNovo,
  registrar as registrarArquivo,
  TETO_DO_ARQUIVO,
  TIPOS_DO_ARQUIVO,
  urlDeEnvio,
  type ArquivoDoNegocio,
} from './repos/arquivos-do-negocio'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações da página do negócio (F2 do plano de 24/09).
 *
 * Arquivo próprio pelo mesmo motivo de `acoes-crm.ts`: `acoes.ts` passou de
 * 2.500 linhas e outro trabalho mexe nele. **Nenhuma revalida a página do
 * negócio**: a tela muda na hora e o servidor grava por trás. Revalidam o
 * funil, que não está aberto, para ele não mostrar dado velho na volta.
 */

function funil(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/quadros`)
}

/** `YYYY-MM-DD` ou vazio, que apaga a previsão. */
export async function acaoPreverFechamento(
  clienteId: string,
  cartaoId: string,
  data: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const r = await preverFechamento(clienteId, cartaoId, data.trim() || null)
  if (!r.ok) return { ok: false, erro: r.motivo }
  funil(clienteId)
  return { ok: true }
}

export async function acaoTrocarDeFunil(
  clienteId: string,
  cartaoId: string,
  quadroId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const quem = await sessaoAtual()
  const r = await trocarDeFunil(clienteId, cartaoId, quadroId, quem?.usuario.nome ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }
  funil(clienteId)
  return { ok: true }
}

/**
 * Anotação feita na página do negócio: vai para o diário da pessoa, como as
 * outras, e leva o `cartaoId` para aparecer no histórico deste negócio.
 */
export async function acaoAnotarNoNegocio(
  clienteId: string,
  contatoId: string,
  cartaoId: string,
  texto: string,
): Promise<{ ok: true; anotacao: Anotacao } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const limpo = texto.trim().slice(0, LIMITE_DA_NOTA)
  if (limpo === '') return { ok: false, erro: 'escreva alguma coisa antes de anotar' }

  // O cartão precisa ser deste contato e desta conta: sem isso, um id de fora
  // penduraria a anotação no histórico de um negócio alheio.
  const [cartao, doCliente] = await Promise.all([
    acharCartao(clienteId, cartaoId),
    contatoEhDoCliente(clienteId, contatoId),
  ])
  if (!doCliente || !cartao || cartao.contatoId !== contatoId) {
    return { ok: false, erro: 'este negócio não existe mais' }
  }

  const quem = await sessaoAtual()
  try {
    const anotacao = await registrarAnotacao(
      clienteId,
      contatoId,
      limpo,
      quem?.usuario.nome ?? null,
      cartaoId,
    )
    return { ok: true, anotacao }
  } catch (erro) {
    console.error('[anotar no negócio]', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'não deu para guardar agora' }
  }
}

/**
 * "+ Nova negociação" na ficha do contato. Nasce avulso (0127): pode haver
 * outro aberto do mesmo contato no mesmo funil.
 */
export async function acaoCriarNegocioAvulso(
  clienteId: string,
  contatoId: string,
  dados: { quadroId: string; titulo: string; valor: string; origem: string },
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const lido = lerValor(dados.valor)
  if (!lido.ok) return { ok: false, erro: lido.motivo }

  const quem = await sessaoAtual()
  try {
    const r = await criarNegocioAvulso(clienteId, {
      contatoId,
      quadroId: dados.quadroId,
      titulo: dados.titulo,
      valor: lido.valor,
      origem: dados.origem,
      responsavel: quem?.usuario.id ?? null,
    })
    if (!r.ok) return { ok: false, erro: r.motivo }
    // A ficha não é revalidada: o negócio entra na lista dela no clique.
    funil(clienteId)
    return { ok: true, id: r.id }
  } catch (erro) {
    console.error('[criar negócio]', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'não deu para criar agora, tente de novo' }
  }
}

export async function acaoDefinirOrigemDoNegocio(
  clienteId: string,
  cartaoId: string,
  origem: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso
  const r = await definirOrigemDoNegocio(clienteId, cartaoId, origem)
  if (!r.ok) return { ok: false, erro: r.motivo }
  funil(clienteId)
  return { ok: true }
}

/**
 * Primeiro passo de guardar um arquivo: confere tudo e devolve para onde o
 * navegador manda. O arquivo não passa por aqui (ver `arquivos-do-negocio.ts`).
 */
export async function acaoPrepararArquivoDoNegocio(
  clienteId: string,
  cartaoId: string,
  arquivo: { nome: string; mime: string; bytes: number },
): Promise<{ ok: true; caminho: string; url: string } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  if (!(TIPOS_DO_ARQUIVO as readonly string[]).includes(arquivo.mime)) {
    return { ok: false, erro: 'só PDF ou imagem (jpg, png, webp)' }
  }
  if (!(arquivo.bytes > 0) || arquivo.bytes > TETO_DO_ARQUIVO) {
    return { ok: false, erro: 'o arquivo passa de 10 MB' }
  }
  const cartao = await acharCartao(clienteId, cartaoId)
  if (!cartao) return { ok: false, erro: 'este negócio não existe mais' }

  const caminho = caminhoNovo(clienteId, cartaoId, arquivo.mime)
  const envio = await urlDeEnvio(caminho)
  if (!envio) return { ok: false, erro: 'não deu para preparar o envio, tente de novo' }
  return { ok: true, caminho, url: envio.url }
}

/** Segundo passo: o arquivo chegou ao Storage, grava a linha. */
export async function acaoRegistrarArquivoDoNegocio(
  clienteId: string,
  cartaoId: string,
  arquivo: { caminho: string; nome: string; mime: string; bytes: number },
): Promise<{ ok: true; arquivo: ArquivoDoNegocio } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  if (!caminhoEhDoNegocio(arquivo.caminho, clienteId, cartaoId)) {
    return { ok: false, erro: 'arquivo de outro lugar' }
  }
  if (!(TIPOS_DO_ARQUIVO as readonly string[]).includes(arquivo.mime) || arquivo.bytes > TETO_DO_ARQUIVO) {
    return { ok: false, erro: 'só PDF ou imagem, até 10 MB' }
  }
  const nome = arquivo.nome.trim().slice(0, 200) || 'arquivo'

  const quem = await sessaoAtual()
  const registrado = await registrarArquivo(
    clienteId,
    cartaoId,
    { caminho: arquivo.caminho, nome, mime: arquivo.mime, bytes: arquivo.bytes },
    { id: quem?.usuario.id ?? null, nome: quem?.usuario.nome ?? null },
  )
  if (!registrado) return { ok: false, erro: 'o arquivo não chegou, tente de novo' }
  return { ok: true, arquivo: registrado }
}

export async function acaoApagarArquivoDoNegocio(
  clienteId: string,
  cartaoId: string,
  arquivoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso
  const apagou = await apagarArquivo(clienteId, cartaoId, arquivoId)
  return apagou ? { ok: true } : { ok: false, erro: 'este arquivo não existe mais' }
}
