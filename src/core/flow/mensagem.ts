import {
  LIMITE_ATRASO_SEGUNDOS,
  type NoMensagem,
  type Parte,
} from './schema'

/**
 * Ler os dois formatos do bloco de mensagem — e é aqui, num lugar só.
 *
 * **Por que isto existe.** `flow_versions` é imutável e a sessão fica presa à
 * versão em que começou: uma conversa aberta às 14h continua rodando o grafo de
 * 14h. Quando o bloco deixou de ser `{ texto }` e virou uma pilha de pedaços,
 * havia dois caminhos — reescrever o que estava gravado, ou aprender a ler o
 * que estava gravado. O primeiro **mata toda conversa em andamento** e apaga o
 * histórico do que de fato foi ao ar. O segundo custa este arquivo.
 *
 * A regra, então: **ler os dois, escrever um.** Nada fora daqui toca
 * `data.texto` — nem o motor, nem o validador, nem a tela. O editor só escreve
 * `partes`. E nenhuma migration encosta em `flow_versions.grafo`.
 *
 * O teste que prende isso está em `mensagem.test.ts` e em
 * `executar.test.ts`: um grafo no formato antigo tem que produzir exatamente as
 * mesmas ações que produzia antes de a pilha existir.
 */
export function partesDaMensagem(no: NoMensagem): Parte[] {
  const { partes, texto, atraso } = no.data

  // Formato novo. `partes` vazio conta como novo e sem nada: quem apagou todos
  // os pedaços no editor não quer o texto antigo de volta.
  if (partes !== undefined) return partes

  const antigas: Parte[] = []

  /**
   * O `atraso` antigo virava `atrasoMs` na ação de envio: esperar **antes** de
   * mandar. Como pedaço, ele precisa vir na frente do texto para significar a
   * mesma coisa — invertido, a espera aconteceria depois da mensagem já ter
   * saído, que é outro comportamento.
   */
  if (atraso !== undefined && atraso > 0) {
    antigas.push({ tipo: 'atraso', segundos: Math.min(atraso, LIMITE_ATRASO_SEGUNDOS) })
  }

  antigas.push({ tipo: 'texto', texto: texto ?? '' })
  return antigas
}

/**
 * O corpo do bloco em uma linha, para rótulo de tela e mensagem de erro.
 *
 * Junta só os pedaços de texto porque é isso que alguém reconhece ao procurar
 * um bloco no desenho. Pilha sem texto nenhum — só uma foto, só um atraso —
 * devolve vazio, e quem chama decide o que dizer no lugar.
 */
export function textoDaMensagem(no: NoMensagem): string {
  return partesDaMensagem(no)
    .filter((parte) => parte.tipo === 'texto')
    .map((parte) => parte.texto)
    .join('\n')
    .trim()
}

/** O pedaço que um botão "+ Texto" acabou de criar precisa nascer de algum jeito. */
export function parteNova(tipo: Parte['tipo']): Parte {
  switch (tipo) {
    case 'texto':
      return { tipo: 'texto', texto: '' }
    case 'midia':
      return { tipo: 'midia', midia: 'imagem', url: '' }
    case 'atraso':
      // Um segundo, e não zero: atraso de zero é o mesmo que não ter atraso, e
      // um pedaço que não faz nada até alguém mexer nele parece defeito.
      return { tipo: 'atraso', segundos: 1 }
    case 'salvar':
      return { tipo: 'salvar', campo: '', valor: '' }
    case 'auto-off':
      return { tipo: 'auto-off' }
  }
}
