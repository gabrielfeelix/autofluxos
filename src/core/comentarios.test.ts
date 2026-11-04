import { describe, expect, it } from 'vitest'
import { escolherResposta, lerPalavras } from './comentarios'

const regra = (id: string, palavras: string[], postId: string | null = null, ativo = true) => ({
  id,
  palavras,
  postId,
  ativo,
})

describe('escolherResposta', () => {
  it('casa palavra inteira, sem acento e sem maiúscula', () => {
    const r = [regra('a', ['promoção'])]
    expect(escolherResposta(r, { postId: 'p1', texto: 'Quero a PROMOCAO!' })?.id).toBe('a')
    expect(escolherResposta([regra('b', ['pix'])], { postId: 'p1', texto: 'meu pixel' })).toBeNull()
  })

  it('o post exato ganha de "todos os posts"', () => {
    const r = [regra('todos', ['link']), regra('post', ['link'], 'p1')]
    expect(escolherResposta(r, { postId: 'p1', texto: 'manda o link' })?.id).toBe('post')
    expect(escolherResposta(r, { postId: 'p2', texto: 'manda o link' })?.id).toBe('todos')
  })

  it('palavra ganha de "qualquer comentário", e qualquer comentário pega o resto', () => {
    const r = [regra('qualquer', []), regra('preco', ['preço'])]
    expect(escolherResposta(r, { postId: 'p1', texto: 'qual o preço?' })?.id).toBe('preco')
    expect(escolherResposta(r, { postId: 'p1', texto: 'lindo!' })?.id).toBe('qualquer')
  })

  it('desligada não responde', () => {
    expect(escolherResposta([regra('a', ['eu quero'], null, false)], { postId: 'p', texto: 'eu quero' })).toBeNull()
  })
})

describe('lerPalavras', () => {
  it('separa por vírgula e linha, tira repetida e vazia', () => {
    expect(lerPalavras('eu quero, Link\nlink, ,  quero   muito ')).toEqual(['eu quero', 'Link', 'quero muito'])
  })
})
