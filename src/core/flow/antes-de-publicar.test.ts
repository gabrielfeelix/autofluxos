import { describe, expect, it } from 'vitest'
import { antesDePublicar, origemValida } from './antes-de-publicar'
import { fluxoSchema } from './schema'
import { validar } from './validar'

const p = { x: 0, y: 0 }

/** O caso de quem importa: etiqueta de outra conta, API sem chave, IA e uma variável solta. */
const importado = fluxoSchema.parse({
  inicio: 'oi',
  nodes: [
    { id: 'oi', type: 'mensagem', position: p, data: { texto: 'Olá, {{plano}}!' } },
    { id: 'tag', type: 'etiqueta', position: p, data: { etiquetaId: 'etiqueta-de-outra-conta' } },
    { id: 'api', type: 'http', position: p, data: { url: 'https://exemplo.com.br/aulas' } },
    { id: 'ia', type: 'ia', position: p, data: { instrucao: 'Responda dúvidas.' } },
    { id: 'fim', type: 'handoff', position: p, data: {} },
  ],
  edges: [
    { id: 'e1', source: 'oi', target: 'tag' },
    { id: 'e2', source: 'tag', target: 'api' },
    { id: 'e3', source: 'api', target: 'ia' },
    { id: 'e4', source: 'ia', target: 'fim' },
  ],
})

function itens(etiquetas: string[], iaHabilitada = false, origem: 'importado' | 'duplicado' = 'importado') {
  const r = validar(importado, { iaHabilitada, etiquetas, conexoes: [] })
  return antesDePublicar({
    origem,
    fluxo: importado,
    canal: 'whatsapp',
    iaHabilitada,
    entradaLigada: origem === 'importado',
    problemas: [...r.erros, ...r.avisos],
    gatilhos: 0,
  })
}

const achar = (lista: ReturnType<typeof itens>, chave: string) => lista.find((i) => i.chave === chave)

describe('antesDePublicar', () => {
  it('aponta o que esta conta não tem, cada item levando ao bloco', () => {
    const lista = itens([])

    expect(achar(lista, 'canal')?.titulo).toBe('Conversa pelo WhatsApp')
    expect(achar(lista, 'etiquetas')).toMatchObject({ estado: 'pendente', noIds: ['tag'] })
    expect(achar(lista, 'conexoes')).toMatchObject({ estado: 'conferir', noIds: ['api'] })
    expect(achar(lista, 'ia')).toMatchObject({ estado: 'pendente', noIds: ['ia'] })
    expect(achar(lista, 'variaveis')).toMatchObject({ estado: 'pendente', noIds: ['oi'] })
    expect(achar(lista, 'gatilhos')).toMatchObject({ estado: 'conferir', link: { caminho: '/fluxos?aba=gatilhos' } })
    // Bloco que o desenho não tem não vira item: não há etapa nem salto aqui.
    expect(achar(lista, 'etapas')).toBeUndefined()
    expect(achar(lista, 'destinos')).toBeUndefined()
  })

  it('resolver no bloco marca o item como feito', () => {
    const lista = itens(['etiqueta-de-outra-conta'], true)

    expect(achar(lista, 'etiquetas')?.estado).toBe('ok')
    expect(achar(lista, 'ia')?.estado).toBe('ok')
  })

  it('cópia desligada lembra de ligar, e não cobra chave que não saiu da conta', () => {
    const lista = itens([], false, 'duplicado')

    expect(achar(lista, 'entrada')).toMatchObject({ estado: 'conferir' })
    expect(achar(lista, 'conexoes')?.estado).toBe('ok')
    expect(achar(lista, 'gatilhos')?.detalhe).toContain('não são copiados')
  })

  it('só aceita as duas origens conhecidas', () => {
    expect(origemValida('importado')).toBe('importado')
    expect(origemValida('duplicado')).toBe('duplicado')
    expect(origemValida('qualquer')).toBeNull()
    expect(origemValida(undefined)).toBeNull()
  })
})
