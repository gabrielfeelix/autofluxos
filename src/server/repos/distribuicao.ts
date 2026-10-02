import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Como a conta distribui, e como cada pessoa participa (a 0064).
 *
 * Ver `docs/PLANO-DISTRIBUICAO.md` para as decisões. O que importa aqui:
 * **tudo tem padrão, e o padrão é o comportamento de hoje.** Conta que nunca
 * abriu a tela de equipe continua exatamente como estava, e linha ausente em
 * `af_atendentes` não é erro nenhum.
 */

export type ModoDeDistribuicao = 'manual' | 'balanceado' | 'rodizio'

export const MODOS_DE_DISTRIBUICAO: ModoDeDistribuicao[] = ['manual', 'balanceado', 'rodizio']

export type AjustesDaConta = {
  distribuicao: ModoDeDistribuicao
  /** `true` = responder exige ser o dono da conversa. */
  exigeAssumir: boolean
}

const PADRAO: AjustesDaConta = { distribuicao: 'manual', exigeAssumir: false }

/**
 * Como esta conta distribui.
 *
 * Degrada para o padrão em vez de estourar, e isso é o que faz o gancho no
 * webhook ser seguro: uma falha de leitura aqui não pode derrubar o recebimento
 * de mensagem. Sem resposta, ninguém é atribuído, que é o estado de sempre.
 */
export async function ajustesDaConta(clienteId: string): Promise<AjustesDaConta> {
  const { data, error } = await db()
    .from('clients')
    .select('distribuicao, exige_assumir')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return PADRAO
  if (error) {
    console.error('[distribuicao] não deu para ler os ajustes da conta', error.message)
    return PADRAO
  }
  if (!data) return PADRAO

  const linha = data as { distribuicao: string | null; exige_assumir: boolean | null }
  return {
    distribuicao: (MODOS_DE_DISTRIBUICAO as string[]).includes(linha.distribuicao ?? '')
      ? (linha.distribuicao as ModoDeDistribuicao)
      : 'manual',
    exigeAssumir: linha.exige_assumir === true,
  }
}

export async function definirAjustesDaConta(
  clienteId: string,
  ajustes: Partial<AjustesDaConta>,
): Promise<{ ok: boolean; erro?: string }> {
  const mudanca: Record<string, unknown> = {}
  if (ajustes.distribuicao !== undefined) mudanca.distribuicao = ajustes.distribuicao
  if (ajustes.exigeAssumir !== undefined) mudanca.exige_assumir = ajustes.exigeAssumir
  if (Object.keys(mudanca).length === 0) return { ok: true }

  const { error } = await db().from('clients').update(mudanca).eq('id', clienteId)

  if (error) {
    console.error('[distribuicao] não deu para salvar os ajustes', error.message)
    return { ok: false, erro: 'não deu para salvar a distribuição' }
  }
  return { ok: true }
}

export type AjusteDoAtendente = {
  entraNoRodizio: boolean
  tetoSimultaneo: number
}

/**
 * O que cada pessoa configurou nesta conta.
 *
 * Devolve só quem tem linha. Quem não tem cai no padrão do papel, decidido em
 * `core/rodizio.ts`, e é de propósito que esse padrão não more aqui: ele muda
 * por conversa com o dono, e regra de produto dentro do repositório é regra que
 * ninguém acha depois.
 */
export async function atendentesDaConta(
  clienteId: string,
): Promise<Map<string, AjusteDoAtendente>> {
  const porUsuario = new Map<string, AjusteDoAtendente>()

  const { data, error } = await db()
    .from('af_atendentes')
    .select('usuario_id, entra_no_rodizio, teto_simultaneo')
    .eq('cliente_id', clienteId)

  if (ehIdInvalido(error)) return porUsuario
  if (error) {
    console.error('[distribuicao] não deu para ler os atendentes', error.message)
    return porUsuario
  }

  for (const linha of data as {
    usuario_id: string
    entra_no_rodizio: boolean
    teto_simultaneo: number
  }[]) {
    porUsuario.set(linha.usuario_id, {
      entraNoRodizio: linha.entra_no_rodizio,
      tetoSimultaneo: Number(linha.teto_simultaneo) || 0,
    })
  }
  return porUsuario
}

/**
 * Grava como uma pessoa participa.
 *
 * `upsert` com os dois campos sempre, e não um `update` parcial: a linha pode
 * não existir, e quem chama é uma tela que mostra os dois controles juntos.
 */
export async function definirAtendente(
  clienteId: string,
  usuarioId: string,
  ajuste: AjusteDoAtendente,
): Promise<{ ok: boolean; erro?: string }> {
  const teto = Number.isFinite(ajuste.tetoSimultaneo)
    ? Math.max(0, Math.trunc(ajuste.tetoSimultaneo))
    : 0

  const { error } = await db()
    .from('af_atendentes')
    .upsert(
      {
        cliente_id: clienteId,
        usuario_id: usuarioId,
        entra_no_rodizio: ajuste.entraNoRodizio,
        teto_simultaneo: teto,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'cliente_id,usuario_id' },
    )

  if (error) {
    console.error('[distribuicao] não deu para salvar o atendente', error.message)
    return { ok: false, erro: 'não deu para salvar' }
  }
  return { ok: true }
}

/**
 * Quando cada pessoa recebeu o último lead pela distribuição (0123).
 *
 * Consulta à parte, e não uma coluna a mais em `atendentesDaConta`: antes da
 * 0123 chegar em produção a coluna não existe, e o erro levaria junto a leitura
 * de quem entra no rodízio. Aqui ele só tira a ordem, e o rodízio cai no
 * desempate pelo id.
 */
export async function ultimosLeadsDaConta(clienteId: string): Promise<Map<string, string>> {
  const porUsuario = new Map<string, string>()
  const { data, error } = await db()
    .from('af_atendentes')
    .select('usuario_id, ultimo_lead_em')
    .eq('cliente_id', clienteId)
    .not('ultimo_lead_em', 'is', null)

  if (error) {
    if (!ehIdInvalido(error)) console.error('[distribuicao] não deu para ler a ordem do rodízio', error.message)
    return porUsuario
  }
  for (const linha of data as { usuario_id: string; ultimo_lead_em: string }[]) {
    porUsuario.set(linha.usuario_id, linha.ultimo_lead_em)
  }
  return porUsuario
}

/**
 * Anota que a pessoa acabou de receber um lead, para o rodízio passar a vez.
 *
 * Só `ultimo_lead_em` no `upsert`: se a linha existe, o resto fica como a
 * pessoa configurou; se não existe, ela nasce com o padrão da tabela
 * (`entra_no_rodizio = true`), que é o que já valia para quem acabou de ser
 * escolhida.
 */
export async function marcarUltimoLead(clienteId: string, usuarioId: string): Promise<void> {
  const { error } = await db()
    .from('af_atendentes')
    .upsert(
      { cliente_id: clienteId, usuario_id: usuarioId, ultimo_lead_em: new Date().toISOString() },
      { onConflict: 'cliente_id,usuario_id' },
    )
  if (error) console.error('[distribuicao] não deu para anotar a vez do rodízio', error.message)
}

export type EscopoDaPassagem = 'sem-dono' | 'todas'

/**
 * Quantos contatos cada escopo alcança, para o botão dizer o número antes.
 * `porDono` deixa a tela tirar do "todas" o que já é da pessoa escolhida:
 * passar para alguém o que já é dele não passa nada.
 */
export async function contarParaPassar(
  clienteId: string,
  donos: string[],
): Promise<{ semDono: number; total: number; porDono: Record<string, number> }> {
  const contar = async (filtro: { dono?: string | null }) => {
    let consulta = db().from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', clienteId)
    if (filtro.dono === null) consulta = consulta.is('atribuido_a', null)
    else if (filtro.dono) consulta = consulta.eq('atribuido_a', filtro.dono)
    const { count, error } = await consulta
    if (error) {
      if (!ehIdInvalido(error)) console.error('[distribuicao] não deu para contar os contatos', error.message)
      return 0
    }
    return count ?? 0
  }
  const [semDono, total, ...deCada] = await Promise.all([
    contar({ dono: null }),
    contar({}),
    ...donos.map((dono) => contar({ dono })),
  ])
  return { semDono, total, porDono: Object.fromEntries(donos.map((dono, i) => [dono, deCada[i] ?? 0])) }
}

/**
 * Passa os contatos da conta para uma pessoa de uma vez.
 *
 * Um `update` só, filtrado pela conta: o dono é do contato, não da conversa,
 * então isso também decide para quem eles voltam no próximo contato.
 * `usuarioId` chega aqui já conferido como membro da conta (a ação confere),
 * e é isso que deixa ele entrar no filtro `or`.
 */
export async function passarContatos(
  clienteId: string,
  usuarioId: string,
  escopo: EscopoDaPassagem,
): Promise<{ ok: true; passaram: number } | { ok: false; erro: string }> {
  const base = db()
    .from('contacts')
    .update({ atribuido_a: usuarioId }, { count: 'exact' })
    .eq('client_id', clienteId)
  // `neq` sozinho não pega nulo no Postgres, por isso o `or` no "todas".
  const { count, error } =
    escopo === 'sem-dono'
      ? await base.is('atribuido_a', null)
      : await base.or(`atribuido_a.is.null,atribuido_a.neq.${usuarioId}`)

  if (error) {
    console.error('[distribuicao] não deu para passar os contatos', error.message)
    return { ok: false, erro: 'não deu para passar as conversas' }
  }
  return { ok: true, passaram: count ?? 0 }
}
