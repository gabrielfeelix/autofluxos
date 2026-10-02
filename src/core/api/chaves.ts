/**
 * A chave da API pública, sem banco nem rede (fase 1 de
 * `docs/HANDOFF-02-OUT-API-PUBLICA.md`).
 *
 * Formato: `af_live_<publico>_<segredo>`.
 *
 * - `publico`: 12 caracteres base62. Acha a linha e aparece na tela e no log.
 * - `segredo`: 32 bytes aleatórios em base62 (43 caracteres). Só o SHA-256 dele
 *   vai para o banco.
 *
 * O prefixo reconhecível é de propósito: a varredura de segredo do GitHub e
 * qualquer pessoa que ache a chave colada num lugar errado sabem o que ela é.
 */

export const PREFIXO_DA_CHAVE = 'af_live_'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const TAMANHO_DO_PUBLICO = 12
/** 32 bytes em base62 cabem em 43 caracteres; completamos com zero à esquerda. */
export const TAMANHO_DO_SEGREDO = 43

/**
 * O que uma chave pode fazer. A lista é fechada, e o nome vai para o banco.
 *
 * `fase` diz em que entrega o escopo passa a ter rota. Escopo de fase futura
 * não aparece na tela: uma caixa que não faz nada é pior que caixa nenhuma.
 */
export const ESCOPOS_DA_API = [
  {
    chave: 'contatos:ler',
    grupo: 'Contatos',
    rotulo: 'Ler contatos',
    explicacao: 'Consultar e listar contatos e etiquetas: nome, campos, etiquetas e etapa do funil.',
    fase: 1,
  },
  {
    chave: 'contatos:escrever',
    grupo: 'Contatos',
    rotulo: 'Criar e atualizar contatos',
    explicacao: 'Cadastrar quem veio do seu formulário ou sistema, com campos e etiquetas.',
    fase: 1,
  },
  {
    chave: 'fluxos:disparar',
    grupo: 'Automações',
    rotulo: 'Disparar automações',
    explicacao: 'Começar uma automação publicada para um contato com a conversa aberta.',
    fase: 1,
  },
  {
    chave: 'mensagens:enviar',
    grupo: 'Mensagens',
    rotulo: 'Enviar modelos aprovados',
    explicacao: 'Mandar um modelo aprovado pela Meta, mesmo fora da janela de 24h: lembrete, confirmação, cobrança.',
    aviso: 'Cada mensagem é cobrada pela Meta na conta do WhatsApp da organização.',
    fase: 2,
  },
  {
    chave: 'funil:ler',
    grupo: 'Funil',
    rotulo: 'Ler o funil',
    explicacao: 'Ver os funis, as etapas e em que oportunidade cada contato está.',
    fase: 4,
  },
  {
    chave: 'funil:escrever',
    grupo: 'Funil',
    rotulo: 'Mover o funil',
    explicacao: 'Abrir oportunidade, mudar de etapa e marcar como ganha ou perdida.',
    fase: 4,
  },
] as const satisfies readonly {
  chave: string
  grupo: string
  rotulo: string
  explicacao: string
  aviso?: string
  fase: number
}[]

export type EscopoDaApi = (typeof ESCOPOS_DA_API)[number]['chave']

export function ehEscopoDaApi(valor: unknown): valor is EscopoDaApi {
  return typeof valor === 'string' && ESCOPOS_DA_API.some((escopo) => escopo.chave === valor)
}

/** Base62 de bytes aleatórios. Divisão longa: sem viés de módulo sobre 256. */
export function base62(bytes: Uint8Array): string {
  const digitos = [...bytes]
  let saida = ''
  while (digitos.some((d) => d !== 0)) {
    let resto = 0
    for (let i = 0; i < digitos.length; i++) {
      const acumulado = resto * 256 + (digitos[i] ?? 0)
      digitos[i] = Math.floor(acumulado / 62)
      resto = acumulado % 62
    }
    saida = BASE62[resto] + saida
  }
  return saida || '0'
}

/** Sorteia o segredo: 32 bytes, sempre 43 caracteres. */
export function sortearSegredo(aleatorio: (n: number) => Uint8Array): string {
  return base62(aleatorio(32)).padStart(TAMANHO_DO_SEGREDO, '0')
}

/** Sorteia o `publico`: 12 caracteres, um byte por caractere, descartando o viés. */
export function sortearPublico(aleatorio: (n: number) => Uint8Array): string {
  let saida = ''
  while (saida.length < TAMANHO_DO_PUBLICO) {
    for (const byte of aleatorio(TAMANHO_DO_PUBLICO * 2)) {
      // 248 = 62 × 4: acima disso o módulo favoreceria os primeiros caracteres.
      if (byte < 248 && saida.length < TAMANHO_DO_PUBLICO) saida += BASE62[byte % 62]
    }
  }
  return saida
}

export type ChaveLida = { publico: string; segredo: string }

/**
 * Separa a chave recebida em `publico` e `segredo`, ou `null` se não tem a
 * forma de uma chave nossa. Não diz se ela existe: isso é com o banco.
 */
export function lerChave(bruta: string): ChaveLida | null {
  if (!bruta.startsWith(PREFIXO_DA_CHAVE)) return null
  const resto = bruta.slice(PREFIXO_DA_CHAVE.length)
  const publico = resto.slice(0, TAMANHO_DO_PUBLICO)
  if (resto[TAMANHO_DO_PUBLICO] !== '_') return null
  const segredo = resto.slice(TAMANHO_DO_PUBLICO + 1)
  if (!/^[A-Za-z0-9]+$/.test(publico) || publico.length !== TAMANHO_DO_PUBLICO) return null
  if (!/^[A-Za-z0-9]+$/.test(segredo)) return null
  if (segredo.length !== TAMANHO_DO_SEGREDO) return null
  return { publico, segredo }
}

export function montarChave(publico: string, segredo: string): string {
  return `${PREFIXO_DA_CHAVE}${publico}_${segredo}`
}

/** Como a chave aparece na tela depois de criada: nunca o segredo. */
export function chaveMascarada(publico: string, final: string): string {
  return `${PREFIXO_DA_CHAVE}${publico}_••••${final}`
}

/** O token do cabeçalho `Authorization: Bearer <token>`, ou `null`. */
export function tokenDoCabecalho(cabecalho: string | null): string | null {
  if (!cabecalho) return null
  const [tipo, token, ...sobra] = cabecalho.trim().split(/\s+/)
  if (sobra.length > 0 || !token || tipo?.toLowerCase() !== 'bearer') return null
  return token
}

/** "usada há 5 min", "usada há 3 dias", "nunca usada". */
export function quandoFoiUsada(ultimaEm: string | null, agora: Date = new Date()): string {
  if (!ultimaEm) return 'nunca usada'
  const segundos = Math.max(0, Math.round((agora.getTime() - new Date(ultimaEm).getTime()) / 1000))
  if (segundos < 60) return 'usada agora'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `usada há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `usada há ${horas} h`
  const dias = Math.round(horas / 24)
  return `usada há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
