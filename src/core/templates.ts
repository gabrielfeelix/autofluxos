/**
 * Os modelos aprovados da Meta — as regras, sem rede e sem banco.
 *
 * ---------------------------------------------------------------------------
 * O que um template é, e por que ele manda no produto
 * ---------------------------------------------------------------------------
 *
 * Fora da janela de 24h (ver `channels/janela.ts`) o WhatsApp recusa texto
 * livre. A única coisa que atravessa é um modelo aprovado antes pela Meta. Sem
 * isso não existe lembrete de véspera, retomada de conversa nem transmissão —
 * e é por isso que `0031_sequencias.sql` nasceu com passo limitado a 1440
 * minutos.
 *
 * Este arquivo guarda o que dá para conferir **antes** de falar com a Meta. A
 * recusa dela chega horas depois, em inglês, e às vezes sem dizer o que está
 * errado: cada validação aqui é uma viagem de 24h que a pessoa não perde.
 */

/** As três categorias da Meta. A escolha muda o **preço** da mensagem. */
export const CATEGORIAS = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const STATUS_DO_TEMPLATE = [
  'rascunho',
  'pendente',
  'aprovado',
  'recusado',
  'pausado',
  'desativado',
] as const
export type StatusDoTemplate = (typeof STATUS_DO_TEMPLATE)[number]

/**
 * Só template **aprovado** entrega mensagem.
 *
 * `pausado` engana: parece temporário e é — a Meta despausa sozinha em 3h, 6h
 * ou nunca, conforme seja a primeira, a segunda ou a terceira vez. Mas enquanto
 * está pausado, envio falha. Tratar como "quase aprovado" é o caminho para uma
 * transmissão inteira virar erro.
 */
export function podeEnviar(status: StatusDoTemplate): boolean {
  return status === 'aprovado'
}

// ---------------------------------------------------------------------------
// Os limites da Meta
// ---------------------------------------------------------------------------

/** Body é o único componente obrigatório, e tem teto de 1024. */
export const LIMITE_BODY = 1024
/** Footer não aceita variável nenhuma e para em 60. */
export const LIMITE_FOOTER = 60
/** Header de texto aceita **uma** variável, no máximo. */
export const LIMITE_VARIAVEIS_NO_HEADER = 1
/** Dez botões no total, somando todos os tipos. */
export const LIMITE_BOTOES = 10
/** Teto por tipo de botão. Estourar é recusa certa. */
export const LIMITE_POR_TIPO_DE_BOTAO = {
  QUICK_REPLY: 10,
  URL: 2,
  PHONE_NUMBER: 1,
  COPY_CODE: 1,
} as const

/**
 * Acima disto o WhatsApp Desktop **esconde os botões**.
 *
 * Não é recusa da Meta — o template é aprovado e funciona no celular. Mas
 * quatro botões viram "Ver todas as opções" no mobile e **somem** no Desktop,
 * junto com qualquer mistura de quick reply com outro tipo. O cliente monta,
 * testa no celular, funciona; o cliente dele abre no computador e não vê nada.
 *
 * Por isso é aviso e não erro: recusar seria passar por cima de uma escolha
 * legítima de quem só atende por celular.
 */
export const BOTOES_SEGUROS_NO_DESKTOP = 3

export type TipoDeBotao = keyof typeof LIMITE_POR_TIPO_DE_BOTAO

export type Botao = {
  tipo: TipoDeBotao
  texto: string
  /** URL para `URL`, telefone para `PHONE_NUMBER`. */
  valor?: string
}

export type Componentes = {
  cabecalho?: { tipo: 'texto'; texto: string } | { tipo: 'imagem' | 'video' | 'documento' }
  corpo: string
  rodape?: string
  botoes?: Botao[]
}

// ---------------------------------------------------------------------------
// O nome
// ---------------------------------------------------------------------------

/**
 * A Meta só aceita minúsculas, números e underscore — e recusa sem explicar.
 *
 * Como a pessoa escreve o nome pensando em título ("Lembrete de consulta"),
 * normalizar é mais gentil que recusar: vira `lembrete_de_consulta` e segue.
 */
export function normalizarNome(bruto: string): string {
  return bruto
    .normalize('NFD')
    // Tira acento: `ç` vira `c`, `ã` vira `a`. A Meta não aceita nenhum dos dois.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512)
}

export function nomeValido(nome: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(nome)
}

// ---------------------------------------------------------------------------
// As variáveis
// ---------------------------------------------------------------------------

/**
 * Acha as variáveis posicionais de um texto: `{{1}}`, `{{2}}`...
 *
 * Devolve ordenado e sem repetição — `{{1}} ... {{1}}` é uma variável usada
 * duas vezes, não duas variáveis.
 */
export function variaveisDe(texto: string): number[] {
  const achadas = new Set<number>()
  for (const casamento of texto.matchAll(/\{\{(\d+)\}\}/g)) {
    achadas.add(Number(casamento[1]))
  }
  return [...achadas].sort((a, b) => a - b)
}

/**
 * A numeração precisa começar em 1 e não pular.
 *
 * `{{1}} {{3}}` é recusa da Meta: ela espera a sequência fechada, porque o
 * envio manda um array e a posição é o que liga valor e lacuna.
 */
export function numeracaoContinua(variaveis: number[]): boolean {
  return variaveis.every((n, i) => n === i + 1)
}

// ---------------------------------------------------------------------------
// A validação
// ---------------------------------------------------------------------------

export type Reparo = {
  gravidade: 'erro' | 'aviso'
  campo: 'nome' | 'cabecalho' | 'corpo' | 'rodape' | 'botoes'
  recado: string
}

/**
 * Confere o que dá para conferir aqui — e devolve recado em português.
 *
 * `erro` impede submeter; `aviso` deixa passar. A distinção importa: recusar o
 * que a Meta aceitaria seria inventar regra, e quem paga por isso é quem só
 * atende por celular e não liga para o Desktop.
 */
export function validarTemplate(
  nome: string,
  componentes: Componentes,
  categoria: Categoria,
): Reparo[] {
  const reparos: Reparo[] = []

  if (!nomeValido(nome)) {
    reparos.push({
      gravidade: 'erro',
      campo: 'nome',
      recado:
        'O nome só pode ter letras minúsculas, números e underscore — a Meta recusa acento, espaço e maiúscula.',
    })
  }

  const corpo = componentes.corpo?.trim() ?? ''
  if (!corpo) {
    reparos.push({
      gravidade: 'erro',
      campo: 'corpo',
      recado: 'O corpo da mensagem é obrigatório — é a única parte que a Meta exige.',
    })
  } else if (corpo.length > LIMITE_BODY) {
    reparos.push({
      gravidade: 'erro',
      campo: 'corpo',
      recado: `O corpo passou de ${LIMITE_BODY} caracteres (tem ${corpo.length}).`,
    })
  }

  const doCorpo = variaveisDe(corpo)
  if (doCorpo.length > 0 && !numeracaoContinua(doCorpo)) {
    reparos.push({
      gravidade: 'erro',
      campo: 'corpo',
      recado: `As variáveis têm que ser {{1}}, {{2}}, {{3}}... sem pular número. Achei ${doCorpo
        .map((n) => `{{${n}}}`)
        .join(', ')}.`,
    })
  }

  // Variável sozinha na borda: a Meta recusa porque não consegue avaliar o
  // conteúdo final — o template inteiro poderia virar outra coisa.
  if (/^\s*\{\{\d+\}\}/.test(corpo) || /\{\{\d+\}\}\s*$/.test(corpo)) {
    reparos.push({
      gravidade: 'aviso',
      campo: 'corpo',
      recado:
        'Variável no começo ou no fim do texto costuma ser recusada. Ponha alguma palavra antes ou depois.',
    })
  }

  if (componentes.cabecalho?.tipo === 'texto') {
    const doCabecalho = variaveisDe(componentes.cabecalho.texto)
    if (doCabecalho.length > LIMITE_VARIAVEIS_NO_HEADER) {
      reparos.push({
        gravidade: 'erro',
        campo: 'cabecalho',
        recado: `O cabeçalho aceita no máximo ${LIMITE_VARIAVEIS_NO_HEADER} variável (tem ${doCabecalho.length}).`,
      })
    }
  }

  const rodape = componentes.rodape?.trim()
  if (rodape) {
    if (rodape.length > LIMITE_FOOTER) {
      reparos.push({
        gravidade: 'erro',
        campo: 'rodape',
        recado: `O rodapé passou de ${LIMITE_FOOTER} caracteres (tem ${rodape.length}).`,
      })
    }
    if (variaveisDe(rodape).length > 0) {
      reparos.push({
        gravidade: 'erro',
        campo: 'rodape',
        recado: 'O rodapé não aceita variável.',
      })
    }
  }

  const botoes = componentes.botoes ?? []
  if (botoes.length > LIMITE_BOTOES) {
    reparos.push({
      gravidade: 'erro',
      campo: 'botoes',
      recado: `São no máximo ${LIMITE_BOTOES} botões (tem ${botoes.length}).`,
    })
  }

  for (const tipo of Object.keys(LIMITE_POR_TIPO_DE_BOTAO) as TipoDeBotao[]) {
    const quantos = botoes.filter((b) => b.tipo === tipo).length
    const teto = LIMITE_POR_TIPO_DE_BOTAO[tipo]
    if (quantos > teto) {
      reparos.push({
        gravidade: 'erro',
        campo: 'botoes',
        recado: `A Meta aceita no máximo ${teto} ${
          teto === 1 ? 'botão' : 'botões'
        } do tipo ${tipo} (tem ${quantos}).`,
      })
    }
  }

  // O aviso do Desktop: some sem erro, e ninguém descobre até um cliente
  // reclamar que "não apareceu botão nenhum".
  const misturados = new Set(botoes.map((b) => b.tipo)).size > 1
  const temQuickReply = botoes.some((b) => b.tipo === 'QUICK_REPLY')
  if (botoes.length > BOTOES_SEGUROS_NO_DESKTOP || (misturados && temQuickReply)) {
    reparos.push({
      gravidade: 'aviso',
      campo: 'botoes',
      recado:
        'Com mais de 3 botões, ou misturando botão de resposta rápida com outro tipo, eles somem no WhatsApp do computador. No celular funcionam.',
    })
  }

  if (categoria === 'AUTHENTICATION' && botoes.some((b) => b.tipo !== 'COPY_CODE')) {
    reparos.push({
      gravidade: 'erro',
      campo: 'botoes',
      recado: 'Template de autenticação só aceita botão de copiar código.',
    })
  }

  return reparos
}

export function temErro(reparos: Reparo[]): boolean {
  return reparos.some((r) => r.gravidade === 'erro')
}

// ---------------------------------------------------------------------------
// O que a Meta responde no envio
// ---------------------------------------------------------------------------

/**
 * Os três estados de uma mensagem recém-enviada — e o do meio é uma armadilha.
 *
 * `retida` é `held_for_quality_assessment`: a Meta **segurou** a mensagem para
 * avaliar. Acontece com template novo, com template sem nota verde e — desde
 * 2026 — com portfólio novo de pouco histórico. Se o veredito for ruim, o
 * template é pausado e **cada mensagem retida é descartada**, chegando depois
 * como `failed` com código 132015.
 *
 * Quem lê só o 200 do POST mostra "enviado" e nada saiu. Por isso `retida` não
 * é sinônimo de `aceita` em lugar nenhum do código.
 */
export function lerStatusDeEnvio(messageStatus: string | undefined): 'aceita' | 'retida' | 'falhou' {
  if (messageStatus === 'held_for_quality_assessment') return 'retida'
  if (messageStatus === 'paused') return 'falhou'
  return 'aceita'
}

// ---------------------------------------------------------------------------
// Erros: o que fazer com cada um
// ---------------------------------------------------------------------------

export type Conduta =
  /** Transitório: esperar e tentar de novo. */
  | 'repetir'
  /** Deste contato, nunca mais. Número inválido, bloqueio, país restrito. */
  | 'desistir'
  /** Limite por usuário: esperar 24h. Repetir antes **piora**. */
  | 'esperar_24h'
  /** Bug nosso no payload. Repetir só repete o erro. */
  | 'corrigir_codigo'
  /** O template morreu. Não adianta tentar outro destinatário. */
  | 'template_pausado'

/**
 * Traduz o código de erro da Meta em decisão.
 *
 * As classes são incompatíveis: repetir o que é terminal queima número, e
 * desistir do que é transitório perde entrega. Misturar as cinco numa política
 * de retry só é o jeito mais rápido de queimar a nota de qualidade.
 */
export function condutaPara(codigo: number): Conduta {
  switch (codigo) {
    case 130429: // throughput estourado
    case 80007: // rate limit da conta
    case 131057: // conta em manutenção (upgrade de throughput, até 1 min)
      return 'repetir'

    case 131026: // não entregável: não é usuário, bloqueou, ou app velho
      return 'desistir'

    case 131049: // limite de marketing por usuário — decisão da Meta, não nossa
    case 131056: // mensagens demais para o mesmo contato em pouco tempo
      return 'esperar_24h'

    case 132000: // contagem de parâmetros não bate
    case 132012: // formato do valor não bate
    case 132001: // template não existe nesse idioma, ou não foi aprovado
    case 132005: // texto traduzido passou do limite
      return 'corrigir_codigo'

    case 132015: // template pausado por qualidade
    case 132007: // conteúdo viola a política
      return 'template_pausado'

    default:
      // Erro que ninguém previu: repetir uma vez é mais seguro que desistir de
      // uma campanha inteira por um código novo da Meta.
      return 'repetir'
  }
}

/** Explica o erro em português, para a tela. */
export function explicarErro(codigo: number): string {
  switch (codigo) {
    case 130429:
    case 80007:
      return 'A Meta limitou o ritmo de envio. Vamos tentar de novo em instantes.'
    case 131057:
      return 'A conta está em manutenção na Meta. Vamos tentar de novo em instantes.'
    case 131026:
      return 'Este número não recebe: ou não tem WhatsApp, ou bloqueou a empresa.'
    case 131049:
      return 'A Meta segurou esta mensagem para não encher a caixa da pessoa. Tentamos de novo em 24h.'
    case 131056:
      return 'Mandamos mensagens demais para este contato em pouco tempo.'
    case 132000:
      return 'A quantidade de valores não bate com as variáveis do modelo.'
    case 132001:
      return 'O modelo não existe neste idioma, ou não está aprovado.'
    case 132005:
      return 'O texto ficou maior do que o modelo aprovado permite.'
    case 132012:
      return 'O formato de um dos valores não é o que o modelo espera.'
    case 132007:
      return 'O conteúdo do modelo fere a política da Meta.'
    case 132015:
      return 'A Meta pausou este modelo por baixa qualidade.'
    default:
      return `A Meta recusou com o código ${codigo}.`
  }
}
