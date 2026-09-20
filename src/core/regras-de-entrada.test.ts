import { describe, expect, it } from 'vitest'
import {
  aceitaQuadroMaisAntigo,
  chaveDaEntrada,
  criaCartaoSozinho,
  ehTipoDeEntrada,
  entradaNoFunil,
  ENTRADA_NO_FUNIL_PADRAO,
  ENTRADAS_NO_FUNIL,
  poderesDaEntrada,
  TIPOS_DE_ENTRADA,
  tipoDoReferral,
} from './regras-de-entrada'

/**
 * O que cada tipo de entrada autoriza.
 *
 * O caso que originou este arquivo é o do formulário: antes da F3, ele abria
 * 72h de texto livre para quem nunca escreveu, porque `passagens` não tinha
 * coluna de tipo e a view da 0065 lia qualquer linha como porta de entrada.
 */
describe('poderesDaEntrada', () => {
  it('o clique em anúncio abre a porta de entrada', () => {
    expect(poderesDaEntrada('anuncio_whatsapp').abrePortaDeEntrada).toBe(true)
    expect(poderesDaEntrada('botao_pagina').abrePortaDeEntrada).toBe(true)
  })

  /** RB-09: formulário não é conversa. */
  it('o formulário não abre a porta de entrada', () => {
    const poderes = poderesDaEntrada('formulario')
    expect(poderes.abrePortaDeEntrada).toBe(false)
    expect(poderes.valeComoMensagem).toBe(false)
    // Mas pode ser trabalhado: o lead existe e alguém vai atendê-lo.
    expect(poderes.podeAcionarAutomacao).toBe(true)
  })

  /** RB-09, segunda metade: importar não simula mensagem recebida. */
  it('a importação não vale como mensagem nem aciona automação', () => {
    const poderes = poderesDaEntrada('importacao')
    expect(poderes.valeComoMensagem).toBe(false)
    expect(poderes.podeAcionarAutomacao).toBe(false)
    expect(poderes.abrePortaDeEntrada).toBe(false)
  })

  it('a mensagem vale como mensagem, e não abre a porta sozinha', () => {
    const poderes = poderesDaEntrada('mensagem')
    expect(poderes.valeComoMensagem).toBe(true)
    // O clique vem numa linha própria; a mensagem não herda a porta dele.
    expect(poderes.abrePortaDeEntrada).toBe(false)
  })

  it('o cadastro manual não inventa janela', () => {
    expect(poderesDaEntrada('submissao_manual').abrePortaDeEntrada).toBe(false)
    expect(poderesDaEntrada('submissao_manual').valeComoMensagem).toBe(false)
  })

  /**
   * Falha fechado. Uma linha antiga, ou um valor que alguém escreveu na mão no
   * banco, não pode autorizar texto livre: o erro barulhento é a tela oferecer
   * modelo aprovado, não a Meta recusar o envio depois do parágrafo digitado.
   */
  it.each([null, undefined, '', 'anuncio', 'ANUNCIO_WHATSAPP', 'qualquer'])(
    'tipo desconhecido (%s) não autoriza nada',
    (tipo) => {
      const poderes = poderesDaEntrada(tipo as string | null | undefined)
      expect(poderes.abrePortaDeEntrada).toBe(false)
      expect(poderes.valeComoMensagem).toBe(false)
      expect(poderes.podeAcionarAutomacao).toBe(false)
    },
  )

  /**
   * Trava de completude: tipo novo precisa ter poderes declarados. Sem isto,
   * acrescentar um tipo ao union e esquecer a tabela o faria cair no default
   * fechado calado, e a queixa apareceria em produção como "o bot não roda".
   */
  it('todo tipo listado tem poderes declarados', () => {
    for (const tipo of TIPOS_DE_ENTRADA) {
      expect(ehTipoDeEntrada(tipo)).toBe(true)
      const poderes = poderesDaEntrada(tipo)
      expect(typeof poderes.abrePortaDeEntrada).toBe('boolean')
      expect(typeof poderes.valeComoMensagem).toBe('boolean')
      expect(typeof poderes.podeAcionarAutomacao).toBe('boolean')
    }
  })
})

describe('tipoDoReferral', () => {
  it('sem source_id não há porta: nada foi clicado que se possa provar', () => {
    expect(tipoDoReferral(undefined)).toBeNull()
    expect(tipoDoReferral({})).toBeNull()
    expect(tipoDoReferral({ source_type: 'ad' })).toBeNull()
  })

  it('o clique no anúncio é anuncio_whatsapp', () => {
    expect(tipoDoReferral({ source_type: 'ad', source_id: '123' })).toBe('anuncio_whatsapp')
    // `source_type` ausente com id presente continua sendo anúncio.
    expect(tipoDoReferral({ source_id: '123' })).toBe('anuncio_whatsapp')
  })

  it('o botão da Página é botao_pagina', () => {
    expect(tipoDoReferral({ source_type: 'post', source_id: '123' })).toBe('botao_pagina')
  })

  it('os dois tipos que ela devolve abrem a porta', () => {
    for (const source_type of ['ad', 'post']) {
      const tipo = tipoDoReferral({ source_type, source_id: '9' })
      expect(tipo).not.toBeNull()
      expect(poderesDaEntrada(tipo).abrePortaDeEntrada).toBe(true)
    }
  })
})

/**
 * RB-10: idempotência por ID externo estável, nunca por minuto.
 *
 * O defeito que isto evita: a 0050 deduplica `passagens` por
 * `(contact_id, ad_id, minuto)`, e duas submissões reais de formulário no mesmo
 * minuto são duas entradas, com `leadgen_id` diferente. Deduplicar por tempo
 * joga a segunda fora.
 */
describe('chaveDaEntrada', () => {
  it('o ID externo é a chave, e ela inclui o tipo', () => {
    expect(chaveDaEntrada({ tipo: 'formulario', idExterno: 'lead-1' })).toBe('formulario:lead-1')
  })

  it('duas submissões diferentes dão chaves diferentes', () => {
    const uma = chaveDaEntrada({ tipo: 'formulario', idExterno: 'lead-1' })
    const outra = chaveDaEntrada({ tipo: 'formulario', idExterno: 'lead-2' })
    expect(uma).not.toBe(outra)
  })

  it('a reentrega do mesmo evento dá a mesma chave', () => {
    expect(chaveDaEntrada({ tipo: 'mensagem', idExterno: 'wamid.X' })).toBe(
      chaveDaEntrada({ tipo: 'mensagem', idExterno: 'wamid.X' }),
    )
  })

  it('o mesmo id em tipos diferentes não colide', () => {
    expect(chaveDaEntrada({ tipo: 'formulario', idExterno: 'X' })).not.toBe(
      chaveDaEntrada({ tipo: 'mensagem', idExterno: 'X' }),
    )
  })

  it.each([undefined, null, '', '   '])('sem id externo (%s) não há chave estável', (id) => {
    expect(chaveDaEntrada({ tipo: 'anuncio_whatsapp', idExterno: id })).toBeNull()
  })
})

/**
 * A política de entrada no funil (0075).
 *
 * A RB-12 é explícita: "Nenhum fallback pode selecionar o quadro mais antigo.
 * Configuração inicial de empresa nova é não criar". Antes da F3 o fallback era
 * o comportamento de todo mundo, dentro de `acharQuadroPadrao`.
 */
describe('entradaNoFunil', () => {
  it('o default de conta nova é não criar (RB-12)', () => {
    expect(ENTRADA_NO_FUNIL_PADRAO).toBe('nao_criar')
    expect(criaCartaoSozinho(ENTRADA_NO_FUNIL_PADRAO)).toBe(false)
  })

  it.each(ENTRADAS_NO_FUNIL)('a política gravada %s é lida de volta', (politica) => {
    expect(entradaNoFunil(politica)).toBe(politica)
  })

  /**
   * Falha fechado, e o comentário da função explica a assimetria: não criar
   * cartão é visível e reversível com um clique; criar no funil errado espalha
   * contato por um quadro que ninguém escolheu.
   */
  it.each([null, undefined, '', 'mais_novo', 'NAO_CRIAR'])(
    'valor ilegível (%s) cai em nao_criar, nunca no legado',
    (valor) => {
      expect(entradaNoFunil(valor as string | null | undefined)).toBe('nao_criar')
    },
  )

  it('só mais_antigo aceita o quadro por idade', () => {
    expect(aceitaQuadroMaisAntigo('mais_antigo')).toBe(true)
    expect(aceitaQuadroMaisAntigo('quadro_marcado')).toBe(false)
    expect(aceitaQuadroMaisAntigo('nao_criar')).toBe(false)
  })

  it('quadro_marcado cria cartão, e nao_criar não', () => {
    expect(criaCartaoSozinho('quadro_marcado')).toBe(true)
    expect(criaCartaoSozinho('mais_antigo')).toBe(true)
    expect(criaCartaoSozinho('nao_criar')).toBe(false)
  })
})
