/**
 * O que a tela do número diz sobre uma conexão de coexistência.
 *
 * Puro de propósito: a pergunta "isto está andando ou travou?" é uma decisão de
 * produto com regra própria, e testá-la por uma página renderizada esconderia
 * qual caso quebrou. A tela só desenha o que sai daqui.
 */

/** O que a tela precisa saber de um número, vindo de `coexistenciaDoCliente`. */
export type EstadoNaTela = {
  isOnBizApp?: boolean | null
  coexistenciaEm?: string | null
  contatosSyncEm?: string | null
  historicoSyncEm?: string | null
  contatosProgresso?: number | null
  historicoProgresso?: number | null
  contatosVistoEm?: string | null
  historicoVistoEm?: string | null
  desembarcadoEm?: string | null
  /** O telefone como a Meta exibe. `null` em canal conectado antes de 0048. */
  displayPhoneNumber?: string | null
  /** O nome de exibição aprovado na Meta. */
  verifiedName?: string | null
}

export type SituacaoDoNumero =
  /** Cloud API pura, ou nunca verificado. Coexistência não se aplica. */
  | 'comum'
  /** Coexistente, e os dois syncs terminaram (ou nunca foram precisos). */
  | 'pronto'
  /** Um sync está correndo e deu sinal recente. */
  | 'sincronizando'
  /**
   * Um sync começou e **parou de dar sinal**. Não é o mesmo que "demorando":
   * ver `PARADO_MS`.
   */
  | 'travado'
  /** `ACCOUNT_OFFBOARDED` chegou. O cliente trocou de celular ou reinstalou. */
  | 'desembarcado'

/**
 * Depois de quanto tempo sem sinal um sync deixa de ser "andando".
 *
 * **Trinta minutos, e o número é escolhido, não arbitrário.** A sincronização
 * leva de minutos a 6 horas, então "passou de uma hora, travou" mentiria na
 * maioria dos casos legítimos. O que não é legítimo é ficar **meia hora sem
 * nenhum lote novo**: os lotes chegam continuamente enquanto a coisa anda, e
 * silêncio longo é o sintoma real de falha.
 *
 * Errar para o lado generoso é de propósito: dizer "travou" para algo que está
 * andando faz alguém mexer no que não devia — e mexer, aqui, pode significar
 * desembarcar um cliente que estava bem.
 */
export const PARADO_MS = 30 * 60 * 1_000

/**
 * Depois de quanto tempo "travado" para de ser notícia.
 *
 * **Vinte e quatro horas, e este número existe por causa de um aviso que ficou
 * na tela para sempre.** A Meta manda o andamento da importação por webhook, e
 * quando ela simplesmente para de mandar — o que acontece, e não é raro — o
 * número congelava em 0% e a tela dizia "a importação parou de dar sinal" todos
 * os dias, para um cliente cujos contatos tinham chegado inteiros.
 *
 * O aviso era duplamente ruim: não descrevia a realidade (o Inbox estava
 * cheio), e não havia o que fazer com ele. **Alerta permanente que ninguém pode
 * resolver deixa de ser alerta e vira moldura** — e, pior, ensina a pessoa a
 * ignorar a faixa amarela no dia em que ela disser algo urgente.
 *
 * Passado um dia, a importação é história: o que chegou está no Inbox, e o que
 * não chegou não vai chegar por esperar mais. Quem quiser a conversa antiga
 * desconecta e conecta o número de novo, que é o que a tela passa a dizer
 * enquanto o aviso está de pé.
 *
 * O silêncio entre `PARADO_MS` e aqui continua sendo avisado, porque nessa
 * janela ainda é informação nova: acabou de acontecer.
 */
export const ABANDONADO_MS = 24 * 60 * 60 * 1_000

/**
 * Em que pé está este número.
 *
 * A ordem das perguntas é a ordem da gravidade: desembarcado vence tudo (o
 * envio está parado agora), travado vence sincronizando (é o que pede ação), e
 * pronto é o silêncio bom.
 */
export function situacaoDoNumero(
  estado: EstadoNaTela | undefined,
  agora: Date = new Date(),
): SituacaoDoNumero {
  if (!estado || estado.isOnBizApp !== true) return 'comum'
  if (estado.desembarcadoEm) return 'desembarcado'

  const syncs = [
    { comecou: estado.contatosSyncEm, progresso: estado.contatosProgresso, visto: estado.contatosVistoEm },
    { comecou: estado.historicoSyncEm, progresso: estado.historicoProgresso, visto: estado.historicoVistoEm },
  ]

  let algumCorrendo = false

  for (const sync of syncs) {
    // Nunca disparado: não está correndo nem travado.
    if (!sync.comecou) continue
    // Chegou a 100: terminou, seja qual for o silêncio depois.
    if (sync.progresso !== null && sync.progresso !== undefined && sync.progresso >= 100) continue

    /*
     * O relógio corre desde o último sinal — e, quando nenhum lote chegou
     * ainda, desde o disparo. Sem o segundo caso, um sync que nunca respondeu
     * ficaria "sincronizando" para sempre, que é exatamente a confusão entre
     * "andando" e "travou" que esta função existe para desfazer.
     */
    const referencia = sync.visto ?? sync.comecou
    const desde = agora.getTime() - new Date(referencia).getTime()

    // Silêncio de mais de um dia: a importação acabou, bem ou mal, e o aviso
    // já foi dado a quem estava olhando. Ver `ABANDONADO_MS`.
    if (desde > ABANDONADO_MS) continue
    if (desde > PARADO_MS) return 'travado'
    algumCorrendo = true
  }

  return algumCorrendo ? 'sincronizando' : 'pronto'
}

/**
 * O progresso somado dos dois syncs, de 0 a 100 — ou `null` quando nenhum
 * começou.
 *
 * A média simples é honesta aqui: são dois trabalhos de peso parecido para
 * quem espera, e ponderar um deles exigiria saber o tamanho do histórico, que
 * só a Meta sabe. Um sync que nem começou conta como zero, e não como ausente:
 * senão a barra mostraria 100% com metade do trabalho por fazer.
 */
export function progressoGeral(estado: EstadoNaTela | undefined): number | null {
  if (!estado) return null
  if (!estado.contatosSyncEm && !estado.historicoSyncEm) return null

  const valor = (comecou: string | null | undefined, progresso: number | null | undefined) => {
    if (!comecou) return 0
    return Math.max(0, Math.min(100, progresso ?? 0))
  }

  const soma =
    valor(estado.contatosSyncEm, estado.contatosProgresso) +
    valor(estado.historicoSyncEm, estado.historicoProgresso)

  return Math.round(soma / 2)
}

/**
 * Como este número se apresenta na lista: o telefone primeiro, o id embaixo.
 *
 * **O `phone_number_id` não é o telefone de ninguém.** A tela mostrava
 * `110549275215531` como título — um número que o cliente nunca viu. Quem
 * acabou de conectar o próprio celular olhava a lista, não achava o seu, via
 * "Conectar número" ao lado e concluía que não tinha conectado. Foi relatado
 * como UX ruim em 13/set/2026, e com razão.
 *
 * O id não some: ele é a identidade do canal e o que se procura no painel da
 * Meta. Só deixa de ser o título.
 *
 * Canal antigo não tem `displayPhoneNumber` — conectou antes de guardarmos
 * isto. Aí o id volta a ser o título, porque mostrar nada seria pior.
 */
export function identidadeNaTela(
  estado: EstadoNaTela | undefined,
  phoneNumberId: string | null,
): { titulo: string; abaixo: string | null } {
  // Canal sem número ainda (criado à mão, ou conexão pela metade).
  const id = phoneNumberId ?? 'sem número'
  const telefone = estado?.displayPhoneNumber?.trim()
  if (!telefone) return { titulo: id, abaixo: null }

  const nome = estado?.verifiedName?.trim()
  return { titulo: telefone, abaixo: nome ? `${nome} · ${id}` : id }
}

/**
 * Quantas horas a sincronização costuma levar antes de valer a pena estranhar.
 *
 * A doc da Meta diz "de alguns minutos a várias horas", e provedores relatam o
 * mesmo: **enquanto o sync não termina, mensagem nova não chega por webhook**.
 * Seis horas erra para o lado de explicar demais, o que é o lado certo: dizer
 * "é normal" para quem já devia estar recebendo custa uma pergunta; não dizer
 * nada faz a pessoa concluir que quebrou e ir mexer no que estava bom.
 */
export const RECEM_CONECTADO_H = 6

/**
 * Este número acabou de conectar e ainda pode estar sincronizando?
 *
 * Serve para a tela explicar um Inbox vazio sem acusar ninguém — foi a dúvida
 * real do primeiro cliente coexistente, que conectou e ficou uma tarde achando
 * que havia defeito.
 *
 * Sync terminado (progresso 100) tira o "recém": aí o silêncio já não tem essa
 * explicação, e oferecê-la seria desculpa, não informação.
 */
export function recemConectado(
  estado: EstadoNaTela | undefined,
  agora: Date = new Date(),
): boolean {
  if (!estado?.coexistenciaEm) return false
  if ((estado.historicoProgresso ?? 0) >= 100) return false

  const desde = agora.getTime() - new Date(estado.coexistenciaEm).getTime()
  return desde >= 0 && desde < RECEM_CONECTADO_H * 60 * 60 * 1_000
}
