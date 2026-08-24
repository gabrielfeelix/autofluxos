import { describe, expect, it } from 'vitest'
import { fluxoSchema, noHttpSchema } from './flow/schema'
import { validar } from './flow/validar'
import { PRESETS, acharPreset } from './presets'

/**
 * Os presets de integração (B6).
 *
 * **O que precisa ser provado é que o que eles preenchem publica.** Um preset
 * que produz um bloco inválido é pior do que não existir: a pessoa clica em
 * "aplicar", acha que resolveu, e descobre na hora de publicar que o desenho
 * não passa — com uma lista de erros sobre um bloco que ela não escreveu.
 */
describe('cada preset produz um bloco de API válido', () => {
  it.each(PRESETS.map((preset) => preset.id))('%s tem forma de bloco `http`', (id) => {
    const preset = acharPreset(id)!

    // O schema é o mesmo que o editor grava e o motor lê. Se o preset não
    // passar por aqui, ele nunca chegaria ao banco.
    const bloco = noHttpSchema.parse({
      id: 'api',
      type: 'http',
      position: { x: 0, y: 0 },
      data: preset.dados,
    })

    expect(bloco.data.url.startsWith('https://')).toBe(true)
    // Host vindo de `{{variavel}}` deixaria quem conversa escolher com qual
    // servidor o cliente fala. O validador recusa, e nenhum preset pode nascer
    // recusado.
    expect(/^https:\/\/[^/]*\{\{/.test(bloco.data.url)).toBe(false)
  })

  it.each(PRESETS.map((preset) => preset.id))('%s publica dentro de um fluxo', (id) => {
    const preset = acharPreset(id)!

    const fluxo = fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        { id: 'api', type: 'http', position: { x: 0, y: 0 }, data: preset.dados },
        {
          id: 'humano',
          type: 'handoff',
          position: { x: 0, y: 160 },
          data: { mensagem: 'já te passo', motivo: 'fim' },
        },
      ],
      edges: [{ id: 'e1', source: 'api', target: 'humano' }],
    })

    const conferido = validar(fluxo, { iaHabilitada: false, conexoes: [] })
    expect(conferido.ok, JSON.stringify(conferido.ok ? [] : conferido.erros)).toBe(true)
  })
})

describe('o que os presets escolhem, e por quê', () => {
  it('só quem apenas avisa um sistema segue em frente; o resto chama uma pessoa', () => {
    /**
     * **A régua não é o verbo, e por um tempo pareceu ser.**
     *
     * Enquanto os presets eram CRM e planilha, `GET` e `POST` separavam certo
     * por acidente: as leituras eram todas assunto da conversa e as escritas
     * eram todas avisos. A agenda quebrou a coincidência — `POST /participacoes`
     * é escrita, e falhar nela significa prometer um horário que ninguém marcou.
     *
     * A pergunta que decide é outra: **a conversa depende do resultado?**
     *
     * - **Não depende** — o lead já está no nosso banco, e o bloco só avisa a
     *   RD, a planilha ou um webhook. Não ter chegado lá é problema de
     *   sincronia, não de atendimento; handoff encheria a fila com conversas que
     *   não precisam de ninguém.
     * - **Depende** — consultar horário livre, reconhecer quem chegou, marcar,
     *   desmarcar, entrar na fila. Seguir em frente aqui entrega uma pergunta
     *   sem resposta possível, um cadastro duplicado, ou uma promessa que
     *   ninguém cumpre. Uma pessoa assume.
     */
    const SO_AVISAM = new Set(['rd-station-conversao', 'google-sheets-linha', 'webhook'])

    for (const preset of PRESETS) {
      const esperado = SO_AVISAM.has(preset.id) ? 'seguir' : 'humano'
      expect(preset.dados.aoFalhar, preset.id).toBe(esperado)
    }
  })

  it('nenhum deles carrega credencial no corpo, no endereço ou no cabeçalho', () => {
    // A credencial entra por `conexaoId`, resolvida no servidor. Um preset com
    // a chave escrita viraria segredo dentro de `flow_versions`, que é imutável
    // — não haveria como tirar depois.
    for (const preset of PRESETS) {
      const tudo = [
        preset.dados.url,
        preset.dados.corpo,
        ...preset.dados.cabecalhos.map((c) => `${c.chave}: ${c.valor}`),
      ].join('\n')

      expect(/api[_-]?key\s*[=:]\s*\S/i.test(tudo)).toBe(false)
      expect(/Bearer\s+\S/i.test(tudo)).toBe(false)
    }
  })

  it('a RD guarda o id do evento — é o que prova que a integração rodou', () => {
    const rd = acharPreset('rd-station-conversao')!
    expect(rd.dados.mapear).toEqual([{ variavel: 'rd_evento', caminho: 'event_uuid' }])
  })
})
