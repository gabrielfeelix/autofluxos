import 'server-only'
import { createHmac } from 'node:crypto'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import {
  ETAPA_DE_QUEM_COMPROU,
  ETIQUETAS_DA_GREENN,
  frasesDaVenda,
  type SituacaoDaGreenn,
  type VendaDaGreenn,
} from '@/core/greenn'
import { iguais } from '@/lib/segredo'
import { alertar } from './alertar'
import { mudarMarketing } from './consentimento'
import { db, ehIdInvalido } from './db'
import { gravarCampos } from './repos/campos'
import { acharContatoPeloTelefone } from './repos/contato-por-telefone'
import { aplicarFato } from './repos/crm'
import { criarEtiqueta, listarEtiquetas, marcarContatos } from './repos/etiquetas'
import { acrescentarNota, criarContato } from './repos/leads'
import { listarQuadros, porContatoNaEtapa } from './repos/quadros'
import { inscreverNoEvento, sairPelaEtiqueta, sairPorEvento } from './sequencias'

/**
 * A venda da Greenn dentro do Dialogon (Solar Buy-Side, nov/2026).
 *
 * A Greenn é checkout de fora: a venda acontece lá e só o aviso chega aqui. O
 * que o aviso faz é **etiquetar**, e a mensagem sai pelas sequências que a conta
 * liga a cada etiqueta, que já têm atraso, modelo aprovado e etiqueta de saída:
 *
 * | Greenn                      | Etiqueta             | O que mais                                  |
 * |-----------------------------|----------------------|---------------------------------------------|
 * | `paid`                      | Comprou              | estágio cliente, etapa "Comprou" se houver  |
 * | `waiting_payment`           | Pagamento pendente   | (o lembrete é a sequência dessa etiqueta)   |
 * | `refunded` / `chargedback`  | Reembolso            | sai das sequências e das transmissões       |
 *
 * Assim a boas-vindas é "sequência da etiqueta Comprou, passo 0 com o modelo",
 * e o lembrete do boleto é "sequência de Pagamento pendente, passo de 1 dia,
 * etiqueta de saída Comprou". Nada disso precisa de código novo para mudar.
 */

// ---------------------------------------------------------------------------
// O token do endereço
// ---------------------------------------------------------------------------

/**
 * O token que vai no endereço do webhook (`?token=`), um por conta.
 *
 * A Greenn não assina o corpo nem manda cabeçalho próprio: o único segredo
 * possível é o que está na URL que o vendedor cola. Derivado, e não guardado,
 * no molde do token dos cardápios (`cardapios/token-do-webhook.ts`).
 */
export function tokenDaGreenn(clienteId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o webhook da Greenn')
  return createHmac('sha256', `greenn:${chave}`).update(clienteId).digest('base64url')
}

export function greennAutentico(clienteId: string, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, tokenDaGreenn(clienteId))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// O contato
// ---------------------------------------------------------------------------

async function acharPeloEmail(clienteId: string, email: string): Promise<string | null> {
  if (!email) return null
  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .eq('campos->>email', email)
    .limit(1)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não foi possível achar o contato pelo e-mail: ${error.message}`)
  return data ? (data as { id: string }).id : null
}

/**
 * O contato da venda: pelo telefone, depois pelo e-mail, e criado se for venda.
 *
 * **Criar aqui é exceção consciente** à regra do webhook de entrada (evento não
 * cria contato): quem paga ou gera boleto na Greenn digitou o próprio celular
 * no checkout do vendedor, e o aviso vem com o token da conta. Reembolso não
 * cria: de quem nunca esteve na base não há o que tirar.
 */
async function contatoDaVenda(
  clienteId: string,
  venda: VendaDaGreenn,
): Promise<{ id: string; novo: boolean } | null> {
  const peloTelefone = venda.telefone ? await acharContatoPeloTelefone(clienteId, venda.telefone) : null
  if (peloTelefone) return { id: peloTelefone, novo: false }

  const peloEmail = await acharPeloEmail(clienteId, venda.email)
  if (peloEmail) return { id: peloEmail, novo: false }

  if (venda.situacao === 'reembolso') return null
  if (chavesDoTelefone(venda.telefone).length === 0) return null

  const criado = await criarContato(clienteId, { nome: venda.nome || 'Cliente Greenn', telefone: venda.telefone })
  if (!criado.ok) throw new Error(`não foi possível criar o contato: ${criado.motivo}`)
  return { id: criado.contatoId, novo: true }
}

// ---------------------------------------------------------------------------
// Etiquetas e funil
// ---------------------------------------------------------------------------

async function etiquetaPeloNome(clienteId: string, nome: string, cor: 'verde' | 'ambar' | 'rosa'): Promise<string> {
  const achar = async () =>
    (await listarEtiquetas(clienteId)).find((e) => e.nome.trim().toLowerCase() === nome.toLowerCase())?.id ?? null
  const existente = await achar()
  if (existente) return existente
  const criada = await criarEtiqueta(clienteId, { nome, cor })
  if (criada.ok) return criada.etiqueta.id
  // Dois avisos ao mesmo tempo: o outro criou primeiro.
  const depois = await achar()
  if (depois) return depois
  throw new Error(`não foi possível criar a etiqueta ${nome}: ${criada.motivo}`)
}

const COR: Record<SituacaoDaGreenn, 'verde' | 'ambar' | 'rosa'> = { paga: 'verde', aguardando: 'ambar', reembolso: 'rosa' }

/** Aplica a etiqueta com o mesmo efeito da tela: saída e entrada nas sequências. */
async function etiquetar(clienteId: string, contatoId: string, situacao: SituacaoDaGreenn): Promise<string> {
  const etiquetaId = await etiquetaPeloNome(clienteId, ETIQUETAS_DA_GREENN[situacao], COR[situacao])
  const r = await marcarContatos(clienteId, etiquetaId, [contatoId], true)
  if (r.ok && r.mudaram > 0) {
    await sairPelaEtiqueta(clienteId, etiquetaId, r.validos)
    await inscreverNoEvento(clienteId, r.validos, 'etiqueta_aplicada', etiquetaId)
  }
  return etiquetaId
}

/** Tira uma etiqueta da Greenn, se a conta já a tiver. Não cria para tirar. */
async function desetiquetar(clienteId: string, contatoId: string, situacao: SituacaoDaGreenn): Promise<void> {
  const nome = ETIQUETAS_DA_GREENN[situacao].toLowerCase()
  const etiqueta = (await listarEtiquetas(clienteId)).find((e) => e.nome.trim().toLowerCase() === nome)
  if (etiqueta) await marcarContatos(clienteId, etiqueta.id, [contatoId], false)
}

/** A primeira etapa chamada "Comprou", em qualquer funil da conta. */
async function etapaDeQuemComprou(clienteId: string): Promise<{ quadroId: string; etapaId: string } | null> {
  for (const quadro of await listarQuadros(clienteId)) {
    const etapa = quadro.etapas.find((e) => e.nome.trim().toLowerCase() === ETAPA_DE_QUEM_COMPROU)
    if (etapa) return { quadroId: quadro.id, etapaId: etapa.id }
  }
  return null
}

// ---------------------------------------------------------------------------
// A venda
// ---------------------------------------------------------------------------

export type ResultadoDaGreenn = 'feito' | 'sem_contato'

/**
 * O aviso, do contato à etiqueta. Estoura em falha de banco: quem chama está
 * num `after()` e transforma o erro em alerta.
 *
 * **Repetir o mesmo aviso não repete nada**: etiqueta já aplicada não reinscreve
 * (`mudaram === 0`), estágio igual não escreve, e a anotação é o único rastro
 * duplicado, que é inofensivo.
 */
export async function tratarVendaDaGreenn(clienteId: string, venda: VendaDaGreenn): Promise<ResultadoDaGreenn> {
  const contato = await contatoDaVenda(clienteId, venda)
  if (!contato) {
    if (venda.situacao !== 'reembolso') {
      await alertar('venda da Greenn sem telefone que dê para casar', venda.telefone || '(vazio)', {
        cliente: clienteId,
        venda: venda.vendaId,
      })
    }
    return 'sem_contato'
  }
  const contatoId = contato.id

  // O e-mail da compra passa a morar na ficha: é por ele que o próximo aviso
  // acha a pessoa se ela trocar de celular.
  if (venda.email) {
    await gravarCampos(clienteId, contatoId, {
      email: { valor: venda.email, origem: 'importacao', autorId: null, em: new Date().toISOString() },
    }).catch(() => undefined)
  }

  await acrescentarNota(clienteId, contatoId, frasesDaVenda(venda))

  if (venda.situacao === 'paga') {
    await desetiquetar(clienteId, contatoId, 'aguardando')
    await desetiquetar(clienteId, contatoId, 'reembolso')
    await etiquetar(clienteId, contatoId, 'paga')
    await aplicarFato(clienteId, contatoId, 'ganhou')
    const etapa = await etapaDeQuemComprou(clienteId)
    if (etapa) await porContatoNaEtapa(clienteId, contatoId, etapa.quadroId, etapa.etapaId)
    return 'feito'
  }

  if (venda.situacao === 'aguardando') {
    await etiquetar(clienteId, contatoId, 'aguardando')
    return 'feito'
  }

  // Reembolso ou chargeback: sai de todo acompanhamento e de toda transmissão.
  // A saída das transmissões é o registro de "não recebe promoções", com o
  // motivo escrito: é o único filtro que todo envio de marketing respeita, e
  // mandar promoção para quem contestou a compra é pedir denúncia de spam.
  await desetiquetar(clienteId, contatoId, 'paga')
  await desetiquetar(clienteId, contatoId, 'aguardando')
  await etiquetar(clienteId, contatoId, 'reembolso')
  await sairPorEvento(contatoId, 'reembolso')
  await mudarMarketing({
    clienteId,
    contatoId,
    aceito: false,
    origem: 'api',
    textoExibido: `Saiu das campanhas automaticamente: ${venda.status === 'chargedback' ? 'chargeback' : 'reembolso'} na Greenn.`,
  })
  return 'feito'
}
