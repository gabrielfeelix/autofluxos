import 'server-only'
import { db, ehIdInvalido } from '../db'

// Reexportado de `core/` para não quebrar quem já o importava daqui.
export { TETO_DA_INSIGNIA } from '@/core/insignia'

/**
 * O que cada pessoa já leu (`af_leituras`, 0023 + a função da 0025).
 *
 * **"Não lida" é por pessoa, não por conversa.** Uma coluna no contato diria
 * que a conversa foi lida porque *alguém* abriu, e "alguém leu" é exatamente
 * a informação que não ajuda ninguém a decidir o que abrir agora.
 *
 * Nada aqui existe sem usuário na sessão: sem usuário
 * não há de quem contar. As duas funções tratam `null` devolvendo o vazio, em
 * vez de o chamador ter que lembrar de perguntar antes.
 */

export async function naoLidasPorContato(
  usuarioId: string | null,
  contatos: string[],
): Promise<Map<string, number>> {
  const porContato = new Map<string, number>()
  if (!usuarioId || contatos.length === 0) return porContato

  const { data, error } = await db().rpc('nao_lidas_por_contato', {
    p_usuario_id: usuarioId,
    p_contatos: contatos,
  })

  if (ehIdInvalido(error)) return porContato
  if (error) {
    // **Degrada, não derruba.** A insígnia de não lidas é conforto; o Inbox é a
    // tela que alguém deixa aberta o dia inteiro, e ela não pode parar de abrir
    // porque uma contagem falhou.
    console.error('[leituras] não deu para contar as não lidas', error.message)
    return porContato
  }

  for (const linha of data as { contato_id: string; total: number }[]) {
    porContato.set(linha.contato_id, Number(linha.total))
  }
  return porContato
}

/**
 * "Eu abri esta conversa agora."
 *
 * `upsert` porque a primeira vez insere e as seguintes só empurram o relógio.
 * É idempotente de propósito: quem chama é a renderização da tela do Inbox, que
 * pode rodar duas vezes na mesma navegação, e escrever `now()` duas vezes é o
 * mesmo que escrever uma.
 *
 * Falha em silêncio pelo mesmo motivo da contagem: perder uma marcação de
 * leitura mostra uma insígnia a mais; estourar aqui fecha a tela de trabalho.
 */
export async function marcarComoLida(usuarioId: string | null, contatoId: string): Promise<void> {
  if (!usuarioId) return

  const { error } = await db()
    .from('af_leituras')
    .upsert(
      { usuario_id: usuarioId, contato_id: contatoId, lida_em: new Date().toISOString() },
      { onConflict: 'usuario_id,contato_id' },
    )

  if (error) console.error('[leituras] não deu para marcar como lida', error.message)
}

/**
 * Quando esta pessoa abriu esta conversa pela última vez. `null` = nunca.
 *
 * Existe para o tique azul do WhatsApp, e por isso precisa ser lido **antes**
 * de `marcarComoLida` escrever `now()`: é a comparação entre este relógio e o
 * da última mensagem recebida que responde "chegou algo desde a última vez que
 * alguém daqui olhou?". Sem essa pergunta, cada atualização da tela mandaria
 * mais um recibo de leitura para a Meta, a tela do Inbox fica aberta o dia
 * inteiro e se refaz sozinha.
 *
 * Falha em silêncio, como o resto do arquivo: sem a resposta, o recibo deixa de
 * ser mandado naquela volta, e ninguém perde trabalho por isso.
 */
export async function quandoLeu(
  usuarioId: string | null,
  contatoId: string,
): Promise<string | null> {
  if (!usuarioId) return null

  const { data, error } = await db()
    .from('af_leituras')
    .select('lida_em')
    .eq('usuario_id', usuarioId)
    .eq('contato_id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) {
    console.error('[leituras] não deu para saber quando foi lida', error.message)
    return null
  }

  return (data as { lida_em: string } | null)?.lida_em ?? null
}

/**
 * "Deixa esta conversa marcada, eu volto nela."
 *
 * ---------------------------------------------------------------------------
 * Por que o relógio anda para trás, e não a linha some
 * ---------------------------------------------------------------------------
 *
 * O caminho óbvio seria apagar a linha de `af_leituras`: sem leitura gravada, a
 * conversa nunca foi lida. O efeito é o oposto do pedido. O piso de contagem,
 * quando não há linha, é a criação do usuário (ver a 0025), apagar devolveria
 * **todas** as entradas desde que a pessoa entrou na conta, e uma conversa de
 * três meses voltaria com a insígnia em 87.
 *
 * O que se quer é o que o WhatsApp faz: a insígnia volta, com o tamanho de uma
 * mensagem, para o olho achar a conversa depois. Por isso o relógio recua para
 * **um milissegundo antes da última entrada**, a conta passa a devolver
 * exatamente as mensagens daquele último instante, quase sempre uma.
 *
 * Sem entrada nenhuma não há o que marcar, e a função não faz nada: insígnia em
 * conversa onde ninguém falou seria um número sobre o vazio.
 */
export async function marcarComoNaoLida(
  usuarioId: string | null,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!usuarioId) return { ok: false, erro: 'entre na conta para marcar conversas' }

  const { data, error } = await db()
    .from('messages')
    .select('ts')
    .eq('contact_id', contatoId)
    .eq('direcao', 'entrada')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, erro: 'esta conversa não existe' }
  if (error) return { ok: false, erro: 'não deu para ler a conversa' }

  const ultima = (data as { ts: string } | null)?.ts
  if (!ultima) return { ok: false, erro: 'ninguém falou nesta conversa ainda' }

  const antes = new Date(Date.parse(ultima) - 1).toISOString()

  const { error: erroDaEscrita } = await db()
    .from('af_leituras')
    .upsert(
      { usuario_id: usuarioId, contato_id: contatoId, lida_em: antes },
      { onConflict: 'usuario_id,contato_id' },
    )

  if (erroDaEscrita) {
    console.error('[leituras] não deu para marcar como não lida', erroDaEscrita.message)
    return { ok: false, erro: 'não deu para marcar como não lida' }
  }

  return { ok: true }
}

/**
 * "Já vi tudo isto."
 *
 * **Recebe a lista, e não o cliente, de propósito.** "Todas" precisa dizer
 * todas de quê: zerar a fila inteira da conta apagaria a insígnia de conversas
 * que a pessoa nem tem à vista, porque o rail ou a busca as deixou de fora. Quem
 * chama manda os contatos do recorte, e o botão da tela diz no rótulo qual
 * recorte é esse.
 *
 * Um `upsert` só com todas as linhas: cinquenta conversas são cinquenta linhas
 * numa ida ao banco, e não cinquenta idas.
 */
export async function marcarTodasComoLidas(
  usuarioId: string | null,
  contatos: string[],
): Promise<{ ok: boolean; erro?: string }> {
  if (!usuarioId) return { ok: false, erro: 'entre na conta para marcar conversas' }
  if (contatos.length === 0) return { ok: true }

  const agora = new Date().toISOString()

  const { error } = await db()
    .from('af_leituras')
    .upsert(
      contatos.map((contatoId) => ({
        usuario_id: usuarioId,
        contato_id: contatoId,
        lida_em: agora,
      })),
      { onConflict: 'usuario_id,contato_id' },
    )

  if (error) {
    console.error('[leituras] não deu para marcar todas como lidas', error.message)
    return { ok: false, erro: 'não deu para marcar as conversas como lidas' }
  }

  return { ok: true }
}
