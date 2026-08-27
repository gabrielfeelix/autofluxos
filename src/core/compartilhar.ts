import { fluxoSchema, type Fluxo, type No } from './flow/schema'
import { mensagensDoHandoff, partesDaMensagem } from './flow/mensagem'

/**
 * O que viaja num fluxo compartilhado, e o que fica para trás (0030).
 *
 * Puro e sem rede, como todo `core/`: o servidor decide *se* pode compartilhar,
 * este arquivo decide *o quê* sai. A separação importa porque a limpeza abaixo
 * é a parte que, se errar, vaza credencial de um cliente para outro — e uma
 * regra dessas tem que dar para testar sem banco.
 */

/**
 * Os prazos que a tela oferece.
 *
 * Sem prazo é opção, e não o padrão: link eterno é o que sobra num grupo de
 * WhatsApp dois anos depois. Trinta dias é o padrão porque é o horizonte de
 * quem manda o link para um colega decidir — mais que isso já é material fixo,
 * e aí a pessoa escolhe conscientemente.
 */
export const PRAZOS_DO_LINK = [
  { valor: '7', rotulo: '7 dias', dias: 7 },
  { valor: '30', rotulo: '30 dias', dias: 30 },
  { valor: 'sem-prazo', rotulo: 'Sem prazo', dias: null },
] as const

export type ValorDePrazo = (typeof PRAZOS_DO_LINK)[number]['valor']

export const PRAZO_PADRAO: ValorDePrazo = '30'

export function diasDoPrazo(valor: string): number | null {
  const achado = PRAZOS_DO_LINK.find((prazo) => prazo.valor === valor)
  // Valor desconhecido cai no padrão em vez de virar "sem prazo". Um `select`
  // de aba velha não pode produzir o link mais permissivo dos três.
  return (achado ?? PRAZOS_DO_LINK.find((p) => p.valor === PRAZO_PADRAO)!).dias
}

/**
 * O que a pessoa precisa saber **antes** de gerar o link.
 *
 * Escondido, isto vira a descoberta ruim: alguém compartilha a triagem inteira
 * do cliente sem perceber que o texto das mensagens vai junto. A tela mostra
 * esta lista no momento de criar, não num aviso genérico depois.
 */
export type AvisoDoCompartilhamento = {
  codigo: 'TEXTOS_VISIVEIS' | 'CREDENCIAL_NAO_VIAJA' | 'ENDERECOS_EXTERNOS' | 'IA_NAO_VIAJA' | 'ARQUIVOS_DO_ACERVO'
  mensagem: string
}

/**
 * A versão do grafo que sai daqui.
 *
 * **A única coisa removida é `conexaoId`**, e ela é removida por dois motivos
 * independentes — bastaria um. O primeiro é que ela aponta para uma linha de
 * `connections` da conta de origem, e um id de credencial de outra conta não
 * significa nada aqui a não ser um convite a tentar. O segundo é que, mesmo se
 * significasse, o `publicar()` do destino recusaria: ele confere que a conexão
 * é do cliente. Deixar o campo faria a importação nascer com um erro que a
 * pessoa não causou e não sabe corrigir.
 *
 * **Nada mais é reescrito.** Em particular, texto, URL de mídia e URL de API
 * saem inteiros: um fluxo com o miolo apagado não é um fluxo compartilhado, é
 * um esqueleto que ninguém consegue usar. Quem não quer que o texto viaje não
 * gera o link — e é por isso que o aviso existe.
 */
export function limparParaCompartilhar(fluxo: Fluxo): Fluxo {
  return fluxoSchema.parse({
    ...fluxo,
    nodes: fluxo.nodes.map((no) => {
      if (no.type !== 'http') return no
      const resto = { ...no.data }
      delete resto.conexaoId
      return { ...no, data: resto }
    }),
  })
}

/** O que muda para quem recebe, dito antes de o link existir. */
export function avisosDoCompartilhamento(fluxo: Fluxo): AvisoDoCompartilhamento[] {
  const avisos: AvisoDoCompartilhamento[] = [
    {
      codigo: 'TEXTOS_VISIVEIS',
      mensagem:
        'Quem tiver o link lê o desenho inteiro, incluindo o texto das mensagens e as instruções de IA. Não gere o link se houver algo aí que não pode sair da conta.',
    },
  ]

  if (fluxo.nodes.some((no) => no.type === 'http')) {
    avisos.push({
      codigo: 'CREDENCIAL_NAO_VIAJA',
      mensagem:
        'As credenciais de API não viajam — quem importar precisa escolher as dele em Conexões antes de publicar.',
    })

    const enderecos = hostsExternos(fluxo)
    if (enderecos.length > 0) {
      avisos.push({
        codigo: 'ENDERECOS_EXTERNOS',
        mensagem: `Os endereços chamados pelos blocos de API ficam visíveis: ${enderecos.join(', ')}. Chave escrita dentro de uma URL vai junto com ela.`,
      })
    }
  }

  if (fluxo.nodes.some((no) => no.type === 'ia')) {
    avisos.push({
      codigo: 'IA_NAO_VIAJA',
      mensagem:
        'Este fluxo usa IA. Quem importar recebe o desenho, mas a IA nasce desligada — ela é plano à parte e não se transfere por link.',
    })
  }

  if (temArquivoDoAcervo(fluxo)) {
    avisos.push({
      codigo: 'ARQUIVOS_DO_ACERVO',
      mensagem:
        'Os arquivos do Acervo continuam sendo servidos daqui. Quem importar passa a usar os seus arquivos — apagá-los quebra o fluxo dele também.',
    })
  }

  return avisos
}

/**
 * Os domínios que os blocos de API chamam.
 *
 * Só o host, e nunca a URL inteira: o caminho é onde chave costuma aparecer
 * (`.../webhook/abc123`), e o aviso não pode ser o vazamento que ele denuncia.
 * URL com `{{variavel}}` no lugar do domínio não tem host conhecido e é
 * omitida em vez de chutada.
 */
export function hostsExternos(fluxo: Fluxo): string[] {
  const hosts = new Set<string>()

  for (const no of fluxo.nodes) {
    if (no.type !== 'http') continue
    try {
      hosts.add(new URL(no.data.url).host)
    } catch {
      // URL montada com variável, ou vazia. Não é erro aqui: quem recusa
      // desenho torto é o `validar()`, na hora de publicar.
    }
  }

  return [...hosts].sort()
}

const PREFIXO_DO_ACERVO = '/storage/v1/object/public/autofluxos-acervo/'

function temArquivoDoAcervo(fluxo: Fluxo): boolean {
  return urlsDeMidia(fluxo).some((url) => url.includes(PREFIXO_DO_ACERVO))
}

/** Toda URL de arquivo do fluxo — no bloco de mídia e nas partes da mensagem. */
export function urlsDeMidia(fluxo: Fluxo): string[] {
  const urls: string[] = []

  for (const no of fluxo.nodes) {
    if (no.type === 'midia') urls.push(no.data.url)
    if (no.type === 'mensagem') {
      for (const parte of partesDaMensagem(no)) {
        if (parte.tipo === 'midia') urls.push(parte.url)
      }
    }
  }

  return urls
}

/**
 * O resumo que a página pública mostra antes de alguém importar.
 *
 * Existe porque a decisão de importar é tomada por quem ainda não tem a conta
 * aberta ao lado: contar blocos e dizer o que o fluxo faz é o que separa
 * "aceito" de "abro e vejo depois" — e "vejo depois" significa um rascunho
 * abandonado na conta de alguém.
 */
export type ResumoCompartilhado = {
  blocos: number
  perguntas: number
  mensagens: number
  temIa: boolean
  temApi: boolean
  temMidia: boolean
  /** Passa para uma pessoa em algum ponto? É a pergunta que todo mundo faz. */
  temHandoff: boolean
}

export function resumirFluxo(fluxo: Fluxo): ResumoCompartilhado {
  const conta = (tipo: No['type']) => fluxo.nodes.filter((no) => no.type === tipo).length

  return {
    blocos: fluxo.nodes.length,
    perguntas: conta('pergunta'),
    mensagens: conta('mensagem'),
    temIa: conta('ia') > 0,
    temApi: conta('http') > 0,
    temMidia: conta('midia') > 0 || urlsDeMidia(fluxo).length > 0,
    temHandoff: conta('handoff') > 0,
  }
}

/**
 * O nome com que o fluxo nasce na conta de destino.
 *
 * O sufixo não é enfeite: sem ele, quem importa duas vezes fica com dois
 * "Triagem de orçamento" idênticos na lista e nenhuma forma de saber qual é o
 * seu. Com ele, o importado se anuncia — e renomear é um clique.
 */
export function nomeAoImportar(nome: string): string {
  const limpo = nome.trim() || 'Fluxo importado'
  return limpo.endsWith('(importado)') ? limpo : `${limpo} (importado)`
}

/**
 * O fluxo escrito como roteiro, na ordem em que a conversa acontece.
 *
 * A página pública não desenha o grafo: quem abre o link está decidindo se
 * importa, e para isso precisa **ler** o atendimento, não navegar um canvas.
 * Um React Flow ali custaria o bundle inteiro do editor numa rota que qualquer
 * um alcança sem sessão, para entregar menos.
 *
 * A ordem é de largura a partir do início — é a que segue a conversa. Blocos
 * que ninguém alcança vêm depois, e vêm marcados: fluxo compartilhado com nó
 * solto é coisa que quem recebe precisa ver antes de importar, não descobrir
 * publicando.
 */
export type LinhaDoRoteiro = {
  id: string
  tipo: No['type']
  texto: string
  /** Rótulos das saídas deste bloco, na ordem em que a tela as mostra. */
  saidas: string[]
  alcancavel: boolean
}

export function roteiroDoFluxo(fluxo: Fluxo): LinhaDoRoteiro[] {
  const porId = new Map(fluxo.nodes.map((no) => [no.id, no]))
  const ordem: string[] = []
  const vistos = new Set<string>()
  const fila = porId.has(fluxo.inicio) ? [fluxo.inicio] : []

  while (fila.length > 0) {
    const atual = fila.shift()!
    if (vistos.has(atual)) continue
    vistos.add(atual)
    ordem.push(atual)

    for (const aresta of fluxo.edges) {
      if (aresta.source === atual && porId.has(aresta.target)) fila.push(aresta.target)
    }
  }

  const soltos = fluxo.nodes.filter((no) => !vistos.has(no.id)).map((no) => no.id)

  return [...ordem, ...soltos].map((id) => {
    const no = porId.get(id)!
    return {
      id,
      tipo: no.type,
      texto: textoDoBloco(no),
      saidas: saidasDoBloco(no),
      alcancavel: vistos.has(id),
    }
  })
}

/**
 * O que este bloco diz, em uma linha.
 *
 * O bloco de API não mostra corpo nem cabeçalho de propósito — é onde chave
 * escrita à mão aparece, e a página é pública. Método e host bastam para
 * entender que o fluxo chama algo de fora.
 */
function textoDoBloco(no: No): string {
  switch (no.type) {
    case 'mensagem': {
      const partes = partesDaMensagem(no)
      const texto = partes.find((parte) => parte.tipo === 'texto')?.texto ?? ''
      const extras = partes.filter((parte) => parte.tipo !== 'texto').length
      return texto || (extras > 0 ? `${extras} item(ns) sem texto` : 'mensagem vazia')
    }
    case 'midia':
      return no.data.legenda?.trim() || `envia ${no.data.midia}`
    case 'pergunta':
      return no.data.texto
    case 'condicao':
      return `se ${no.data.variavel} ${no.data.operador} ${no.data.valor}`.trim()
    case 'salvar-campo':
      return `guarda ${no.data.campo}`
    case 'ia':
      return no.data.instrucao
    case 'handoff': {
      // Os dois formatos, como em todo lugar que lê handoff. Na página pública
      // basta a primeira fala: ela é a que diz o que acontece com a conversa.
      const mensagens = mensagensDoHandoff(no)
      const extras = mensagens.length - 1
      return extras > 0 ? `${mensagens[0]} (+${extras})` : (mensagens[0] ?? '')
    }
    case 'http': {
      let host = 'endereço com variável'
      try {
        host = new URL(no.data.url).host
      } catch {
        // URL montada com `{{variavel}}` — ver `hostsExternos`.
      }
      return `${no.data.metodo} em ${host}`
    }
    case 'etapa':
      // O nome da etapa vive no banco da conta de origem, e o link é público:
      // dizer "move para Aula agendada" contaria o funil de um cliente a quem
      // só recebeu um desenho. O que o bloco faz basta.
      return 'move o contato no quadro'
    case 'ir-fluxo':
      // Pelo mesmo motivo da etapa: o nome da outra automação é informação da
      // conta de origem, e quem recebe o link não importa o destino junto — o
      // salto vira um bloco que ele vai ter que apontar para um fluxo dele.
      return 'continua em outra automação'
    case 'voltar':
      /*
       * O destino é um bloco **deste mesmo desenho**, então dizer para onde não
       * vaza nada de fora — mas o `rotulo` guarda o texto do bloco de destino,
       * e esse texto é do cliente. "Volta para 'Qual seu CPF, dona Marina?'"
       * numa página pública entrega o roteiro e às vezes mais do que ele.
       */
      return no.data.destino === '' ? 'volta ao início do fluxo' : 'volta a um passo anterior'
  }
}

function saidasDoBloco(no: No): string[] {
  if (no.type === 'condicao') return ['verdadeiro', 'falso']
  if (no.type !== 'pergunta') return []

  const dinamica = (no.data.opcoesDe ?? '').trim() !== ''
  const base = dinamica ? ['escolheu', 'vazio'] : no.data.opcoes.map((opcao) => opcao.rotulo)
  return no.data.timeoutMinutos ? [...base, 'sem resposta'] : base
}

/** O link expirou, foi revogado, ou ainda vale? */
export type EstadoDoLink = 'valido' | 'revogado' | 'expirado'

export function estadoDoLink(
  link: { expiraEm: string | null; revogadoEm: string | null },
  agora: number = Date.now(),
): EstadoDoLink {
  if (link.revogadoEm) return 'revogado'
  if (!link.expiraEm) return 'valido'

  const prazo = Date.parse(link.expiraEm)
  // Data ilegível não pode virar "vale para sempre". Falha fechado: o pior lado
  // do erro aqui é um link que devia estar morto continuar aberto.
  if (Number.isNaN(prazo)) return 'expirado'

  return prazo > agora ? 'valido' : 'expirado'
}
