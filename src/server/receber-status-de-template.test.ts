import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Os repositórios são trocados por espiões: o que se prova aqui é a LEITURA do
 * payload da Meta, que é onde estão as armadilhas. Se o banco aceita o que a
 * gente manda é outra pergunta, e quem a responde é `repos.test.ts` contra o
 * Supabase de verdade.
 */
const atualizarStatusPorWabaId = vi.fn().mockResolvedValue(true)
const atualizarCategoriaPorWabaId = vi.fn().mockResolvedValue(true)
const aplicarStatusPorWamid = vi.fn().mockResolvedValue(true)

vi.mock('./repos/templates', () => ({
  atualizarStatusPorWabaId: (...args: unknown[]) => atualizarStatusPorWabaId(...args),
  atualizarCategoriaPorWabaId: (...args: unknown[]) => atualizarCategoriaPorWabaId(...args),
}))
vi.mock('./repos/transmissoes', () => ({
  aplicarStatusPorWamid: (...args: unknown[]) => aplicarStatusPorWamid(...args),
}))

const { receberStatusDeEntrega, receberStatusDeTemplate } = await import(
  './receber-status-de-template'
)

beforeEach(() => {
  vi.clearAllMocks()
  atualizarStatusPorWabaId.mockResolvedValue(true)
  atualizarCategoriaPorWabaId.mockResolvedValue(true)
  aplicarStatusPorWamid.mockResolvedValue(true)
})

/** O envelope da Meta: entry → changes → { field, value }. */
function envelope(field: string, value: unknown) {
  return { entry: [{ changes: [{ field, value }] }] }
}

describe('o status do modelo', () => {
  it('grava a aprovação pelo id da Meta', async () => {
    const r = await receberStatusDeTemplate(
      envelope('message_template_status_update', {
        message_template_id: 123,
        message_template_name: 'lembrete',
        event: 'APPROVED',
      }),
    )

    expect(r.atualizados).toBe(1)
    expect(atualizarStatusPorWabaId).toHaveBeenCalledWith('123', {
      status: 'aprovado',
      motivoRecusa: null,
    })
  })

  /*
   * `rejection_info` é a melhor informação que a Meta dá em qualquer lugar da
   * plataforma: a descrição diz O QUE está errado, a recomendação diz O QUE
   * FAZER. Perder a segunda é perder a razão de o campo existir.
   */
  it('junta descrição e recomendação da recusa, nessa ordem', async () => {
    await receberStatusDeTemplate(
      envelope('message_template_status_update', {
        message_template_id: '123',
        event: 'REJECTED',
        reason: 'INVALID_FORMAT',
        rejection_info: {
          description: 'Falta valor de exemplo na variável 2.',
          recommendation: 'Adicione um exemplo para {{2}}.',
        },
      }),
    )

    expect(atualizarStatusPorWabaId).toHaveBeenCalledWith('123', {
      status: 'recusado',
      motivoRecusa: 'Falta valor de exemplo na variável 2. — Adicione um exemplo para {{2}}.',
    })
  })

  it('usa o `reason` seco quando é tudo o que veio', async () => {
    await receberStatusDeTemplate(
      envelope('message_template_status_update', {
        message_template_id: '123',
        event: 'REJECTED',
        reason: 'ABUSIVE_CONTENT',
      }),
    )

    expect(atualizarStatusPorWabaId.mock.calls[0]![1].motivoRecusa).toBe('ABUSIVE_CONTENT')
  })

  it('limpa o motivo velho quando o template sai da recusa', async () => {
    await receberStatusDeTemplate(
      envelope('message_template_status_update', {
        message_template_id: '123',
        event: 'APPROVED',
        reason: 'NONE',
      }),
    )

    // "recusado porque X" ao lado de "aprovado" confundiria mais do que ajuda.
    expect(atualizarStatusPorWabaId.mock.calls[0]![1].motivoRecusa).toBeNull()
  })

  it('grava a pausa, que é o que faz o envio falhar', async () => {
    await receberStatusDeTemplate(
      envelope('message_template_status_update', { message_template_id: '1', event: 'PAUSED' }),
    )

    expect(atualizarStatusPorWabaId.mock.calls[0]![1].status).toBe('pausado')
  })

  /*
   * O único erro aqui capaz de fazer mal de verdade: um evento novo da Meta
   * virar `aprovado` seria transmissão saindo com modelo que não passou.
   */
  it('ignora evento que esta versão não conhece', async () => {
    const r = await receberStatusDeTemplate(
      envelope('message_template_status_update', {
        message_template_id: '1',
        event: 'ALGO_NOVO',
      }),
    )

    expect(r.atualizados).toBe(0)
    expect(atualizarStatusPorWabaId).not.toHaveBeenCalled()
  })

  it('não conta o template que não é nosso', async () => {
    // O webhook chega para TODA a WABA, inclusive o que o cliente criou direto
    // no WhatsApp Manager.
    atualizarStatusPorWabaId.mockResolvedValue(false)

    const r = await receberStatusDeTemplate(
      envelope('message_template_status_update', { message_template_id: '999', event: 'APPROVED' }),
    )

    expect(r.atualizados).toBe(0)
  })

  it('muda só a categoria quando é `template_category_update`', async () => {
    const r = await receberStatusDeTemplate(
      envelope('template_category_update', {
        message_template_id: '123',
        previous_category: 'UTILITY',
        new_category: 'MARKETING',
      }),
    )

    expect(r.atualizados).toBe(1)
    expect(atualizarCategoriaPorWabaId).toHaveBeenCalledWith('123', 'MARKETING')
    // Reclassificação muda o PREÇO, não a revisão: tocar no status aqui faria
    // um template aprovado virar outra coisa.
    expect(atualizarStatusPorWabaId).not.toHaveBeenCalled()
  })

  it('não confunde com outros campos do mesmo envelope', async () => {
    const r = await receberStatusDeTemplate(envelope('messages', { messages: [{ id: 'x' }] }))

    expect(r.atualizados).toBe(0)
    expect(atualizarStatusPorWabaId).not.toHaveBeenCalled()
  })

  it('não estoura com payload torto', async () => {
    await expect(receberStatusDeTemplate({ lixo: true })).resolves.toEqual({ atualizados: 0 })
    await expect(receberStatusDeTemplate(null)).resolves.toEqual({ atualizados: 0 })
  })
})

describe('o status de cada mensagem', () => {
  it('traduz os quatro estados da Meta', async () => {
    for (const [meta, nosso] of [
      ['sent', 'aceita'],
      ['delivered', 'entregue'],
      ['read', 'lida'],
      ['failed', 'falhou'],
    ] as const) {
      vi.clearAllMocks()
      await receberStatusDeEntrega(
        envelope('messages', { statuses: [{ id: 'wamid-1', status: meta }] }),
      )
      expect(aplicarStatusPorWamid.mock.calls[0]![1].estado).toBe(nosso)
    }
  })

  it('leva o código de erro e o detalhe da falha', async () => {
    await receberStatusDeEntrega(
      envelope('messages', {
        statuses: [
          {
            id: 'wamid-1',
            status: 'failed',
            errors: [
              {
                code: 131026,
                title: 'Message undeliverable',
                error_data: { details: 'não é usuário do WhatsApp' },
              },
            ],
          },
        ],
      }),
    )

    expect(aplicarStatusPorWamid).toHaveBeenCalledWith('wamid-1', {
      estado: 'falhou',
      codigoErro: 131026,
      erro: 'não é usuário do WhatsApp',
    })
  })

  /*
   * 132015 é a mensagem que a Meta tinha RETIDO e acabou descartando. Não
   * adianta tentar outro destinatário: o template morreu, e quem chama tem que
   * parar a transmissão em vez de queimar 5.000 tentativas.
   */
  it('avisa quando o template morreu, para a transmissão parar', async () => {
    const r = await receberStatusDeEntrega(
      envelope('messages', {
        statuses: [
          { id: 'w1', status: 'failed', errors: [{ code: 132015 }] },
          { id: 'w2', status: 'failed', errors: [{ code: 132015 }] },
        ],
      }),
    )

    // Sem repetição: é o mesmo template morrendo duas vezes.
    expect(r.templatesMortos).toEqual([132015])
  })

  it('não confunde erro de contato com template morto', async () => {
    const r = await receberStatusDeEntrega(
      envelope('messages', {
        statuses: [{ id: 'w1', status: 'failed', errors: [{ code: 131026 }] }],
      }),
    )

    // 131026 é terminal para ESTE contato, e só. A transmissão segue.
    expect(r.templatesMortos).toEqual([])
  })

  it('ignora status que a Meta inventar, sem derrubar o resto', async () => {
    const r = await receberStatusDeEntrega(
      envelope('messages', {
        statuses: [
          { id: 'w1', status: 'deleted' },
          { id: 'w2', status: 'delivered' },
        ],
      }),
    )

    expect(r.atualizados).toBe(1)
  })

  it('não conta a mensagem que não é de transmissão nenhuma', async () => {
    // O caso COMUM: o webhook de status chega para toda mensagem que o número
    // manda, inclusive as respostas de atendimento.
    aplicarStatusPorWamid.mockResolvedValue(false)

    const r = await receberStatusDeEntrega(
      envelope('messages', { statuses: [{ id: 'wamid-de-atendimento', status: 'read' }] }),
    )

    expect(r.atualizados).toBe(0)
  })

  it('ignora `statuses` de um campo que não é `messages`', async () => {
    const r = await receberStatusDeEntrega(
      envelope('smb_message_echoes', { statuses: [{ id: 'w1', status: 'read' }] }),
    )

    expect(aplicarStatusPorWamid).not.toHaveBeenCalled()
    expect(r.atualizados).toBe(0)
  })

  it('não estoura com payload torto', async () => {
    await expect(receberStatusDeEntrega({ lixo: true })).resolves.toEqual({
      atualizados: 0,
      templatesMortos: [],
    })
  })
})
