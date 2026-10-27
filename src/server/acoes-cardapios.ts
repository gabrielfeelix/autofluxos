'use server'

import { revalidatePath } from 'next/cache'
import { conectarCardapioWeb, desligarCardapioWeb } from './cardapios/cardapio-web'
import { conectarFoody, desligarFoody } from './cardapios/foody'
import { conectarGoomer, desligarGoomer } from './cardapios/goomer'
import { conectarOlaClick, desligarOlaClick } from './cardapios/olaclick'
import { exigirCapacidade, recusou } from './permissoes'
import { registrar } from './repos/auditoria'
import { cardapioDaConta, salvarCardapio, type PlataformaConectavel } from './repos/cardapios'

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
  return mudarAviso(clienteId, 'cardapio_web', avisar)
}

export async function acaoConectarOlaClick(clienteId: string, chave: string, avisarCliente: boolean): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  try {
    const r = await conectarOlaClick(clienteId, chave, avisarCliente)
    if (!r.ok) return r
    await auditar(clienteId, acesso, 'conectou_olaclick', 'OlaClick')
    revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
    return { ok: true, loja: r.loja }
  } catch (erro) {
    console.error('[olaclick] a conexão não foi gravada', erro)
    return { ok: false, erro: 'Não foi possível conectar agora. Tente de novo.' }
  }
}

export async function acaoDesligarOlaClick(clienteId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  await desligarOlaClick(clienteId)
  await auditar(clienteId, acesso, 'desligou_olaclick', 'OlaClick')
  revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
  return { ok: true }
}

export async function acaoAvisarClienteDaOlaClick(clienteId: string, avisar: boolean): Promise<Resposta> {
  return mudarAviso(clienteId, 'olaclick', avisar)
}

export async function acaoConectarGoomer(
  clienteId: string,
  clientId: string,
  clientSecret: string,
  avisarCliente: boolean,
): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  try {
    const r = await conectarGoomer(clienteId, clientId, clientSecret, avisarCliente)
    if (!r.ok) return r
    await auditar(clienteId, acesso, 'conectou_goomer', 'Goomer')
    revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
    return { ok: true, loja: r.loja }
  } catch (erro) {
    console.error('[goomer] a conexão não foi gravada', erro)
    return { ok: false, erro: 'Não foi possível conectar agora. Tente de novo.' }
  }
}

export async function acaoDesligarGoomer(clienteId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  await desligarGoomer(clienteId)
  await auditar(clienteId, acesso, 'desligou_goomer', 'Goomer')
  revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
  return { ok: true }
}

export async function acaoAvisarClienteDaGoomer(clienteId: string, avisar: boolean): Promise<Resposta> {
  return mudarAviso(clienteId, 'goomer', avisar)
}

export async function acaoConectarFoody(clienteId: string, token: string, avisarCliente: boolean): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  try {
    const r = await conectarFoody(clienteId, token, avisarCliente)
    if (!r.ok) return r
    await auditar(clienteId, acesso, 'conectou_foody', 'Foody Delivery')
    revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
    return { ok: true }
  } catch (erro) {
    console.error('[foody] a conexão não foi gravada', erro)
    return { ok: false, erro: 'Não foi possível conectar agora. Tente de novo.' }
  }
}

export async function acaoDesligarFoody(clienteId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  await desligarFoody(clienteId)
  await auditar(clienteId, acesso, 'desligou_foody', 'Foody Delivery')
  revalidatePath(`/clientes/${clienteId}/loja/cardapios`)
  return { ok: true }
}

export async function acaoAvisarClienteDaFoody(clienteId: string, avisar: boolean): Promise<Resposta> {
  return mudarAviso(clienteId, 'foody', avisar)
}

async function mudarAviso(clienteId: string, plataforma: PlataformaConectavel, avisar: boolean): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const atual = await cardapioDaConta(clienteId, plataforma)
  if (!atual) return { ok: false, erro: 'Conecte a plataforma primeiro.' }
  await salvarCardapio({
    clienteId,
    plataforma,
    conexaoId: atual.conexaoId,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: avisar,
    importarCatalogo: atual.importarCatalogo,
    ativo: atual.ativo,
  })
  return { ok: true }
}

type Acesso = Exclude<Awaited<ReturnType<typeof exigirCapacidade>>, { erro: string }>

async function auditar(clienteId: string, acesso: Acesso, acao: string, alvo = 'Cardápio Web'): Promise<void> {
  await registrar({
    acao,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'integracao',
    alvoNome: alvo,
    impersonadoPor: acesso.sessao.impersonadoPor,
  }).catch(() => undefined)
}
