import { describe, expect, it } from 'vitest'
import {
  CAMPOS_DE_COEXISTENCIA,
  HISTORICO_RECUSADO,
  carimboDaMeta,
  contatoDaMensagem,
  direcaoDaMensagem,
  ehCampoDeCoexistencia,
  webhookDeCoexistenciaSchema,
} from './receber-coexistencia'

/**
 * Os payloads dos três campos de coexistência.
 *
 * Testados aqui, e não pelo webhook inteiro, pela mesma razão do Instagram: é
 * onde moram as armadilhas do formato, e passar pelo banco esconderia qual
 * delas quebrou. O handoff pede explicitamente estes testes **antes** de
 * assinar os campos na Meta — webhook chegando em código que não digere o
 * payload vira erro silencioso em produção.
 */

const NUMERO_DO_NEGOCIO = '5544740074380'

describe('a direção de uma mensagem importada', () => {
  /**
   * A decisão que o handoff deixou em aberto. Errar aqui inverte a conversa
   * inteira na tela — o que o cliente disse aparece como resposta nossa — e
   * como o histórico é importado uma vez só, não há segunda chance.
   */
  it('`from` igual ao número do negócio é saída', () => {
    expect(direcaoDaMensagem({ from: NUMERO_DO_NEGOCIO }, NUMERO_DO_NEGOCIO)).toBe('saida')
  })

  it('`from` de outra pessoa é entrada', () => {
    expect(direcaoDaMensagem({ from: '5511999998888' }, NUMERO_DO_NEGOCIO)).toBe('entrada')
  })

  /** O echo ainda traz `to`. Sem `from`, é ele que decide. */
  it('sem `from`, um `to` que não é o negócio significa que o negócio mandou', () => {
    expect(direcaoDaMensagem({ to: '5511999998888' }, NUMERO_DO_NEGOCIO)).toBe('saida')
    expect(direcaoDaMensagem({ to: NUMERO_DO_NEGOCIO }, NUMERO_DO_NEGOCIO)).toBe('entrada')
  })

  /**
   * Canal sem número conhecido não pode afirmar direção. `entrada` é o lado
   * seguro: a mensagem aparece na ficha como veio da pessoa, que é o que o
   * produto já fazia antes da coexistência existir.
   */
  it('sem número do negócio, assume entrada', () => {
    expect(direcaoDaMensagem({ from: '5511999998888' }, null)).toBe('entrada')
  })
})

describe('de quem é a ficha', () => {
  /**
   * A conversa é **do contato**, não de quem digitou. Pendurar pelo `from` cru
   * criaria um contato com o número do próprio negócio, e todo o histórico de
   * saída cairia nele.
   */
  it('mensagem que o negócio mandou pertence à ficha de quem recebeu', () => {
    expect(
      contatoDaMensagem({ from: NUMERO_DO_NEGOCIO, to: '5511999998888' }, NUMERO_DO_NEGOCIO),
    ).toBe('5511999998888')
  })

  it('mensagem que a pessoa mandou pertence à ficha dela', () => {
    expect(
      contatoDaMensagem({ from: '5511999998888', to: NUMERO_DO_NEGOCIO }, NUMERO_DO_NEGOCIO),
    ).toBe('5511999998888')
  })

  it('sem os dois lados, não há ficha para escolher', () => {
    expect(contatoDaMensagem({ from: NUMERO_DO_NEGOCIO }, NUMERO_DO_NEGOCIO)).toBeNull()
  })
})

describe('o carimbo da Meta', () => {
  /**
   * Ela manda **segundos**, como string. Tratar como milissegundos põe a
   * conversa em 1970 — e o histórico é importado uma vez só.
   */
  it('segundos viram a data certa', () => {
    expect(carimboDaMeta('1757808000')).toBe(new Date(1757808000 * 1000).toISOString())
  })

  it('ausente ou torto vira null, e o banco usa o now()', () => {
    expect(carimboDaMeta(undefined)).toBeNull()
    expect(carimboDaMeta('')).toBeNull()
    expect(carimboDaMeta('ontem')).toBeNull()
    expect(carimboDaMeta('0')).toBeNull()
  })
})

describe('qual campo é de coexistência', () => {
  it('reconhece os três', () => {
    for (const campo of CAMPOS_DE_COEXISTENCIA) expect(ehCampoDeCoexistencia(campo)).toBe(true)
  })

  /**
   * `messages` continua no outro arquivo. Se ele passasse por aqui, a mensagem
   * ao vivo seria processada duas vezes — uma pelo caminho de sempre e outra
   * como se fosse histórico.
   */
  it('não reconhece `messages` nem campo desconhecido', () => {
    expect(ehCampoDeCoexistencia('messages')).toBe(false)
    expect(ehCampoDeCoexistencia('account_update')).toBe(false)
    expect(ehCampoDeCoexistencia(undefined)).toBe(false)
  })
})

describe('o envelope', () => {
  it('lê um lote de história com fase e ordem', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            {
              field: 'history',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                history: [
                  {
                    metadata: { phase: 0, chunk_order: 1, progress: 50 },
                    threads: [
                      {
                        id: '5511999998888',
                        messages: [
                          {
                            id: 'wamid.HIST1',
                            from: '5511999998888',
                            type: 'text',
                            timestamp: '1757808000',
                            text: { body: 'oi, tem horário?' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const mudanca = analise.success ? analise.data.entry[0]?.changes[0] : null
    expect(mudanca?.value.history?.[0]?.metadata?.chunk_order).toBe(1)
    expect(mudanca?.value.history?.[0]?.threads[0]?.messages[0]?.id).toBe('wamid.HIST1')
  })

  /**
   * Armadilha: a recusa do cliente chega como **erro** e não é falha. Se o
   * schema não a lesse, ela viraria alerta — pedindo para alguém investigar uma
   * escolha que o cliente tomou de propósito.
   */
  it('lê a recusa de compartilhar histórico como erro legível', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            {
              field: 'history',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                errors: [{ code: HISTORICO_RECUSADO, title: 'History sync not authorized' }],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const erros = analise.success ? analise.data.entry[0]?.changes[0]?.value.errors : null
    expect(erros?.[0]?.code).toBe(HISTORICO_RECUSADO)
  })

  /**
   * Armadilha 3: `remove` vem **sem os nomes**. O schema precisa aceitar isso —
   * exigir `full_name` faria toda remoção da agenda ser descartada.
   */
  it('lê a agenda, com `add` completo e `remove` só com telefone', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            {
              field: 'smb_app_state_sync',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                state_sync: [
                  {
                    type: 'contact',
                    contact: {
                      action: 'add',
                      phone_number: '5511999998888',
                      full_name: 'Maria Souza',
                      first_name: 'Maria',
                    },
                  },
                  { type: 'contact', contact: { action: 'remove', phone_number: '5511777776666' } },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const sync = analise.success ? analise.data.entry[0]?.changes[0]?.value.state_sync : null
    expect(sync?.[0]?.contact?.full_name).toBe('Maria Souza')
    expect(sync?.[1]?.contact?.action).toBe('remove')
    expect(sync?.[1]?.contact?.full_name).toBeUndefined()
  })

  /**
   * Armadilha 2: mídia velha chega como `media_placeholder` **sem conteúdo**, e
   * o conteúdo nunca vem se for mais velha que duas semanas. O schema não pode
   * exigir corpo — senão metade do histórico seria descartada.
   */
  it('aceita o placeholder de mídia, que chega sem conteúdo', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            {
              field: 'history',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                history: [
                  {
                    metadata: { phase: 2, chunk_order: 0 },
                    threads: [
                      {
                        messages: [
                          {
                            id: 'wamid.VELHA',
                            from: '5511999998888',
                            type: 'media_placeholder',
                            timestamp: '1700000000',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const msg = analise.success
      ? analise.data.entry[0]?.changes[0]?.value.history?.[0]?.threads[0]?.messages[0]
      : null
    expect(msg?.type).toBe('media_placeholder')
    expect(msg?.text).toBeUndefined()
  })

  /**
   * A lição do `messaging` do Instagram, aplicada antes de doer: uma mudança
   * que não encaixa vira `null` em vez de derrubar o lote. O mesmo corpo
   * carrega `messages` e `history`, e um formato novo num deles não pode fazer
   * o outro ser descartado em silêncio.
   */
  it('uma mudança estranha não derruba as outras do mesmo corpo', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            { field: 'algo_novo_da_meta', value: 'nem objeto é' },
            {
              field: 'smb_message_echoes',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                messages: [
                  {
                    id: 'wamid.ECO',
                    from: '5544740074380',
                    to: '5511999998888',
                    type: 'text',
                    text: { body: 'já te respondo' },
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const mudancas = analise.success ? analise.data.entry[0]?.changes : []
    expect(mudancas?.[0]).toBeNull()
    expect(mudancas?.[1]?.value.messages?.[0]?.id).toBe('wamid.ECO')
  })

  /**
   * A sincronização pode levar **até 6 horas** e pode falhar de vez (relato de
   * quem implementou, não da doc da Meta). O `progress` é o que separa "ainda
   * rodando" de "morreu no meio" — se o schema não o lesse, as duas situações
   * ficariam idênticas vistas de fora: nenhum dado novo chegando.
   */
  it('lê o progresso dos dois syncs', () => {
    const analise = webhookDeCoexistenciaSchema.safeParse({
      entry: [
        {
          changes: [
            {
              field: 'history',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                history: [{ metadata: { phase: 1, chunk_order: 3, progress: 75 }, threads: [] }],
              },
            },
            {
              field: 'smb_app_state_sync',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                state_sync: [{ type: 'contact', metadata: { progress: 40 } }],
              },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const mudancas = analise.success ? analise.data.entry[0]?.changes : []
    expect(mudancas?.[0]?.value.history?.[0]?.metadata?.progress).toBe(75)
    expect(mudancas?.[1]?.value.state_sync?.[0]?.metadata?.progress).toBe(40)
  })

  /**
   * O echo de uma mensagem que o dono mandou pelo celular: é o que cala o bot.
   * A direção precisa sair `saida` do payload cru, senão o handoff não dispara
   * e o bot atropela a conversa que ele já estava tendo.
   */
  it('o echo do dono pelo celular é saída, e a ficha é de quem recebeu', () => {
    const eco = { from: '5544740074380', to: '5511999998888' }
    expect(direcaoDaMensagem(eco, '5544740074380')).toBe('saida')
    expect(contatoDaMensagem(eco, '5544740074380')).toBe('5511999998888')
  })
})

describe('PARTNER_ADDED — o onboarding que a Meta avisa por webhook', () => {
  /**
   * O payload real, da doc da Meta (`account_update` reference). O que importa
   * aqui é a forma: `waba_info.waba_id` existe, e **`phone_number_id` não** —
   * é por isso que este evento não consegue concluir o onboarding sozinho.
   */
  const partnerAdded = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '35602282435505',
        time: 1731617831,
        changes: [
          {
            field: 'account_update',
            value: {
              event: 'PARTNER_ADDED',
              waba_info: {
                waba_id: '495709166956424',
                owner_business_id: '942647313864044',
              },
            },
          },
        ],
      },
    ],
  }

  it('o payload da doc passa pelo nosso schema', () => {
    const lido = webhookDeCoexistenciaSchema.safeParse(partnerAdded)
    expect(lido.success).toBe(true)
  })

  it('traz a WABA e **não** traz o número — o motivo de não concluir sozinho', () => {
    const lido = webhookDeCoexistenciaSchema.parse(partnerAdded)
    const valor = lido.entry[0]?.changes[0]?.value as Record<string, unknown>

    const info = valor.waba_info as Record<string, unknown>
    expect(info.waba_id).toBe('495709166956424')

    // A ausência é o ponto: sem `phone_number_id` e sem token (que só sai da
    // troca do `code`, no retorno pelo navegador), o máximo honesto é alertar.
    expect(valor.metadata).toBeUndefined()
  })

  it('não se confunde com os eventos de desembarque', () => {
    // Os três chegam pelo mesmo `field`, e tratá-los juntos foi o defeito
    // anterior: só offboard/reconnect eram lidos, e o PARTNER_ADDED caía fora.
    for (const evento of ['ACCOUNT_OFFBOARDED', 'ACCOUNT_RECONNECTED']) {
      expect(evento).not.toBe('PARTNER_ADDED')
    }
  })
})
