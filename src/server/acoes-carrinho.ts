'use server'

import { headers } from 'next/headers'
import { modelosDoCarrinho, PREFIXO_DO_CARRINHO } from '@/core/carrinho'
import { acaoCriarTemplate } from './acoes-transmissoes'
import { exigirCapacidade, recusou } from './permissoes'
import { guardarNoAcervo } from './repos/acervo'
import { acharCliente } from './repos/clientes'
import { lojaDaConta } from './repos/lojas'
import { listarTemplates } from './repos/templates'

export type ResultadoDosModelosDoCarrinho =
  | { ok: true; criados: string[]; jaExistiam: string[]; falhas: { nome: string; erro: string }[] }
  | { ok: false; erro: string }

/**
 * Cria e manda para a Meta os dez modelos do carrinho abandonado
 * (`core/carrinho.ts`), de uma vez, com o texto que a tela mostrou.
 *
 * Os que já existem ficam como estão: clicar de novo depois de uma recusa só
 * cria o que faltou, sem duplicar nome (a Meta recusaria). A foto de exemplo
 * da revisão é a de `public/exemplos`, guardada no acervo da conta porque é de
 * lá que a criação de modelo lê a imagem.
 */
export async function acaoCriarModelosDoCarrinho(clienteId: string): Promise<ResultadoDosModelosDoCarrinho> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const [loja, cliente, existentes] = await Promise.all([lojaDaConta(clienteId), acharCliente(clienteId), listarTemplates(clienteId)])
  if (!loja?.endereco) return { ok: false, erro: 'Conecte a loja Magento antes: o botão do carrinho leva para o endereço dela.' }

  const nomes = new Set(existentes.map((t) => t.nome))
  const faltam = modelosDoCarrinho({ nome: cliente?.nome ?? 'loja', endereco: loja.endereco, exemplo: '' }).filter((m) => !nomes.has(m.nome))
  const jaExistiam = [...nomes].filter((nome) => nome.startsWith(PREFIXO_DO_CARRINHO)).sort()
  if (faltam.length === 0) return { ok: true, criados: [], jaExistiam, falhas: [] }

  let exemplo: string
  try {
    const cabecalhos = await headers()
    const origem = `${cabecalhos.get('x-forwarded-proto') ?? 'https'}://${cabecalhos.get('host')}`
    const resposta = await fetch(`${origem}/exemplos/carrinho-produto.jpg`)
    if (!resposta.ok) throw new Error(`a foto de exemplo respondeu ${resposta.status}`)
    const arquivo = new File([await resposta.arrayBuffer()], 'carrinho-produto.jpg', { type: 'image/jpeg' })
    exemplo = (await guardarNoAcervo(clienteId, arquivo)).url
  } catch (erro) {
    return { ok: false, erro: `Não foi possível preparar a foto de exemplo: ${erro instanceof Error ? erro.message : String(erro)}` }
  }

  const modelos = modelosDoCarrinho({ nome: cliente?.nome ?? 'loja', endereco: loja.endereco, exemplo }).filter((m) => !nomes.has(m.nome))
  const criados: string[] = []
  const falhas: { nome: string; erro: string }[] = []
  // Um por vez: são escritas na Meta, e repetir em paralelo uma que talvez
  // tenha dado certo duplica nome.
  for (const modelo of modelos) {
    const r = await acaoCriarTemplate(clienteId, {
      nome: modelo.nome,
      categoria: 'MARKETING',
      componentes: modelo.componentes,
      exemplos: modelo.exemplos,
      exemplosDoCartao: modelo.exemplosDoCartao,
    })
    if (r.ok) criados.push(modelo.nome)
    else falhas.push({ nome: modelo.nome, erro: r.erro ?? 'não foi possível criar' })
  }
  return { ok: true, criados, jaExistiam, falhas }
}
