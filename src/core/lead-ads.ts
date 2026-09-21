import { telefoneCanonico } from './contatos/telefone'

/**
 * O formulário nativo da Meta, o lead que nunca abriu conversa.
 *
 * ---------------------------------------------------------------------------
 * O que muda em relação ao CTWA
 * ---------------------------------------------------------------------------
 *
 * No clique-pra-WhatsApp a pessoa **escreve**: chega mensagem, e todo o resto
 * do produto já sabe o que fazer com ela. No Lead Ads ela preenche um
 * formulário dentro do Facebook e **nunca fala com ninguém**, o que chega é um
 * registro, não uma conversa.
 *
 * Isso inverte quem começa. Aqui o lead existe antes de qualquer mensagem, e o
 * atendimento é o que precisa acontecer **depois**. É por isso que este caminho
 * não passa pelo motor de fluxo: não há nada a responder ainda.
 *
 * ---------------------------------------------------------------------------
 * A restrição que manda no desenho
 * ---------------------------------------------------------------------------
 *
 * `contacts` tem `wa_id not null` e `unique (client_id, wa_id)`, e a migration
 * do Kanban diz na própria letra que **"o cartão É um contato"**. Telefone é a
 * identidade deste sistema inteiro.
 *
 * Logo: formulário sem telefone não tem onde entrar. Não é limitação a
 * contornar em código, é o modelo dizendo que um lead sem como falar com ele
 * não é lead aqui, é linha de planilha. O caminho certo é o formulário do
 * cliente pedir telefone, e este módulo recusa o resto com motivo legível em
 * vez de inventar identidade.
 */

/** Um campo do formulário, como a Meta devolve: nome e lista de valores. */
export type CampoDaMeta = { name?: unknown; values?: unknown }

export type LeadDoFormulario = {
  /** O `leadgen_id`. É a chave de dedupe: a Meta reentrega o mesmo. */
  leadId: string
  /** Telefone normalizado, pronto para virar `wa_id`. */
  telefone: string
  nome: string
  email: string
  /** Tudo que veio, inclusive o que não reconhecemos. Vira `campos`. */
  respostas: Record<string, string>
}

export type LeadRecusado = { leadId: string; motivo: string }

/**
 * As chaves que a Meta usa nos campos pré-definidos.
 *
 * Campo customizado tem a chave que o anunciante escolheu, `qual_seu_whatsapp`,
 * `telefone_de_contato`, o que ele digitou na hora. Por isso a busca abaixo é
 * por *conter*, e não por igualdade: cobrir só as chaves oficiais deixaria de
 * fora justamente os formulários feitos à mão, que são a maioria no Brasil.
 */
const CHAVES_DE_TELEFONE = ['phone_number', 'phone', 'telefone', 'whatsapp', 'celular', 'fone']
const CHAVES_DE_NOME = ['full_name', 'first_name', 'name', 'nome']
const CHAVES_DE_EMAIL = ['email', 'e_mail', 'mail']

/** A Meta manda `values` como lista, mesmo em campo de valor único. */
function primeiroValor(campo: CampoDaMeta): string {
  const valores = campo.values
  if (!Array.isArray(valores) || valores.length === 0) return ''
  const bruto = valores[0]
  return typeof bruto === 'string' ? bruto.trim() : ''
}

function nomeDoCampo(campo: CampoDaMeta): string {
  return typeof campo.name === 'string' ? campo.name.trim().toLowerCase() : ''
}

function acharPor(respostas: Record<string, string>, pistas: string[]): string {
  /*
   * Casamento exato primeiro, depois parcial. Sem essa ordem, um formulário com
   * `nome` e `nome_da_empresa` poderia devolver a empresa como nome da pessoa,
   * dependendo de qual viesse antes no objeto.
   */
  for (const pista of pistas) {
    const exato = respostas[pista]
    if (exato !== undefined && exato !== '') return exato
  }
  for (const pista of pistas) {
    for (const [chave, valor] of Object.entries(respostas)) {
      if (valor !== '' && chave.includes(pista)) return valor
    }
  }
  return ''
}

/**
 * Traduz o `field_data` da Meta para um lead que este produto sabe guardar.
 *
 * Devolve `{ ok: false }` com motivo em vez de lançar, porque quem chama está
 * num laço processando um lote: um formulário mal montado não pode derrubar os
 * outros dezenove leads que vieram junto.
 */
export function lerLeadDoFormulario(entrada: {
  leadId: string
  fieldData: unknown
}): { ok: true; lead: LeadDoFormulario } | { ok: false; recusa: LeadRecusado } {
  const leadId = entrada.leadId.trim()
  if (leadId === '') {
    return { ok: false, recusa: { leadId: '', motivo: 'veio sem leadgen_id' } }
  }

  const campos = Array.isArray(entrada.fieldData) ? (entrada.fieldData as CampoDaMeta[]) : []
  const respostas: Record<string, string> = {}
  for (const campo of campos) {
    const nome = nomeDoCampo(campo)
    if (nome === '') continue
    respostas[nome] = primeiroValor(campo)
  }

  const telefone = telefoneCanonico(acharPor(respostas, CHAVES_DE_TELEFONE))
  if (telefone === null) {
    /*
     * A recusa é informativa de propósito: o dono precisa saber que o
     * formulário do cliente não pede telefone, porque a correção é lá, e sem
     * esse motivo a queixa chega como "o lead não entrou" e ninguém sabe por quê.
     */
    return {
      ok: false,
      recusa: {
        leadId,
        motivo: 'o formulário não trouxe telefone válido; inclua um campo de telefone nele',
      },
    }
  }

  return {
    ok: true,
    lead: {
      leadId,
      telefone,
      nome: acharPor(respostas, CHAVES_DE_NOME),
      email: acharPor(respostas, CHAVES_DE_EMAIL),
      respostas,
    },
  }
}

/**
 * Os avisos de `leadgen` que vieram num POST do webhook.
 *
 * **`changes` é lista, e o exemplo oficial da Meta traz dois leads no mesmo
 * POST.** Handler que lê `changes[0]` perde lead em rajada, que é exatamente
 * quando o anúncio está performando.
 */
export type AvisoDeLead = { leadgenId: string; formId: string; adId: string; pageId: string }

export function avisosDoWebhook(corpo: unknown): AvisoDeLead[] {
  const raiz = corpo as { object?: unknown; entry?: unknown } | null
  if (!raiz || raiz.object !== 'page' || !Array.isArray(raiz.entry)) return []

  const avisos: AvisoDeLead[] = []
  for (const entrada of raiz.entry) {
    const mudancas = (entrada as { changes?: unknown }).changes
    if (!Array.isArray(mudancas)) continue

    for (const mudanca of mudancas) {
      const m = mudanca as { field?: unknown; value?: Record<string, unknown> }
      if (m.field !== 'leadgen' || !m.value) continue

      const leadgenId = String(m.value.leadgen_id ?? '').trim()
      if (leadgenId === '') continue

      avisos.push({
        leadgenId,
        formId: String(m.value.form_id ?? '').trim(),
        /*
         * `ad_id` some em lead orgânico (formulário em post sem impulsionamento)
         * e em lead de teste da ferramenta da Meta. Vazio é resposta legítima:
         * o lead entra, só não tem anúncio a que se ligar.
         */
        adId: String(m.value.ad_id ?? '').trim(),
        pageId: String(m.value.page_id ?? '').trim(),
      })
    }
  }
  return avisos
}
