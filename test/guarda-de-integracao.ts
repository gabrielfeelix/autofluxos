/**
 * Confere o ambiente antes do primeiro teste de integração.
 *
 * Roda como `setupFiles`, isto é, antes de qualquer `beforeAll` de suíte — que
 * é onde os testes atuais criam cliente, fluxo e canal. Se o endereço não for
 * local, a suíte cai aqui, com o motivo, sem ter aberto conexão nenhuma.
 */
import { beforeAll } from 'vitest'
import { exigirAmbienteLocal } from './ambiente-local'

beforeAll(() => {
  exigirAmbienteLocal()
})
