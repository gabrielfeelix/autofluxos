import { describe, expect, it } from 'vitest'
import { cabemNaHora, EXPEDIENTE_DO_RITMO_PADRAO, expedienteDoRitmo } from './disparo'
import { SEMPRE_ABERTO } from './horario'
import {
  comCliqueContado,
  ENDERECO_DO_CLIQUE,
  indiceDoBotaoContado,
  linkComLacuna,
  manterDestinos,
  modeloComoTexto,
} from './templates'

describe('modeloComoTexto (0139)', () => {
  it('preenche o corpo e junta cabeçalho e rodapé', () => {
    expect(
      modeloComoTexto({ cabecalho: { tipo: 'texto', texto: 'Promoção' }, corpo: 'Oi, {{1}}! Até {{2}}.', rodape: 'Studio' }, [
        'Ana',
        'sexta',
      ]),
    ).toEqual({ tipo: 'texto', texto: '*Promoção*\n\nOi, Ana! Até sexta.\n\nStudio' })
  })

  it('não vira texto com foto no cabeçalho ou resposta rápida', () => {
    expect(modeloComoTexto({ cabecalho: { tipo: 'imagem' }, corpo: 'Oi' }, [])).toBeNull()
    expect(modeloComoTexto({ corpo: 'Oi', botoes: [{ tipo: 'QUICK_REPLY', texto: 'Quero' }] }, [])).toBeNull()
  })

  it('um botão de link vira o botão da mensagem comum, com o destino real', () => {
    const botao = comCliqueContado({ tipo: 'URL', texto: 'Ver', valor: 'https://loja.com/x' })
    expect(modeloComoTexto({ corpo: 'Oi', botoes: [botao] }, [])).toEqual({
      tipo: 'link',
      texto: 'Oi',
      rotulo: 'Ver',
      url: 'https://loja.com/x',
    })
  })
})

describe('botão que conta cliques (0139)', () => {
  const contado = comCliqueContado({ tipo: 'URL', texto: 'Ver', valor: 'https://loja.com/x' })

  it('aponta para o nosso endereço e guarda o destino', () => {
    expect(contado).toEqual({ tipo: 'URL', texto: 'Ver', valor: `${ENDERECO_DO_CLIQUE}{{1}}`, destino: 'https://loja.com/x' })
    expect(indiceDoBotaoContado({ botoes: [{ tipo: 'QUICK_REPLY', texto: 'a' }, contado] })).toBe(1)
  })

  it('não é tratado como link com lacuna esquecida', () => {
    expect(linkComLacuna({ botoes: [contado] })).toBeNull()
  })

  it('mantém o destino quando o texto é relido da Meta', () => {
    const lido = { corpo: 'Oi', botoes: [{ tipo: 'URL' as const, texto: 'Ver', valor: `${ENDERECO_DO_CLIQUE}{{1}}` }] }
    expect(manterDestinos({ botoes: [contado] }, lido).botoes?.[0]?.destino).toBe('https://loja.com/x')
  })
})

describe('ritmo por hora (0139)', () => {
  it('conta o que cabe na última hora corrida', () => {
    expect(cabemNaHora(100, 30)).toBe(70)
    expect(cabemNaHora(100, 140)).toBe(0)
  })

  it('sem expediente configurado, anda das 8h às 20h', () => {
    expect(expedienteDoRitmo(null)).toBe(EXPEDIENTE_DO_RITMO_PADRAO)
    expect(expedienteDoRitmo(SEMPRE_ABERTO)).toBe(EXPEDIENTE_DO_RITMO_PADRAO)
  })
})
