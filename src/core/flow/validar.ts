import {
  FORMATO_VARIAVEL,
  LIMITE_LISTA,
  LIMITE_ROTULO,
  SAIDA_FALSO,
  SAIDA_VERDADEIRO,
  type Fluxo,
  type No,
} from './schema'
import { variaveisCitadas } from '../engine/interpolar'

/**
 * `{{segredo.nome}}` — o namespace reservado para o cofre da v2.
 *
 * Ele atravessa o motor sem ser tocado (o regex de `interpolar()` não casa com
 * ponto), então hoje sairia literal na requisição. Por isso o aviso: é erro de
 * quem desenhou, mas não trava publicação de fluxo que não depende disso.
 */
const CITA_SEGREDO = /\{\{\s*segredo\.[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/

export type Problema = {
  codigo: string
  mensagem: string
  noId?: string
}

export type ResultadoValidacao = {
  /** `false` bloqueia a publicação. */
  ok: boolean
  erros: Problema[]
  avisos: Problema[]
}

/**
 * O que o dono do fluxo tem direito de usar.
 *
 * Repare que é uma **capacidade**, não um cliente: o `core/` continua sem saber
 * que existe tabela `clients` ou coluna `ia_habilitada`. Ele só sabe responder
 * "com IA disponível, este desenho pode ir ao ar?". Quem traduz contrato em
 * capacidade é a camada de fora.
 */
export type Capacidades = {
  /**
   * IA é plano à parte (Etapa 2). O padrão é `false` — **falha fechado**: quem
   * esquecer de dizer que o cliente contratou vê a publicação ser recusada, que
   * é o erro barulhento. O contrário seria vender IA por descuido.
   */
  iaHabilitada?: boolean
}

/**
 * Confere se o fluxo pode ir ao ar.
 *
 * A regra que mais importa aqui é a do handoff alcançável: o sistema se recusa
 * a publicar um bot que não tem como passar a conversa para um humano. É a
 * diferença entre um produto que previne o "hello loop" e um produto que confia
 * na memória de quem desenhou o fluxo.
 */
export function validar(fluxo: Fluxo, capacidades: Capacidades = {}): ResultadoValidacao {
  const { iaHabilitada = false } = capacidades
  const erros: Problema[] = []
  const avisos: Problema[] = []

  const porId = new Map<string, No>()
  for (const no of fluxo.nodes) {
    if (porId.has(no.id)) {
      erros.push({ codigo: 'ID_DUPLICADO', mensagem: `Existe mais de um nó com o id "${no.id}".`, noId: no.id })
    }
    porId.set(no.id, no)
  }

  if (!porId.has(fluxo.inicio)) {
    erros.push({
      codigo: 'SEM_INICIO',
      mensagem: `O fluxo aponta para o nó de início "${fluxo.inicio}", que não existe.`,
    })
  }

  for (const aresta of fluxo.edges) {
    if (!porId.has(aresta.source)) {
      erros.push({ codigo: 'ARESTA_SOLTA', mensagem: `A ligação "${aresta.id}" sai de um nó que não existe.` })
    }
    if (!porId.has(aresta.target)) {
      erros.push({ codigo: 'ARESTA_SOLTA', mensagem: `A ligação "${aresta.id}" chega num nó que não existe.` })
    }
  }

  const saidas = (noId: string) => fluxo.edges.filter((a) => a.source === noId)

  for (const no of fluxo.nodes) {
    const minhasSaidas = saidas(no.id)
    conferirConteudo(no, erros)

    if (no.type === 'pergunta') {
      const { opcoes } = no.data

      if (opcoes.length > LIMITE_LISTA) {
        erros.push({
          codigo: 'OPCOES_DEMAIS',
          mensagem: `"${no.data.texto}" tem ${opcoes.length} opções. O WhatsApp aceita no máximo ${LIMITE_LISTA}.`,
          noId: no.id,
        })
      }

      const vistas = new Set<string>()
      for (const opcao of opcoes) {
        if (vistas.has(opcao.id)) {
          erros.push({
            codigo: 'OPCAO_DUPLICADA',
            mensagem: `A opção "${opcao.rotulo}" está repetida.`,
            noId: no.id,
          })
        }
        vistas.add(opcao.id)

        if (!minhasSaidas.some((a) => a.sourceHandle === opcao.id)) {
          erros.push({
            codigo: 'OPCAO_SEM_SAIDA',
            mensagem: `A opção "${opcao.rotulo}" não leva a lugar nenhum. Ligue ela a outro bloco.`,
            noId: no.id,
          })
        }
      }

      if (opcoes.length === 0 && minhasSaidas.length === 0) {
        erros.push({
          codigo: 'PERGUNTA_SEM_SAIDA',
          mensagem: `"${no.data.texto}" espera uma resposta mas não continua para lugar nenhum.`,
          noId: no.id,
        })
      }
    }

    // O portão comercial da Etapa 2. Sem ele, um fluxo com nó de IA publica
    // para quem não contratou e a conversa vira handoff silencioso em produção
    // — o cliente vê o bot "desistindo" sem ninguém entender por quê.
    if (no.type === 'ia' && !iaHabilitada) {
      erros.push({
        codigo: 'IA_NAO_CONTRATADA',
        mensagem:
          'Este bloco usa IA, que é um plano à parte e não está contratado para este cliente.',
        noId: no.id,
      })
    }

    if (no.type === 'condicao') {
      for (const saida of [SAIDA_VERDADEIRO, SAIDA_FALSO]) {
        if (!minhasSaidas.some((a) => a.sourceHandle === saida)) {
          erros.push({
            codigo: 'CONDICAO_SEM_SAIDA',
            mensagem: `A condição sobre "${no.data.variavel}" não tem saída para "${saida}".`,
            noId: no.id,
          })
        }
      }
    }
  }

  const alcancaveis = alcancaveisA_partirDe(fluxo)

  for (const no of fluxo.nodes) {
    if (!alcancaveis.has(no.id)) {
      avisos.push({
        codigo: 'NO_ORFAO',
        mensagem: 'Este bloco está solto: a conversa nunca chega nele.',
        noId: no.id,
      })
    }
  }

  const temSaidaHumana = [...alcancaveis].some((id) => porId.get(id)?.type === 'handoff')
  if (!temSaidaHumana) {
    erros.push({
      codigo: 'SEM_SAIDA_HUMANA',
      mensagem:
        'Nenhum caminho do fluxo chega a um bloco "Falar com humano". Todo fluxo precisa ter como escapar para uma pessoa.',
    })
  }

  for (const problema of conferirVariaveis(fluxo)) avisos.push(problema)

  return { ok: erros.length === 0, erros, avisos }
}

/**
 * As regras de conteúdo que o Zod não faz mais.
 *
 * O schema garante que o objeto tem o formato certo; aqui a gente cobra que ele
 * faça sentido. A separação existe porque o rascunho passa por estados
 * incompletos enquanto alguém digita — o que não pode é isso ir ao ar.
 */
function conferirConteudo(no: No, erros: Problema[]): void {
  const vazio = (texto: string) => texto.trim() === ''

  const conferirVariavel = (nome: string | undefined, campo: string) => {
    if (nome === undefined || nome === '') return
    if (!FORMATO_VARIAVEL.test(nome)) {
      erros.push({
        codigo: 'VARIAVEL_INVALIDA',
        mensagem: `"${nome}" não serve como nome de ${campo}: comece com letra e use só letras, números e _ (sem espaço nem acento).`,
        noId: no.id,
      })
    }
  }

  switch (no.type) {
    case 'mensagem':
      if (vazio(no.data.texto)) {
        erros.push({ codigo: 'TEXTO_VAZIO', mensagem: 'Esta mensagem está sem texto.', noId: no.id })
      }
      break

    case 'pergunta': {
      if (vazio(no.data.texto)) {
        erros.push({ codigo: 'TEXTO_VAZIO', mensagem: 'Esta pergunta está sem texto.', noId: no.id })
      }
      conferirVariavel(no.data.salvarEm, 'variável')
      for (const opcao of no.data.opcoes) {
        if (vazio(opcao.rotulo)) {
          erros.push({ codigo: 'ROTULO_VAZIO', mensagem: 'Uma das opções está sem rótulo.', noId: no.id })
        } else if (opcao.rotulo.length > LIMITE_ROTULO) {
          erros.push({
            codigo: 'ROTULO_LONGO',
            mensagem: `"${opcao.rotulo}" tem ${opcao.rotulo.length} caracteres. O WhatsApp corta em ${LIMITE_ROTULO}.`,
            noId: no.id,
          })
        }
      }
      break
    }

    case 'condicao':
      conferirVariavel(no.data.variavel, 'variável')
      if (vazio(no.data.variavel)) {
        erros.push({ codigo: 'CONDICAO_SEM_VARIAVEL', mensagem: 'A condição não diz qual variável olhar.', noId: no.id })
      }
      break

    case 'salvar-campo':
      conferirVariavel(no.data.campo, 'campo')
      if (vazio(no.data.campo)) {
        erros.push({ codigo: 'CAMPO_VAZIO', mensagem: 'Este bloco não diz em qual campo guardar.', noId: no.id })
      }
      break

    case 'ia':
      if (vazio(no.data.instrucao)) {
        erros.push({ codigo: 'IA_SEM_INSTRUCAO', mensagem: 'A IA está sem instrução.', noId: no.id })
      }
      conferirVariavel(no.data.salvarEm, 'variável')
      break

    case 'handoff':
      if (vazio(no.data.mensagem)) {
        erros.push({
          codigo: 'TEXTO_VAZIO',
          mensagem: 'Sem mensagem, a pessoa é passada para um humano sem aviso nenhum.',
          noId: no.id,
        })
      }
      break

    case 'http': {
      if (vazio(no.data.url)) {
        erros.push({ codigo: 'URL_VAZIA', mensagem: 'Este bloco não diz qual endereço chamar.', noId: no.id })
      } else if (!no.data.url.trim().startsWith('https://')) {
        // Exigir o `https://` **literal** no começo é de propósito, e o efeito
        // colateral é que a URL não pode começar com `{{variavel}}`.
        //
        // Isso não é limitação a corrigir: as variáveis da sessão vêm do que a
        // pessoa digita no WhatsApp. Se o começo da URL saísse delas, quem está
        // conversando escolheria para onde o nosso servidor faz requisição. A
        // recusa de endereço interno (`server/efeitos/rede.ts`) ainda barraria
        // rede privada, mas um estranho passaria a apontar o servidor para
        // qualquer host externo que quisesse.
        //
        // Se um dia fizer falta ter endereço-base por cliente, o caminho é uma
        // lista de hosts permitidos — não afrouxar isto aqui.
        erros.push({
          codigo: 'URL_INSEGURA',
          mensagem: 'O endereço precisa começar com https:// — o servidor recusa qualquer outro.',
          noId: no.id,
        })
      }

      for (const item of no.data.mapear) {
        conferirVariavel(item.variavel, 'variável')
        if (vazio(item.variavel)) {
          erros.push({
            codigo: 'VARIAVEL_INVALIDA',
            mensagem: 'Um dos mapeamentos não diz em qual variável guardar.',
            noId: no.id,
          })
        }
      }

      if (no.data.metodo === 'POST' && !vazio(no.data.corpo)) {
        const problema = conferirCorpo(no.data.corpo)
        if (problema === 'VARIAVEL_FORA_DE_ASPAS') {
          erros.push({
            codigo: 'VARIAVEL_FORA_DE_ASPAS',
            mensagem:
              'Toda {{variavel}} no corpo precisa estar entre aspas: o que a conversa coleta é sempre texto, e sem as aspas o JSON quebra na hora do envio.',
            noId: no.id,
          })
        } else if (problema === 'CORPO_INVALIDO') {
          erros.push({
            codigo: 'CORPO_INVALIDO',
            mensagem: 'O corpo não é JSON válido.',
            noId: no.id,
          })
        }
      }
      break
    }
  }
}

/**
 * O mesmo padrão que `interpolar()` reconhece. Precisa ser o mesmo, e não um
 * parecido: o que este arquivo aprova é enviado depois de passar por lá, então
 * qualquer diferença entre os dois vira corpo que publica e quebra na conversa.
 *
 * `{{1abc}}` é o exemplo: não é nome de variável válido, `interpolar()` não
 * troca, e o texto sai literal na requisição. Com um regex mais frouxo aqui,
 * isso passaria na validação.
 */
const VARIAVEL_NO_TEXTO = /\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/g

/**
 * Confere o corpo do POST sabendo que as variáveis ainda não viraram nada.
 *
 * Duas regras, e a segunda é a que salva de um bug que só aparece com cliente
 * real conversando:
 *
 * 1. **Toda variável tem que estar entre aspas.** As variáveis da sessão são
 *    sempre texto (`Record<string, string>`), então `{"nome": {{nome}}}` vira
 *    `{"nome": João}` no envio — JSON quebrado. Variável fora de aspas num
 *    corpo JSON é sempre engano, nunca intenção.
 * 2. **Com as aspas garantidas, trocar por `1` e tentar `JSON.parse`.** Como
 *    toda variável está dentro de uma string, a troca não muda a estrutura, e o
 *    que sobrar de errado é erro de sintaxe de verdade.
 */
function conferirCorpo(corpo: string): 'CORPO_INVALIDO' | 'VARIAVEL_FORA_DE_ASPAS' | null {
  const dentroDeTexto = mapaDeTexto(corpo)

  for (const achado of corpo.matchAll(VARIAVEL_NO_TEXTO)) {
    if (achado.index !== undefined && !dentroDeTexto[achado.index]) {
      return 'VARIAVEL_FORA_DE_ASPAS'
    }
  }

  try {
    JSON.parse(corpo.replace(VARIAVEL_NO_TEXTO, '1'))
    return null
  } catch {
    return 'CORPO_INVALIDO'
  }
}

/** Para cada posição do texto, se ela está dentro de uma string JSON. */
function mapaDeTexto(corpo: string): boolean[] {
  const dentro: boolean[] = []
  let emTexto = false
  let escapado = false

  for (let i = 0; i < corpo.length; i++) {
    dentro[i] = emTexto

    if (escapado) {
      escapado = false
      continue
    }
    if (corpo[i] === '\\') {
      escapado = true
      continue
    }
    if (corpo[i] === '"') emTexto = !emTexto
  }

  return dentro
}

function alcancaveisA_partirDe(fluxo: Fluxo): Set<string> {
  const vistos = new Set<string>()
  const fila = [fluxo.inicio]

  while (fila.length > 0) {
    const atual = fila.shift() as string
    if (vistos.has(atual)) continue
    vistos.add(atual)
    for (const aresta of fluxo.edges) {
      if (aresta.source === atual) fila.push(aresta.target)
    }
  }

  return vistos
}

/** Avisa sobre `{{variavel}}` que o fluxo nunca preenche. */
function conferirVariaveis(fluxo: Fluxo): Problema[] {
  const definidas = new Set<string>()
  for (const no of fluxo.nodes) {
    if (no.type === 'pergunta' && no.data.salvarEm) definidas.add(no.data.salvarEm)
    if (no.type === 'salvar-campo') definidas.add(no.data.campo)
    if (no.type === 'ia' && no.data.salvarEm) definidas.add(no.data.salvarEm)
    if (no.type === 'http') {
      for (const item of no.data.mapear) definidas.add(item.variavel)
    }
  }

  const problemas: Problema[] = []
  for (const no of fluxo.nodes) {
    for (const citada of variaveisDoNo(no)) {
      if (!definidas.has(citada)) {
        problemas.push({
          codigo: 'VARIAVEL_DESCONHECIDA',
          mensagem: `Este bloco usa {{${citada}}}, mas nenhum bloco preenche essa informação.`,
          noId: no.id,
        })
      }
    }
  }

  for (const no of fluxo.nodes) {
    if (no.type !== 'http') continue
    const textos = [no.data.url, no.data.corpo, ...no.data.cabecalhos.map((c) => c.valor)]
    if (textos.some((t) => CITA_SEGREDO.test(t))) {
      problemas.push({
        codigo: 'SEGREDO_INEXISTENTE',
        mensagem:
          'Este bloco usa {{segredo.…}}, e o cofre de segredos ainda não existe. Hoje isso sai literal na chamada.',
        noId: no.id,
      })
    }
  }

  return problemas
}

function variaveisDoNo(no: No): string[] {
  switch (no.type) {
    case 'mensagem':
      return variaveisCitadas(no.data.texto)
    case 'pergunta':
      return variaveisCitadas(no.data.texto)
    case 'salvar-campo':
      return variaveisCitadas(no.data.valor)
    case 'ia':
      return variaveisCitadas(no.data.instrucao)
    case 'handoff':
      return variaveisCitadas(no.data.mensagem)
    case 'condicao':
      return [no.data.variavel]
    case 'http':
      return [
        ...variaveisCitadas(no.data.url),
        ...variaveisCitadas(no.data.corpo),
        ...no.data.cabecalhos.flatMap((c) => variaveisCitadas(c.valor)),
      ]
  }
}
