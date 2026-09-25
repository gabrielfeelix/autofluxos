import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { podeEditarPessoa, podeGerenciarPessoas } from '@/core/funcoes'
import type { Acesso, AlcanceDeConversas, PapelDaConta } from '@/core/permissoes'
import { alcanceDasRegras, meuAlcance } from './permissoes'
import { atorNaOrganizacao, exigirHierarquia, pessoasNaHierarquia } from './pessoas'
import { membrosDaConta } from './repos/usuarios'

/**
 * O modo espiar: quem está acima olha a caixa de um atendente como ele vê.
 *
 * Quem pode espiar quem é a mesma regra de quem edita quem na tela Pessoas
 * (`podeEditarPessoa`): o gestor espia os atendentes da equipe dele; o
 * administrador, gestores e atendentes; o proprietário, todo mundo. Mudou a
 * regra lá, muda aqui.
 *
 * Espiar não deixa rastro na conversa: nada vira lido, nem para quem espia
 * nem para o espiado, e o cliente não recebe o tique azul. Quem deixa rastro
 * é quem espia: cada entrada vai para a auditoria (`acoes-espiar.ts`).
 *
 * Mora num cookie, e não no endereço, para não ter de carregar um parâmetro
 * em cada link da fila. O cookie só diz **quem**; a permissão é conferida de
 * novo a cada requisição, então rebaixar alguém corta o espiar na hora.
 */
export const COOKIE_DE_ESPIAR = 'af-espiar'

export type Espiando = {
  alvo: { id: string; nome: string }
  alcance: AlcanceDeConversas
}

export const espiando = cache(async (clienteId: string): Promise<Espiando | null> => {
  const valor = (await cookies()).get(COOKIE_DE_ESPIAR)?.value
  if (!valor) return null
  const [conta, alvoId] = valor.split(':')
  if (conta !== clienteId || !alvoId) return null

  const hierarquia = await exigirHierarquia(clienteId, alvoId)
  if ('ok' in hierarquia) return null
  const { ator, alvo } = hierarquia
  if (ator.usuarioId === alvo.usuarioId) return null

  const regras: Acesso = {
    papel: alvo.papel as PapelDaConta,
    usuarioId: alvo.usuarioId,
    equipes: alvo.equipes,
    politicaBase: alvo.politica,
  }
  const [alcance, membros] = await Promise.all([alcanceDasRegras(clienteId, regras), membrosDaConta(clienteId)])
  const nome = membros.find((membro) => membro.id === alvo.usuarioId)?.nome ?? 'Atendente'
  return { alvo: { id: alvo.usuarioId, nome }, alcance }
})

/** O alcance que a tela do Inbox usa: o do espiado, ou o de quem olha. */
export const alcanceDaTela = cache(async (clienteId: string): Promise<AlcanceDeConversas> => {
  return (await espiando(clienteId))?.alcance ?? meuAlcance(clienteId)
})

/** Quem esta pessoa pode espiar nesta conta. Vazio para quem não gerencia. */
export async function quemPossoEspiar(clienteId: string): Promise<string[]> {
  const ator = await atorNaOrganizacao(clienteId)
  if (!podeGerenciarPessoas(ator)) return []
  const pessoas = await pessoasNaHierarquia(clienteId)
  return [...pessoas.values()]
    .filter((pessoa) => pessoa.usuarioId !== ator.usuarioId && podeEditarPessoa(ator, pessoa))
    .map((pessoa) => pessoa.usuarioId)
}
