import { describe, expect, it } from 'vitest'
import { voltaDoErro } from './volta-do-erro'

describe('voltaDoErro', () => {
  it('dentro de uma conta, volta para o início dela', () => {
    expect(voltaDoErro('/clientes/abc/atividades')).toEqual({
      href: '/clientes/abc',
      rotulo: 'Voltar para o início da conta',
    })
  })

  it('no próprio início da conta, não manda para o mesmo lugar que quebrou', () => {
    expect(voltaDoErro('/clientes/abc').href).toBe('/contas')
    expect(voltaDoErro('/clientes/abc/').href).toBe('/contas')
  })

  it('admin volta para a área admin; o resto decide pela sessão', () => {
    expect(voltaDoErro('/admin/usuarios').href).toBe('/admin/contas')
    expect(voltaDoErro('/ajuda').href).toBe('/voltar')
  })
})
