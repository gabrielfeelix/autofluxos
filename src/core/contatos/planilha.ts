import { chavesDoTelefone, telefoneCanonico } from './telefone'

/**
 * Ler a planilha do cliente e decidir o que fazer com cada linha.
 *
 * Isto mora em `core/` porque é decisão, não infraestrutura: dado o que está na
 * planilha e o que já existe em contatos, **quais linhas casam, quais criam e
 * quais ficam pendentes**. Sem rede, sem banco, testável linha a linha.
 *
 * A regra que dá o tom: uma linha sem telefone utilizável nunca é descartada em
 * silêncio. Ela vira pendência com o motivo escrito. Importação que "deu certo"
 * e comeu 40 das 300 linhas é pior do que importação que recusa.
 */

export type LinhaDaPlanilha = {
  /** 1-based, contando a linha de cabeçalho. É o que a pessoa vê no editor. */
  numero: number
  nome: string
  telefone: string
}

export type Conciliacao =
  /** Casou com um contato existente. `nomeAtual` é o que a tela mostra hoje. */
  | { tipo: 'casou'; linha: LinhaDaPlanilha; contatoId: string; nomeAtual: string | null }
  /** Telefone bom, mas ninguém nunca conversou com ele. */
  | { tipo: 'novo'; linha: LinhaDaPlanilha; waId: string }
  /** Não dá para casar nem criar. O motivo é escrito para a pessoa consertar. */
  | { tipo: 'pendente'; linha: LinhaDaPlanilha; motivo: string }

/** O que a conciliação precisa saber dos contatos que já existem. */
export type ContatoConhecido = {
  contatoId: string
  waId: string
  /** O que a tela mostra hoje: corrigido, ou o do perfil. */
  nomeAtual: string | null
}

/**
 * Lê um CSV simples: cabeçalho na primeira linha, `,` ou `;` como separador.
 *
 * `;` é o padrão do Excel em português e é o que sai de uma planilha brasileira
 * salva como CSV — aceitar só `,` faria a importação mais comum falhar com "uma
 * coluna só", que é um erro difícil de entender olhando o arquivo.
 *
 * Aspas são respeitadas porque nome com vírgula existe ("Silva, Maria").
 */
export function lerCsv(texto: string): { cabecalho: string[]; linhas: string[][] } {
  const limpo = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const primeira = limpo.slice(0, limpo.indexOf('\n') === -1 ? undefined : limpo.indexOf('\n'))
  // Mais `;` do que `,` na primeira linha decide o separador. Contar na linha
  // toda enganaria: um único nome "Silva, Maria" tem vírgula e nem por isso o
  // arquivo é separado por vírgula.
  const separador = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ';' : ','

  const linhas: string[][] = []
  let campo = ''
  let atual: string[] = []
  let entreAspas = false

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]

    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"'
          i++
        } else entreAspas = false
      } else campo += c
      continue
    }

    if (c === '"') entreAspas = true
    else if (c === separador) {
      atual.push(campo)
      campo = ''
    } else if (c === '\n') {
      atual.push(campo)
      linhas.push(atual)
      atual = []
      campo = ''
    } else campo += c
  }

  if (campo !== '' || atual.length > 0) {
    atual.push(campo)
    linhas.push(atual)
  }

  const uteis = linhas.filter((l) => l.some((c) => c.trim() !== ''))
  const cabecalho = (uteis.shift() ?? []).map((c) => c.trim())
  return { cabecalho, linhas: uteis }
}

/** Como as colunas costumam se chamar numa planilha de verdade. */
const NOMES_DE_COLUNA = {
  nome: ['nome', 'name', 'aluno', 'cliente', 'contato', 'nome completo', 'nome do aluno'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'phone', 'zap', 'numero', 'número'],
}

/**
 * Descobre qual coluna é o nome e qual é o telefone.
 *
 * Adivinhar em vez de exigir um formato fixo é a diferença entre "exporte sua
 * planilha e mande" e "reorganize sua planilha nas colunas A e B". Devolve
 * `-1` quando não achou, e quem chama transforma isso numa mensagem, não num
 * palpite.
 */
export function acharColunas(cabecalho: string[]): { nome: number; telefone: number } {
  const normal = cabecalho.map((c) =>
    c
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  )

  const procurar = (candidatos: string[]) => {
    const exato = normal.findIndex((c) => candidatos.includes(c))
    if (exato !== -1) return exato
    return normal.findIndex((c) => candidatos.some((alvo) => c.includes(alvo)))
  }

  return {
    nome: procurar(NOMES_DE_COLUNA.nome.map((c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))),
    telefone: procurar(
      NOMES_DE_COLUNA.telefone.map((c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
    ),
  }
}

/**
 * Decide o destino de cada linha contra os contatos que já existem.
 *
 * O índice é montado por **todas** as chaves de cada contato, não pelo `wa_id`
 * literal: é assim que `551187654321` no banco encontra `(11) 98765-4321` na
 * planilha. Ver `chavesDoTelefone`.
 */
export function conciliar(
  linhas: LinhaDaPlanilha[],
  conhecidos: ContatoConhecido[],
): Conciliacao[] {
  const porChave = new Map<string, ContatoConhecido>()
  for (const contato of conhecidos) {
    for (const chave of chavesDoTelefone(contato.waId)) {
      // O primeiro ganha. Dois contatos que colidem em chave são o mesmo
      // aparelho gravado duas vezes, e escolher um é melhor do que casar a
      // linha da planilha com o mais recente por acaso de ordem.
      if (!porChave.has(chave)) porChave.set(chave, contato)
    }
  }

  const jaVistos = new Set<string>()

  return linhas.map((linha) => {
    if (linha.telefone.trim() === '') {
      return { tipo: 'pendente' as const, linha, motivo: 'sem telefone na planilha' }
    }

    const chaves = chavesDoTelefone(linha.telefone)
    if (chaves.length === 0) {
      return {
        tipo: 'pendente' as const,
        linha,
        motivo: 'telefone incompleto — falta o DDD',
      }
    }

    const canonico = telefoneCanonico(linha.telefone)
    if (canonico === null) {
      return { tipo: 'pendente' as const, linha, motivo: 'telefone não reconhecido' }
    }

    // A própria planilha repetindo a mesma pessoa é comum, e importar duas
    // vezes criaria dois contatos com o mesmo número.
    if (chaves.some((chave) => jaVistos.has(chave))) {
      return { tipo: 'pendente' as const, linha, motivo: 'telefone repetido na planilha' }
    }
    for (const chave of chaves) jaVistos.add(chave)

    const achado = chaves.map((chave) => porChave.get(chave)).find(Boolean)
    if (achado) {
      return {
        tipo: 'casou' as const,
        linha,
        contatoId: achado.contatoId,
        nomeAtual: achado.nomeAtual,
      }
    }

    return { tipo: 'novo' as const, linha, waId: canonico }
  })
}

/** O resumo que a tela mostra antes de alguém confirmar a importação. */
export function resumir(conciliacoes: Conciliacao[]) {
  return {
    casou: conciliacoes.filter((c) => c.tipo === 'casou').length,
    novos: conciliacoes.filter((c) => c.tipo === 'novo').length,
    pendentes: conciliacoes.filter((c) => c.tipo === 'pendente').length,
    /** Casou e o nome da planilha é diferente do que a tela mostra hoje. */
    renomeia: conciliacoes.filter(
      (c) =>
        c.tipo === 'casou' &&
        c.linha.nome.trim() !== '' &&
        c.linha.nome.trim() !== (c.nomeAtual ?? '').trim(),
    ).length,
  }
}
