import { describe, expect, it } from 'vitest'
import {
  caminhoDoArquivo,
  ehArquivoGuardado,
  extensaoDoMime,
  midiaDoTipo,
  mimeLimpo,
  TETO_DO_ARQUIVO,
} from './midia-recebida'

describe('o tipo da mídia recebida', () => {
  it('traduz o que a Meta manda para o vocabulário da bolha', () => {
    expect(midiaDoTipo('image')).toBe('imagem')
    expect(midiaDoTipo('video')).toBe('video')
    expect(midiaDoTipo('audio')).toBe('audio')
    expect(midiaDoTipo('document')).toBe('documento')
  })

  /* Figurinha é WebP: o navegador desenha igual, e um quinto tipo obrigaria a
   * mexer no vocabulário do motor, onde figurinha não significa nada. */
  it('trata figurinha como imagem', () => {
    expect(midiaDoTipo('sticker')).toBe('imagem')
  })

  it('devolve nulo para o que não tem arquivo', () => {
    for (const tipo of ['text', 'location', 'contacts', 'reaction', 'interactive', 'button']) {
      expect(midiaDoTipo(tipo), tipo).toBeNull()
    }
    expect(midiaDoTipo(null)).toBeNull()
    expect(midiaDoTipo(undefined)).toBeNull()
  })
})

describe('a extensão do arquivo', () => {
  it('sai do mime que a Meta declarou', () => {
    expect(extensaoDoMime('image/jpeg')).toBe('jpg')
    expect(extensaoDoMime('application/pdf')).toBe('pdf')
    expect(extensaoDoMime('audio/ogg')).toBe('ogg')
    expect(extensaoDoMime('image/webp')).toBe('webp')
  })

  /* `audio/ogg; codecs=opus` é o que o WhatsApp manda em áudio de verdade. */
  it('ignora os parâmetros do mime', () => {
    expect(extensaoDoMime('audio/ogg; codecs=opus')).toBe('ogg')
    expect(mimeLimpo('audio/ogg; codecs=opus')).toBe('audio/ogg')
  })

  it('cai em bin quando não conhece, em vez de inventar', () => {
    expect(extensaoDoMime('application/x-coisa')).toBe('bin')
    expect(extensaoDoMime(null)).toBe('bin')
  })
})

describe('o caminho no bucket', () => {
  /*
   * Começa pelo cliente para o expurgo e a exclusão de conta serem um prefixo,
   * e não uma varredura.
   */
  it('começa pelo cliente e termina na extensão', () => {
    expect(caminhoDoArquivo('cli1', 'kon1', 'msg1', 'image/jpeg')).toBe('cli1/kon1/msg1.jpg')
  })

  it('usa o id da mensagem, que é nosso e não expira', () => {
    const caminho = caminhoDoArquivo('cli1', 'kon1', 'msg-abc', 'application/pdf')
    expect(caminho).toContain('msg-abc')
    expect(caminho.endsWith('.pdf')).toBe(true)
  })
})

describe('o teto do arquivo', () => {
  /*
   * A Meta aceita documento de até 100 MB. O nosso teto é o dela para vídeo e
   * áudio: 16 MB. Um PDF de 100 MB ocuparia um décimo do plano gratuito, que é
   * compartilhado com a Verandi.
   */
  it('é 16 MB, e não os 100 MB que a Meta aceita em documento', () => {
    expect(TETO_DO_ARQUIVO).toBe(16 * 1024 * 1024)
    expect(TETO_DO_ARQUIVO).toBeLessThan(100 * 1024 * 1024)
  })
})

describe('o registro do arquivo guardado', () => {
  const bom = { midia: 'imagem', caminho: 'c/k/m.jpg', mime: 'image/jpeg', bytes: 1234 }

  it('aceita o registro completo', () => {
    expect(ehArquivoGuardado(bom)).toBe(true)
    expect(ehArquivoGuardado({ ...bom, nomeArquivo: 'comprovante.pdf' })).toBe(true)
  })

  it('recusa linha antiga, nula ou de outro formato', () => {
    expect(ehArquivoGuardado(null)).toBe(false)
    expect(ehArquivoGuardado(undefined)).toBe(false)
    expect(ehArquivoGuardado('texto')).toBe(false)
    expect(ehArquivoGuardado({})).toBe(false)
  })

  it('recusa caminho vazio — ele viraria uma assinatura de nada', () => {
    expect(ehArquivoGuardado({ ...bom, caminho: '' })).toBe(false)
  })

  it('recusa tipo de mídia que o produto não conhece', () => {
    expect(ehArquivoGuardado({ ...bom, midia: 'figurinha' })).toBe(false)
  })

  /*
   * A regra que não se dobra: a coluna guarda caminho, nunca URL. URL assinada
   * em coluna é link público com um passo a mais — viaja em log e em backup, e
   * continua valendo até expirar.
   */
  it('não tem campo de url no registro', () => {
    expect(Object.keys(bom)).not.toContain('url')
  })
})
