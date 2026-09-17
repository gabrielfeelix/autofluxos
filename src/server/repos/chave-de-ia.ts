import 'server-only'
import { db } from '../db'
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from '../cofre'

/**
 * A chave de IA do próprio cliente (`clients.ia_chave_ref`).
 *
 * ---------------------------------------------------------------------------
 * Por que ela existe, e não é feature de plano
 * ---------------------------------------------------------------------------
 *
 * A conta free do Gemini **treina modelo com o que passa por ela**, inclusive
 * com revisão humana. Enquanto quem conversa é a 4YU numa demonstração, o dado é
 * nosso e o assunto é de ninguém. Quando entra o cliente do cliente, com nome,
 * telefone e o que quer comprar, aquilo é dado pessoal de terceiro indo para
 * treino sem o titular ter consentido.
 *
 * Por isso a chave do cliente **tem precedência sobre a nossa** em
 * `ia/modelo.ts`: não é o plano alto que liga, é a conta que tem chave que passa
 * a usá-la. Vender isso como diferencial é consequência, não a razão.
 *
 * ---------------------------------------------------------------------------
 * A coluna guarda a referência, nunca a chave
 * ---------------------------------------------------------------------------
 *
 * `ia_chave_ref` existe desde a `0001` e está vazia em toda conta. Ela aponta
 * para o Supabase Vault, como `connections.secret_id` — mesma mecânica, mesmas
 * três RPC, agora em `server/cofre.ts`. Uma coluna de texto com a chave dentro
 * apareceria em todo `select *`, em todo backup e em todo log de erro.
 *
 * **Não existe função que devolva a chave para a tela.** `comoEsta` diz se
 * existe e o que dá para mostrar sem risco; quem lê o valor é o servidor, uma
 * vez, na hora de falar com o Google.
 */

/** O que a tela pode saber. Repare no que não está aqui: a chave. */
export type EstadoDaChave = {
  /** A conta tem chave própria gravada? */
  propria: boolean
  /**
   * Os últimos quatro caracteres, para a pessoa reconhecer qual chave está lá.
   *
   * Quatro e não seis: é o bastante para distinguir duas chaves da mesma conta e
   * pouco demais para servir a quem interceptar a tela.
   */
  fim: string | null
}

export async function comoEsta(clienteId: string): Promise<EstadoDaChave> {
  const ref = await refDaConta(clienteId)
  if (ref === null) return { propria: false, fim: null }

  const chave = await lerDoCofre(ref)
  /*
   * Referência apontando para nada conta como "sem chave própria", e não como
   * erro: o segredo pode ter sido apagado por fora, e uma conta que respondia
   * ontem não pode parar de responder hoje por causa disso. `escolherModelo`
   * cai na nossa chave pelo mesmo caminho.
   */
  if (chave === null) return { propria: false, fim: null }

  return { propria: true, fim: chave.slice(-4) }
}

/**
 * Grava ou troca a chave da conta.
 *
 * Guarda a nova **antes** de apagar a velha, e apaga a velha só depois de a
 * coluna já apontar para a nova. Na ordem inversa, uma falha no meio deixaria a
 * conta sem chave nenhuma — com a IA muda em produção e nada para restaurar.
 */
export async function guardarChave(clienteId: string, chave: string): Promise<void> {
  const limpa = chave.trim()
  if (limpa === '') throw new Error('a chave não pode ser vazia')

  const anterior = await refDaConta(clienteId)
  const nova = await guardarNoCofre(limpa, `ia_${crypto.randomUUID()}`)

  const { data, error } = await db()
    .from('clients')
    .update({ ia_chave_ref: nova })
    .eq('id', clienteId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    // A coluna não mudou, então a chave nova não é de ninguém. Sem isto ela
    // fica órfã no cofre para sempre, e segredo que ninguém usa é segredo que
    // ninguém percebe sendo usado.
    await apagarDoCofre(nova)
    if (error) throw new Error(`não deu para guardar a chave: ${error.message}`)
    throw new Error('esta conta não existe')
  }

  if (anterior !== null) await apagarDoCofre(anterior)
}

/** Volta a usar a chave da 4YU. O segredo sai do cofre junto. */
export async function apagarChave(clienteId: string): Promise<void> {
  const ref = await refDaConta(clienteId)
  if (ref === null) return

  const { error } = await db()
    .from('clients')
    .update({ ia_chave_ref: null })
    .eq('id', clienteId)

  if (error) throw new Error(`não deu para apagar a chave: ${error.message}`)
  await apagarDoCofre(ref)
}

/**
 * A chave em claro, para o servidor usar agora. `null` quando a conta não tem.
 *
 * Só `ia/modelo.ts` chama. O retorno morre no fim da chamada: nunca é
 * serializado, nunca entra na sessão, nunca chega ao navegador.
 */
export async function lerChave(clienteId: string): Promise<string | null> {
  const ref = await refDaConta(clienteId)
  return ref === null ? null : lerDoCofre(ref)
}

async function refDaConta(clienteId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('clients')
    .select('ia_chave_ref')
    .eq('id', clienteId)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar a conta: ${error.message}`)
  const ref = (data as { ia_chave_ref: string | null } | null)?.ia_chave_ref ?? null
  return ref === null || ref.trim() === '' ? null : ref
}
