import 'server-only'
import { createHash } from 'node:crypto'
import { canalDoSite } from '@/channels/site'
import type { ValorDeCampo } from '@/core/campos'
import {
  camposQueFaltam,
  type MensagemPublica,
  mensagemPublica,
  TETO_DA_MENSAGEM,
  type TipoDoFormulario,
} from '@/core/chat-do-site'
import { PREFIXO_DO_SITE } from '@/core/contatos/visitante-do-site'
import { db } from './db'
import { gravarCampos } from './repos/campos'
import type { CanalDoSite } from './repos/canais-site'
import { type Mensagem, tratarUma } from './receber-mensagem'

/**
 * O caminho de uma mensagem do balão do site até a resposta.
 *
 * Mesmo desenho do `receber-do-instagram.ts`: o que muda entre os canais é o
 * formato de quem chega, e o que acontece depois (dedupe, contato, trava da
 * conversa, motor, IA, handoff, histórico) é o `tratarUma` de sempre. Aqui só
 * se traduz o que o balão mandou para a forma interna.
 *
 * ---------------------------------------------------------------------------
 * Quem é o visitante
 * ---------------------------------------------------------------------------
 *
 * O navegador gera um segredo aleatório na primeira visita e o guarda. O
 * endereço do contato é o hash do segredo junto com o id do canal: o mesmo
 * navegador em duas lojas diferentes vira dois contatos, e ninguém que leia o
 * banco (ou o Inbox) tem o que precisa para se passar pelo visitante. É o
 * segredo, e só ele, que abre a conversa: nenhuma rota aceita id de contato,
 * de sessão ou de mensagem vindo do navegador.
 */

/** O endereço do visitante neste canal. Ver o cabeçalho. */
export function enderecoDoVisitante(canalId: string, segredo: string): string {
  const hash = createHash('sha256').update(`${canalId}:${segredo}`).digest('hex')
  // 40 hex são 160 bits: colisão entre visitantes não acontece na vida da loja.
  return `${PREFIXO_DO_SITE}${hash.slice(0, 40)}`
}

export type ChegadaDoSite =
  | { tipo: 'texto'; ref: string; texto: string }
  | { tipo: 'opcao'; ref: string; opcaoId: string; rotulo: string }

/**
 * Traduz o que o balão mandou para a forma interna.
 *
 * O `id` da mensagem carrega o endereço e o `ref` do balão. O endereço entra
 * para o `ref` (que o navegador escolhe) não poder colidir com a mensagem de
 * outro visitante: o `wa_message_id` é único no banco inteiro, e um `ref`
 * repetido de propósito derrubaria a mensagem de outra pessoa como duplicada.
 * Do mesmo visitante, repetir o `ref` é exatamente o reenvio que o dedupe
 * existe para descartar.
 */
export function paraMensagemInterna(endereco: string, chegou: ChegadaDoSite): Mensagem {
  const base = { id: `${endereco}:${chegou.ref}`, from: endereco }

  if (chegou.tipo === 'opcao') {
    return {
      ...base,
      type: 'interactive',
      interactive: { button_reply: { id: chegou.opcaoId, title: chegou.rotulo } },
    }
  }

  return { ...base, type: 'text', text: { body: chegou.texto.slice(0, TETO_DA_MENSAGEM) } }
}

/** O formulário do balão, já conferido por `lerFicha`. */
export type FichaDoVisitante = { nome: string | null; campos: Record<string, string> }

export async function receberDoSite(
  canal: CanalDoSite,
  segredo: string,
  chegou: ChegadaDoSite,
  pagina: string | null,
  ficha: FichaDoVisitante | null = null,
): Promise<void> {
  const endereco = enderecoDoVisitante(canal.id, segredo)
  const mensagem = paraMensagemInterna(endereco, chegou)

  // O nome do formulário entra como "nome do perfil", o mesmo que o WhatsApp
  // manda: é o que deixa a primeira resposta do fluxo já chamar pelo nome.
  // Nulo é "não sei", não "apague": o nome dado antes sobrevive.
  await tratarUma(canal, mensagem, ficha?.nome ?? null, () => canalDoSite())

  if (ficha && Object.keys(ficha.campos).length) await guardarFicha(canal.clienteId, endereco, ficha.campos)
  if (pagina) await lembrarPagina(canal.clienteId, endereco, pagina)
}

/**
 * Os campos do formulário vão para a ficha do lead com origem `contato`: a
 * pessoa disse o próprio dado, o que vale mais que o bot deduzir e menos que a
 * equipe corrigir (`core/campos.ts`). Depois do `tratarUma`, porque é ele que
 * cria o contato, e contato sem mensagem é robô testando a rota.
 *
 * O WhatsApp informado vai para `campos.whatsapp` e **não junta** com o
 * contato do WhatsApp de mesmo número: ver `docs/DECISIONS.md`.
 */
async function guardarFicha(clienteId: string, endereco: string, campos: Record<string, string>): Promise<void> {
  const { data } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .eq('wa_id', endereco)
    .maybeSingle()
  if (!data) return

  const em = new Date().toISOString()
  const novos: Record<string, ValorDeCampo> = {}
  for (const [chave, valor] of Object.entries(campos)) novos[chave] = { valor, origem: 'contato', autorId: null, em }
  await gravarCampos(clienteId, data.id, novos)
}

/**
 * Em que página do site a pessoa estava quando escreveu.
 *
 * Vai para os campos do contato, que o Inbox já mostra ao lado da conversa:
 * "estava na página do monitor X" é metade da resposta para quem atende. Só
 * grava quando mudou, para não escrever no contato a cada mensagem.
 */
async function lembrarPagina(clienteId: string, endereco: string, pagina: string): Promise<void> {
  const { data } = await db()
    .from('contacts')
    .select('id, campos')
    .eq('client_id', clienteId)
    .eq('wa_id', endereco)
    .maybeSingle()
  if (!data) return

  const campos = (data.campos ?? {}) as Record<string, string>
  if (campos.pagina_do_site === pagina) return

  await db()
    .from('contacts')
    .update({ campos: { ...campos, pagina_do_site: pagina } })
    .eq('id', data.id)
}

/**
 * A conversa deste visitante, como o balão a desenha.
 *
 * Achar o contato pelo endereço, que sai do segredo, é o que garante que cada
 * navegador só lê a própria conversa. As últimas 100 mensagens bastam para o
 * balão: ninguém rola um chat de loja até o mês passado.
 */
export async function conversaDoVisitante(
  canal: CanalDoSite,
  segredo: string,
): Promise<{ mensagens: MensagemPublica[]; identificado: boolean; faltam: TipoDoFormulario[] }> {
  const endereco = enderecoDoVisitante(canal.id, segredo)

  const { data: contato, error } = await db()
    .from('contacts')
    .select('id, nome, nome_real, campos')
    .eq('client_id', canal.clienteId)
    .eq('wa_id', endereco)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar o visitante: ${error.message}`)
  const formulario = canal.config.formulario
  if (!contato) return { mensagens: [], identificado: false, faltam: camposQueFaltam(formulario, null) }

  const { data, error: erro } = await db()
    .from('messages')
    .select('id, direcao, texto, ts, payload, wa_message_id')
    .eq('contact_id', contato.id)
    // Reação não é mensagem: é enfeite colado em outra, e o balão não as tem.
    .is('reagiu_a', null)
    .order('ts', { ascending: false })
    .limit(100)

  if (erro) throw new Error(`não deu para ler a conversa: ${erro.message}`)

  const campos = (contato.campos ?? {}) as Record<string, string>
  const faltam = camposQueFaltam(formulario, { nome: contato.nome_real || contato.nome || null, campos })
  return {
    mensagens: (data ?? []).reverse().map(mensagemPublica),
    // Para o balão de antes, ainda em cache em algum navegador.
    identificado: Boolean(contato.nome_real || contato.nome) && Boolean(campos.whatsapp || campos.email),
    faltam,
  }
}

/**
 * O visitante disse quem é: nome, e WhatsApp ou e-mail.
 *
 * **O WhatsApp informado vai para `campos.whatsapp`, nunca para `telefone`.**
 * `telefone` é o que a consulta de pedido usa como prova de que o pedido é de
 * quem pergunta, e um número digitado num formulário não prova nada: qualquer
 * um digita o telefone de outra pessoa. No site, "Meu pedido" confere pelo CPF.
 *
 * Só escreve em contato que já existe: o formulário aparece depois da primeira
 * mensagem, e um endereço sem conversa é um robô testando a rota.
 */
export async function identificarVisitante(
  canal: CanalDoSite,
  segredo: string,
  dados: { nome: string; contato: string },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (nome.length < 2) return { ok: false, motivo: 'Escreva seu nome.' }

  const bruto = dados.contato.trim()
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruto) ? bruto.toLowerCase().slice(0, 120) : null
  const digitos = bruto.replace(/\D/g, '')
  const whatsapp = !email && digitos.length >= 10 && digitos.length <= 13 ? digitos : null
  if (!email && !whatsapp) return { ok: false, motivo: 'Informe um WhatsApp com DDD ou um e-mail.' }

  const endereco = enderecoDoVisitante(canal.id, segredo)
  const { data, error } = await db()
    .from('contacts')
    .select('id, campos, nome_real')
    .eq('client_id', canal.clienteId)
    .eq('wa_id', endereco)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar o visitante: ${error.message}`)
  if (!data) return { ok: false, motivo: 'Mande uma mensagem antes.' }

  const campos = { ...((data.campos ?? {}) as Record<string, string>) }
  if (email) campos.email = email
  if (whatsapp) campos.whatsapp = whatsapp

  const { error: erro } = await db()
    .from('contacts')
    // `nome` é o "nome do perfil", o que o canal diz. `nome_real` é o que a
    // equipe corrigiu, e não é sobrescrito por um formulário.
    .update({ nome, campos })
    .eq('id', data.id)
  if (erro) throw new Error(`não deu para guardar o contato do visitante: ${erro.message}`)

  return { ok: true }
}
