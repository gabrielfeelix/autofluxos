import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from './flow/schema'
import { MODELOS } from '@/exemplos/modelos'
import { marcadorEm, validarPublicacao } from './validar-publicacao'

const p = { x: 0, y: 0 }

function comTexto(texto: string): Fluxo {
  return fluxoSchema.parse({
    inicio: 'oi',
    nodes: [
      { id: 'oi', type: 'mensagem', position: p, data: { texto } },
      { id: 'h', type: 'handoff', position: p, data: {} },
    ],
    edges: [{ id: 'e1', source: 'oi', target: 'h' }],
  })
}

const codigos = (problemas: { codigo: string }[]) => problemas.map((x) => x.codigo)

/**
 * O cenário que falha antes da correção, e é o ponto inteiro da RB-45:
 *
 * os modelos de `src/exemplos/` vêm com marcador de demonstração no texto que o
 * cliente recebe, e publicar uma cópia sem trocá-los manda "Rua Exemplo, 123" e
 * "a partir de R$ 000" para gente de verdade.
 */
describe('texto de exemplo não trocado', () => {
  it('recusa o endereço de mentira do modelo de menu', () => {
    const r = validarPublicacao(
      comTexto('*Onde estamos*\nRua Exemplo, 123 — bairro, cidade.'),
    )
    expect(r.ok).toBe(false)
    expect(codigos(r.erros)).toContain('TEXTO_DE_EXEMPLO')
  })

  it('recusa a instrução do modelo que ficou no texto', () => {
    const r = validarPublicacao(
      comTexto('*Nosso horário*\nSegunda a sexta, das 9h às 19h.\n\n_Troque este texto pelo horário real._'),
    )
    expect(r.ok).toBe(false)
  })

  it('recusa o "cole aqui o link"', () => {
    expect(validarPublicacao(comTexto('Aqui está o link para pagar: *cole aqui o link ou o Pix*.')).ok).toBe(false)
    expect(validarPublicacao(comTexto('te mando o material: *cole aqui o link*.')).ok).toBe(false)
  })

  it('recusa o preço de mentira', () => {
    expect(validarPublicacao(comTexto('*Valores*\nA partir de R$ 000, e aceitamos Pix.')).ok).toBe(false)
  })

  it('aponta o bloco, para a tela poder levar até ele', () => {
    const r = validarPublicacao(comTexto('Rua Exemplo, 123'))
    expect(r.erros[0]?.noId).toBe('oi')
  })

  it('um erro por bloco, e não um por marcador', () => {
    // Três marcadores no mesmo texto são um trabalho só. Três linhas iguais na
    // lista fazem a pessoa parar de ler a lista.
    const r = validarPublicacao(
      comTexto('Rua Exemplo, 123. A partir de R$ 000. _Troque este texto._'),
    )
    expect(r.erros).toHaveLength(1)
  })
})

/**
 * O outro lado, e é o que impede esta validação de virar ruído: texto legítimo
 * tem que passar. Validação que recusa trabalho correto é validação que se
 * aprende a contornar.
 */
describe('o que precisa passar', () => {
  it('um fluxo escrito de verdade passa', () => {
    const r = validarPublicacao(
      comTexto('*Onde estamos*\nAvenida Paulista, 1000, São Paulo.\nTem estacionamento na porta.'),
    )
    expect(r.ok).toBe(true)
    expect(r.erros).toHaveLength(0)
  })

  it('preço de verdade não é marcador', () => {
    // A borda que engana: o padrão exige que TODOS os dígitos sejam zero.
    for (const texto of ['A partir de R$ 100', 'R$ 1.000,00', 'R$ 90', 'R$ 2.500 por mês']) {
      expect(validarPublicacao(comTexto(texto)).ok).toBe(true)
    }
  })

  it('"por exemplo" numa frase comum passa', () => {
    // "exemplo" sozinho não está na lista de propósito: é palavra de texto bom.
    expect(
      validarPublicacao(comTexto('Atendemos por agendamento, por exemplo às 9h ou às 14h.')).ok,
    ).toBe(true)
  })

  it('a instrução da IA não é cobrada', () => {
    /*
     * A instrução é escrita **para o modelo**, e não para o cliente: "troque
     * este termo por..." dentro de um prompt é instrução válida. Cobrar ali
     * produziria recusa em desenho correto.
     */
    const fluxo = fluxoSchema.parse({
      inicio: 'ia',
      nodes: [
        {
          id: 'ia',
          type: 'ia',
          position: p,
          data: { instrucao: 'Troque o jargão técnico por palavras simples. Cole aqui nada.' },
        },
        { id: 'h', type: 'handoff', position: p, data: {} },
      ],
      edges: [{ id: 'e1', source: 'ia', target: 'h' }],
    })
    expect(validarPublicacao(fluxo).ok).toBe(true)
  })
})

describe('bot sem entrada', () => {
  it('é aviso e não erro: publicar sem entrada é uso legítimo', () => {
    // O §12.1, passo 7: "publicar não liga o bot silenciosamente a todos os
    // canais". Bloquear recusaria quem publica hoje para apontar o número
    // amanhã, ou quem usa o fluxo só como destino de um salto.
    const r = validarPublicacao(comTexto('Olá!'), { temEntrada: false })
    expect(r.ok).toBe(true)
    expect(codigos(r.avisos)).toContain('SEM_ENTRADA')
  })

  it('com entrada não avisa', () => {
    expect(validarPublicacao(comTexto('Olá!'), { temEntrada: true }).avisos).toHaveLength(0)
  })

  it('sem saber, não cobra', () => {
    // `undefined` é "não perguntei": é o editor validando sem ter ido ao banco.
    expect(validarPublicacao(comTexto('Olá!')).avisos).toHaveLength(0)
  })
})

/**
 * A prova de que o defeito era real, medida contra o repositório.
 *
 * Este teste lê os modelos de verdade e exige que **pelo menos um** seja recusado
 * hoje. Se algum dia todos os modelos forem limpos, ele cai: e cair é a resposta
 * certa, porque aí a validação passa a proteger só contra o que o cliente
 * escrever, e quem for mexer precisa saber que a razão original mudou.
 */
describe('os modelos do produto', () => {
  it('há modelo que hoje sai da galeria com texto de exemplo', () => {
    const recusados = MODELOS.filter((modelo) => !validarPublicacao(modelo.grafo).ok)
    expect(recusados.length).toBeGreaterThan(0)
  })

  it('o modelo em branco passa', () => {
    const vazio = MODELOS.find((m) => m.id === 'vazio')
    expect(vazio).toBeDefined()
    if (!vazio) return
    expect(validarPublicacao(vazio.grafo).ok).toBe(true)
  })
})

describe('marcadorEm', () => {
  it('devolve o motivo, que é o que a tela mostra', () => {
    const achado = marcadorEm('*cole aqui o link*')
    expect(achado).not.toBeNull()
    expect(achado?.motivo).toContain('troque')
  })

  it('devolve nulo em texto limpo', () => {
    expect(marcadorEm('Bom dia! Como posso ajudar?')).toBeNull()
  })
})
