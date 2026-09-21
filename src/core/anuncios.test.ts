import { describe, expect, it } from 'vitest'
import {
  comoMostrar,
  idsParaResolver,
  passagensComNome,
  venceu,
  VALIDADE_DO_NOME_EM_HORAS,
  type AnuncioEmCache,
} from './anuncios'

const agora = new Date('2026-09-14T12:00:00Z')

function emCache(adId: string, horasAtras: number): AnuncioEmCache {
  return {
    adId,
    anuncio: `anúncio ${adId}`,
    conjunto: `conjunto ${adId}`,
    campanha: `campanha ${adId}`,
    resolvidoEm: new Date(agora.getTime() - horasAtras * 3_600_000).toISOString(),
  }
}

describe('venceu', () => {
  it('nome recém-resolvido vale', () => {
    expect(venceu(agora.toISOString(), agora)).toBe(false)
  })

  it('vence no limite, não depois dele', () => {
    const noLimite = new Date(agora.getTime() - VALIDADE_DO_NOME_EM_HORAS * 3_600_000)
    expect(venceu(noLimite.toISOString(), agora)).toBe(true)
  })

  it('data ilegível conta como vencida, e não derruba', () => {
    expect(venceu('era uma vez', agora)).toBe(true)
  })
})

describe('comoMostrar', () => {
  it('o nome da campanha ganha de tudo', () => {
    expect(
      comoMostrar({
        rotulo: 'Anúncio',
        titulo: 'Filme institucional para sua empresa',
        nomes: { anuncio: 'Vídeo 30s', conjunto: 'Retargeting', campanha: 'Institucional Set26' },
      }),
    ).toEqual({ texto: 'Institucional Set26', detalhe: 'Vídeo 30s · Retargeting' })
  })

  it('sem nome resolvido, mostra o título do anúncio', () => {
    expect(
      comoMostrar({ rotulo: 'Anúncio', titulo: 'Filme institucional', nomes: null }),
    ).toEqual({ texto: 'Filme institucional', detalhe: null })
  })

  it('sem título, sobra o rótulo, nunca o id', () => {
    expect(comoMostrar({ rotulo: 'Direto', titulo: '', nomes: null })).toEqual({
      texto: 'Direto',
      detalhe: null,
    })
  })

  /* Campanha em branco é como não ter: cai para o degrau de baixo. */
  it('campanha vazia não vale como nome', () => {
    expect(
      comoMostrar({
        rotulo: 'Anúncio',
        titulo: 'Filme institucional',
        nomes: { anuncio: '', conjunto: '', campanha: '   ' },
      }),
    ).toEqual({ texto: 'Filme institucional', detalhe: null })
  })
})

describe('idsParaResolver', () => {
  it('não pergunta o que já tem nome fresco', () => {
    const cache = new Map([['a1', emCache('a1', 1)]])
    expect(idsParaResolver(['a1'], cache, agora)).toEqual([])
  })

  it('pergunta o que venceu', () => {
    const cache = new Map([['a1', emCache('a1', 30)]])
    expect(idsParaResolver(['a1'], cache, agora)).toEqual(['a1'])
  })

  it('a mesma campanha em 200 conversas é uma pergunta só', () => {
    const muitos = Array.from({ length: 200 }, () => 'a1')
    expect(idsParaResolver(muitos, new Map(), agora)).toEqual(['a1'])
  })

  it('ignora id vazio', () => {
    expect(idsParaResolver(['', '   '], new Map(), agora)).toEqual([])
  })
})

describe('passagensComNome', () => {
  const passagens = [
    { adId: 'a2', titulo: 'Promoção de setembro', criadoEm: '2026-09-10T10:00:00Z' },
    { adId: 'a1', titulo: 'Filme institucional', criadoEm: '2026-08-02T10:00:00Z' },
  ]

  it('usa o nome da campanha quando ele foi resolvido', () => {
    const cache = new Map([['a1', emCache('a1', 1)]])
    const r = passagensComNome(passagens, cache)

    expect(r[0]?.texto).toBe('Promoção de setembro')
    expect(r[1]?.texto).toBe('campanha a1')
  })

  /*
   * O ponto do modelo novo: duas chegadas pelo mesmo anúncio são duas linhas,
   * e não uma deduplicada. Clicar de novo em outro dia é um fato a mais.
   */
  it('a mesma campanha duas vezes continua sendo duas passagens', () => {
    const duas = [
      { adId: 'a1', titulo: 'Filme', criadoEm: '2026-09-10T10:00:00Z' },
      { adId: 'a1', titulo: 'Filme', criadoEm: '2026-08-02T10:00:00Z' },
    ]
    expect(passagensComNome(duas, new Map())).toHaveLength(2)
  })

  it('sem cache nenhum, o título do dia responde', () => {
    const r = passagensComNome(passagens, new Map())
    expect(r.map((p) => p.texto)).toEqual(['Promoção de setembro', 'Filme institucional'])
  })
})
