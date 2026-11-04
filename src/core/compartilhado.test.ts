import { describe, expect, it } from 'vitest'
import { compartilhadoDoPayload, ehArquivoDaMeta, embedDoInstagram, tipoDoLinkDoInstagram } from './compartilhado'

describe('ehArquivoDaMeta', () => {
  it('aceita só CDN da Meta e o Giphy, em https', () => {
    expect(ehArquivoDaMeta('https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1')).toBe(true)
    expect(ehArquivoDaMeta('https://scontent.xx.fbcdn.net/v/t1.jpg')).toBe(true)
    expect(ehArquivoDaMeta('https://scontent-gru.cdninstagram.com/a.mp4')).toBe(true)
    expect(ehArquivoDaMeta('https://media3.giphy.com/media/x/giphy.gif')).toBe(true)
    expect(ehArquivoDaMeta('http://lookaside.fbsbx.com/x')).toBe(false)
    expect(ehArquivoDaMeta('https://www.instagram.com/reel/abc/')).toBe(false)
    expect(ehArquivoDaMeta('https://fbsbx.com.evil.test/x')).toBe(false)
    expect(ehArquivoDaMeta('https://169.254.169.254/latest')).toBe(false)
    expect(ehArquivoDaMeta(undefined)).toBe(false)
  })
})

describe('tipoDoLinkDoInstagram', () => {
  it('lê reel, post e story pelo caminho', () => {
    expect(tipoDoLinkDoInstagram('https://www.instagram.com/reel/abc/')).toBe('reel')
    expect(tipoDoLinkDoInstagram('https://instagram.com/reels/abc')).toBe('reel')
    expect(tipoDoLinkDoInstagram('https://www.instagram.com/p/abc/')).toBe('post')
    expect(tipoDoLinkDoInstagram('https://www.instagram.com/stories/conta/1/')).toBe('story')
    expect(tipoDoLinkDoInstagram('https://www.instagram.com/conta/')).toBeNull()
    expect(tipoDoLinkDoInstagram('https://notinstagram.com/reel/abc')).toBeNull()
  })
})

describe('compartilhadoDoPayload', () => {
  it('devolve o cartão validado e descarta link que não é http', () => {
    expect(compartilhadoDoPayload({ compartilhado: { tipo: 'reel', url: 'https://www.instagram.com/reel/a/' } })).toEqual({
      tipo: 'reel',
      url: 'https://www.instagram.com/reel/a/',
    })
    expect(compartilhadoDoPayload({ compartilhado: { tipo: 'post', url: 'javascript:alert(1)' } })).toEqual({ tipo: 'post' })
    expect(compartilhadoDoPayload({ compartilhado: { tipo: 'outro' } })).toBeNull()
    expect(compartilhadoDoPayload({ type: 'video' })).toBeNull()
  })
})

describe('embedDoInstagram', () => {
  it('monta o player oficial de reel e post, e recusa o resto', () => {
    expect(embedDoInstagram('https://www.instagram.com/reel/DfDWVlSJslQ/')).toBe('https://www.instagram.com/reel/DfDWVlSJslQ/embed/')
    expect(embedDoInstagram('https://instagram.com/reels/abc_1-2?igsh=x')).toBe('https://www.instagram.com/reel/abc_1-2/embed/')
    expect(embedDoInstagram('https://www.instagram.com/p/Cxyz/')).toBe('https://www.instagram.com/p/Cxyz/embed/')
    expect(embedDoInstagram('https://www.instagram.com/stories/conta/1/')).toBeNull()
    expect(embedDoInstagram('https://evil.test/reel/abc/')).toBeNull()
    expect(embedDoInstagram(undefined)).toBeNull()
  })
})
