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
} from './audio-de-voz'
import { TIPOS_ACEITOS } from '@/server/repos/acervo'

/**
 * Estes testes existem porque o modo de falha desta funcionalidade é silencioso
 * e distante: o formato errado sobe, grava mensagem, e só a Meta recusa — com o
 * erro aparecendo na conversa de um cliente. Aqui a regra é conferida sem
 * navegador, sem microfone e sem rede.
 */

/** O que cada navegador responde a `MediaRecorder.isTypeSupported`. */
const NAVEGADORES = {
  chrome: ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm', 'audio/webm;codecs=opus'],
  safari: ['audio/mp4'],
  firefox: ['audio/ogg', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/webm;codecs=opus'],
  chromeAntigo: ['audio/webm', 'audio/webm;codecs=opus'],
}

const suporte = (lista: string[]) => (m: string) => lista.includes(m)

describe('escolherFormato', () => {
  it('no Chrome e no Safari escolhe MP4, que a Meta lista como .m4a', () => {
    expect(escolherFormato(suporte(NAVEGADORES.chrome))?.mime).toBe('audio/mp4')
    expect(escolherFormato(suporte(NAVEGADORES.safari))?.mime).toBe('audio/mp4')
  })

  it('no Firefox escolhe OGG pedindo Opus explicitamente', () => {
    const formato = escolherFormato(suporte(NAVEGADORES.firefox))
    expect(formato?.mime).toBe('audio/ogg')
    /*
     * A letra miúda da Meta: "OPUS codecs only; base audio/ogg not supported".
     * `audio/ogg` sozinho sai em Vorbis no Firefox, e a Meta recusa.
     */
    expect(formato?.mimeType).toBe('audio/ogg;codecs=opus')
  })

  it('recusa quando só há WebM, que a Meta não aceita', () => {
    expect(escolherFormato(suporte(NAVEGADORES.chromeAntigo))).toBeNull()
  })

  it('nunca devolve WebM, mesmo se o navegador disser que suporta tudo', () => {
    const formato = escolherFormato(() => true)
    expect(formato?.mime).not.toContain('webm')
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
    // não limite de tamanho — e este teste é o que registra isso.
    const bytesEstimados = (LIMITE_DE_GRAVACAO_S * 32_000) / 8
    expect(bytesEstimados).toBeLessThan(16 * 1024 * 1024)
  })
})
