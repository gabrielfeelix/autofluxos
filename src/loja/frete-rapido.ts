/**
 * "Onde está meu pedido?" pela Frete Rápido, a plataforma de frete da loja.
 *
 * O Magento sabe que o pedido foi pago e enviado; quem sabe **onde ele está**
 * é a Frete Rápido, que contrata a transportadora e recebe as ocorrências dela.
 * Ver https://dev.freterapido.com.br/ecommerce/rastreamento_ocorrencias/.
 *
 * ---------------------------------------------------------------------------
 * Só leitura, e isso está no código, não na boa vontade
 * ---------------------------------------------------------------------------
 *
 * A Frete Rápido não tem token só de leitura: o mesmo token cota e contrata
 * frete. Então a trava é daqui:
 *
 *  - **uma chamada só**, `GET` em endereço fixo. Não existe outra função, e o
 *    teste falha se o método ou o endereço mudarem;
 *  - o número do pedido passa por `numeroDoPedidoValido` antes de virar URL:
 *    só dígitos, para ninguém trocar o caminho com `../`;
 *  - quem chama aqui já conferiu no Magento que o pedido é de quem pergunta.
 *    Este módulo não confere nada, e por isso nunca é chamado sozinho.
 *
 * O token vai na query string porque é assim que a API pede. Por isso o
 * endereço montado nunca vai para log nem para mensagem de erro.
 */

export const ENDERECO_DA_FRETE_RAPIDO = 'https://freterapido.com/api/external/embarcador/v1/quotes'

const PRAZO_MS = 8_000

export type OcorrenciaDeEntrega = {
  situacao: string
  quando: string
  detalhe: string
}

export type RastreioDaFreteRapido = {
  transportadora: string
  codigo: string
  previsao: string
  ultima: OcorrenciaDeEntrega | null
  ocorrencias: OcorrenciaDeEntrega[]
}

/** Só dígitos, até 20. É o que impede o número de mexer no caminho da URL. */
export function numeroDoPedidoValido(numero: string): string | null {
  const limpo = numero.replace(/^#/, '').trim()
  return /^\d{1,20}$/.test(limpo) ? limpo : null
}

export function urlDasOcorrencias(numero: string, token: string): string {
  return `${ENDERECO_DA_FRETE_RAPIDO}/${numero}/occurrences?token=${encodeURIComponent(token)}`
}

type OcorrenciaCrua = {
  nome?: unknown
  descricao_ocorrencia?: unknown
  mensagem?: unknown
  data_ocorrencia?: unknown
  data_prevista_entrega?: unknown
  razao_social_transportadora?: unknown
  codigo_volume?: unknown
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** `2026-09-30 11:41:13` vira `30/09 11:41`; `2026-10-02` vira `02/10/2026`. */
export function dataLegivel(v: unknown): string {
  const s = texto(v)
  const comHora = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  if (comHora) return `${comHora[3]}/${comHora[2]} ${comHora[4]}:${comHora[5]}`
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`
  return s
}

/**
 * A resposta vira o recorte que a IA recebe. Aceita a lista solta, que é o
 * que a documentação descreve, e a lista embrulhada num objeto, porque a
 * documentação não mostra o corpo inteiro e ler as duas custa uma linha.
 * `null` quando não há ocorrência nenhuma: frete ainda não coletado.
 */
export function lerOcorrencias(json: unknown): RastreioDaFreteRapido | null {
  const bruto = Array.isArray(json)
    ? json
    : ((json as { occurrences?: unknown; ocorrencias?: unknown } | null)?.occurrences ??
      (json as { ocorrencias?: unknown } | null)?.ocorrencias)
  if (!Array.isArray(bruto) || bruto.length === 0) return null

  const lista = bruto as OcorrenciaCrua[]
  const ocorrencias = lista.map((o) => ({
    situacao: texto(o.nome),
    quando: dataLegivel(o.data_ocorrencia),
    detalhe: texto(o.descricao_ocorrencia) || texto(o.mensagem),
  }))
  // A documentação diz ordem cronológica; o último é o mais recente. Os
  // outros campos podem vir só em algumas linhas, então vale o último que tem.
  const ultimoCom = (campo: keyof OcorrenciaCrua) =>
    [...lista].reverse().map((o) => texto(o[campo])).find((v) => v !== '') ?? ''

  return {
    transportadora: ultimoCom('razao_social_transportadora'),
    codigo: ultimoCom('codigo_volume'),
    previsao: dataLegivel(ultimoCom('data_prevista_entrega')),
    ultima: ocorrencias.at(-1) ?? null,
    // As 5 mais recentes: o histórico inteiro de uma entrega longa é ruído
    // para quem só quer saber onde está.
    ocorrencias: ocorrencias.slice(-5),
  }
}

type Buscar = (url: string, init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>

/**
 * As ocorrências do pedido. `ok: false` só para falha que alguém precisa
 * ver (token recusado, API fora); pedido sem frete ainda é `valor: null`.
 */
export async function rastrearNaFreteRapido(
  numero: string,
  token: string,
  buscar: Buscar = fetch,
): Promise<{ ok: true; valor: RastreioDaFreteRapido | null } | { ok: false; motivo: string }> {
  const valido = numeroDoPedidoValido(numero)
  if (!valido) return { ok: true, valor: null }

  let resposta: Response
  try {
    resposta = await buscar(urlDasOcorrencias(valido, token), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PRAZO_MS),
    })
  } catch {
    // Sem a URL na mensagem: ela carrega o token.
    return { ok: false, motivo: 'a Frete Rápido não respondeu' }
  }

  if (resposta.status === 404) return { ok: true, valor: null }
  if (resposta.status === 401 || resposta.status === 403) {
    return { ok: false, motivo: 'a Frete Rápido recusou o token' }
  }
  if (!resposta.ok) return { ok: false, motivo: `a Frete Rápido respondeu ${resposta.status}` }

  try {
    return { ok: true, valor: lerOcorrencias(await resposta.json()) }
  } catch {
    return { ok: false, motivo: 'a Frete Rápido respondeu algo que não é JSON' }
  }
}
