import { describe, expect, it } from 'vitest'
import {
  aplicarValores,
  bloqueiaEntrada,
  doLegado,
  faltamPara,
  paraLegado,
  podeSobrescrever,
  TIPOS_DE_CAMPO,
  type DefinicaoDeCampo,
  type ValorDeCampo,
} from './campos'

/**
 * A precedência entre origens, e a correção humana que não pode ser desfeita.
 *
 * O defeito: `guardarCampo` gravava o objeto inteiro e `campos` não guardava
 * proveniência nenhuma. Duas escritas a campos diferentes perdiam uma, e uma
 * importação de março desfazia a correção de ontem sem erro nenhum.
 */
const em = (iso: string) => iso
const valor = (
  v: string,
  origem: ValorDeCampo['origem'],
  quando = '2026-09-19T10:00:00Z',
): ValorDeCampo => ({ valor: v, origem, autorId: null, em: em(quando) })

describe('podeSobrescrever', () => {
  it('campo vazio aceita qualquer origem', () => {
    expect(podeSobrescrever(undefined, valor('x', 'importacao')).grava).toBe(true)
  })

  /**
   * O caso central da RB-19. A pessoa conferiu o telefone com o cliente e
   * digitou; a planilha de março, subida hoje, não pode desfazer isso.
   */
  it('importação não sobrescreve correção humana', () => {
    const decisao = podeSobrescrever(
      valor('11 99999-0000', 'humano', '2026-09-18T10:00:00Z'),
      valor('11 88888-1111', 'importacao', '2026-09-19T10:00:00Z'),
    )
    expect(decisao.grava).toBe(false)
    if (decisao.grava) return
    // E diz por quê: a tela explica em vez de parecer quebrada.
    expect(decisao.motivo).toBe('origem_mais_fraca')
  })

  it('a automação não sobrescreve o que a pessoa respondeu', () => {
    expect(podeSobrescrever(valor('Maringá', 'contato'), valor('Curitiba', 'automacao')).grava).toBe(
      false,
    )
  })

  it('o humano sobrescreve automação, contato e importação', () => {
    for (const origem of ['automacao', 'contato', 'importacao'] as const) {
      expect(podeSobrescrever(valor('antigo', origem), valor('novo', 'humano')).grava).toBe(true)
    }
  })

  /**
   * "O mais novo vence" só vale **dentro da mesma origem**. Duas correções
   * humanas em sequência são a segunda corrigindo a primeira, que é o que quem
   * digita espera.
   */
  it('dentro da mesma origem, o mais novo vence', () => {
    expect(
      podeSobrescrever(
        valor('antigo', 'humano', '2026-09-18T10:00:00Z'),
        valor('novo', 'humano', '2026-09-19T10:00:00Z'),
      ).grava,
    ).toBe(true)
  })

  it('dentro da mesma origem, o mais antigo perde', () => {
    const decisao = podeSobrescrever(
      valor('atual', 'humano', '2026-09-19T10:00:00Z'),
      valor('atrasado', 'humano', '2026-09-18T10:00:00Z'),
    )
    expect(decisao.grava).toBe(false)
    if (decisao.grava) return
    expect(decisao.motivo).toBe('mais_antigo')
  })

  /**
   * Mesmo valor não é escrita. Gravar trocaria a proveniência de uma correção
   * humana pela de um bot que apenas concordou com ela, e a próxima importação
   * passaria a vencer.
   */
  it('valor igual não grava, e não conta como recusa', () => {
    const decisao = podeSobrescrever(valor('Maringá', 'humano'), valor('Maringá', 'automacao'))
    expect(decisao.grava).toBe(false)
    if (decisao.grava) return
    expect(decisao.motivo).toBe('igual')
  })

  /** Falha fechado: data ilegível não desfaz o que está gravado. */
  it('data ilegível no valor novo não vence', () => {
    expect(
      podeSobrescrever(valor('bom', 'humano'), valor('duvidoso', 'humano', 'ontem')).grava,
    ).toBe(false)
  })
})

/**
 * O defeito 1: o objeto inteiro. Um lote que traz `telefone` não pode apagar o
 * `cidade` que outra escrita acabou de gravar.
 */
describe('aplicarValores', () => {
  it('escrita a um campo preserva os outros', () => {
    const atuais = { cidade: valor('Maringá', 'humano') }
    const { campos } = aplicarValores(atuais, { telefone: valor('11 99999-0000', 'contato') })

    expect(campos.cidade?.valor).toBe('Maringá')
    expect(campos.telefone?.valor).toBe('11 99999-0000')
  })

  it('o lote grava o que pode e recusa o que não pode, no mesmo passe', () => {
    const atuais = {
      cidade: valor('Maringá', 'humano'),
      interesse: valor('Plano XYZ', 'automacao'),
    }
    const { campos, recusados } = aplicarValores(atuais, {
      // Recusado: importação contra correção humana.
      cidade: valor('Londrina', 'importacao'),
      // Aceito: contato vence automação.
      interesse: valor('Plano ABC', 'contato'),
      // Aceito: campo novo.
      email: valor('ana@exemplo.test', 'contato'),
    })

    expect(campos.cidade?.valor).toBe('Maringá')
    expect(campos.interesse?.valor).toBe('Plano ABC')
    expect(campos.email?.valor).toBe('ana@exemplo.test')

    expect(recusados).toHaveLength(1)
    expect(recusados[0]?.chave).toBe('cidade')
  })

  it('não muta o objeto que recebeu', () => {
    const atuais = { cidade: valor('Maringá', 'humano') }
    aplicarValores(atuais, { cidade: valor('Londrina', 'humano', '2027-01-01T00:00:00Z') })
    expect(atuais.cidade?.valor).toBe('Maringá')
  })

  it('valor igual não entra na lista de recusados', () => {
    const atuais = { cidade: valor('Maringá', 'humano') }
    const { recusados } = aplicarValores(atuais, { cidade: valor('Maringá', 'automacao') })
    expect(recusados).toHaveLength(0)
  })
})

/**
 * RB-20: obrigatoriedade contextual. O campo exigido para fechar venda não pode
 * impedir receber mensagem nem criar contato.
 */
describe('faltamPara', () => {
  const definicoes: DefinicaoDeCampo[] = [
    { chave: 'cidade', rotulo: 'Cidade', tipo: 'texto_curto', obrigatorioEm: ['qualificar'] },
    { chave: 'cnpj', rotulo: 'CNPJ', tipo: 'texto_curto', obrigatorioEm: ['fechar_venda'] },
    { chave: 'notas', rotulo: 'Notas', tipo: 'texto_longo' },
  ]

  it('cobra só o que a ação pede, e nada além', () => {
    expect(faltamPara(definicoes, {}, 'qualificar')).toEqual(['Cidade'])
    expect(faltamPara(definicoes, {}, 'fechar_venda')).toEqual(['CNPJ'])
  })

  it('campo preenchido sai da lista', () => {
    const campos = { cidade: valor('Maringá', 'contato') }
    expect(faltamPara(definicoes, campos, 'qualificar')).toEqual([])
  })

  /** Espaço em branco não é resposta. */
  it('campo só com espaços continua faltando', () => {
    expect(faltamPara(definicoes, { cidade: valor('   ', 'contato') }, 'qualificar')).toEqual([
      'Cidade',
    ])
  })

  it('campo arquivado não é cobrado', () => {
    const comArquivado: DefinicaoDeCampo[] = [{ ...definicoes[0]!, arquivado: true }]
    expect(faltamPara(comArquivado, {}, 'qualificar')).toEqual([])
  })

  /** A RB-20 literal, com um lugar onde esteja escrita e testada. */
  it('nada disso bloqueia receber mensagem ou criar contato', () => {
    expect(bloqueiaEntrada()).toBe(false)
  })
})

/**
 * A conversão do legado. Sem inferir tipo: um "10/03" é data para quem escreveu
 * e texto para quem lê de outro país, e adivinhar errado perde o original.
 */
describe('doLegado e paraLegado', () => {
  it('converte sem inventar origem humana', () => {
    const convertido = doLegado({ cidade: 'Maringá' }, '2026-09-19T10:00:00Z')
    expect(convertido.cidade?.valor).toBe('Maringá')
    /*
     * `automacao` e não `humano`: não dá para saber quem escreveu o que já
     * estava lá, e dar autoridade humana ao legado travaria correções futuras.
     */
    expect(convertido.cidade?.origem).toBe('automacao')
  })

  it('o legado convertido aceita ser corrigido por uma pessoa', () => {
    const convertido = doLegado({ cidade: 'Maringá' }, '2026-09-19T10:00:00Z')
    expect(podeSobrescrever(convertido.cidade, valor('Londrina', 'humano')).grava).toBe(true)
  })

  it('a volta preserva os valores', () => {
    const campos = { cidade: valor('Maringá', 'humano'), email: valor('a@b.test', 'contato') }
    expect(paraLegado(campos)).toEqual({ cidade: 'Maringá', email: 'a@b.test' })
  })

  it('ida e volta não perde nada', () => {
    const original = { cidade: 'Maringá', interesse: 'Plano XYZ' }
    expect(paraLegado(doLegado(original, '2026-09-19T10:00:00Z'))).toEqual(original)
  })
})

describe('os tipos de campo', () => {
  /** A 7.2 lista oito tipos para a primeira entrega. */
  it('são os oito da proposta', () => {
    expect(TIPOS_DE_CAMPO).toHaveLength(8)
    expect(TIPOS_DE_CAMPO).toContain('moeda')
    expect(TIPOS_DE_CAMPO).toContain('selecao_multipla')
  })
})
