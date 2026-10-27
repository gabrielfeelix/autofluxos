'use server'

import { revalidatePath } from 'next/cache'
import { conectarCardapioWeb, desligarCardapioWeb } from './cardapios/cardapio-web'
import { exigirCapacidade, recusou } from './permissoes'
import { registrar } from './repos/auditoria'
import { cardapioDaConta, salvarCardapio } from './repos/cardapios'

/**
 * Integrações > Cardápio e delivery. Mexe em integração e guarda credencial,
 * então é de quem configura a operação, como ligar a loja on-line.
 */

type Resposta = { ok: true; loja?: string } | { ok: false; erro: string }

export async function acaoConectarCardapioWeb(clienteId: string, chave: string, avisarCliente: boolean): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  try {
    const r = await conectarCardapioWeb(clienteId, chave, avisarCliente)
    if (!r.ok) return r
    await auditar(clienteId, acesso, 'conectou_cardapio_web')
    revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
    return { ok: true, loja: r.loja }
  } catch (erro) {
    console.error('[cardápio web] a conexão não foi gravada', erro)
    return { ok: false, erro: 'Não foi possível conectar agora. Tente de novo.' }
  }
}

export async function acaoDesligarCardapioWeb(clienteId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  await desligarCardapioWeb(clienteId)
  await auditar(clienteId, acesso, 'desligou_cardapio_web')
  revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
  return { ok: true }
}

/** Liga ou desliga o aviso ao cliente sem mexer na chave. */
export async function acaoAvisarClienteDoCardapioWeb(clienteId: string, avisar: boolean): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const atual = await cardapioDaConta(clienteId, 'cardapio_web')
  if (!atual) return { ok: false, erro: 'Conecte o Cardápio Web primeiro.' }
  await salvarCardapio({
    clienteId,
    plataforma: 'cardapio_web',
    conexaoId: atual.conexaoId,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: avisar,
    importarCatalogo: atual.importarCatalogo,
    ativo: atual.ativo,
  })
  return { ok: true }
}

type Acesso = Exclude<Awaited<ReturnType<typeof exigirCapacidade>>, { erro: string }>

async function auditar(clienteId: string, acesso: Acesso, acao: string): Promise<void> {
  await registrar({
    acao,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'integracao',
    alvoNome: 'Cardápio Web',
    impersonadoPor: acesso.sessao.impersonadoPor,
  }).catch(() => undefined)
}
