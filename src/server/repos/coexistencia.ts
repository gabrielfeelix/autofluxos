import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * O estado de coexistência de um número, e a agenda que veio junto (0047).
 *
 * Separado de `conversas.ts` porque o que mora aqui tem um dono de tempo
 * próprio: a **janela de 24 horas**. Todo write deste arquivo existe para
 * responder uma pergunta só — "este disparo já foi gasto?" — e essa pergunta
 * não tem segunda chance de ser respondida errado.
 */

/** O que sabemos sobre a coexistência de um canal. */
export type EstadoDeCoexistencia = {
  /** `null` = nunca verificamos. Não é o mesmo que `false`. */
  isOnBizApp: boolean | null
  /** Quando o Embedded Signup terminou. O relógio da janela de 24h. */
  coexistenciaEm: string | null
  contatosSyncEm: string | null
  contatosSyncRequestId: string | null
  historicoSyncEm: string | null
  historicoSyncRequestId: string | null
  /** Preenchido = `ACCOUNT_OFFBOARDED` chegou e a reconexão não. */
  desembarcadoEm: string | null
  /**
   * O andamento dos dois syncs, para a tela.
   *
   * Só `coexistenciaDoCliente` preenche — as leituras do caminho quente não
   * precisam disso e não pagam por ele. `null` em toda parte é o normal de um
   * número que nunca sincronizou.
   */
  contatosProgresso?: number | null
  contatosVistoEm?: string | null
  historicoProgresso?: number | null
  historicoVistoEm?: string | null
  /**
   * O número e o nome como a Meta os exibe — para a tela dizer qual telefone
   * está ali, em vez do `phone_number_id` que ninguém reconhece.
   *
   * `null` em canal antigo, que conectou antes de guardarmos isto. A tela cai
   * de volta no id quando falta.
   */
  displayPhoneNumber?: string | null
  verifiedName?: string | null
  /** A conta do WhatsApp na Meta. Preenche os links da tela de pendências. */
  wabaId?: string | null
}

const COLUNAS =
  'is_on_biz_app, coexistencia_em, contatos_sync_em, contatos_sync_request_id, historico_sync_em, historico_sync_request_id, desembarcado_em'

function paraEstado(linha: Record<string, unknown>): EstadoDeCoexistencia {
  return {
    isOnBizApp: (linha.is_on_biz_app ?? null) as boolean | null,
    coexistenciaEm: (linha.coexistencia_em ?? null) as string | null,
    contatosSyncEm: (linha.contatos_sync_em ?? null) as string | null,
    contatosSyncRequestId: (linha.contatos_sync_request_id ?? null) as string | null,
    historicoSyncEm: (linha.historico_sync_em ?? null) as string | null,
    historicoSyncRequestId: (linha.historico_sync_request_id ?? null) as string | null,
    desembarcadoEm: (linha.desembarcado_em ?? null) as string | null,
  }
}

export async function lerCoexistencia(canalId: string): Promise<EstadoDeCoexistencia | null> {
  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('id', canalId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler a coexistência: ${error.message}`)
  return data ? paraEstado(data as Record<string, unknown>) : null
}

/** O número embarcou em coexistência. Marca o início da janela de 24h. */
export async function marcarCoexistente(canalId: string): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({ is_on_biz_app: true, coexistencia_em: new Date().toISOString() })
    .eq('id', canalId)

  if (error) throw new Error(`não deu para marcar a coexistência: ${error.message}`)
}

/**
 * Corrige a WABA do canal para a que de fato contém o número.
 *
 * O `waba_id` gravado no onboarding vem da query do Embedded Signup, e ela
 * pode apontar para outra WABA do mesmo cliente — aconteceu em 13/set/2026.
 * Quando `wabaQueContemONumero` descobre a certa, é ela que tem que ficar no
 * canal: é por este campo que qualquer depuração futura começa, e um valor
 * errado aqui manda a próxima pessoa investigar a conta errada.
 */
export async function anotarWaba(canalId: string, wabaId: string): Promise<void> {
  const { error } = await db().from('channels').update({ waba_id: wabaId }).eq('id', canalId)

  if (error) throw new Error(`não deu para corrigir a WABA do canal: ${error.message}`)
}

/**
 * Reserva um disparo de sync, **antes** de ele acontecer.
 *
 * Devolve `true` se a reserva é nossa e o disparo pode sair; `false` se alguém
 * já gastou essa chance.
 *
 * ---------------------------------------------------------------------------
 * Por que é um `update` condicional e não "ler, decidir, escrever"
 * ---------------------------------------------------------------------------
 *
 * **Cada sync só pode ser disparado uma vez, e não há como perguntar à Meta se
 * já gastamos a nossa.** Ler antes e escrever depois deixa uma janela entre as
 * duas coisas: dois webhooks do mesmo onboarding chegando juntos — que é o
 * caso comum, não o raro — leem os dois "ainda não foi", e os dois disparam. O
 * segundo disparo não dá erro; ele só desperdiça a única chance que existia.
 *
 * Com `.is(coluna, null)` no `update`, quem escreve é o banco: exatamente uma
 * das duas chamadas encontra a coluna vazia. A outra não afeta linha nenhuma e
 * descobre isso pela contagem, sem precisar confiar em ordem de chegada.
 *
 * O `request_id` entra depois, em `guardarRequestIdDoSync` — a reserva carimba
 * só a hora, porque o `request_id` só existe **depois** da resposta da Meta, e
 * esperar por ele para reservar traria de volta exatamente a janela que este
 * desenho fecha.
 */
export async function reservarSync(
  canalId: string,
  tipo: 'contatos' | 'historico',
): Promise<boolean> {
  const coluna = tipo === 'contatos' ? 'contatos_sync_em' : 'historico_sync_em'

  const { data, error } = await db()
    .from('channels')
    .update({ [coluna]: new Date().toISOString() })
    .eq('id', canalId)
    .is(coluna, null)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para reservar o sync: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * O `request_id` que a Meta devolveu. **É o que o suporte dela pede** quando um
 * sync não chega, e sem ele não há como investigar um onboarding que falhou.
 */
export async function guardarRequestIdDoSync(
  canalId: string,
  tipo: 'contatos' | 'historico',
  requestId: string,
): Promise<void> {
  const coluna = tipo === 'contatos' ? 'contatos_sync_request_id' : 'historico_sync_request_id'

  const { error } = await db()
    .from('channels')
    .update({ [coluna]: requestId })
    .eq('id', canalId)

  if (error) throw new Error(`não deu para guardar o request_id: ${error.message}`)
}

/**
 * `ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED`.
 *
 * O cliente trocou de celular ou reinstalou o WhatsApp Business e o companion
 * da Cloud API foi desembarcado **sozinho**. Normalmente reconecta em minutos.
 * Enquanto não reconecta, os envios daquele número falham — e sem marcar isso,
 * a troca de aparelho de um cliente vira uma fila de envios falhando em
 * silêncio, que é o defeito que ninguém percebe até alguém reclamar.
 */
export async function marcarDesembarque(canalId: string, desembarcado: boolean): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({ desembarcado_em: desembarcado ? new Date().toISOString() : null })
    .eq('id', canalId)

  if (error) throw new Error(`não deu para marcar o desembarque: ${error.message}`)
}

/* -------------------------------------------------------------------------- */
/* A agenda do celular                                                         */
/* -------------------------------------------------------------------------- */

export type ContatoDaAgenda = {
  phoneNumber: string
  fullName?: string
  firstName?: string
}

/**
 * Grava os contatos da agenda que chegaram num lote.
 *
 * **`upsert`, não `insert`:** `smb_app_state_sync` não chega só no onboarding —
 * toda mudança futura na agenda dele chega por aqui. O mesmo telefone volta com
 * o nome corrigido, e a segunda passagem tem que atualizar, não estourar.
 *
 * Lote inteiro numa chamada: uma agenda de celular tem centenas de linhas, e
 * uma ida ao banco por contato estouraria o orçamento de tempo do webhook antes
 * de metade da agenda entrar.
 */
export async function guardarContatosDaAgenda(
  clienteId: string,
  canalId: string,
  contatos: ContatoDaAgenda[],
): Promise<number> {
  if (contatos.length === 0) return 0

  const linhas = contatos.map((c) => ({
    client_id: clienteId,
    channel_id: canalId,
    phone_number: c.phoneNumber,
    ...(c.fullName === undefined ? {} : { full_name: c.fullName }),
    ...(c.firstName === undefined ? {} : { first_name: c.firstName }),
  }))

  const { data, error } = await db()
    .from('contatos_da_agenda')
    .upsert(linhas, { onConflict: 'client_id,phone_number' })
    .select('id')

  if (error) throw new Error(`não deu para guardar a agenda: ${error.message}`)
  return data?.length ?? 0
}

/**
 * Tira da agenda o que a ação `remove` mandou tirar.
 *
 * Separado do `guardar` porque a ação `remove` **vem sem os nomes** — só com o
 * telefone. Passá-la pelo mesmo caminho gravaria `null` por cima de um nome
 * bom, que é a armadilha 3 de `receber-coexistencia.ts`.
 */
export async function apagarContatosDaAgenda(
  clienteId: string,
  telefones: string[],
): Promise<void> {
  if (telefones.length === 0) return

  const { error } = await db()
    .from('contatos_da_agenda')
    .delete()
    .eq('client_id', clienteId)
    .in('phone_number', telefones)

  if (error) throw new Error(`não deu para apagar da agenda: ${error.message}`)
}

/**
 * O nome que a agenda do cliente dá para um telefone.
 *
 * É o único uso de leitura da agenda no caminho quente: quem estava na agenda
 * dele e escreve pela primeira vez já entra com nome, em vez de aparecer como
 * um número cru na tela de leads.
 */
export async function nomeNaAgenda(
  clienteId: string,
  telefone: string,
): Promise<string | null> {
  const { data, error } = await db()
    .from('contatos_da_agenda')
    .select('full_name, first_name')
    .eq('client_id', clienteId)
    .eq('phone_number', telefone)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler a agenda: ${error.message}`)
  if (!data) return null

  const linha = data as Record<string, unknown>
  return ((linha.full_name ?? linha.first_name) as string | null) ?? null
}

/* -------------------------------------------------------------------------- */
/* As mensagens importadas                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Uma mensagem vinda de `history` ou `smb_message_echoes`.
 *
 * Existe separada de `registrarEntrada` por duas razões que aquela função não
 * pode acomodar sem piorar o caminho quente:
 *
 * 1. **A direção varia.** `registrarEntrada` grava `'entrada'` fixo, porque no
 *    webhook normal só chega o que a pessoa mandou. Aqui metade do histórico é
 *    coisa que o **negócio** disse.
 * 2. **A data é a da mensagem.** `messages.ts` tem `default now()`, certo para
 *    o que chega ao vivo e errado para histórico: importar seis meses de
 *    conversa carimbaria tudo com o instante da importação, e a conversa
 *    apareceria na tela como se tivesse acontecido toda hoje, fora de ordem.
 *
 * Devolve `false` quando a mensagem já existia. **Quem deduplica é o `unique`
 * de `wa_message_id`**, não uma consulta anterior — inclusive entre o histórico
 * e um echo da mesma mensagem, que é o caso que acontece de verdade: uma
 * mensagem recente aparece nos dois.
 */
export async function registrarMensagemDeCoexistencia(dados: {
  contatoId: string
  waMessageId: string
  direcao: 'entrada' | 'saida'
  texto: string | null
  payload: unknown
  /** `null` = use o `now()` do banco. */
  ts: string | null
  historico: boolean
  /*
   * Devolve o **id da linha gravada**, e `null` quando era repetida.
   *
   * Era `boolean`. O id passou a ser necessário quando o eco começou a baixar
   * a cópia da mídia: `guardarMidiaRecebida` grava o arquivo **na mensagem**, e
   * para isso precisa saber em qual. `true` dizia que gravou e não dizia onde.
   */
}): Promise<string | null> {
  const { data, error } = await db()
    .from('messages')
    .insert({
      contact_id: dados.contatoId,
      session_id: null,
      direcao: dados.direcao,
      wa_message_id: dados.waMessageId,
      texto: dados.texto,
      payload: dados.payload,
      historico: dados.historico,
      ...(dados.ts === null ? {} : { ts: dados.ts }),
      /*
       * Entregue, e não "por confirmar".
       *
       * O que veio do histórico ou de um echo **já aconteceu** — a pessoa já
       * recebeu, pelo celular dele. `false` aqui faria a tela mostrar meio
       * histórico como envio pendente que nunca vai confirmar.
       */
      ...(dados.direcao === 'saida' ? { entregue: true } : {}),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw new Error(`não deu para registrar a mensagem de coexistência: ${error.message}`)
  }
  return data.id as string
}

/* -------------------------------------------------------------------------- */
/* O canal que nasce do Embedded Signup                                        */
/* -------------------------------------------------------------------------- */

/**
 * Grava o número que veio do Embedded Signup, com o token no cofre.
 *
 * Espelha `salvarContaDoInstagram`, e pelas mesmas razões:
 *
 * - **O token nunca fica na tabela.** Ele vai para o Vault e a linha guarda só
 *   a referência, como em `channels.token_ref` (0040). Quem lê a linha não lê o
 *   token, e isso não depende de disciplina de quem escreve a próxima consulta.
 * - **Reconectar o mesmo número atualiza, não duplica.** `phone_number_id` é
 *   `unique` no sistema inteiro; sem este caminho, o cliente que refaz o
 *   onboarding — que é o que a Meta manda fazer quando a janela de 24h vence —
 *   bateria numa violação de constraint em vez de reconectar.
 * - **O mesmo número de outro cliente é erro dito por extenso.** O `unique`
 *   barra no banco, com uma mensagem que não ajuda ninguém. O caso é real: uma
 *   agência com dois cadastros do mesmo negócio.
 *
 * Devolve o id do canal, que é o que o onboarding precisa para reservar os syncs.
 */
export async function salvarNumeroDoOnboarding(entrada: {
  clienteId: string
  phoneNumberId: string
  wabaId: string | null
  token: string
  expiraEm: Date | null
}): Promise<{ canalId: string }> {
  const { data: existente } = await db()
    .from('channels')
    .select('id, client_id, token_ref')
    .eq('phone_number_id', entrada.phoneNumberId)
    .maybeSingle()

  const linha = existente as { id: string; client_id: string; token_ref: string | null } | null

  if (linha && linha.client_id !== entrada.clienteId) {
    throw new Error('este número de WhatsApp já está ligado a outro cliente')
  }

  const expira = entrada.expiraEm ? entrada.expiraEm.toISOString() : null

  if (linha) {
    if (linha.token_ref) {
      const { error } = await db().rpc('trocar_segredo', {
        alvo: linha.token_ref,
        valor: entrada.token,
      })
      if (error) throw new Error(`não deu para guardar o token: ${error.message}`)
    } else {
      const { data: segredo, error } = await db().rpc('criar_segredo', {
        valor: entrada.token,
        apelido: `whatsapp_${crypto.randomUUID()}`,
      })
      if (error) throw new Error(`não deu para guardar o token: ${error.message}`)

      const { error: erroDoVinculo } = await db()
        .from('channels')
        .update({ token_ref: segredo as string })
        .eq('id', linha.id)
      if (erroDoVinculo) {
        await db().rpc('apagar_segredo', { alvo: segredo as string })
        throw new Error(`não deu para ligar o token ao número: ${erroDoVinculo.message}`)
      }
    }

    const { error } = await db()
      .from('channels')
      .update({
        waba_id: entrada.wabaId,
        token_expira_em: expira,
        status: 'ativo',
        // Reconectou: o desembarque anterior, se havia, acabou.
        desembarcado_em: null,
      })
      .eq('id', linha.id)

    if (error) throw new Error(`não deu para atualizar o número: ${error.message}`)
    return { canalId: linha.id }
  }

  // O apelido leva um id aleatório: ele precisa ser único e não pode vazar o
  // nome do cliente para dentro do Vault.
  const { data: segredo, error: erroDoCofre } = await db().rpc('criar_segredo', {
    valor: entrada.token,
    apelido: `whatsapp_${crypto.randomUUID()}`,
  })
  if (erroDoCofre) throw new Error(`não deu para guardar o token: ${erroDoCofre.message}`)

  const tokenRef = segredo as string

  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: entrada.clienteId,
      provider: 'cloud-api',
      phone_number_id: entrada.phoneNumberId,
      waba_id: entrada.wabaId,
      token_ref: tokenRef,
      token_expira_em: expira,
      status: 'ativo',
    })
    .select('id')
    .single()

  if (error) {
    // O segredo já está no cofre e a linha não nasceu. Sem isto ele ficaria
    // órfão para sempre — e token órfão é token que ninguém revoga.
    await db().rpc('apagar_segredo', { alvo: tokenRef })
    throw new Error(`não deu para conectar o número: ${error.message}`)
  }

  return { canalId: (data as { id: string }).id }
}

/**
 * O progresso de uma sincronização, como o último lote reportou.
 *
 * **A sincronização pode levar até 6 horas e pode falhar de vez** — não está na
 * doc da Meta, veio de quem implementou. Sem gravar isto, "ainda rodando" e
 * "morreu no meio" são a mesma coisa vista de fora: nenhum dado novo chegando.
 *
 * Grava o número **e** a hora. Progresso parado em 40 há duas horas é falha;
 * parado em 40 há dez segundos é a sincronização andando. O número sozinho não
 * distingue os dois, e é a distinção que importa para quem olha a tela.
 *
 * Melhor-esforço: falhar em anotar o progresso não pode derrubar a importação
 * do lote que chegou junto. Quem chama trata o erro, não propaga.
 */
export async function anotarProgressoDoSync(
  canalId: string,
  tipo: 'contatos' | 'historico',
  progresso: number,
): Promise<void> {
  const prefixo = tipo === 'contatos' ? 'contatos_sync' : 'historico_sync'

  const { error } = await db()
    .from('channels')
    .update({
      // A Meta manda 0 a 100. Um valor fora disso é ruído e não vale gravar.
      [`${prefixo}_progresso`]: Math.max(0, Math.min(100, Math.round(progresso))),
      [`${prefixo}_visto_em`]: new Date().toISOString(),
    })
    .eq('id', canalId)

  if (error) throw new Error(`não deu para anotar o progresso: ${error.message}`)
}

/**
 * O estado de coexistência de todos os números de um cliente, de uma vez.
 *
 * Existe para a tela: `listarCanais` devolve `CanalSalvo`, que não tem nenhuma
 * coluna desta migration — e uma leitura por número transformaria a tela de um
 * cliente com três números em quatro idas ao banco. Devolve um mapa por id de
 * canal, que é como a tela já tem os números na mão.
 */
export async function coexistenciaDoCliente(
  clienteId: string,
): Promise<Record<string, EstadoDeCoexistencia>> {
  const { data, error } = await db()
    .from('channels')
    .select(
      `id, ${COLUNAS}, contatos_sync_progresso, contatos_sync_visto_em, historico_sync_progresso, historico_sync_visto_em, display_phone_number, verified_name, waba_id`,
    )
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return {}
  if (error) throw new Error(`não deu para ler a coexistência do cliente: ${error.message}`)

  const mapa: Record<string, EstadoDeCoexistencia> = {}
  for (const linha of (data ?? []) as Record<string, unknown>[]) {
    mapa[linha.id as string] = {
      ...paraEstado(linha),
      contatosProgresso: (linha.contatos_sync_progresso ?? null) as number | null,
      contatosVistoEm: (linha.contatos_sync_visto_em ?? null) as string | null,
      historicoProgresso: (linha.historico_sync_progresso ?? null) as number | null,
      historicoVistoEm: (linha.historico_sync_visto_em ?? null) as string | null,
      displayPhoneNumber: (linha.display_phone_number ?? null) as string | null,
      verifiedName: (linha.verified_name ?? null) as string | null,
      wabaId: (linha.waba_id ?? null) as string | null,
    }
  }
  return mapa
}

/**
 * Já existe canal com esta WABA?
 *
 * A pergunta do `PARTNER_ADDED`: a Meta avisa que uma WABA foi conectada, e
 * precisamos saber se é uma que já conhecemos (o retorno pelo navegador
 * funcionou) ou uma que nunca chegou até aqui (o cliente conectou e nós não
 * ficamos sabendo). Ver `registrarOnboardingPelaMeta`.
 */
export async function existeCanalComWaba(wabaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('channels')
    .select('id')
    .eq('waba_id', wabaId)
    .limit(1)

  if (error) throw new Error(`não deu para procurar o canal pela WABA: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * O telefone e o nome como a Meta os exibe, para a tela ter o que mostrar.
 *
 * **Enfeite de tela, e só.** A identidade do canal continua sendo o
 * `phone_number_id`; estes dois campos existem porque `110549275215531` não
 * significa nada para quem conectou o próprio celular. Anuláveis: canal antigo
 * não tem, e a tela sabe cair de volta no id.
 */
export async function anotarIdentidade(
  canalId: string,
  dados: { displayPhoneNumber: string | null; verifiedName: string | null },
): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({
      display_phone_number: dados.displayPhoneNumber,
      verified_name: dados.verifiedName,
    })
    .eq('id', canalId)

  if (error) throw new Error(`não deu para anotar a identidade do número: ${error.message}`)
}
