import { describe, expect, it } from 'vitest'
import { andamentoDoPedido } from '@/loja/magento-pedido'
import { dataComDia, dataCurta, etapaDoPedido, linkDoRastreio, mensagemDoPedido, nomeCurto } from './pedido-na-conversa'

describe('status do pedido na conversa', () => {
  it('junta situação, entrega, andamento, itens e total numa mensagem', () => {
    const texto = mensagemDoPedido({
      numero: '000001955',
      situacao: 'Entregue à transportadora',
      situacaoCodigo: 'delivered_carrier',
      feitoEm: '2026-09-28',
      total: 'R$ 1.238,90',
      itens: [{ nome: 'Placa de Vídeo RX 550', quantidade: 2 }],
      rastreios: [],
      entrega: { transportadora: 'BRASPRESS TRANSPORTES URGENTES LTDA', codigo: '', previsao: '2026-10-02', ultima: null, ocorrencias: [] },
      andamento: [{ texto: 'Em Transferência', quando: '28/09 às 21:32' }],
    })
    expect(texto).toBe(
      [
        '🚚 *Seu pedido está a caminho*',
        'Previsão de entrega: *sexta, 02/10*',
        '',
        '✅ Pagamento aprovado',
        '✅ Pedido separado',
        '🔵 *Em Transferência*',
        '⚪ Entrega no seu endereço',
        '',
        'Transportadora: Braspress',
        '',
        '*Pedido #000001955* · R$ 1.238,90',
        '2x Placa de Vídeo RX 550',
      ].join('\n'),
    )
  })

  it('aguardando coleta não diz "a caminho" e corta nome longo na palavra', () => {
    const texto = mensagemDoPedido({
      numero: '000002025',
      situacao: 'Entregue à transportadora',
      situacaoCodigo: 'delivered_carrier',
      feitoEm: '',
      total: 'R$ 1.718,10',
      itens: [{ nome: 'Cadeira Ergonômica de Massagem Sublime Backrobo Preta', quantidade: 1 }],
      rastreios: [{ transportadora: 'JAMEF', codigo: 'https://ondeestameupedido.com.br/FR261005PJ5ZR' }],
      andamento: [{ texto: 'Aguardando coleta / postagem', quando: '05/10 14:19' }],
    })
    expect(texto.split('\n')[0]).toBe('📦 *Seu pedido está pronto para envio*')
    expect(texto).toContain('🔵 *Aguardando a transportadora*')
    expect(texto).toContain('Código de rastreio: FR261005PJ5ZR')
    expect(texto).toContain('1x Cadeira Ergonômica de Massagem…')
  })

  it('fora do caminho feliz não desenha linha do tempo', () => {
    const texto = mensagemDoPedido({
      numero: '1',
      situacao: 'Cancelado',
      situacaoCodigo: 'canceled',
      feitoEm: '',
      total: '',
      itens: [],
      rastreios: [],
    })
    expect(texto).toBe('📦 *Situação do pedido: Cancelado*\n\n*Pedido #1*')
  })

  it('entregue pela Frete Rápido fecha a linha do tempo e some a previsão', () => {
    const entrega = {
      transportadora: 'JAMEF',
      codigo: '',
      previsao: '2026-10-08',
      ultima: { situacao: 'Entregue', quando: '2026-10-07', detalhe: '' },
      ocorrencias: [],
    }
    expect(etapaDoPedido({ situacaoCodigo: 'delivered_carrier', entrega })).toBe(3)
    expect(etapaDoPedido({ situacaoCodigo: 'delivered_carrier' })).toBe(2)
    expect(dataComDia('2026-10-08')).toBe('qui, 08/10')
    // Como a Frete Rápido manda.
    expect(dataComDia('08/10/2026', 'longo')).toBe('quinta, 08/10')
  })

  it('lê o andamento do histórico e ignora nota interna', () => {
    expect(
      andamentoDoPedido([
        { comment: 'Em Transferência - 28/09/2026 às 21:32:52' },
        { comment: 'Coletado / Postado - 28/09/2026 às 20:40:12' },
        { comment: 'Freight successfully hired' },
        { comment: 'Ordered amount of R$ 1.238,90' },
      ]),
    ).toEqual([
      { texto: 'Em Transferência', quando: '28/09 às 21:32' },
      { texto: 'Coletado / Postado', quando: '28/09 às 20:40' },
    ])
  })

  it('código FR do envio vira o link público da Frete Rápido', () => {
    expect(linkDoRastreio({ rastreios: [{ transportadora: 'Frete Rápido', codigo: 'FR260928DHHN5' }] })).toBe(
      'https://ondeestameupedido.com.br/FR260928DHHN5',
    )
    expect(linkDoRastreio({ rastreios: [{ transportadora: 'Correios', codigo: 'AA123456789BR' }] })).toBeNull()
    // Como a PCYES grava: o link inteiro no número de rastreio.
    expect(
      linkDoRastreio({ rastreios: [{ transportadora: 'BRASPRESS', codigo: 'https://ondeestameupedido.com.br/FR260928DHHN5' }] }),
    ).toBe('https://ondeestameupedido.com.br/FR260928DHHN5')
  })

  it('encurta transportadora e data', () => {
    expect(nomeCurto('BRASPRESS TRANSPORTES URGENTES LTDA')).toBe('Braspress')
    expect(nomeCurto('JAD LOG')).toBe('JAD')
    expect(dataCurta('2026-10-02 00:00:00')).toBe('02/10')
  })
})
