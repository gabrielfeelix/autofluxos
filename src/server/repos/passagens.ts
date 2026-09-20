import 'server-only'
import type { Passagem } from '@/core/anuncios'
import { chaveDaEntrada, type TipoDeEntrada } from '@/core/regras-de-entrada'
import { db, ehIdInvalido } from '../db'

/**
 * Por onde cada contato já chegou (0050).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que mostrar é
 * `core/anuncios.ts`; quem busca o nome na Meta é `resolver-anuncios.ts`.
 */

type Linha = { ad_id: string; titulo: string | null; criado_em: string; tipo: string | null }

/**
 * Registra uma chegada.
 *
 * **Nunca lança, e por isso devolve `void`.** Quem chama é o webhook da Meta,
 * no caminho de receber mensagem: falhar aqui não pode impedir a pessoa de ser
 * atendida nem fazer o webhook responder erro — a Meta reentregaria, e o
 * resultado seria a mensagem duplicada por causa de um registro de histórico.
 *
 * A repetição é esperada e silenciosa: o índice `passagens_sem_repeticao_idx`
 * recusa o retry do webhook dentro do mesmo minuto, o
 * `passagens_chave_externa_idx` recusa a reentrega do mesmo evento em qualquer
 * momento, e `23505` aqui quer dizer "já estava registrado", que é sucesso e
 * não erro.
 *
 * **`tipo` é obrigatório desde a 0074, e não tem default aqui de propósito.**
 * No banco a coluna tem default, o que era necessário para as linhas antigas;
 * repetir o default nesta assinatura deixaria um chamador novo esquecer o tipo e
 * virar chegada por anúncio calada, abrindo 72h de texto livre que a Meta não
 * concedeu. Ver `core/regras-de-entrada.ts`.
 */
export async function registrarPassagem(entrada: {
  clienteId: string
  contatoId: string
  adId: string
  tipo: TipoDeEntrada
  /** O ID do evento na origem: `leadgen_id`, `wamid`. Torna a reentrega idempotente. */
  idExterno?: string | null
  titulo?: string
  texto?: string
  url?: string
  clique?: string
}): Promise<void> {
  const adId = entrada.adId.trim()
  if (adId === '') return

  const { error } = await db()
    .from('passagens')
    .insert({
      client_id: entrada.clienteId,
      contact_id: entrada.contatoId,
      ad_id: adId,
      tipo: entrada.tipo,
      chave_externa: chaveDaEntrada(entrada),
      titulo: entrada.titulo ?? '',
      texto: entrada.texto ?? '',
      url: entrada.url ?? '',
      clique: entrada.clique ?? '',
    })

  if (!error || error.code === '23505') return
  throw new Error(`não deu para registrar a passagem: ${error.message}`)
}

/**
 * O histórico de um contato, da chegada mais recente para a mais antiga.
 *
 * A ordem é a da leitura: "veio por esta, e antes por aquela". Quem quiser a
 * primeira passagem — a atribuição original, que é o que a Meta credita — lê a
 * última da lista.
 */
export async function passagensDoContato(contatoId: string): Promise<Passagem[]> {
  const { data, error } = await db()
    .from('passagens')
    .select('ad_id, titulo, criado_em, tipo')
    .eq('contact_id', contatoId)
    .order('criado_em', { ascending: false })

  /*
   * Histórico é contexto, não o atendimento. Tabela ausente ou id torto devolve
   * lista vazia em vez de derrubar o Inbox inteiro.
   */
  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para ler as passagens: ${error.message}`)
  }

  return ((data ?? []) as Linha[]).map((linha) => ({
    adId: linha.ad_id,
    titulo: linha.titulo ?? '',
    criadoEm: linha.criado_em,
    tipo: linha.tipo ?? undefined,
  }))
}
