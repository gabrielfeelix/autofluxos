import { DEFINICAO_DO_CANAL, type CanalId } from '../canais'
import type { Fluxo } from './schema'
import type { Problema } from './validar'

/**
 * O que conferir antes de publicar uma automação que chegou de fora (A13).
 *
 * Importar e duplicar trazem um desenho pronto que foi pensado para outro
 * lugar: outra conta, outras etiquetas, outra chave de API. O `validar()` já
 * sabe apontar cada referência quebrada, mas espalhado entre dezenas de avisos
 * de desenho; quem acabou de importar precisa da lista curta do que **esta
 * conta** ainda não tem.
 *
 * Por isso a lista se monta **em cima dos problemas da validação**, e não com
 * regra própria: as duas não têm como discordar, e resolver o item no bloco
 * tira ele daqui no mesmo instante, porque o editor revalida a cada mudança.
 */

export type OrigemDoFluxo = 'importado' | 'duplicado'

export function origemValida(valor: unknown): OrigemDoFluxo | null {
  return valor === 'importado' || valor === 'duplicado' ? valor : null
}

/**
 * `pendente` impede publicar ou deixa o bloco sem efeito; `conferir` é o que
 * só a pessoa sabe responder (a API pede chave?); `ok` fica na lista para ela
 * ver que aquilo foi olhado, e não esquecido.
 */
export type EstadoDoItem = 'pendente' | 'conferir' | 'ok'

export type ItemAntesDePublicar = {
  chave: string
  estado: EstadoDoItem
  titulo: string
  detalhe: string
  /** Blocos para levar a pessoa, na ordem do desenho. */
  noIds: string[]
  /** Caminho dentro da conta (`/fluxos?aba=gatilhos`), sem `/clientes/<id>`. */
  link?: { caminho: string; rotulo: string }
}

export type EntradaAntesDePublicar = {
  origem: OrigemDoFluxo
  fluxo: Fluxo
  canal: CanalId
  iaHabilitada: boolean
  entradaLigada: boolean
  /** Erros e avisos do `validar()` do editor, já com as capacidades da conta. */
  problemas: Problema[]
  /** Palavras-chave, eventos e campanhas desta conta que apontam para este fluxo. */
  gatilhos: number
}

function comCodigos(problemas: Problema[], codigos: string[]): string[] {
  const ids = problemas
    .filter((p) => codigos.includes(p.codigo) && p.noId)
    .map((p) => p.noId as string)
  return [...new Set(ids)]
}

function blocos(n: number): string {
  return n === 1 ? '1 bloco' : `${n} blocos`
}

function porReferencia(
  chave: string,
  problemas: Problema[],
  codigos: string[],
  tem: boolean,
  textos: { ok: string; pendente: (n: number) => string; detalhe: string },
): ItemAntesDePublicar | null {
  if (!tem) return null
  const noIds = comCodigos(problemas, codigos)
  return noIds.length === 0
    ? { chave, estado: 'ok', titulo: textos.ok, detalhe: '', noIds: [] }
    : { chave, estado: 'pendente', titulo: textos.pendente(noIds.length), detalhe: textos.detalhe, noIds }
}

export function antesDePublicar(entrada: EntradaAntesDePublicar): ItemAntesDePublicar[] {
  const { origem, fluxo, problemas } = entrada
  const tipos = new Set(fluxo.nodes.map((no) => no.type))
  const itens: (ItemAntesDePublicar | null)[] = []

  itens.push({
    chave: 'canal',
    estado: 'ok',
    titulo: `Conversa pelo ${DEFINICAO_DO_CANAL[entrada.canal].nome}`,
    detalhe: 'O canal é escolhido ao criar e não muda depois.',
    noIds: [],
  })

  // A chave de API nunca viaja (`limparParaCompartilhar`), então todo bloco
  // HTTP importado chega sem ela. Se a API é pública, está certo assim; só
  // quem conhece a API sabe, e é por isso que o item é "conferir".
  const httpSemChave =
    origem === 'importado'
      ? fluxo.nodes.filter((no) => no.type === 'http' && !no.data.conexaoId).map((no) => no.id)
      : []
  const chaveQuebrada = comCodigos(problemas, ['CONEXAO_INEXISTENTE', 'FERRAMENTA_SEM_CREDENCIAL'])
  if (tipos.has('http') || tipos.has('ia')) {
    if (chaveQuebrada.length > 0) {
      itens.push({
        chave: 'conexoes',
        estado: 'pendente',
        titulo: `${blocos(chaveQuebrada.length)} sem a chave de acesso`,
        detalhe: 'Escolha uma chave desta conta no bloco, ou crie uma em Chaves de API.',
        noIds: chaveQuebrada,
        link: { caminho: '/ajustes/chaves', rotulo: 'Abrir chaves de API' },
      })
    } else if (httpSemChave.length > 0) {
      itens.push({
        chave: 'conexoes',
        estado: 'conferir',
        titulo: `${blocos(httpSemChave.length)} de Serviços externos sem chave`,
        detalhe: 'A chave não vem junto ao importar. Se a API pede, escolha uma no bloco.',
        noIds: httpSemChave,
      })
    } else {
      itens.push({ chave: 'conexoes', estado: 'ok', titulo: 'Chaves de acesso escolhidas', detalhe: '', noIds: [] })
    }
  }

  itens.push(
    porReferencia('etapas', problemas, ['ETAPA_INEXISTENTE', 'ETAPA_NAO_ESCOLHIDA'], tipos.has('etapa'), {
      ok: 'Etapas do funil existem nesta conta',
      pendente: (n) => `${blocos(n)} de etapa sem etapa desta conta`,
      detalhe: 'O funil de origem não veio junto. Escolha uma etapa daqui em cada bloco.',
    }),
    porReferencia(
      'etiquetas',
      problemas,
      ['ETIQUETA_INEXISTENTE', 'ETIQUETA_NAO_ESCOLHIDA'],
      tipos.has('etiqueta'),
      {
        ok: 'Etiquetas existem nesta conta',
        pendente: (n) => `${blocos(n)} de etiqueta sem etiqueta desta conta`,
        detalhe: 'Escolha uma etiqueta daqui em cada bloco, ou crie em Etiquetas.',
      },
    ),
    porReferencia(
      'destinos',
      problemas,
      ['DESTINO_SUMIU', 'DESTINO_NAO_ESCOLHIDO', 'DESTINO_SEM_PUBLICACAO', 'DESTINO_DESLIGADO'],
      tipos.has('ir-fluxo'),
      {
        ok: 'Automações de destino prontas',
        pendente: (n) => `${blocos(n)} de "Ir para outra automação" sem destino pronto`,
        detalhe: 'O destino precisa existir nesta conta, estar publicado e ligado.',
      },
    ),
  )

  const variaveis = comCodigos(problemas, ['VARIAVEL_DESCONHECIDA'])
  itens.push(
    variaveis.length > 0
      ? {
          chave: 'variaveis',
          estado: 'pendente',
          titulo: `${blocos(variaveis.length)} ${variaveis.length === 1 ? 'usa' : 'usam'} informação que ninguém guarda`,
          detalhe: 'Alguma pergunta ou bloco Guardar precisa preencher a {{variável}} antes.',
          noIds: variaveis,
        }
      : { chave: 'variaveis', estado: 'ok', titulo: 'Toda {{variável}} usada é preenchida', detalhe: '', noIds: [] },
  )

  if (tipos.has('ia')) {
    const ia = fluxo.nodes.filter((no) => no.type === 'ia').map((no) => no.id)
    itens.push(
      entrada.iaHabilitada
        ? { chave: 'ia', estado: 'ok', titulo: 'IA liberada nesta automação', detalhe: '', noIds: [] }
        : {
            chave: 'ia',
            estado: 'pendente',
            titulo: 'IA desligada nesta automação',
            detalhe:
              origem === 'importado'
                ? 'Importar nunca traz a IA junto. Tire os blocos de IA ou peça a liberação à 4YU.'
                : 'Tire os blocos de IA ou peça a liberação à 4YU.',
            noIds: ia,
          },
    )
  }

  itens.push(
    entrada.gatilhos > 0
      ? {
          chave: 'gatilhos',
          estado: 'ok',
          titulo: entrada.gatilhos === 1 ? '1 gatilho começa esta automação' : `${entrada.gatilhos} gatilhos começam esta automação`,
          detalhe: '',
          noIds: [],
        }
      : {
          chave: 'gatilhos',
          estado: 'conferir',
          titulo: 'Nenhum gatilho começa esta automação',
          detalhe:
            origem === 'duplicado'
              ? 'Palavras-chave, eventos e campanhas não são copiados. Crie os desta cópia em Gatilhos.'
              : 'Palavras-chave, eventos e campanhas não vêm junto. Crie em Gatilhos.',
          noIds: [],
          link: { caminho: '/fluxos?aba=gatilhos', rotulo: 'Abrir Gatilhos' },
        },
  )

  if (!entrada.entradaLigada) {
    itens.push({
      chave: 'entrada',
      estado: 'conferir',
      titulo: 'Nasceu desligada',
      detalhe: 'Depois de publicar, ligue no interruptor da lista para ela começar a atender.',
      noIds: [],
      link: { caminho: '/fluxos', rotulo: 'Abrir a lista' },
    })
  }

  return itens.filter((item): item is ItemAntesDePublicar => item !== null)
}
