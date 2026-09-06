import { describe, expect, it } from 'vitest'
import { rotuloDoCampo } from './rotulo-do-campo'

describe('rotuloDoCampo', () => {
  // É o caso da queixa: `objetivo_aluno` em `font-mono` no painel do Inbox.
  it('a chave do fluxo vira frase legível', () => {
    expect(rotuloDoCampo('objetivo_aluno')).toBe('Objetivo aluno')
  })

  it('a chave em camelo, que é a que vem do JSON de um http, também', () => {
    expect(rotuloDoCampo('valorTotal')).toBe('Valor total')
    expect(rotuloDoCampo('dataDeNascimento')).toBe('Data de nascimento')
  })

  // "Objetivo Do Aluno" é o erro clássico de title case aplicado ao português,
  // e mesmo "Valor Total" lido numa coluna estreita volta a parecer código.
  it('é caixa de frase: só a primeira palavra sobe', () => {
    expect(rotuloDoCampo('nome_do_responsavel')).toBe('Nome do responsavel')
    expect(rotuloDoCampo('turma_e_horario')).toBe('Turma e horario')
    expect(rotuloDoCampo('de_onde_veio')).toBe('De onde veio')
  })

  it('sigla tem nome próprio, senão sairia "Cpf"', () => {
    expect(rotuloDoCampo('cpf')).toBe('CPF')
    expect(rotuloDoCampo('CEP')).toBe('CEP')
    expect(rotuloDoCampo('email')).toBe('E-mail')
  })

  // O ponto do campo é ser a correção de quem atende; "Nome real" perde isso.
  it('nome_real tem nome próprio', () => {
    expect(rotuloDoCampo('nome_real')).toBe('Nome corrigido')
  })

  it('hífen e ponto separam igual ao sublinhado', () => {
    expect(rotuloDoCampo('origem-do-lead')).toBe('Origem do lead')
    expect(rotuloDoCampo('endereco.rua')).toBe('Endereco rua')
  })

  it('número no meio não quebra a separação do camelo', () => {
    expect(rotuloDoCampo('telefone2Contato')).toBe('Telefone2 contato')
  })

  // A tela chama isto para toda chave que existir no dicionário, e chave vazia
  // não pode virar exceção numa coluna de tabela.
  it('chave vazia devolve vazio em vez de estourar', () => {
    expect(rotuloDoCampo('')).toBe('')
    expect(rotuloDoCampo('   ')).toBe('')
  })

  it('chave que é só separador devolve ela mesma, sem inventar rótulo', () => {
    expect(rotuloDoCampo('___')).toBe('___')
  })
})
