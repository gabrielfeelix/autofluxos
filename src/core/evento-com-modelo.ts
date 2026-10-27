import { z } from 'zod'
import { telefoneCanonico } from './contatos/telefone'
import type { Botao } from './templates'

/**
 * "Começar pelo modelo": o evento de outro sistema manda um modelo aprovado, e
 * o modelo é a primeira pergunta do fluxo (Automações > Eventos).
 *
 * Nasceu da pesquisa pós-compra da PCYES (26/out/2026), que era regra fixa no
 * código: nome do evento, modelos, variáveis, aceite e número de teste. Aqui
 * tudo isso vira configuração do gatilho, guardada em
 * `gatilhos_de_evento.modelo` (0152). É o caminho que o mercado usa (WATI,
 * Zoko, Klaviyo): evento da loja, modelo aprovado com as lacunas ligadas a
 * campos do pedido, e a resposta seguindo um fluxo.
 *
 * Por que o modelo e não uma mensagem comum: quem compra no site quase nunca
 * escreveu para a loja no WhatsApp, então não há janela de 24h aberta, e fora
 * dela só modelo aprovado sai.
 */
export type ModeloDoEvento = {
  /**
   * Os modelos, em ordem: sai o primeiro aprovado. O segundo segura enquanto a
   * Meta revisa uma versão nova do primeiro.
   */
  modelos: string[]
  /** Um campo do aviso por lacuna do corpo, em ordem: `nome` vai no `{{1}}`. */
  variaveis: string[]
  /** Cria o contato pelo telefone do aviso. Só com aceite (`campoDeAceite`). */
  criarContato: boolean
  /** O campo do aviso que precisa vir `true` para o modelo sair. Vazio: não exige. */
  campoDeAceite: string
  /** O campo que identifica o envio, para sair uma vez só (o número do pedido). */
  umaVezPor: string
  /** Recebem mesmo sem aceite: é como se testa antes de o site mandar o aceite. */
  telefonesDeTeste: string[]
  /**
   * A imagem do cabeçalho, para modelo com cabeçalho de imagem (o mascote da
   * PCYES). Sem ela a Meta entrega o modelo sem a imagem aprovada (27/out/2026).
   */
  imagem?: string
}

const campo = z
  .string()
  .trim()
  .max(60)
  .regex(/^[\w.]*$/, 'o nome do campo só tem letra, número, ponto e sublinhado')

const esquema = z.object({
  modelos: z.array(z.string().trim().min(1).max(512)).min(1).max(3),
  variaveis: z.array(campo.min(1)).max(10),
  criarContato: z.boolean(),
  campoDeAceite: campo,
  umaVezPor: campo,
  telefonesDeTeste: z.array(z.string().trim().min(1)).max(5),
  imagem: z.string().trim().url().startsWith('https://').max(500).optional(),
})

/** O que veio do banco, ou `null` quando o gatilho não começa pelo modelo. */
export function lerModeloDoEvento(bruto: unknown): ModeloDoEvento | null {
  const lido = esquema.safeParse(bruto)
  return lido.success ? lido.data : null
}

/**
 * Confere a configuração antes de gravar. Devolve o recado para a tela, ou a
 * configuração limpa (telefones normalizados).
 */
export function conferirModeloDoEvento(
  bruto: unknown,
): { ok: true; modelo: ModeloDoEvento } | { ok: false; erro: string } {
  const lido = esquema.safeParse(bruto)
  if (!lido.success) {
    const primeiro = lido.error.issues[0]
    const onde = primeiro?.path[0]
    if (onde === 'modelos') return { ok: false, erro: 'Escolha o modelo que sai.' }
    return { ok: false, erro: primeiro?.message ?? 'Configuração inválida.' }
  }
  const modelo = lido.data

  /*
   * Contato novo a partir de um aviso só com aceite: o telefone vem de outro
   * sistema, e a política da Meta exige que a pessoa tenha aceitado receber
   * WhatsApp da empresa antes da primeira mensagem.
   */
  if (modelo.criarContato && !modelo.campoDeAceite) {
    return { ok: false, erro: 'Para criar o contato, diga qual campo do aviso traz o aceite de WhatsApp.' }
  }

  const telefones: string[] = []
  for (const telefone of modelo.telefonesDeTeste) {
    const canonico = telefoneCanonico(telefone)
    if (!canonico) return { ok: false, erro: `O telefone de teste ${telefone} não é um número válido.` }
    telefones.push(canonico)
  }
  return { ok: true, modelo: { ...modelo, telefonesDeTeste: [...new Set(telefones)] } }
}

/**
 * O valor de um campo do aviso, com ponto para entrar em objeto
 * (`cliente.nome`). Só texto e número viram valor; o resto é ausência.
 */
export function valorDoCampo(dados: Record<string, unknown>, caminho: string): string {
  let atual: unknown = dados
  for (const parte of caminho.split('.')) {
    if (!atual || typeof atual !== 'object' || Array.isArray(atual)) return ''
    atual = (atual as Record<string, unknown>)[parte]
  }
  return typeof atual === 'string' || typeof atual === 'number' ? String(atual).trim().slice(0, 80) : ''
}

/**
 * Os valores das lacunas do corpo, em ordem, ou o nome do primeiro campo que
 * veio vazio. A Meta recusa lacuna vazia, então faltar é motivo para não
 * mandar, e para dizer qual faltou.
 */
export function valoresDoAviso(
  modelo: ModeloDoEvento,
  dados: Record<string, unknown>,
): { ok: true; valores: string[] } | { ok: false; faltou: string } {
  const valores: string[] = []
  for (const caminho of modelo.variaveis) {
    const valor = valorDoCampo(dados, caminho)
    if (!valor) return { ok: false, faltou: caminho }
    valores.push(valor)
  }
  return { ok: true, valores }
}

/** Se a pessoa aceitou, ou é um telefone de teste. */
export function podeReceber(modelo: ModeloDoEvento, dados: Record<string, unknown>, waId: string): boolean {
  if (modelo.telefonesDeTeste.includes(waId)) return true
  if (!modelo.campoDeAceite) return true
  return lerCaminho(dados, modelo.campoDeAceite) === true
}

function lerCaminho(dados: Record<string, unknown>, caminho: string): unknown {
  let atual: unknown = dados
  for (const parte of caminho.split('.')) {
    if (!atual || typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[parte]
  }
  return atual
}

/**
 * Os campos simples do aviso, para virarem variáveis do fluxo (`{{pedido}}`,
 * `{{customer_id}}`). Com teto: o corpo vem de outro sistema.
 */
export function variaveisDoAviso(dados: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(dados).slice(0, 40)) {
    if (!/^\w{1,40}$/.test(chave)) continue
    if (typeof valor === 'string' || typeof valor === 'number') vars[chave] = String(valor).trim().slice(0, 200)
  }
  return vars
}

/**
 * Os botões de resposta do modelo que não casam com nenhuma opção da primeira
 * pergunta. O toque chega como texto do botão (`paraEntrada`), e a pergunta
 * casa pelo rótulo: botão sem opção correspondente cai em "não entendi".
 */
export function botoesSemOpcao(botoes: Botao[] | undefined, opcoes: { rotulo: string }[]): string[] {
  const rotulos = opcoes.map((o) => normalizar(o.rotulo))
  return (botoes ?? [])
    .filter((b) => b.tipo === 'QUICK_REPLY')
    .map((b) => b.texto)
    .filter((texto) => !rotulos.includes(normalizar(texto)))
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** O campo do contato que guarda os envios já feitos deste evento. */
export function campoDosEnvios(evento: string): string {
  return `enviados_${evento.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}`
}
