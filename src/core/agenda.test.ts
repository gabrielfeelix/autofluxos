import { describe, expect, it } from 'vitest'
import { credencialDaAgenda } from './agenda'

describe('a credencial da agenda', () => {
  it('acha a do botão, e a criada à mão com outro nome', () => {
    expect(credencialDaAgenda([{ nome: 'Asaas' }, { nome: 'Verandi (agenda)' }])?.nome).toBe('Verandi (agenda)')
    expect(credencialDaAgenda([{ nome: 'Asaas' }, { nome: 'VERANDI-OFICIAL' }])?.nome).toBe('VERANDI-OFICIAL')
    expect(credencialDaAgenda([{ nome: 'VERANDI-OFICIAL' }, { nome: 'Verandi (agenda)' }])?.nome).toBe('Verandi (agenda)')
    expect(credencialDaAgenda([{ nome: 'Asaas' }])).toBeNull()
  })
})
