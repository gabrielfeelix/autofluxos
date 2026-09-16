import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * O alfinete e a estrela: o que cada pessoa marcou para si (a 0063).
 *
 * ---------------------------------------------------------------------------
 * Por que isto é irmão de `repos/leituras.ts`, e não parte dele
 * ---------------------------------------------------------------------------
 *
 * As três tabelas respondem a mesma forma de pergunta, "o que ESTA pessoa
 * marcou neste contato?", e por isso o desenho é o mesmo: par
 * `usuario_id + contato_id`, chave primária composta, sem `cliente_id`.
 *
 * Ficam em arquivos separados porque o que elas guardam decide coisas
 * diferentes: leitura é contagem (e degrada em silêncio, porque insígnia é
 * conforto), enquanto fixar e favoritar são gestos deliberados, quem clica no
 * alfinete e não vê a conversa subir precisa saber que não funcionou, e por
 * isso aqui os erros **voltam** em vez de virar `console.error`.
 *
 * Nada aqui existe sem usuário na sessão: sem usuário não há de quem marcar.
 */

/* -------------------------------------------------------------------------- */
/* O alfinete                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * As conversas que esta pessoa fixou, da mais recente para a mais antiga.
 *
 * Devolve `Map` de contato para `fixada_em` porque a tela precisa das duas
 * coisas: quem está fixado (para o alfinete nascer cheio) e em que ordem (para
 * o bloco do topo não se reordenar sozinho quando a conversa recebe mensagem).
 *
 * **Não filtra por cliente**, e isso é seguro por como o resultado é usado:
 * quem chama cruza estes ids com os leads do cliente atual, que já vêm de uma
 * consulta com `client_id`. Filtrar aqui exigiria um join com `contacts` numa
 * leitura que acontece a cada abertura do Inbox, para no máximo cinco linhas.
 *
 * Degrada para o vazio: sem o alfinete a fila continua sendo a fila, e a tela
 * mais usada do produto não pode parar de abrir porque uma marcação falhou.
 */
export async function fixadasDoUsuario(usuarioId: string | null): Promise<Map<string, string>> {
  const fixadas = new Map<string, string>()
  if (!usuarioId) return fixadas

  const { data, error } = await db()
    .from('af_fixadas')
    .select('contato_id, fixada_em')
    .eq('usuario_id', usuarioId)
    .order('fixada_em', { ascending: false })

  if (ehIdInvalido(error)) return fixadas
  if (error) {
    console.error('[marcadores] não deu para ler as fixadas', error.message)
    return fixadas
  }

  for (const linha of data as { contato_id: string; fixada_em: string }[]) {
    fixadas.set(linha.contato_id, linha.fixada_em)
  }
  return fixadas
}

/**
 * Quantas desta conta esta pessoa já fixou.
 *
 * **O teto é por conta, e não por pessoa.** Quem atende dois clientes tem dois
 * conjuntos de urgências, e somar os dois faria o quinto alfinete de um cliente
 * ser recusado por causa de conversas do outro, uma recusa que a tela não teria
 * como explicar, porque o que a bloqueou não está nela.
 *
 * São duas consultas em vez de um join embutido: PostgREST resolveria com
 * `contacts!inner`, mas embedding depende do nome da relação, que é a parte que
 * quebra em silêncio quando a chave estrangeira muda. Duas consultas explícitas
 * num clique raro custam menos que um 400 sem explicação.
 */
export async function contarFixadasNoCliente(
  usuarioId: string,
  clienteId: string,
): Promise<number> {
  const fixadas = await fixadasDoUsuario(usuarioId)
  if (fixadas.size === 0) return 0

  const { count, error } = await db()
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clienteId)
    .in('id', [...fixadas.keys()])

  if (error) {
    console.error('[marcadores] não deu para contar as fixadas da conta', error.message)
    // Contar errado para menos libera um alfinete a mais; para mais, bloqueia
    // quem não devia. Na dúvida, libera: o custo do erro é uma linha a mais no
    // topo da fila de uma pessoa só.
    return 0
  }

  return count ?? 0
}

/** Gruda a conversa no topo da fila desta pessoa. Idempotente. */
export async function fixar(usuarioId: string, contatoId: string): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await db()
    .from('af_fixadas')
    .upsert(
      { usuario_id: usuarioId, contato_id: contatoId },
      { onConflict: 'usuario_id,contato_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[marcadores] não deu para fixar', error.message)
    return { ok: false, erro: 'não deu para fixar a conversa' }
  }
  return { ok: true }
}

/** Solta a conversa. Apagar o que não existe é sucesso, e não erro. */
export async function soltar(usuarioId: string, contatoId: string): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await db()
    .from('af_fixadas')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('contato_id', contatoId)

  if (error) {
    console.error('[marcadores] não deu para soltar', error.message)
    return { ok: false, erro: 'não deu para soltar a conversa' }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* A estrela                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Quais destas mensagens esta pessoa guardou.
 *
 * Recebe os ids que já estão na tela em vez de ler tudo o que a pessoa
 * favoritou: a conversa aberta traz até 500 bolhas, e a pergunta que a tela faz
 * é sobre elas, "quais destas estão com estrela" , não sobre o acervo.
 */
export async function favoritasEntre(
  usuarioId: string | null,
  mensagens: string[],
): Promise<Set<string>> {
  const marcadas = new Set<string>()
  if (!usuarioId || mensagens.length === 0) return marcadas

  const { data, error } = await db()
    .from('af_favoritas')
    .select('mensagem_id')
    .eq('usuario_id', usuarioId)
    .in('mensagem_id', mensagens)

  if (ehIdInvalido(error)) return marcadas
  if (error) {
    console.error('[marcadores] não deu para ler as favoritas', error.message)
    return marcadas
  }

  for (const linha of data as { mensagem_id: string }[]) marcadas.add(linha.mensagem_id)
  return marcadas
}

/** Uma mensagem guardada, com o bastante para a lista fazer sentido sozinha. */
export type Favorita = {
  mensagemId: string
  contatoId: string
  nomeDoContato: string | null
  waId: string
  direcao: 'entrada' | 'saida'
  texto: string | null
  ts: string
  favoritadaEm: string
}

/**
 * O acervo desta pessoa, nesta conta.
 *
 * **O join com `contacts` não é enfeite: é o filtro de conta.** `af_favoritas`
 * não guarda `cliente_id` (ver a 0063), e sem cruzar com o contato a lista
 * mostraria mensagens de um cliente dentro da tela de outro. É o mesmo cuidado
 * do resto do repo, id vindo de outro lugar não prova de quem ele é.
 *
 * Sem embedding do PostgREST, e sim três consultas explícitas. É o mesmo
 * caminho de `acharMensagemParaReagir`: a relação aqui tem dois saltos
 * (`af_favoritas → messages → contacts`), e embedding de dois saltos depende do
 * nome que o PostgREST deduz da chave estrangeira, a parte que passa a
 * responder 400 no dia em que a chave mudar, sem nada no código mudando junto.
 */
export async function listarFavoritas(
  usuarioId: string | null,
  clienteId: string,
  teto = 200,
): Promise<Favorita[]> {
  if (!usuarioId) return []

  const { data: marcadas, error } = await db()
    .from('af_favoritas')
    .select('mensagem_id, favoritada_em')
    .eq('usuario_id', usuarioId)
    .order('favoritada_em', { ascending: false })
    .limit(teto)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as favoritas: ${error.message}`)

  const linhas = (marcadas ?? []) as { mensagem_id: string; favoritada_em: string }[]
  if (linhas.length === 0) return []

  const quando = new Map(linhas.map((l) => [l.mensagem_id, l.favoritada_em]))

  const { data: mensagens, error: erroDasMensagens } = await db()
    .from('messages')
    .select('id, contact_id, direcao, texto, ts')
    .in('id', [...quando.keys()])

  if (erroDasMensagens) {
    throw new Error(`não deu para ler as mensagens favoritas: ${erroDasMensagens.message}`)
  }

  type Linha = {
    id: string
    contact_id: string
    direcao: 'entrada' | 'saida'
    texto: string | null
    ts: string
  }

  const achadas = (mensagens ?? []) as Linha[]
  if (achadas.length === 0) return []

  /*
   * **O corte por conta acontece aqui, e é o que impede a lista de vazar.**
   *
   * `af_favoritas` não guarda `cliente_id` (ver a 0063), então até esta linha a
   * lista é "o que esta pessoa guardou em qualquer conta que ela atende".
   * Quem não estiver entre os contatos deste cliente sai, e sai por ausência,
   * que é o jeito que falha fechado: contato que não voltou da consulta
   * simplesmente não entra.
   */
  const { data: contatos, error: erroDosContatos } = await db()
    .from('contacts')
    .select('id, nome, wa_id')
    .eq('client_id', clienteId)
    .in('id', [...new Set(achadas.map((m) => m.contact_id))])

  if (erroDosContatos) {
    throw new Error(`não deu para ler os contatos das favoritas: ${erroDosContatos.message}`)
  }

  const porContato = new Map(
    ((contatos ?? []) as { id: string; nome: string | null; wa_id: string }[]).map((c) => [c.id, c]),
  )

  return achadas
    .filter((linha) => porContato.has(linha.contact_id))
    .map((linha) => {
      const contato = porContato.get(linha.contact_id)!
      return {
        mensagemId: linha.id,
        contatoId: linha.contact_id,
        nomeDoContato: contato.nome,
        waId: contato.wa_id,
        direcao: linha.direcao,
        texto: linha.texto,
        ts: linha.ts,
        favoritadaEm: quando.get(linha.id) ?? linha.ts,
      }
    })
    .sort((a, b) => Date.parse(b.favoritadaEm) - Date.parse(a.favoritadaEm))
}

/**
 * Guarda a mensagem, conferindo antes que ela é desta conta.
 *
 * A conferência existe pelo mesmo motivo de `acharMensagemParaReagir`: o id vem
 * da tela, e a tela pode estar mostrando outra coisa. Sem ela, um id de outro
 * cliente entraria no acervo de quem não devia poder lê-lo.
 */
export async function favoritar(
  usuarioId: string,
  clienteId: string,
  mensagemId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const dona = await ehDestaConta(clienteId, mensagemId)
  if (!dona) return { ok: false, erro: 'esta mensagem não é desta conta' }

  const { error } = await db()
    .from('af_favoritas')
    .upsert(
      { usuario_id: usuarioId, mensagem_id: mensagemId },
      { onConflict: 'usuario_id,mensagem_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[marcadores] não deu para favoritar', error.message)
    return { ok: false, erro: 'não deu para guardar a mensagem' }
  }
  return { ok: true }
}

/**
 * Tira a estrela.
 *
 * Sem conferir a conta, e de propósito: a linha já é da pessoa (`usuario_id` na
 * cláusula), e apagar o que é seu não vaza nada de ninguém. Conferir aqui só
 * adicionaria uma consulta ao caminho de desfazer.
 */
export async function desfavoritar(
  usuarioId: string,
  mensagemId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await db()
    .from('af_favoritas')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('mensagem_id', mensagemId)

  if (error) {
    console.error('[marcadores] não deu para desfavoritar', error.message)
    return { ok: false, erro: 'não deu para tirar a estrela' }
  }
  return { ok: true }
}

/**
 * A mensagem pertence a um contato deste cliente?
 *
 * Duas consultas, na ordem que falha fechado: acha o contato da mensagem, e
 * depois pergunta se aquele contato é deste cliente. Qualquer uma das duas
 * voltando vazia é "não", que é a resposta segura.
 */
async function ehDestaConta(clienteId: string, mensagemId: string): Promise<boolean> {
  const { data: mensagem, error } = await db()
    .from('messages')
    .select('contact_id')
    .eq('id', mensagemId)
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) {
    console.error('[marcadores] não deu para achar a mensagem', error.message)
    return false
  }

  const contatoId = (mensagem as { contact_id: string } | null)?.contact_id
  if (!contatoId) return false

  const { data: contato, error: erroDoContato } = await db()
    .from('contacts')
    .select('id')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (erroDoContato) {
    console.error('[marcadores] não deu para conferir a conta da mensagem', erroDoContato.message)
    return false
  }
  return Boolean(contato)
}
