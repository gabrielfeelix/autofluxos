import { describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { fluxoSchema } from '@/core/flow/schema'
import { executarComEfeitos } from './resolver'

/**
 * Prova a cadeia inteira contra a internet de verdade: motor -> resolvedor ->
 * recusa de rede (DNS) -> fetch -> extração -> variável -> mensagem
 * interpolada. Tudo que os outros testes dublam, aqui é real.
 *
 * Fica atrás de uma trava pelo mesmo motivo que os testes do Gemini: `npm test`
 * tem que passar para quem clonou o repo e está sem internet. Ligue com
 * `API_TESTE_REAL=1 npm test` quando quiser a prova de verdade.
 *
 * O ViaCEP é escolha deliberada: é público, gratuito, sem chave, e é o mesmo
 * endereço com que o bloco nasce no editor — então este teste também confere
 * que a demonstração de reunião continua funcionando.
 */
const real = process.env.API_TESTE_REAL === '1'

describe.skipIf(!real)('ponta a ponta com o ViaCEP', () => {
  it('o bot responde com a cidade que veio da API', async () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
          position: { x: 0, y: 0 },
          data: {
            url: 'https://viacep.com.br/ws/01310100/json/',
            mapear: [{ variavel: 'cidade', caminho: 'localidade' }],
          },
        },
        { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'Você está em {{cidade}}.' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'a1', source: 'consulta', target: 'diz' },
        { id: 'a2', source: 'diz', target: 'humano' },
      ],
    })

    const r = await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      origem: 'simulador',
    })

    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos).toContain('Você está em São Paulo.')
  }, 20_000)

  it('recusa endereço interno de verdade, sem dublê', async () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { url: 'https://localhost/segredo', aoFalhar: 'humano' },
        },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'consulta', target: 'humano' }],
    })

    const r = await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      origem: 'simulador',
    })

    const motivo = r.acoes.find((a) => a.tipo === 'transferir_humano')
    expect(motivo?.tipo === 'transferir_humano' && motivo.motivo).toContain('interno')
  }, 20_000)
})
