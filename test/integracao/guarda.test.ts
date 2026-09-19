import { describe, expect, it } from 'vitest'
import { conferirAmbienteLocal } from '../ambiente-local'

/**
 * Prova viva de que a suíte de integração só roda contra banco local.
 *
 * Se o `setupFiles` deixar passar um ambiente remoto, este teste não chega a
 * rodar: o guarda derruba a suíte antes. Ele fica aqui para que a suíte de
 * integração nunca fique sem nenhum arquivo — uma suíte vazia passa verde e não
 * prova nada.
 */
describe('a suíte de integração roda em ambiente local', () => {
  it('o ambiente conferido é local', () => {
    const veredito = conferirAmbienteLocal()
    expect(veredito.ok).toBe(true)
  })
})
