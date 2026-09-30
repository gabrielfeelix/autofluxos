import { describe, expect, it } from 'vitest'
import { andamentoDoPedido } from '@/loja/magento-pedido'
import { dataCurta, mensagemDoPedido, nomeCurto } from './pedido-na-conversa'

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
        '📦 *Pedido #000001955*',
        'Situação: *Entregue à transportadora*',
        'Transportadora: Braspress',
        'Previsão de entrega: *02/10*',
        'Última atualização: Em Transferência, 28/09 às 21:32',
        '',
        '• 2x Placa de Vídeo RX 550',
        'Total: R$ 1.238,90',
      ].join('\n'),
    )
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

  it('encurta transportadora e data', () => {
    expect(nomeCurto('BRASPRESS TRANSPORTES URGENTES LTDA')).toBe('Braspress')
    expect(nomeCurto('JAD LOG')).toBe('JAD')
    expect(dataCurta('2026-10-02 00:00:00')).toBe('02/10')
  })
})
