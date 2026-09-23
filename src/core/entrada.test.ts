import { describe, expect, it } from 'vitest'
import { podeLigar } from './entrada'

/**
 * Ligar uma entrada (palavra-chave, evento, campanha ou a própria automação)
 * que aponta para um fluxo sem versão publicada deixa a porta aberta para
 * lugar nenhum: a pessoa escreve, casa, e ninguém responde. O interruptor verde
 * dizia o contrário, e é isso que esta regra impede.
 */
describe('podeLigar', () => {
  it('destino publicado pode ligar', () => {
    expect(podeLigar({ existe: true, publicado: true })).toEqual({ ok: true })
  })

  it('destino em rascunho recusa e diz para publicar', () => {
    const r = podeLigar({ existe: true, publicado: false })
    expect(r).toMatchObject({ ok: false, motivo: 'destino_nao_publicado' })
    if (!r.ok) expect(r.texto).toMatch(/Publique antes de ligar/)
  })

  it('destino apagado recusa e pede outro, mesmo que diga publicado', () => {
    const r = podeLigar({ existe: false, publicado: true })
    expect(r).toMatchObject({ ok: false, motivo: 'destino_apagado' })
    if (!r.ok) expect(r.texto).toMatch(/Escolha outra/)
  })
})
