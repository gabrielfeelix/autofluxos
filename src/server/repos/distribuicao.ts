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

export type ModoDeDistribuicao = 'manual' | 'balanceado'

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
    distribuicao: linha.distribuicao === 'balanceado' ? 'balanceado' : 'manual',
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
