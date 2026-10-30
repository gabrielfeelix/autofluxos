import { describe, expect, it } from 'vitest'
import { montarEmail } from './layout'
import { MODELOS, primeiroNome } from './modelos'

const PAINEL = 'https://dialogon.com.br'

describe('modelos de e-mail', () => {
  const todos = Object.entries(MODELOS).map(([id, modelo]) => {
    const m = modelo as unknown as { montar: (p: unknown) => Parameters<typeof montarEmail>[0]; exemplo: unknown }
    return [id, montarEmail(m.montar(m.exemplo), PAINEL)] as const
  })

  it.each(todos)('%s monta HTML e texto, com assunto', (_id, email) => {
    expect(email.assunto.length).toBeGreaterThan(5)
    expect(email.html).toContain('<!doctype html>')
    expect(email.html).toContain('Dialogon')
    expect(email.texto).toContain(PAINEL)
    // O texto puro não carrega marcação.
    expect(email.texto).not.toMatch(/\*\*|<[a-z]/i)
  })

  it.each(todos)('%s não usa travessão', (_id, email) => {
    expect(email.html + email.texto + email.assunto).not.toMatch(/[–—]/)
  })

  it('escapa o que vem de fora: nome de organização com HTML não vira tag', () => {
    const email = montarEmail(
      MODELOS.boasVindas.montar({ nome: 'Ana', organizacao: '<script>alert(1)</script>', link: `${PAINEL}/painel` }),
      PAINEL,
    )
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('o link de redefinição sai no botão e por extenso', () => {
    const link = `${PAINEL}/redefinir-senha?token=abc123`
    const email = montarEmail(MODELOS.redefinirSenha.montar({ nome: 'Ana Souza', link }), PAINEL)
    expect(email.html.split(link).length - 1).toBe(3)
    expect(email.texto).toContain(link)
    expect(email.texto).toContain('Olá, Ana.')
  })

  it('valor em reais não quebra no meio, e o "$&" do replace não aparece', () => {
    const email = montarEmail(MODELOS.planoAtivado.montar({ ...MODELOS.planoAtivado.exemplo, preco: 'R$ 497' }), PAINEL)
    expect(email.html).toContain('R$&nbsp;497')
    expect(email.html).not.toContain('RR$')
  })

  it('o medidor passa de 100% sem estourar a barra', () => {
    const email = montarEmail(
      MODELOS.franquiaDaMeta.montar({ ...MODELOS.franquiaDaMeta.exemplo, usadas: 1240, estourou: true, excedentes: 240, custo: 'R$ 8,40' }),
      PAINEL,
    )
    expect(email.html).toContain('124%')
    expect(email.html).not.toMatch(/<td width="1\d\d%"/)
    expect(email.assunto).toContain('passou')
  })

  it('a troca agendada fala de amanhã, de dias ou da data', () => {
    const base = MODELOS.trocaDePlanoAgendada.exemplo
    expect(MODELOS.trocaDePlanoAgendada.montar({ ...base, faltam: 1 }).titulo).toContain('amanhã')
    expect(MODELOS.trocaDePlanoAgendada.montar({ ...base, faltam: 7 }).titulo).toContain('7 dias')
    expect(MODELOS.trocaDePlanoAgendada.montar({ ...base, faltam: null }).assunto).toContain(base.data)
  })

  it('primeiro nome ignora espaço e nome vazio', () => {
    expect(primeiroNome('  Daniel  Moreira ')).toBe('Daniel')
    expect(primeiroNome('')).toBeNull()
    expect(primeiroNome(null)).toBeNull()
  })
})
