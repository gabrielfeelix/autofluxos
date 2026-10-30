'use server'

import { after } from 'next/server'
import { avisarPedidoDeExclusao } from './avisos-por-email'
import { linkDoPainel } from './email'
import { situacaoDoLimite } from './limite'
import { registrar } from './repos/auditoria'
import { acharCliente } from './repos/clientes'
import { organizacoesSoDele, papelNaConta } from './repos/usuarios'
import { contasDoUsuario, sessaoAtual } from './sessao'

/**
 * "Pedir exclusão": da própria conta de acesso, ou da organização inteira.
 *
 * **Pede, não apaga.** Quem executa é a 4YU, pela administração
 * (`acaoApagarConta`, `acaoAdminExcluirUsuario`), depois de conferir: apagar
 * é irreversível, a organização pode ter canal conectado, e o pedido pode não
 * ter sido da pessoa (sessão esquecida aberta). O prazo prometido é o da
 * página `/exclusao-de-dados`: confirmar em 2 dias úteis, concluir em 15.
 *
 * O pedido fica na auditoria (`pediu_exclusao`) e sai por e-mail para os dois
 * lados: o comprovante para quem pediu, e o pedido para `contato@dialogon.com.br`.
 */

export type ResultadoDoPedidoDeExclusao = { ok: true; email: string } | { ok: false; erro: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function acaoPedirExclusao(dados: {
  alvo: 'usuario' | 'organizacao'
  clienteId?: string | null
  motivo?: string
}): Promise<ResultadoDoPedidoDeExclusao> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'Sua sessão expirou. Entre de novo.' }
  if (sessao.impersonadoPor) return { ok: false, erro: 'O pedido de exclusão só a própria pessoa faz, não o suporte.' }
  if (dados.alvo !== 'usuario' && dados.alvo !== 'organizacao') return { ok: false, erro: 'Pedido inválido.' }

  const usuario = sessao.usuario
  const motivo = String(dados.motivo ?? '').trim().slice(0, 500)

  // Três pedidos por dia bastam para quem mudou de ideia no meio; mais que isso
  // é alguém enchendo a caixa da 4YU.
  const limite = await situacaoDoLimite(`exclusao:${usuario.id}`, 3, 24 * 60 * 60)
  if (limite !== 'livre') return { ok: false, erro: 'Seu pedido já foi enviado. A 4YU responde por e-mail.' }

  let organizacao: string
  let link: string
  let contaDoPedido: string | null = null

  if (dados.alvo === 'organizacao') {
    const clienteId = String(dados.clienteId ?? '')
    if (!UUID.test(clienteId)) return { ok: false, erro: 'Organização inválida.' }
    if ((await papelNaConta(clienteId, usuario.id)) !== 'owner') {
      return { ok: false, erro: 'Só o proprietário pode pedir a exclusão da organização.' }
    }
    const cliente = await acharCliente(clienteId)
    if (!cliente) return { ok: false, erro: 'Esta organização não existe mais.' }
    contaDoPedido = clienteId
    organizacao = cliente.nome
    link = linkDoPainel(`/admin/organizacoes/${clienteId}/perigo`)
  } else {
    // Excluir o login deixaria sem dono a organização em que ele é o único
    // proprietário; a administração recusa (`acaoAdminExcluirUsuario`), então
    // o pedido também não sai.
    const soDele = await organizacoesSoDele(usuario.id)
    if (soDele.length > 0) {
      const nomes = soDele.map((item) => item.nome).join(', ')
      return {
        ok: false,
        erro: `Você é o único proprietário de ${nomes}. Passe a posse para outra pessoa, ou peça a exclusão da organização em Configurações, Dados da organização.`,
      }
    }
    organizacao = (await contasDoUsuario(usuario.id)).map((conta) => conta.nome).join(', ') || 'Nenhuma'
    link = linkDoPainel('/admin/usuarios')
  }

  await registrar({
    acao: 'pediu_exclusao',
    autorId: usuario.id,
    autorEmail: usuario.email,
    contaId: contaDoPedido,
    ...(contaDoPedido ? { contaNome: organizacao } : {}),
    alvoTipo: dados.alvo === 'organizacao' ? 'client' : 'usuario',
    alvoId: contaDoPedido ?? usuario.id,
    alvoNome: dados.alvo === 'organizacao' ? organizacao : usuario.nome,
    detalhes: { alvo: dados.alvo, ...(motivo ? { motivo } : {}) },
  })

  const pessoa = { email: usuario.email, nome: usuario.nome }
  after(() => avisarPedidoDeExclusao({ pessoa, alvo: dados.alvo, organizacao, motivo, link }))
  return { ok: true, email: usuario.email }
}
