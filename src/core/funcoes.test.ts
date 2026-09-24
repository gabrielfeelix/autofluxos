import { describe, expect, it } from 'vitest'
import { MODELOS_EXTRA, POLITICAS } from './permissoes'
import {
  conferirExcecoes,
  conferirTrocaDeFuncao,
  funcaoDerivada,
  funcoesAtribuiveis,
  NIVEL_DO_SUPORTE,
  podeAtribuirFuncao,
  podeEditarPessoa,
  podeGerenciarPessoas,
  podeVerPessoa,
  type NaHierarquia,
} from './funcoes'

const pessoa = (usuarioId: string, nivel: number, equipes: string[] = []): NaHierarquia => ({ usuarioId, nivel, equipes })

const dono = pessoa('dono', 4)
const admin = pessoa('admin', 3)
const outroAdmin = pessoa('admin-2', 3)
const gestor = pessoa('gestor', 2, ['vendas'])
const outroGestor = pessoa('gestor-2', 2, ['vendas'])
const atendenteDaEquipe = pessoa('ana', 1, ['vendas'])
const atendenteDeFora = pessoa('bia', 1, ['suporte'])
const atendenteSemEquipe = pessoa('caio', 1)
const suporte = pessoa('4yu', NIVEL_DO_SUPORTE)

describe('quem vê quem (regra 1)', () => {
  it('todo mundo se vê', () => {
    for (const alguem of [dono, admin, gestor, atendenteDaEquipe]) expect(podeVerPessoa(alguem, alguem)).toBe(true)
  })

  it('o gestor vê os atendentes da equipe dele e mais ninguém', () => {
    expect(podeVerPessoa(gestor, atendenteDaEquipe)).toBe(true)
    expect(podeVerPessoa(gestor, atendenteDeFora)).toBe(false)
    expect(podeVerPessoa(gestor, atendenteSemEquipe)).toBe(false)
    expect(podeVerPessoa(gestor, outroGestor)).toBe(false)
    expect(podeVerPessoa(gestor, admin)).toBe(false)
    expect(podeVerPessoa(gestor, dono)).toBe(false)
  })

  it('o administrador vê gestores e atendentes de qualquer equipe, mas não outro administrador nem o dono', () => {
    expect(podeVerPessoa(admin, gestor)).toBe(true)
    expect(podeVerPessoa(admin, atendenteDeFora)).toBe(true)
    expect(podeVerPessoa(admin, atendenteSemEquipe)).toBe(true)
    expect(podeVerPessoa(admin, outroAdmin)).toBe(false)
    expect(podeVerPessoa(admin, dono)).toBe(false)
  })

  it('o atendente só se vê', () => {
    expect(podeVerPessoa(atendenteDaEquipe, atendenteDeFora)).toBe(false)
    expect(podeVerPessoa(atendenteDaEquipe, gestor)).toBe(false)
  })

  it('o suporte da plataforma vê todo mundo', () => {
    expect(podeVerPessoa(suporte, dono)).toBe(true)
  })
})

describe('quem edita quem', () => {
  it('ninguém edita a si mesmo, nem o dono', () => {
    expect(podeEditarPessoa(dono, dono)).toBe(false)
    expect(podeEditarPessoa(gestor, gestor)).toBe(false)
  })

  it('atendente não edita ninguém, nem outro atendente', () => {
    expect(podeEditarPessoa(atendenteDaEquipe, atendenteDeFora)).toBe(false)
    expect(podeGerenciarPessoas(atendenteDaEquipe)).toBe(false)
  })

  it('só edita quem está abaixo', () => {
    expect(podeEditarPessoa(gestor, atendenteDaEquipe)).toBe(true)
    expect(podeEditarPessoa(admin, gestor)).toBe(true)
    expect(podeEditarPessoa(admin, dono)).toBe(false)
    expect(podeEditarPessoa(dono, admin)).toBe(true)
  })

  it('o suporte edita qualquer um, inclusive o dono', () => {
    expect(podeEditarPessoa(suporte, dono)).toBe(true)
  })
})

describe('quais funções cada um atribui (regras 2 e 3)', () => {
  it('o gestor promove atendente a gestor, e não cria administrador', () => {
    expect(funcoesAtribuiveis(gestor)).toEqual(['gestor', 'atendente'])
  })

  it('o administrador dá até administrador, e não passa a posse', () => {
    expect(funcoesAtribuiveis(admin)).toEqual(['administrador', 'gestor', 'atendente'])
    expect(podeAtribuirFuncao(admin, 'proprietario')).toBe(false)
  })

  it('só o proprietário e o suporte passam a posse', () => {
    expect(podeAtribuirFuncao(dono, 'proprietario')).toBe(true)
    expect(podeAtribuirFuncao(suporte, 'proprietario')).toBe(true)
  })

  it('atendente não atribui nada', () => {
    expect(funcoesAtribuiveis(atendenteDaEquipe)).toEqual([])
  })

  it('a troca completa recusa com o motivo', () => {
    expect(conferirTrocaDeFuncao(gestor, atendenteDaEquipe, 'gestor')).toEqual({ ok: true })
    expect(conferirTrocaDeFuncao(gestor, atendenteDaEquipe, 'administrador')).toMatchObject({ ok: false })
    expect(conferirTrocaDeFuncao(gestor, atendenteDeFora, 'gestor')).toMatchObject({ ok: false })
    expect(conferirTrocaDeFuncao(admin, dono, 'atendente')).toMatchObject({ ok: false })
    expect(conferirTrocaDeFuncao(gestor, gestor, 'atendente')).toMatchObject({ ok: false, motivo: expect.stringContaining('própria') })
  })
})

describe('a função de quem não tem função gravada', () => {
  it('owner e admin são diretos', () => {
    expect(funcaoDerivada('owner', POLITICAS.owner)).toBe('proprietario')
    expect(funcaoDerivada('admin', POLITICAS.admin)).toBe('administrador')
  })

  it('member sem exceção vira Administrador, como o plano decidiu', () => {
    expect(funcaoDerivada('member', POLITICAS.member)).toBe('administrador')
  })

  it('member com o modelo de gestão ou de atendimento vira Gestor ou Atendente', () => {
    expect(funcaoDerivada('member', MODELOS_EXTRA.gestor)).toBe('gestor')
    expect(funcaoDerivada('member', MODELOS_EXTRA.operador)).toBe('atendente')
  })

  it('atendente com exceção acima do gestor não é tratado como atendente', () => {
    expect(funcaoDerivada('member', { ...MODELOS_EXTRA.operador, exportar: 'todos' })).toBe('administrador')
  })
})

describe('exceções por pessoa', () => {
  it('ninguém concede o que não tem', () => {
    const doGestor = { nivel: 2, politica: MODELOS_EXTRA.gestor }
    expect(conferirExcecoes(doGestor, MODELOS_EXTRA.operador)).toEqual({ ok: true })
    expect(conferirExcecoes(doGestor, { ...MODELOS_EXTRA.operador, exportar: 'todos' })).toMatchObject({ ok: false })
    expect(conferirExcecoes(doGestor, { ...MODELOS_EXTRA.operador, atender: 'todos' })).toMatchObject({ ok: false })
  })

  it('o suporte passa', () => {
    expect(conferirExcecoes({ nivel: NIVEL_DO_SUPORTE, politica: MODELOS_EXTRA.operador }, POLITICAS.owner)).toEqual({ ok: true })
  })
})
