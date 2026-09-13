import { describe, expect, it } from 'vitest'
import {
  PARADO_MS,
  RECEM_CONECTADO_H,
  identidadeNaTela,
  recemConectado,
  progressoGeral,
  situacaoDoNumero,
  type EstadoNaTela,
} from './coexistencia-na-tela'

/**
 * "Andando" e "travou" não podem parecer a mesma coisa.
 *
 * É o pedido da spec, e é a regra inteira deste módulo: um cliente que vê
 * "conectado" e não vê a conversa antiga aparecer vai achar que quebrou. Testado
 * aqui, e não pela página, porque é decisão de produto — a tela só desenha.
 */

const AGORA = new Date('2026-09-13T12:00:00Z')
const minutosAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString()

const coexistente: EstadoNaTela = { isOnBizApp: true, coexistenciaEm: minutosAtras(60) }

describe('a situação de um número', () => {
  /** Cloud API pura não tem coexistência para mostrar. */
  it('número comum não vira coexistente por engano', () => {
    expect(situacaoDoNumero(undefined, AGORA)).toBe('comum')
    expect(situacaoDoNumero({ isOnBizApp: false }, AGORA)).toBe('comum')
    // `null` é "nunca verificamos", que também não é coexistente.
    expect(situacaoDoNumero({ isOnBizApp: null }, AGORA)).toBe('comum')
  })

  /**
   * O desembarque vence tudo: o envio está parado **agora**, e é o que pede
   * ação imediata de quem olha a tela.
   */
  it('desembarcado vence sincronizando', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          desembarcadoEm: minutosAtras(2),
          historicoSyncEm: minutosAtras(5),
          historicoVistoEm: minutosAtras(1),
        },
        AGORA,
      ),
    ).toBe('desembarcado')
  })

  it('sync com sinal recente está sincronizando', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          historicoSyncEm: minutosAtras(90),
          historicoProgresso: 40,
          historicoVistoEm: minutosAtras(3),
        },
        AGORA,
      ),
    ).toBe('sincronizando')
  })

  /**
   * Noventa minutos correndo **não** é travado: a sincronização leva até 6
   * horas, e chamar isso de falha faria alguém mexer no que está funcionando.
   * O que conta é o silêncio desde o último lote.
   */
  it('demorar muito não é travar, desde que dê sinal', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          historicoSyncEm: minutosAtras(300),
          historicoProgresso: 70,
          historicoVistoEm: minutosAtras(10),
        },
        AGORA,
      ),
    ).toBe('sincronizando')
  })

  it('meia hora sem sinal nenhum é travado', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          historicoSyncEm: minutosAtras(120),
          historicoProgresso: 40,
          historicoVistoEm: minutosAtras(31),
        },
        AGORA,
      ),
    ).toBe('travado')
  })

  /**
   * O caso que a referência dupla resolve: disparou e **nenhum lote chegou**.
   * Sem contar o tempo desde o disparo, isto ficaria "sincronizando" para
   * sempre — que é exatamente a confusão que o módulo existe para desfazer.
   */
  it('disparado e sem nenhum lote há muito tempo é travado', () => {
    expect(
      situacaoDoNumero({ ...coexistente, historicoSyncEm: minutosAtras(45) }, AGORA),
    ).toBe('travado')
  })

  it('disparado agora, ainda sem lote, está sincronizando', () => {
    expect(
      situacaoDoNumero({ ...coexistente, contatosSyncEm: minutosAtras(2) }, AGORA),
    ).toBe('sincronizando')
  })

  /** Cem por cento é fim, e o silêncio depois disso é o silêncio bom. */
  it('sync a 100 está pronto, mesmo em silêncio longo', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          contatosSyncEm: minutosAtras(600),
          contatosProgresso: 100,
          contatosVistoEm: minutosAtras(400),
          historicoSyncEm: minutosAtras(600),
          historicoProgresso: 100,
          historicoVistoEm: minutosAtras(300),
        },
        AGORA,
      ),
    ).toBe('pronto')
  })

  it('coexistente sem nenhum sync disparado está pronto', () => {
    expect(situacaoDoNumero(coexistente, AGORA)).toBe('pronto')
  })

  /** Um travado e um andando: manda o pior, que é o que pede ação. */
  it('travado vence sincronizando', () => {
    expect(
      situacaoDoNumero(
        {
          ...coexistente,
          contatosSyncEm: minutosAtras(90),
          contatosVistoEm: minutosAtras(60),
          historicoSyncEm: minutosAtras(90),
          historicoProgresso: 50,
          historicoVistoEm: minutosAtras(1),
        },
        AGORA,
      ),
    ).toBe('travado')
  })

  it('o limite é o PARADO_MS documentado', () => {
    const noLimite = new Date(AGORA.getTime() - PARADO_MS + 1_000).toISOString()
    expect(
      situacaoDoNumero(
        { ...coexistente, historicoSyncEm: minutosAtras(120), historicoVistoEm: noLimite },
        AGORA,
      ),
    ).toBe('sincronizando')
  })
})

describe('o progresso somado', () => {
  it('sem sync nenhum, não há barra para mostrar', () => {
    expect(progressoGeral(coexistente)).toBeNull()
    expect(progressoGeral(undefined)).toBeNull()
  })

  /**
   * O sync que nem começou conta como zero, não como ausente — senão a barra
   * mostraria 100% com metade do trabalho por fazer.
   */
  it('um sync a 100 e o outro nem começado é 50, não 100', () => {
    expect(
      progressoGeral({ ...coexistente, contatosSyncEm: minutosAtras(10), contatosProgresso: 100 }),
    ).toBe(50)
  })

  it('os dois pela metade é metade', () => {
    expect(
      progressoGeral({
        ...coexistente,
        contatosSyncEm: minutosAtras(10),
        contatosProgresso: 50,
        historicoSyncEm: minutosAtras(10),
        historicoProgresso: 50,
      }),
    ).toBe(50)
  })

  it('os dois no fim é cem', () => {
    expect(
      progressoGeral({
        ...coexistente,
        contatosSyncEm: minutosAtras(10),
        contatosProgresso: 100,
        historicoSyncEm: minutosAtras(10),
        historicoProgresso: 100,
      }),
    ).toBe(100)
  })

  /** Valor fora da faixa é ruído da Meta e não pode virar barra de 300%. */
  it('valor absurdo é contido na faixa', () => {
    expect(
      progressoGeral({
        ...coexistente,
        contatosSyncEm: minutosAtras(10),
        contatosProgresso: 900,
        historicoSyncEm: minutosAtras(10),
        historicoProgresso: -5,
      }),
    ).toBe(50)
  })
})

describe('identidadeNaTela', () => {
  /*
   * O defeito que isto trava: a tela mostrava `110549275215531` como título, e
   * quem tinha acabado de conectar o próprio celular não reconhecia o número.
   * Com "Conectar número" logo ao lado, a conclusão era "não conectou".
   */
  it('mostra o telefone como título, não o phone_number_id', () => {
    expect(
      identidadeNaTela(
        { displayPhoneNumber: '+55 11 91100-1414', verifiedName: 'Academia' },
        '110549275215531',
      ),
    ).toEqual({ titulo: '+55 11 91100-1414', abaixo: 'Academia · 110549275215531' })
  })

  it('sem nome verificado, o id fica sozinho embaixo', () => {
    expect(
      identidadeNaTela({ displayPhoneNumber: '+55 11 91100-1414' }, '110549275215531'),
    ).toEqual({ titulo: '+55 11 91100-1414', abaixo: '110549275215531' })
  })

  it('canal antigo, sem telefone guardado, volta a mostrar o id', () => {
    // Conectou antes da 0048. Mostrar nada seria pior que mostrar o id.
    expect(identidadeNaTela(undefined, '110549275215531')).toEqual({
      titulo: '110549275215531',
      abaixo: null,
    })
  })

  it('telefone em branco conta como ausente', () => {
    // String vazia ou só espaços não é telefone; cair no id é o certo.
    expect(identidadeNaTela({ displayPhoneNumber: '   ' }, '110549275215531').titulo).toBe(
      '110549275215531',
    )
  })

  it('canal sem phone_number_id não quebra a tela', () => {
    expect(identidadeNaTela(undefined, null).titulo).toBe('sem número')
  })
})

describe('recemConectado', () => {
  const agora = new Date('2026-09-13T22:00:00Z')
  const hAtras = (h: number) =>
    new Date(agora.getTime() - h * 60 * 60 * 1_000).toISOString()

  /*
   * O caso real: conectou às 21:04, e uma hora depois nenhuma mensagem entrava.
   * Não era defeito — a Meta ainda não tinha terminado de sincronizar. Sem a
   * tela dizer isso, a conclusão foi "quebrou", e horas foram gastas nisso.
   */
  it('uma hora depois de conectar ainda é recente', () => {
    expect(recemConectado({ coexistenciaEm: hAtras(1) }, agora)).toBe(true)
  })

  it('passada a janela, para de explicar', () => {
    expect(recemConectado({ coexistenciaEm: hAtras(RECEM_CONECTADO_H + 1) }, agora)).toBe(false)
  })

  it('sync terminado tira o recém — aí o silêncio não tem essa desculpa', () => {
    expect(
      recemConectado({ coexistenciaEm: hAtras(1), historicoProgresso: 100 }, agora),
    ).toBe(false)
  })

  it('sync andando mas incompleto continua explicando', () => {
    expect(
      recemConectado({ coexistenciaEm: hAtras(1), historicoProgresso: 40 }, agora),
    ).toBe(true)
  })

  it('número que nunca foi coexistente não recebe o aviso', () => {
    expect(recemConectado(undefined, agora)).toBe(false)
    expect(recemConectado({ coexistenciaEm: null }, agora)).toBe(false)
  })
})
