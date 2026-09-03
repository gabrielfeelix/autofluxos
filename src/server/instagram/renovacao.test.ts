import { describe, expect, it } from 'vitest'
import type { CanalSalvo } from '../repos/conversas'
import {
  DIAS_DE_FOLGA,
  limiteDaRenovacao,
  renovarTokensDoInstagram,
  type MundoDaRenovacao,
} from './renovacao'

/**
 * O token do Instagram vale 60 dias e não avisa quando morre: a conta responde
 * normalmente até o dia 60 e fica muda no 61, sem ninguém ter mexido em nada.
 * Estes testes são sobre a fronteira do prazo e sobre o que acontece quando a
 * Meta recusa — não sobre o formato de nada.
 */

const AGORA = new Date('2026-09-03T12:00:00.000Z')

function canal(parcial: Partial<CanalSalvo> = {}): CanalSalvo {
  return {
    id: 'canal-1',
    clienteId: 'cliente-1',
    provider: 'instagram',
    phoneNumberId: null,
    igUserId: '17841400000000000',
    igUsername: 'estudio',
    tokenRef: 'ref-1',
    tokenExpiraEm: '2026-09-08T12:00:00.000Z',
    flowId: null,
    fluxoBoasVindasId: null,
    fluxoMidiaId: null,
    fluxoPosAtendimentoId: null,
    status: 'ativo',
    ...parcial,
  }
}

function mundoDeMentira(ajustes: Partial<MundoDaRenovacao> = {}) {
  const guardados: { canal: CanalSalvo; token: string; expiraEm: Date }[] = []
  const avisos: string[] = []
  let limitePedido: Date | null = null

  const mundo: MundoDaRenovacao = {
    listar: async (limite) => {
      limitePedido = limite
      return [canal()]
    },
    lerToken: async () => 'token-velho',
    renovar: async () => ({
      token: 'token-novo',
      expiraEm: new Date('2026-11-02T12:00:00.000Z'),
    }),
    guardar: async (canal, novo) => {
      guardados.push({ canal, ...novo })
    },
    avisar: async (mensagem) => {
      avisos.push(mensagem)
    },
    ...ajustes,
  }

  return { mundo, guardados, avisos, limitePedido: () => limitePedido }
}

describe('a janela da renovação', () => {
  it('pede à fila quem vence dentro da folga, e não quem vence depois', () => {
    // Dez dias de folga são dez tentativas antes da morte do token: a Meta
    // pode estar fora do ar num dia, e um dia não pode ser o último.
    expect(limiteDaRenovacao(AGORA).toISOString()).toBe('2026-09-13T12:00:00.000Z')
    expect(limiteDaRenovacao(AGORA, 3).toISOString()).toBe('2026-09-06T12:00:00.000Z')
    expect(DIAS_DE_FOLGA).toBe(10)
  })

  it('a listagem recebe o limite calculado, e não o instante de agora', async () => {
    const { mundo, limitePedido } = mundoDeMentira()
    await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(limitePedido()?.toISOString()).toBe('2026-09-13T12:00:00.000Z')
  })
})

describe('a renovação', () => {
  it('troca o token e conta o que fez', async () => {
    const { mundo, guardados } = mundoDeMentira()
    const resumo = await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(resumo).toEqual({ olhados: 1, renovados: 1, vencidos: 0, falhas: 0 })
    expect(guardados).toHaveLength(1)
    expect(guardados[0]?.token).toBe('token-novo')
    expect(guardados[0]?.expiraEm.toISOString()).toBe('2026-11-02T12:00:00.000Z')
  })

  /**
   * O caso que a rotina existe para não deixar acontecer em silêncio: token
   * vencido não se renova — a Meta recusa —, e insistir todo dia trocaria um
   * aviso claro por uma falha diária que ninguém sabe interpretar.
   */
  it('não tenta renovar token vencido, e avisa', async () => {
    const { mundo, guardados, avisos } = mundoDeMentira({
      listar: async () => [canal({ tokenExpiraEm: '2026-09-01T12:00:00.000Z' })],
      renovar: async () => {
        throw new Error('não deveria ter chegado aqui')
      },
    })

    const resumo = await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(resumo).toEqual({ olhados: 1, renovados: 0, vencidos: 1, falhas: 0 })
    expect(guardados).toHaveLength(0)
    expect(avisos[0]).toContain('venceu')
  })

  it('uma conta que falha não derruba as outras', async () => {
    const bom = canal({ id: 'canal-2', clienteId: 'cliente-2', igUsername: 'petshop' })
    const { mundo, guardados, avisos } = mundoDeMentira({
      listar: async () => [canal(), bom],
      lerToken: async (c) => {
        if (c.id === 'canal-1') throw new Error('o cofre não devolveu o token do canal')
        return 'token-velho'
      },
    })

    const resumo = await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(resumo).toEqual({ olhados: 2, renovados: 1, vencidos: 0, falhas: 1 })
    expect(guardados.map((g) => g.canal.id)).toEqual(['canal-2'])
    expect(avisos[0]).toContain('estudio')
  })

  it('a falha da Meta vira alerta, e não exceção que mata a passada', async () => {
    const { mundo, avisos } = mundoDeMentira({
      renovar: async () => {
        throw new Error('o Instagram respondeu 400: OAuthException')
      },
    })

    const resumo = await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(resumo.falhas).toBe(1)
    expect(avisos).toHaveLength(1)
  })

  it('sem canal na fila, não fala com ninguém', async () => {
    const { mundo, avisos } = mundoDeMentira({ listar: async () => [] })
    const resumo = await renovarTokensDoInstagram({ agora: AGORA }, mundo)

    expect(resumo).toEqual({ olhados: 0, renovados: 0, vencidos: 0, falhas: 0 })
    expect(avisos).toHaveLength(0)
  })
})
