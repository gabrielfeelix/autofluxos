'use server'

import { revalidatePath } from 'next/cache'
import { faltamPara, TIPOS_DE_CAMPO, type DefinicaoDeCampo, type TipoDeCampo, type ValorDeCampo } from '@/core/campos'
import { exigirCapacidade, recusou } from './permissoes'
import { arquivarCampo, camposDoContato, definicoesDeCampo, definirCampo, gravarCampos } from './repos/campos'
import { sessaoAtual } from './sessao'

/**
 * As ações dos campos da empresa (UI-16) e do preenchimento com proveniência.
 *
 * ---------------------------------------------------------------------------
 * Duas capacidades diferentes, e a diferença não é detalhe
 * ---------------------------------------------------------------------------
 *
 * **Definir campo é `configurar_empresa`**: mexe na estrutura, vale para a conta
 * inteira, e um campo obrigatório criado por engano trava a qualificação de
 * todo mundo. **Preencher campo é `atender`**, no escopo `proprios`: é o
 * trabalho de todo dia de quem está na conversa.
 *
 * Dar a mesma capacidade às duas faria uma de duas coisas erradas: ou quem
 * atende passa a poder reconfigurar a conta, ou quem atende deixa de poder
 * preencher a ficha de quem está atendendo.
 */

/** Define ou renomeia um campo da empresa. */
export async function acaoDefinirCampo(
  clienteId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const chave = String(formData.get('chave') ?? '').trim()
  const rotulo = String(formData.get('rotulo') ?? '').trim()
  const tipo = String(formData.get('tipo') ?? '')

  if (!(TIPOS_DE_CAMPO as readonly string[]).includes(tipo)) {
    return { ok: false, erro: 'esse tipo de campo não existe' }
  }

  /*
   * As opções chegam uma por linha, que é como a tela pede. Linha vazia sai:
   * um `\n` sobrando no fim da caixa viraria uma opção em branco no seletor.
   */
  const opcoes = String(formData.get('opcoes') ?? '')
    .split('\n')
    .map((o) => o.trim())
    .filter((o) => o !== '')

  const obrigatorioEm = formData
    .getAll('obrigatorioEm')
    .map(String)
    .filter((v): v is 'qualificar' | 'fechar_venda' => v === 'qualificar' || v === 'fechar_venda')

  const definicao: DefinicaoDeCampo = {
    chave,
    rotulo,
    tipo: tipo as TipoDeCampo,
    opcoes,
    obrigatorioEm,
  }

  const gravou = await definirCampo(clienteId, definicao)
  if (!gravou.ok) return { ok: false, erro: gravou.motivo }

  revalidatePath(`/clientes/${clienteId}/ajustes/campos`)
  return { ok: true }
}

/**
 * Arquiva um campo. Nunca apaga.
 *
 * Apagar deixaria os valores já gravados sem rótulo: existe o dado e não existe
 * o que ele significa.
 */
export async function acaoArquivarCampo(
  clienteId: string,
  chave: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const arquivou = await arquivarCampo(clienteId, chave)
  if (!arquivou.ok) return { ok: false, erro: arquivou.motivo }

  revalidatePath(`/clientes/${clienteId}/ajustes/campos`)
  return { ok: true }
}

/**
 * Preenche campos de um contato, pela tela, com proveniência `humano`.
 *
 * `humano` é a origem mais forte (`core/campos.ts`), e é o que faz uma
 * correção da equipe não ser desfeita por uma importação depois. É também por
 * isso que esta ação não serve ao bot: o motor grava por outro caminho, com a
 * origem dele.
 */
export async function acaoPreencherCampos(
  clienteId: string,
  contatoId: string,
  valores: Record<string, string>,
): Promise<{ ok: boolean; erro?: string; recusados?: { chave: string; motivo: string }[] }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  const quem = await sessaoAtual()
  const em = new Date().toISOString()

  const novos: Record<string, ValorDeCampo> = {}
  for (const [chave, valor] of Object.entries(valores)) {
    novos[chave] = { valor, origem: 'humano', autorId: quem?.usuario.id ?? null, em }
  }

  const gravou = await gravarCampos(clienteId, contatoId, novos)
  if (!gravou.ok) return { ok: false, erro: 'este contato não é deste cliente' }

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  /*
   * Os recusados sobem para a tela. Recusa não é erro: é o sistema protegendo
   * uma correção, e a pessoa precisa saber qual campo não entrou e por quê, em
   * vez de achar que salvou tudo.
   */
  return { ok: true, recusados: gravou.recusados }
}

/**
 * O que falta para uma ação, e nada além disso (RB-20).
 *
 * Consulta e não trava: a resposta vai para a tela da **ação que precisa do
 * dado**, e não para o caminho da mensagem. Campo obrigatório para fechar venda
 * não pode impedir receber mensagem, criar contato ou salvar rascunho.
 */
export async function acaoConferirObrigatorios(
  clienteId: string,
  contatoId: string,
  acao: 'qualificar' | 'fechar_venda',
): Promise<{ ok: boolean; erro?: string; faltam?: string[] }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  const [definicoes, campos] = await Promise.all([
    definicoesDeCampo(clienteId),
    camposDoContato(clienteId, contatoId),
  ])

  if (campos === null) return { ok: false, erro: 'este contato não é deste cliente' }
  return { ok: true, faltam: faltamPara(definicoes, campos, acao) }
}
