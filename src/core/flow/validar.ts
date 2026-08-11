import {
  LIMITE_LISTA,
  SAIDA_FALSO,
  SAIDA_VERDADEIRO,
  type Fluxo,
  type No,
} from './schema.js'
import { variaveisCitadas } from '../engine/interpolar.js'

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
 * Confere se o fluxo pode ir ao ar.
 *
 * A regra que mais importa aqui é a do handoff alcançável: o sistema se recusa
 * a publicar um bot que não tem como passar a conversa para um humano. É a
 * diferença entre um produto que previne o "hello loop" e um produto que confia
 * na memória de quem desenhou o fluxo.
 */
export function validar(fluxo: Fluxo): ResultadoValidacao {
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
  }
}
