/**
 * Arrumar o desenho: blocos em colunas, da entrada para a saída.
 *
 * Fluxo desenhado à mão vira teia: quem arrasta um bloco novo põe onde há
 * espaço na tela, não onde ele pertence na conversa, e depois de trinta blocos
 * as linhas se cruzam tanto que ninguém acha onde uma pergunta cai. Isto
 * recoloca tudo em camadas da esquerda para a direita, que é o sentido em que
 * as alças já apontam (`target` à esquerda, `source` à direita, ver `nos.tsx`).
 *
 * O algoritmo é o Sugiyama, em quatro passos:
 *
 * 1. **Camada**: caminho mais longo a partir das entradas. Cada bloco fica uma
 *    coluna à direita do seu antecessor mais distante, então nenhuma linha
 *    anda para trás a não ser que o desenho tenha ciclo de verdade.
 * 2. **Ordem dentro da camada**: baricentro dos vizinhos, algumas varreduras
 *    de ida e volta. É o que desembaraça os cruzamentos.
 * 3. **Nós de apoio**: uma ligação que pula colunas (da coluna 1 para a 5, por
 *    exemplo) é quebrada em pedaços de uma coluna só, com um nó invisível em
 *    cada coluna do meio. É a fase que faltava aqui, e a falta dela era **a**
 *    causa do emaranhado: sem apoio, o fio ia em linha reta da coluna 1 até a
 *    5, atravessando por trás de tudo o que estivesse no caminho, em diagonal.
 *    Com apoio, ele anda de coluna em coluna, participa do desembaraço junto
 *    com os blocos e ganha um corredor só seu na vertical. É o que Graphviz,
 *    dagre e ELK fazem, e é por isso que o desenho deles se lê.
 * 4. **Altura**: cada bloco (e cada apoio) mira a altura **da alça** que
 *    aponta para ele, não o meio do pai. É o que põe o filho do "verdadeiro"
 *    na linha do "verdadeiro", e o fio sai reto. Quando os filhos não cabem
 *    todos na mira, a coluna inteira se acomoda com o menor desvio total
 *    (regressão isotônica), em vez de empurrar só o de baixo para o fundo.
 *
 * **Volta posição e curva, e não os blocos.** Quem tem o estado do editor é o
 * `editor.tsx`; devolver dado solto deixa esta função pura e testável sem
 * React Flow no meio.
 */

/** Largura fixa do bloco no canvas. Igual à do `editor.tsx`. */
const LARGURA_NO = 248
/** Altura usada quando o bloco ainda não foi medido pelo React Flow. */
const ALTURA_PADRAO = 140
/** Espaço entre uma coluna e a seguinte. */
const VAO_X = 110
/** Espaço entre dois blocos da mesma coluna. */
const VAO_Y = 40
/** Espaço entre dois pedaços do desenho que não se ligam. */
const VAO_ENTRE_PARTES = 120
/**
 * Varreduras do baricentro. Com a melhor guardada a cada rodada, mais rodada
 * só pode ajudar; oito cobre fluxo de cem blocos em poucos milissegundos.
 */
const VARREDURAS = 8
/**
 * Espaço entre dois corredores de fio vizinhos, dentro da mesma coluna.
 *
 * Menor que `VAO_Y` de propósito: corredor não tem conteúdo para ler, só
 * precisa de distância suficiente para o olho separar um fio do outro. Usar os
 * mesmos 40px de bloco faria uma coluna com seis fios de passagem ficar mais
 * alta que a coluna de cartões ao lado, e o desenho cresceria para baixo sem
 * nada dentro.
 */
const VAO_ENTRE_CORREDORES = 20

export type NoDoDesenho = {
  id: string
  position: { x: number; y: number }
  measured?: { width?: number | null; height?: number | null } | null
  data?: Record<string, unknown>
}

export type ArestaDoDesenho = {
  /** O `id` da aresta no React Flow. É por ele que o editor acha a curva dela. */
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
}

/**
 * Onde ficam as alças de um bloco, medidas pelo React Flow.
 *
 * Tudo em px a partir do topo do bloco, no centro da alça. Sem medida (teste,
 * bloco que ainda não pintou) o arrumador estima pela ordem conhecida das
 * saídas, ver `ORDEM_FIXA`.
 */
export type AlcasDoBloco = {
  /** `sourceHandle` (ou `''` para a saída única) → altura da alça. */
  saidas: Map<string, number>
  entrada: number | null
}

/** Um ponto por onde o fio passa, em coordenadas do desenho. */
export type Ponto = { x: number; y: number }

/**
 * O que sai do arrumador: onde fica cada bloco, e por onde passa cada fio.
 *
 * As duas coisas juntas porque são a mesma conta: o corredor de um fio é o
 * lugar que o próprio empilhamento reservou para ele, e recalcular isso depois,
 * olhando só as posições finais, é refazer o trabalho com menos informação.
 */
export type Desenho = {
  posicoes: Map<string, Ponto>
  /** `id` da aresta → os pontos de dobra dela, da origem para o destino. */
  curvas: Map<string, Ponto[]>
}

type Posicao = { x: number; y: number }

/**
 * As saídas que não são opção, na ordem em que o bloco as desenha (ver
 * `nos.tsx`). Só vale quando falta medida: com medida, manda a altura real.
 *
 * Era a falta disto que trocava os ramos. "verdadeiro" e "falso" não estão em
 * `opcoes`, então empatavam, e o empate caía na ordem de tela: o "falso" saía
 * por cima e cruzava com o "verdadeiro" colado no bloco.
 */
const ORDEM_FIXA = [
  'escolheu',
  'vazio',
  'verdadeiro',
  'falso',
  'promotor',
  'neutro',
  'detrator',
  'midia',
  '',
  'timeout',
]

/**
 * Altura da alça de saída, a partir do topo do bloco.
 *
 * É ao mesmo tempo a ordem das saídas (quem está mais acima sai primeiro) e a
 * altura que o filho mira. Sem medida, estima uma linha de 34px por saída
 * depois do cabeçalho, que é o desenho do `Saida` em `nos.tsx`.
 */
function alturaDaSaida(
  no: NoDoDesenho | undefined,
  alca: string | null | undefined,
  alcas: Map<string, AlcasDoBloco> | undefined,
): number {
  if (!no) return 0
  const medida = alcas?.get(no.id)?.saidas.get(alca ?? '')
  if (medida !== undefined) return medida
  if (!alca) return altura(no) / 2
  const opcoes = Array.isArray(no.data?.opcoes) ? (no.data!.opcoes as unknown[]) : []
  const naOpcao = opcoes.findIndex(
    (o) => typeof o === 'object' && o !== null && (o as { id?: unknown }).id === alca,
  )
  const fixa = ORDEM_FIXA.indexOf(alca)
  const linha =
    naOpcao >= 0 ? naOpcao : opcoes.length + (fixa >= 0 ? fixa : ORDEM_FIXA.length)
  return 60 + linha * 34
}

/** Altura da alça de entrada, a partir do topo. O padrão do React Flow é o meio. */
function alturaDaEntrada(no: NoDoDesenho, alcas: Map<string, AlcasDoBloco> | undefined): number {
  return alcas?.get(no.id)?.entrada ?? altura(no) / 2
}

function altura(no: NoDoDesenho): number {
  const medida = no.measured?.height
  return typeof medida === 'number' && medida > 0 ? medida : ALTURA_PADRAO
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null
  return valores.reduce((s, v) => s + v, 0) / valores.length
}

export function organizar(
  nos: NoDoDesenho[],
  arestas: ArestaDoDesenho[],
  inicio: string | null,
  alcas?: Map<string, AlcasDoBloco>,
): Desenho {
  const posicoes = new Map<string, Posicao>()
  const curvas = new Map<string, Ponto[]>()
  if (nos.length === 0) return { posicoes, curvas }

  const porId = new Map(nos.map((n) => [n.id, n]))

  // Só ligação entre blocos que existem, e nada de laço no próprio bloco:
  // aresta órfã sobrevive no grafo salvo e travaria a contagem de entradas.
  const ligacoes = arestas.filter(
    (a) => a.source !== a.target && porId.has(a.source) && porId.has(a.target),
  )

  const filhos = new Map<string, { id: string; ordem: number }[]>()
  const pais = new Map<string, string[]>()
  /** Ligação pai→filho → altura da alça de onde ela sai, a partir do topo do pai. */
  const saidas = new Map<string, number>()
  for (const no of nos) {
    filhos.set(no.id, [])
    pais.set(no.id, [])
  }
  for (const a of ligacoes) {
    const y = alturaDaSaida(porId.get(a.source), a.sourceHandle, alcas)
    filhos.get(a.source)!.push({ id: a.target, ordem: y })
    pais.get(a.target)!.push(a.source)
    const k = chave(a.source, a.target)
    saidas.set(k, Math.min(saidas.get(k) ?? Infinity, y))
  }
  for (const lista of filhos.values()) lista.sort((x, y) => x.ordem - y.ordem)

  // Ordem estável de leitura do desenho de hoje: de cima para baixo, depois da
  // esquerda para a direita. É o desempate de tudo o que vem a seguir, e por
  // isso organizar duas vezes seguidas dá o mesmo resultado.
  const daTela = [...nos].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  const ordemNaTela = new Map(daTela.map((n, i) => [n.id, i]))

  const partes = pedacos(daTela, ligacoes)

  /** `id` da aresta → os apoios dela, em ordem, para virar curva no fim. */
  const todosOsApoios = new Map<string, string[]>()

  const cantoX = Math.min(...nos.map((n) => n.position.x))
  const cantoY = Math.min(...nos.map((n) => n.position.y))
  let deslocamentoY = 0

  for (const parte of partes) {
    const entradas = entradasDa(parte, pais, inicio, ordemNaTela)
    // A ordem de leitura do fluxo, e não a de tela: percorrer os filhos na
    // ordem das alças faz a primeira opção da pergunta nascer acima da
    // segunda, que é como quem escreveu o menu espera ver.
    const ordem = ordemDeLeitura(parte, filhos, entradas, ordemNaTela)
    const voltas = arestasDeVolta(parte, filhos, entradas)
    const camada = emCamadas(parte, filhos, pais, entradas, voltas)
    const apoios = apoiar(parte, ligacoes, camada, voltas, filhos, pais, ordem, saidas)
    const colunas = porColuna(camada)

    // Apoio não tem corpo: ele reserva um corredor, não ocupa uma faixa. Dar
    // altura a ele afastaria os fios uns dos outros como se fossem cartões.
    const alturas = new Map<string, number>()
    for (const id of camada.keys()) alturas.set(id, porId.has(id) ? altura(porId.get(id)!) : 0)

    /** Onde, de 0 a 1, a alça fica na altura do pai. É o que separa dois irmãos. */
    const fracaoDaSaida = (pai: string, filho: string) => {
      const h = alturas.get(pai) ?? 0
      return h > 0 ? Math.min(0.99, (saidas.get(chave(pai, filho)) ?? h / 2) / h) : 0.5
    }
    desembaracar(colunas, filhos, pais, ordem, voltas, fracaoDaSaida)

    // Topo de cada bloco, coluna por coluna. A coluna seguinte lê os topos da
    // anterior, então a ordem daqui importa.
    const topos = new Map<string, number>()

    for (const coluna of colunas) {
      const itens = coluna.map((id) => {
        const entrada = porId.has(id) ? alturaDaEntrada(porId.get(id)!, alcas) : 0
        const miras = (pais.get(id) ?? [])
          .filter((p) => !voltas.has(chave(p, id)) && topos.has(p))
          .map((p) => topos.get(p)! + (saidas.get(chave(p, id)) ?? 0) - entrada)
        return { id, h: alturas.get(id)!, mira: media(miras), peso: miras.length }
      })
      const achados = acomodar(itens, porId)
      for (const [i, item] of itens.entries()) topos.set(item.id, achados[i]!)
    }

    // O pedaço começa no zero dele, qualquer que tenha sido a acomodação.
    const topo = Math.min(...topos.values())
    let maisBaixo = 0
    for (const [indice, coluna] of colunas.entries()) {
      for (const id of coluna) {
        const y = topos.get(id)! - topo
        maisBaixo = Math.max(maisBaixo, y + alturas.get(id)!)
        posicoes.set(id, { x: indice * (LARGURA_NO + VAO_X), y: deslocamentoY + y })
      }
    }

    for (const [idDaAresta, ids] of apoios) todosOsApoios.set(idDaAresta, ids)

    deslocamentoY += maisBaixo + VAO_ENTRE_PARTES
  }

  /*
   * O desenho arrumado volta para o canto onde ele estava.
   *
   * Encostar no canto que as posições novas calcularam (sempre perto do zero)
   * teleportaria o fluxo inteiro para longe de onde a pessoa estava olhando.
   * E o encaixe é pelo canto **do resultado**, não pelo das posições velhas:
   * assim organizar de novo não empurra o desenho um pouco mais a cada clique.
   */
  const topoLocal = Math.min(...[...posicoes.values()].map((p) => p.y))
  const esquerdaLocal = Math.min(...[...posicoes.values()].map((p) => p.x))
  for (const [id, p] of posicoes) {
    posicoes.set(id, { x: cantoX + p.x - esquerdaLocal, y: cantoY + p.y - topoLocal })
  }

  /*
   * O apoio vira dois pontos, e não um.
   *
   * Um ponto só no meio da coluna deixaria o fio fazer uma curva em S dentro
   * dela, e o resultado é serpente, não corredor. Com um ponto em cada borda
   * da coluna o trecho do meio sai **reto e horizontal**, que é o que faz
   * vários fios de passagem virarem faixas paralelas em vez de novelo.
   */
  for (const [idDaAresta, ids] of todosOsApoios) {
    const pontos: Ponto[] = []
    for (const id of ids) {
      const p = posicoes.get(id)
      if (!p) continue
      pontos.push({ x: p.x, y: p.y }, { x: p.x + LARGURA_NO, y: p.y })
    }
    if (pontos.length > 0) curvas.set(idDaAresta, pontos)
    for (const id of ids) posicoes.delete(id)
  }

  return { posicoes, curvas }
}

/**
 * Acomoda uma coluna: cada item o mais perto possível da sua mira, sem
 * sair da ordem e sem encostar no vizinho.
 *
 * O jeito antigo era guloso: o de cima pegava a mira dele e o de baixo descia
 * o quanto precisasse. Numa pergunta com quatro opções e filhos altos, isso
 * alinhava a primeira opção e jogava a última lá para baixo, com o fio
 * descendo em diagonal. Aqui a conta é a regressão isotônica (o algoritmo dos
 * vizinhos que se juntam, PAVA): quem colide forma um bloco, e o bloco se
 * centra na média das miras de quem está nele. O desvio total sai o menor
 * possível, e o grupo de filhos fica centrado nas opções que o alimentam.
 *
 * Item sem mira (entrada do fluxo, bloco que só recebe fio de volta) não puxa
 * nada: ele só segue o vizinho de cima.
 */
function acomodar(
  itens: { id: string; h: number; mira: number | null; peso: number }[],
  porId: Map<string, NoDoDesenho>,
): number[] {
  if (itens.length === 0) return []

  // Quanto cada item precisa estar abaixo do primeiro, no mínimo. Com isso a
  // restrição "não encostar" vira só "não passar na frente": z[i] >= z[i-1].
  const recuo: number[] = [0]
  for (let i = 1; i < itens.length; i++) {
    const anterior = itens[i - 1]!
    const atual = itens[i]!
    // Dois corredores vizinhos se separam com pouco; qualquer par que envolva
    // cartão usa o vão cheio.
    const vao = !porId.has(anterior.id) && !porId.has(atual.id) ? VAO_ENTRE_CORREDORES : VAO_Y
    recuo.push(recuo[i - 1]! + anterior.h + vao)
  }

  type Bloco = { soma: number; peso: number; inicio: number; fim: number }
  const blocos: Bloco[] = []
  for (const [i, item] of itens.entries()) {
    const peso = item.mira === null ? 0 : item.peso
    let bloco: Bloco = {
      soma: item.mira === null ? 0 : (item.mira - recuo[i]!) * peso,
      peso,
      inicio: i,
      fim: i,
    }
    const valor = (b: Bloco) => (b.peso > 0 ? b.soma / b.peso : -Infinity)
    // Sem mira, o valor é -∞: ele encosta no bloco de cima, que é "seguir o vizinho".
    while (blocos.length > 0 && valor(blocos[blocos.length - 1]!) >= valor(bloco)) {
      const cima = blocos.pop()!
      bloco = { soma: cima.soma + bloco.soma, peso: cima.peso + bloco.peso, inicio: cima.inicio, fim: bloco.fim }
    }
    blocos.push(bloco)
  }

  // Só o primeiro bloco pode ficar sem mira (os outros encostaram no de
  // cima); ele gruda no de baixo, para não abrir buraco no topo da coluna.
  const valores = blocos.map((b) => (b.peso > 0 ? b.soma / b.peso : null))
  if (valores[0] === null) valores[0] = valores[1] ?? 0
  const z: number[] = []
  for (const [n, b] of blocos.entries()) {
    for (let i = b.inicio; i <= b.fim; i++) z.push(valores[n]!)
  }
  // Um bloco sem mira nenhuma pode ter ficado abaixo do de cima; a restrição
  // manda, então sobe até encostar.
  for (let i = 1; i < z.length; i++) z[i] = Math.max(z[i]!, z[i - 1]!)

  return z.map((v, i) => v + recuo[i]!)
}

/** Como um nó de apoio se chama. O `\u0000` não aparece em id de bloco real. */
const nomeDoApoio = (aresta: string, coluna: number) => `\u0000apoio\u0000${aresta}\u0000${coluna}`

/**
 * Quebra as ligações que pulam colunas, pondo um apoio em cada coluna do meio.
 *
 * Depois disto o grafo é *próprio*: toda ligação liga colunas vizinhas. Isso é
 * o que permite ao desembaraço e ao empilhamento cuidarem do fio como cuidam
 * de um bloco , o apoio entra na fila da coluna, briga por lugar e ganha o seu.
 * Sem essa etapa, o baricentro ordena olhando só as pontas da ligação e o meio
 * do caminho fica sem dono, que é onde o desenho embaralha.
 *
 * Ligação de volta fica de fora: ela já é desenhada em caminho ortogonal pela
 * própria linha (ver `arestas.tsx`), e forçá-la a virar corrente de apoios
 * acrescentaria corredor para um fio que a pessoa lê como "e volta pro menu".
 */
function apoiar(
  parte: string[],
  ligacoes: ArestaDoDesenho[],
  camada: Map<string, number>,
  voltas: Set<string>,
  filhos: Map<string, { id: string; ordem: number }[]>,
  pais: Map<string, string[]>,
  ordem: Map<string, number>,
  saidas: Map<string, number>,
): Map<string, string[]> {
  const naParte = new Set(parte)
  const apoios = new Map<string, string[]>()

  for (const a of ligacoes) {
    if (!naParte.has(a.source) || !naParte.has(a.target)) continue
    if (voltas.has(chave(a.source, a.target))) continue

    const de = camada.get(a.source)
    const para = camada.get(a.target)
    if (de === undefined || para === undefined) continue
    if (para - de <= 1) continue

    const idDaAresta = a.id ?? `${a.source}\u0000${a.sourceHandle ?? ''}\u0000${a.target}`

    // A ordem da alça precisa ser lida **antes** de a ligação direta sair de
    // `filhos`: é ela que mantém a primeira opção da pergunta por cima da
    // segunda ao longo de todo o caminho, e não só na saída do bloco.
    const daOrigem = filhos.get(a.source)
    const ligacaoDireta = daOrigem?.find((f) => f.id === a.target)
    const ordemDaAlca = ligacaoDireta?.ordem ?? 0

    const ids: string[] = []

    for (let coluna = de + 1; coluna < para; coluna++) {
      const id = nomeDoApoio(idDaAresta, coluna)
      ids.push(id)
      camada.set(id, coluna)
      filhos.set(id, [])
      pais.set(id, [])
      // Fica logo atrás da origem na ordem de leitura: é dela que o fio sai, e
      // é perto dela que ele deve ficar quando o baricentro empatar.
      ordem.set(id, (ordem.get(a.source) ?? 0) + 0.0001 * (ordemDaAlca + 1))
    }

    // Tira a ligação direta e põe a corrente no lugar.
    if (daOrigem && ligacaoDireta) daOrigem.splice(daOrigem.indexOf(ligacaoDireta), 1)
    const doDestino = pais.get(a.target)
    if (doDestino) {
      const onde = doDestino.indexOf(a.source)
      if (onde >= 0) doDestino.splice(onde, 1)
    }

    const corrente = [a.source, ...ids, a.target]
    for (let i = 0; i < corrente.length - 1; i++) {
      filhos.get(corrente[i]!)!.push({ id: corrente[i + 1]!, ordem: ordemDaAlca })
      pais.get(corrente[i + 1]!)!.push(corrente[i]!)
      // Só o primeiro trecho sai de alça de verdade; apoio não tem altura.
      saidas.set(chave(corrente[i]!, corrente[i + 1]!), i === 0 ? ordemDaAlca : 0)
    }
    filhos.get(a.source)!.sort((x, y) => x.ordem - y.ordem)

    apoios.set(idDaAresta, ids)
  }

  return apoios
}

/**
 * Os pedaços do desenho que não se falam.
 *
 * Um fluxo grande quase sempre tem ilha: um ramo antigo desligado, um bloco
 * criado e ainda não ligado. Misturar as ilhas nas mesmas colunas do tronco
 * principal espalha o tronco sem motivo. Cada pedaço ganha a sua faixa de
 * altura, um embaixo do outro.
 */
function pedacos(nos: NoDoDesenho[], ligacoes: ArestaDoDesenho[]): string[][] {
  const vizinhos = new Map<string, string[]>()
  for (const n of nos) vizinhos.set(n.id, [])
  for (const a of ligacoes) {
    vizinhos.get(a.source)!.push(a.target)
    vizinhos.get(a.target)!.push(a.source)
  }

  const vistos = new Set<string>()
  const partes: string[][] = []

  for (const n of nos) {
    if (vistos.has(n.id)) continue
    const fila = [n.id]
    vistos.add(n.id)
    const parte: string[] = []
    while (fila.length > 0) {
      const atual = fila.shift()!
      parte.push(atual)
      for (const v of vizinhos.get(atual) ?? []) {
        if (vistos.has(v)) continue
        vistos.add(v)
        fila.push(v)
      }
    }
    partes.push(parte)
  }

  return partes
}

/** As portas de entrada do pedaço: início do fluxo primeiro, depois quem não recebe ligação. */
function entradasDa(
  parte: string[],
  pais: Map<string, string[]>,
  inicio: string | null,
  ordemNaTela: Map<string, number>,
): string[] {
  const naParte = new Set(parte)
  const semPai = parte.filter((id) => (pais.get(id) ?? []).filter((p) => naParte.has(p)).length === 0)
  const entradas = [...semPai].sort((a, b) => ordemNaTela.get(a)! - ordemNaTela.get(b)!)

  if (inicio && naParte.has(inicio)) {
    const jaEsta = entradas.indexOf(inicio)
    if (jaEsta >= 0) entradas.splice(jaEsta, 1)
    entradas.unshift(inicio)
  }

  // Pedaço que é só ciclo ("voltar ao menu" sem nenhuma porta de fora) não tem
  // bloco sem pai. Alguém tem que abrir a fila, e o de cima na tela abre.
  if (entradas.length === 0) {
    entradas.push([...parte].sort((a, b) => ordemNaTela.get(a)! - ordemNaTela.get(b)!)[0]!)
  }

  return entradas
}

/** Chave de uma ligação, para marcar as que voltam. */
const chave = (de: string, para: string) => `${de}\u0000${para}`

/**
 * As ligações que voltam para trás, achadas por uma busca em profundidade.
 *
 * Fluxo tem ciclo de propósito: "voltar ao menu" é o exemplo do dia. Sem
 * marcar essas ligações, o cálculo da coluna empurra o menu para a direita do
 * bloco que aponta de volta para ele, e o desenho sai ao contrário do que a
 * conversa faz. Elas seguem desenhadas na tela; só não mandam no layout.
 */
function arestasDeVolta(
  parte: string[],
  filhos: Map<string, { id: string; ordem: number }[]>,
  entradas: string[],
): Set<string> {
  const naParte = new Set(parte)
  const voltas = new Set<string>()
  const cor = new Map<string, 'andando' | 'pronto'>()

  const andar = (id: string) => {
    cor.set(id, 'andando')
    for (const f of filhos.get(id) ?? []) {
      if (!naParte.has(f.id)) continue
      if (cor.get(f.id) === 'andando') voltas.add(chave(id, f.id))
      else if (!cor.has(f.id)) andar(f.id)
    }
    cor.set(id, 'pronto')
  }

  for (const entrada of entradas) if (!cor.has(entrada)) andar(entrada)
  for (const id of parte) if (!cor.has(id)) andar(id)

  return voltas
}

/**
 * A ordem em que o fluxo se lê, seguindo as alças de cima para baixo.
 *
 * É o desempate de tudo o que vem depois. A ordem de tela não serve: o desenho
 * embaraçado que se está justamente arrumando tem a segunda opção acima da
 * primeira, e usar isso como critério guardaria a bagunça.
 */
function ordemDeLeitura(
  parte: string[],
  filhos: Map<string, { id: string; ordem: number }[]>,
  entradas: string[],
  ordemNaTela: Map<string, number>,
): Map<string, number> {
  const naParte = new Set(parte)
  const vistos = new Set<string>()
  const ordem = new Map<string, number>()

  const andar = (id: string) => {
    if (vistos.has(id)) return
    vistos.add(id)
    ordem.set(id, ordem.size)
    for (const f of filhos.get(id) ?? []) if (naParte.has(f.id)) andar(f.id)
  }

  for (const entrada of entradas) andar(entrada)
  for (const id of [...parte].sort((a, b) => ordemNaTela.get(a)! - ordemNaTela.get(b)!)) andar(id)

  return ordem
}

/**
 * Em que coluna cada bloco cai.
 *
 * Caminho mais longo a partir das entradas, relaxando as ligações até parar de
 * mudar. As ligações de volta ficam de fora, então o teto de rodadas (o número
 * de blocos) é folga e não muleta.
 */
function emCamadas(
  parte: string[],
  filhos: Map<string, { id: string; ordem: number }[]>,
  pais: Map<string, string[]>,
  entradas: string[],
  voltas: Set<string>,
): Map<string, number> {
  const naParte = new Set(parte)
  const camada = new Map<string, number>()
  for (const id of entradas) camada.set(id, 0)

  for (let rodada = 0; rodada < parte.length; rodada++) {
    let mudou = false
    for (const id of parte) {
      const minha = camada.get(id)
      if (minha === undefined) continue
      for (const f of filhos.get(id) ?? []) {
        if (!naParte.has(f.id) || voltas.has(chave(id, f.id))) continue
        const dele = camada.get(f.id)
        if (dele === undefined || dele < minha + 1) {
          camada.set(f.id, minha + 1)
          mudou = true
        }
      }
    }
    if (!mudou) break
  }

  // Sobrou quem só é alcançável por dentro de um ciclo: entra na coluna logo
  // depois do pai que já tem coluna, ou na primeira, para não sumir.
  for (const id of parte) {
    if (camada.has(id)) continue
    const dosPais = (pais.get(id) ?? []).map((p) => camada.get(p)).filter((v): v is number => v !== undefined)
    camada.set(id, dosPais.length > 0 ? Math.max(...dosPais) + 1 : 0)
  }

  return camada
}

function porColuna(camada: Map<string, number>): string[][] {
  const maior = Math.max(...camada.values())
  const colunas: string[][] = Array.from({ length: maior + 1 }, () => [])
  for (const [id, n] of camada) colunas[n]!.push(id)
  return colunas
}

/**
 * Baricentro: cada bloco se muda para perto da média dos vizinhos.
 *
 * Varre para a direita olhando os pais, para a esquerda olhando os filhos, e
 * repete. É a heurística clássica de redução de cruzamentos: não dá o mínimo,
 * dá um desenho que uma pessoa consegue seguir com o olho, que é o pedido.
 *
 * Duas coisas que a versão ingênua não faz, e que eram o emaranhado:
 *
 * - **O pai conta pela alça, não pelo bloco.** Os dois filhos de uma condição
 *   têm o mesmo pai e empatavam; somando a fração da altura da alça (o
 *   "verdadeiro" em cima, o "falso" embaixo) o empate some, e cada filho fica
 *   do lado da saída que o alimenta.
 * - **Fica a melhor ordem, não a última.** Uma varredura pode piorar o que a
 *   anterior acertou; contar os cruzamentos a cada rodada e guardar o menor é
 *   o que garante que organizar nunca deixa o desenho mais embaraçado.
 */
function desembaracar(
  colunas: string[][],
  filhos: Map<string, { id: string; ordem: number }[]>,
  pais: Map<string, string[]>,
  ordem: Map<string, number>,
  voltas: Set<string>,
  fracaoDaSaida: (pai: string, filho: string) => number,
) {
  for (const coluna of colunas) {
    coluna.sort((a, b) => ordem.get(a)! - ordem.get(b)!)
  }

  const posicaoNa = (coluna: string[]) => new Map(coluna.map((id, i) => [id, i]))

  const cruzamentos = () => {
    let total = 0
    for (let i = 0; i < colunas.length - 1; i++) {
      const aqui = posicaoNa(colunas[i]!)
      const ali = posicaoNa(colunas[i + 1]!)
      const fios: [number, number][] = []
      for (const id of colunas[i]!) {
        for (const f of filhos.get(id) ?? []) {
          if (voltas.has(chave(id, f.id)) || !ali.has(f.id)) continue
          fios.push([aqui.get(id)! + fracaoDaSaida(id, f.id), ali.get(f.id)!])
        }
      }
      for (let a = 0; a < fios.length; a++) {
        for (let b = a + 1; b < fios.length; b++) {
          const [s1, t1] = fios[a]!
          const [s2, t2] = fios[b]!
          if ((s1 - s2) * (t1 - t2) < 0) total++
        }
      }
    }
    return total
  }

  let melhor = colunas.map((c) => [...c])
  let menos = cruzamentos()

  for (let volta = 0; volta < VARREDURAS && menos > 0; volta++) {
    for (let i = 1; i < colunas.length; i++) {
      const acima = posicaoNa(colunas[i - 1]!)
      ordenarPor(
        colunas[i]!,
        (id) =>
          media(
            (pais.get(id) ?? [])
              .filter((p) => !voltas.has(chave(p, id)) && acima.has(p))
              .map((p) => acima.get(p)! + fracaoDaSaida(p, id)),
          ),
        ordem,
      )
    }
    for (let i = colunas.length - 2; i >= 0; i--) {
      const abaixo = posicaoNa(colunas[i + 1]!)
      ordenarPor(
        colunas[i]!,
        (id) =>
          media(
            (filhos.get(id) ?? [])
              .filter((f) => !voltas.has(chave(id, f.id)))
              .map((f) => abaixo.get(f.id))
              .filter((v): v is number => v !== undefined),
          ),
        ordem,
      )
    }
    const agora = cruzamentos()
    if (agora < menos) {
      menos = agora
      melhor = colunas.map((c) => [...c])
    }
  }

  // A ida da última rodada é a que casa a ordem com as alças; se ela não bateu
  // a melhor, volta para a melhor.
  for (const [i, c] of melhor.entries()) colunas[i]!.splice(0, colunas[i]!.length, ...c)
}

/**
 * Reordena a coluna pelo peso, deixando parado quem não tem peso.
 *
 * Bloco sem vizinho na coluna vizinha não tem baricentro, e jogá-lo para o
 * topo ou para o fim só porque `null` compara mal é o defeito ingênuo desta
 * heurística: ele guarda o lugar que tinha.
 */
function ordenarPor(
  coluna: string[],
  peso: (id: string) => number | null,
  ordem: Map<string, number>,
) {
  const pesos = new Map(coluna.map((id) => [id, peso(id)]))
  const fixos = coluna.map((id, i) => ({ id, i })).filter(({ id }) => pesos.get(id) === null)
  const moveis = coluna
    .filter((id) => pesos.get(id) !== null)
    .sort((a, b) => pesos.get(a)! - pesos.get(b)! || ordem.get(a)! - ordem.get(b)!)

  const resultado: string[] = []
  let proximo = 0
  for (let i = 0; i < coluna.length; i++) {
    const preso = fixos.find((f) => f.i === i)
    resultado.push(preso ? preso.id : moveis[proximo++]!)
  }
  coluna.splice(0, coluna.length, ...resultado)
}
