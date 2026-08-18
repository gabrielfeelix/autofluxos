import { describe, expect, it } from 'vitest'
import {
  acharColunas,
  conciliar,
  lerCsv,
  resumir,
  type ContatoConhecido,
  type LinhaDaPlanilha,
} from './planilha'

describe('ler CSV', () => {
  it('lê o separador `;`, que é o que sai do Excel em português', () => {
    const { cabecalho, linhas } = lerCsv('Nome;Telefone\nAna;11987654321\n')
    expect(cabecalho).toEqual(['Nome', 'Telefone'])
    expect(linhas).toEqual([['Ana', '11987654321']])
  })

  it('lê o separador `,` quando é ele que domina o cabeçalho', () => {
    const { linhas } = lerCsv('Nome,Telefone\nAna,11987654321\n')
    expect(linhas).toEqual([['Ana', '11987654321']])
  })

  it('respeita aspas — "Silva, Maria" é um nome, não duas colunas', () => {
    const { linhas } = lerCsv('Nome,Telefone\n"Silva, Maria",11987654321\n')
    expect(linhas).toEqual([['Silva, Maria', '11987654321']])
  })

  it('entende aspas escapadas', () => {
    const { linhas } = lerCsv('Nome,Apelido\nAna,"a ""Rainha"" da casa"\n')
    expect(linhas[0]?.[1]).toBe('a "Rainha" da casa')
  })

  it('aguenta BOM e quebra de linha do Windows', () => {
    const { cabecalho, linhas } = lerCsv('﻿Nome;Telefone\r\nAna;11987654321\r\n')
    expect(cabecalho).toEqual(['Nome', 'Telefone'])
    expect(linhas).toHaveLength(1)
  })

  it('descarta linha totalmente vazia, que toda planilha exportada tem no fim', () => {
    const { linhas } = lerCsv('Nome;Telefone\nAna;11987654321\n;\n\n')
    expect(linhas).toHaveLength(1)
  })

  it('não confunde vírgula dentro do nome com separador', () => {
    // O cabeçalho tem um `;` e nenhum `,`, então o separador é `;` mesmo que o
    // corpo esteja cheio de vírgula.
    const { linhas } = lerCsv('Nome;Telefone\nSilva, Maria;11987654321\n')
    expect(linhas).toEqual([['Silva, Maria', '11987654321']])
  })
})

describe('achar as colunas', () => {
  it('acha nome e telefone pelos rótulos comuns', () => {
    expect(acharColunas(['Nome', 'Telefone'])).toEqual({ nome: 0, telefone: 1 })
    expect(acharColunas(['WhatsApp', 'Aluno'])).toEqual({ nome: 1, telefone: 0 })
  })

  it('ignora acento e caixa', () => {
    expect(acharColunas(['NÚMERO', 'Nome Completo'])).toEqual({ nome: 1, telefone: 0 })
  })

  it('acha por pedaço quando o rótulo é composto', () => {
    expect(acharColunas(['Nome do aluno', 'Celular do responsável'])).toEqual({
      nome: 0,
      telefone: 1,
    })
  })

  it('devolve -1 em vez de chutar quando não acha', () => {
    expect(acharColunas(['Coluna A', 'Coluna B'])).toEqual({ nome: -1, telefone: -1 })
  })
})

describe('conciliar', () => {
  const linha = (numero: number, nome: string, telefone: string): LinhaDaPlanilha => ({
    numero,
    nome,
    telefone,
  })

  const conhecidos: ContatoConhecido[] = [
    // Gravado SEM o nono dígito, como a Meta manda para contas antigas.
    { contatoId: 'c1', waId: '551187654321', nomeAtual: 'Rodrigão comedor delas' },
    { contatoId: 'c2', waId: '5521999998888', nomeAtual: null },
  ]

  it('casa a planilha com o contato mesmo com o nono dígito de diferença', () => {
    // É o caso central: o dono do negócio escreveu o número completo, e a Meta
    // gravou sem o 9. Comparação literal diria que são duas pessoas.
    const [r] = conciliar([linha(2, 'Rodrigo', '(11) 98765-4321')], conhecidos)
    expect(r).toMatchObject({ tipo: 'casou', contatoId: 'c1', nomeAtual: 'Rodrigão comedor delas' })
  })

  it('telefone bom e desconhecido vira contato novo, na forma canônica', () => {
    const [r] = conciliar([linha(2, 'Ana', '11 3900-1234')], conhecidos)
    expect(r).toMatchObject({ tipo: 'novo', waId: '551139001234' })
  })

  it('linha sem telefone vira pendência, e não some', () => {
    // Importação que "deu certo" e comeu 40 das 300 linhas é pior do que
    // importação que recusa.
    const [r] = conciliar([linha(2, 'Sem número', '')], conhecidos)
    expect(r).toMatchObject({ tipo: 'pendente', motivo: 'sem telefone na planilha' })
  })

  it('telefone sem DDD vira pendência com o motivo escrito', () => {
    const [r] = conciliar([linha(2, 'Ana', '98765-4321')], conhecidos)
    expect(r).toMatchObject({ tipo: 'pendente', motivo: 'telefone incompleto — falta o DDD' })
  })

  it('a mesma pessoa repetida na planilha não vira dois contatos', () => {
    const r = conciliar(
      [linha(2, 'Ana', '11 3900-1234'), linha(3, 'Ana Maria', '(11) 3900-1234')],
      conhecidos,
    )
    expect(r[0]?.tipo).toBe('novo')
    expect(r[1]).toMatchObject({ tipo: 'pendente', motivo: 'telefone repetido na planilha' })
  })

  it('a repetição também pega grafias diferentes do mesmo aparelho', () => {
    const r = conciliar(
      [linha(2, 'Ana', '11 98888-7777'), linha(3, 'Ana', '11 8888-7777')],
      conhecidos,
    )
    expect(r[1]).toMatchObject({ tipo: 'pendente', motivo: 'telefone repetido na planilha' })
  })

  it('preserva o número da linha para a pessoa achar no editor dela', () => {
    const [r] = conciliar([linha(47, 'Ana', '')], conhecidos)
    expect(r?.linha.numero).toBe(47)
  })
})

describe('resumo antes de confirmar', () => {
  const conhecidos: ContatoConhecido[] = [
    { contatoId: 'c1', waId: '551187654321', nomeAtual: 'Rodrigão comedor delas' },
    { contatoId: 'c2', waId: '5511977776666', nomeAtual: 'Ana' },
  ]

  it('conta o que vai casar, criar, ficar pendente e ser renomeado', () => {
    const r = conciliar(
      [
        { numero: 2, nome: 'Rodrigo', telefone: '11987654321' },
        { numero: 3, nome: 'Ana', telefone: '11977776666' },
        { numero: 4, nome: 'Novo', telefone: '11 3900-1234' },
        { numero: 5, nome: 'Sem fone', telefone: '' },
      ],
      conhecidos,
    )

    // A Ana casa e **não** conta como renomeação: o nome da planilha é igual ao
    // que a tela já mostra. Sem isso, o resumo diria "2 renomeados" e assustaria
    // por nada.
    expect(resumir(r)).toEqual({ casou: 2, novos: 1, pendentes: 1, renomeia: 1 })
  })

  it('nome vazio na planilha não conta como renomeação', () => {
    const r = conciliar([{ numero: 2, nome: '', telefone: '11987654321' }], conhecidos)
    expect(resumir(r).renomeia).toBe(0)
  })
})
