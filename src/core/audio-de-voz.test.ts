import { describe, expect, it } from 'vitest'
import {
  AVISO_DE_FIM_S,
  duracaoLegivel,
  escolherFormato,
  FORMATOS_DE_GRAVACAO,
  LIMITE_DE_GRAVACAO_S,
  motivoDoMicrofone,
  nomeDoAudio,
  RESTRICOES_DO_MICROFONE,
  gravouOpus,
} from './audio-de-voz'
import { TIPOS_ACEITOS } from '@/server/repos/acervo'

/**
 * Estes testes existem porque o modo de falha desta funcionalidade é silencioso
 * e distante: o formato errado sobe, grava mensagem, e só a Meta recusa, com o
 * erro aparecendo na conversa de um cliente. Aqui a regra é conferida sem
 * navegador, sem microfone e sem rede.
 */

/**
 * O que cada navegador responde a `MediaRecorder.isTypeSupported`.
 *
 * `audio/mp4` aparece em quase todos e **não está mais na lista que pedimos**:
 * ele é o tipo genérico que deixa o codec com o navegador, e foi assim que o
 * Chrome entregou Opus dentro de MP4 em produção. Está aqui de propósito, para
 * os testes provarem que a escolha o ignora.
 */
const NAVEGADORES = {
  chrome: ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm', 'audio/webm;codecs=opus'],
  safari: ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2'],
  firefox: ['audio/ogg', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/webm;codecs=opus'],
  chromeAntigo: ['audio/webm', 'audio/webm;codecs=opus'],
  /*
   * O caso que ainda não foi observado mas é plausível: build sem codificador
   * AAC (AAC tem patente, e alguns Chromium não o embarcam). Sobraria só
   * Opus-em-MP4, que a Meta não entrega. Recusar é a resposta certa.
   */
  chromiumSemAac: ['audio/mp4', 'audio/mp4;codecs=opus', 'audio/webm;codecs=opus'],
}

const suporte = (lista: string[]) => (m: string) => lista.includes(m)

describe('escolherFormato', () => {
  it('no Chrome escolhe WebM/Opus, que o remux reembala como OGG', () => {
    const formato = escolherFormato(suporte(NAVEGADORES.chrome))
    expect(formato?.mimeType).toBe('audio/webm;codecs=opus')
    expect(formato?.remux).toBe(true)
    // O que sobe é sempre OGG, independentemente do que foi gravado.
    expect(formato?.mime).toBe('audio/ogg')
  })

  it('no Firefox escolhe OGG nativo e não precisa de remux', () => {
    const formato = escolherFormato(suporte(NAVEGADORES.firefox))
    expect(formato?.mimeType).toBe('audio/ogg;codecs=opus')
    expect(formato?.remux).toBe(false)
  })

  /*
   * A letra miúda da Meta: "OPUS codecs only; base audio/ogg not supported".
   * `audio/ogg` sozinho sai em Vorbis no Firefox, e a Meta recusa.
   */
  it('pede Opus por extenso, nunca o contêiner sozinho', () => {
    const formato = escolherFormato(suporte(NAVEGADORES.firefox))
    expect(formato?.mimeType).toContain(';codecs=opus')
  })

  /*
   * O Safari não grava Opus, só MP4/AAC. E o MP4 do MediaRecorder é
   * fragmentado, sem índice de amostras: o WhatsApp o lê como vazio. Recusar é
   * melhor do que gravar algo que sai daqui e não chega do outro lado.
   * Registrado como pendência, não como acidente.
   */
  it('recusa o Safari, que só grava MP4 fragmentado', () => {
    expect(escolherFormato(suporte(NAVEGADORES.safari))).toBeNull()
  })

  it('recusa quando não há Opus em lugar nenhum', () => {
    expect(escolherFormato(suporte(['audio/mp4', 'audio/mp4;codecs=mp4a.40.2']))).toBeNull()
    expect(escolherFormato(suporte([]))).toBeNull()
  })

  it('trata `isTypeSupported` que estoura como "não suporta"', () => {
    const explode = () => {
      throw new TypeError('navegador antigo')
    }
    expect(escolherFormato(explode)).toBeNull()
  })

  it('devolve o MIME sem `;codecs=`, que é o que o bucket compara', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      expect(formato.mime).not.toContain(';')
    }
  })
})

describe('o formato gravado bate com o que o acervo aceita', () => {
  /*
   * Esta é a armadilha que o comentário da `0056` descreve: tipo que o
   * navegador grava e o acervo não conhece é recusado antes de subir; tipo que
   * o acervo conhece e o bucket não tem dá 400 do Storage, longe de qualquer
   * código nosso. As duas listas andam juntas ou não andam.
   */
  it('todo formato de gravação tem entrada em TIPOS_ACEITOS, como áudio', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      const aceito = TIPOS_ACEITOS[formato.mime]
      expect(aceito, `${formato.mime} falta em TIPOS_ACEITOS`).toBeDefined()
      expect(aceito?.midia).toBe('audio')
    }
  })

  it('a extensão do formato é a mesma que o acervo daria ao arquivo', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      expect(TIPOS_ACEITOS[formato.mime]?.extensao).toBe(formato.extensao)
    }
  })
})

describe('nomeDoAudio', () => {
  it('carimba data e hora, para o acervo não virar uma lista de "recording"', () => {
    const nome = nomeDoAudio(new Date(2026, 8, 15, 9, 7, 3), 'm4a')
    expect(nome).toBe('audio-2026-09-15-090703.m4a')
  })

  it('não produz caractere que o acervo teria de limpar', () => {
    expect(nomeDoAudio(new Date(2026, 0, 1, 0, 0, 0), 'ogg')).toMatch(/^[a-z0-9.-]+$/)
  })
})

describe('duracaoLegivel', () => {
  it('mostra m:ss com dois dígitos no segundo', () => {
    expect(duracaoLegivel(0)).toBe('0:00')
    expect(duracaoLegivel(9)).toBe('0:09')
    expect(duracaoLegivel(60)).toBe('1:00')
    expect(duracaoLegivel(125)).toBe('2:05')
    expect(duracaoLegivel(LIMITE_DE_GRAVACAO_S)).toBe('5:00')
  })

  it('não mostra número negativo quando o relógio escorrega', () => {
    expect(duracaoLegivel(-3)).toBe('0:00')
  })
})

describe('as restrições do microfone', () => {
  it('pede mono, porque a Meta exige mono no OGG', () => {
    expect(RESTRICOES_DO_MICROFONE.channelCount).toBe(1)
  })
})

describe('motivoDoMicrofone', () => {
  const comNome = (nome: string) => Object.assign(new Error('qualquer'), { name: nome })

  it('diz onde liberar quando a pessoa negou', () => {
    expect(motivoDoMicrofone(comNome('NotAllowedError'))).toContain('cadeado')
  })

  it('separa "não tem microfone" de "outro programa está usando"', () => {
    expect(motivoDoMicrofone(comNome('NotFoundError'))).toContain('Nenhum microfone')
    expect(motivoDoMicrofone(comNome('NotReadableError'))).toContain('Outro programa')
  })

  it('tem resposta para erro que não conhece, e para não-erro', () => {
    expect(motivoDoMicrofone(comNome('CoisaNova'))).toBe('Não deu para abrir o microfone.')
    expect(motivoDoMicrofone('texto solto')).toBe('Não deu para abrir o microfone.')
  })
})

describe('os limites', () => {
  it('o aviso cabe dentro da gravação', () => {
    expect(AVISO_DE_FIM_S).toBeGreaterThan(0)
    expect(AVISO_DE_FIM_S).toBeLessThan(LIMITE_DE_GRAVACAO_S)
  })

  it('cinco minutos de voz mono cabem folgados nos 16 MB da Meta', () => {
    // AAC mono de voz fica em torno de 32 kbps. O teto de tempo é bom senso,
    // não limite de tamanho, e este teste é o que registra isso.
    const bytesEstimados = (LIMITE_DE_GRAVACAO_S * 32_000) / 8
    expect(bytesEstimados).toBeLessThan(16 * 1024 * 1024)
  })
})

/*
 * -----------------------------------------------------------------------------
 * A armadilha que passou em produção
 * -----------------------------------------------------------------------------
 *
 * Em 15/set/2026 o áudio foi gravado, subiu, a Cloud API respondeu 200, a
 * mensagem foi marcada como entregue, e nada chegou no celular. O arquivo foi
 * aberto byte a byte: `mp4a` e `esds` ausentes, `Opus` e `dOps` presentes. O
 * Chrome tinha gravado Opus dentro de MP4, porque o pedido foi `audio/mp4` sem
 * codec.
 *
 * Estes testes são o que impede isso de voltar.
 */
describe('o codec, que é o que a Meta realmente olha', () => {
  it('nenhum formato é pedido sem `;codecs=`', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      expect(formato.mimeType, `${formato.mimeType} não declara o codec`).toContain(';codecs=')
    }
  })

  /*
   * MP4 saiu da lista por duas falhas medidas no mesmo dia: primeiro o codec
   * (`audio/mp4` sem `;codecs=` deixou o Chrome gravar Opus dentro de MP4),
   * depois o contêiner (o MP4 do MediaRecorder é fragmentado, `stts`, `stsz`
   * e `stco` vazios, `mvhd duration = 0`, e quem lê MP4 progressivo vê zero
   * amostras). Ele não volta.
   */
  it('MP4 não está mais na lista, em nenhuma forma', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      expect(formato.mimeType).not.toContain('mp4')
    }
  })

  it('tudo que se pede é Opus, porque é o que vira OGG sem reencode', () => {
    for (const formato of FORMATOS_DE_GRAVACAO) {
      expect(formato.mimeType.toLowerCase()).toContain('codecs=opus')
      expect(formato.mime).toBe('audio/ogg')
      expect(formato.extensao).toBe('ogg')
    }
  })

  it('só o WebM precisa de remux; o OGG do Firefox já sai pronto', () => {
    const ogg = FORMATOS_DE_GRAVACAO.find((f) => f.mimeType.startsWith('audio/ogg'))
    const webm = FORMATOS_DE_GRAVACAO.find((f) => f.mimeType.startsWith('audio/webm'))
    expect(ogg?.remux).toBe(false)
    expect(webm?.remux).toBe(true)
  })
})

describe('gravouOpus', () => {
  it('aceita Opus declarado, em qualquer um dos dois contêineres', () => {
    expect(gravouOpus('audio/ogg;codecs=opus')).toBe(true)
    expect(gravouOpus('audio/webm;codecs=opus')).toBe(true)
  })

  /*
   * O caso real de 15/set: pedimos um contêiner e o navegador escolheu o codec.
   * Conferir o tipo efetivo é o que transforma isso numa frase na tela em vez
   * de uma mensagem que a Cloud API aceita com 200 e nunca entrega.
   */
  it('recusa o que não é Opus, mesmo em contêiner que a Meta aceita', () => {
    expect(gravouOpus('audio/mp4;codecs=opus')).toBe(true) // é Opus, o remux lida
    expect(gravouOpus('audio/ogg;codecs=vorbis')).toBe(false)
    expect(gravouOpus('audio/mp4;codecs=mp4a.40.2')).toBe(false)
  })

  /*
   * Aqui a omissão NÃO passa: os dois contêineres da lista aceitam mais de um
   * codec, e o remux só sabe ler Opus. Deixar passar seria voltar a adivinhar.
   */
  it('recusa quando o codec não vem declarado', () => {
    expect(gravouOpus('audio/webm')).toBe(false)
    expect(gravouOpus('audio/ogg')).toBe(false)
  })

  it('lida com aspas e espaço, que alguns navegadores põem', () => {
    expect(gravouOpus('audio/webm; codecs="opus"')).toBe(true)
    expect(gravouOpus('audio/webm; codecs="OPUS"')).toBe(true)
  })
})
