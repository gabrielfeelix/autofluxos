import { describe, expect, it } from 'vitest'
import { houveRascunho, PERGUNTA_DESCARTAR, type ValorDeCampo } from './rascunho-do-modal'

/**
 * O cenário que falha, e que a T7.4 existe para consertar:
 *
 * alguém abre "Novo anúncio", digita o nome da campanha e o texto de boas
 * vindas, encosta o mouse fora do modal e clica. O `ModalFormulario` chamava
 * `close()` direto ali, e o digitado ia embora **sem uma palavra**. O mesmo
 * valia para `Esc` e para o "Cancelar".
 *
 * O outro lado é igualmente importante e é o que impede a correção de virar
 * praga: quem abre o modal por engano e fecha não pode ser interrogado.
 */

function mapa(o: Record<string, ValorDeCampo>) {
  return new Map(Object.entries(o))
}

describe('houveRascunho', () => {
  it('modal aberto e fechado sem toque nenhum não pergunta nada', () => {
    const inicial = mapa({ nome: '', texto: '' })
    expect(houveRascunho(mapa({ nome: '', texto: '' }), inicial)).toBe(false)
  })

  it('um campo digitado já basta para perguntar', () => {
    const inicial = mapa({ nome: '', texto: '' })
    expect(houveRascunho(mapa({ nome: 'Campanha de maio', texto: '' }), inicial)).toBe(true)
  })

  it('no modal de edição, campo preenchido que ninguém tocou não é rascunho', () => {
    // Este é o caso que "diferente de vazio" erraria: em edição todo campo nasce
    // cheio, e a pergunta apareceria em toda desistência.
    const inicial = mapa({ nome: 'Etiqueta antiga', cor: '#ff0000' })
    expect(houveRascunho(mapa({ nome: 'Etiqueta antiga', cor: '#ff0000' }), inicial)).toBe(false)
  })

  it('em edição, mudar o que já estava lá é rascunho', () => {
    const inicial = mapa({ nome: 'Etiqueta antiga' })
    expect(houveRascunho(mapa({ nome: 'Etiqueta nova' }), inicial)).toBe(true)
  })

  it('apagar o que estava preenchido também é rascunho', () => {
    // Apagar é uma edição como outra qualquer: fechar depois perde o gesto.
    const inicial = mapa({ nome: 'Etiqueta antiga' })
    expect(houveRascunho(mapa({ nome: '' }), inicial)).toBe(true)
  })

  it('espaço em branco não é digitação', () => {
    const inicial = mapa({ nome: '' })
    expect(houveRascunho(mapa({ nome: '   ' }), inicial)).toBe(false)
    expect(houveRascunho(mapa({ nome: '\n\t ' }), inicial)).toBe(false)
  })

  it('arquivo escolhido é rascunho, e nenhum arquivo é o estado de partida', () => {
    // Todo `input type=file` vazio devolve um `File` de tamanho zero no
    // `FormData`: sem esta distinção, o modal de logo perguntaria sempre.
    const vazio = new File([], '')
    const escolhido = new File(['conteudo'], 'logo.png')

    expect(houveRascunho(mapa({ logo: vazio }), mapa({ logo: vazio }))).toBe(false)
    expect(houveRascunho(mapa({ logo: escolhido }), mapa({ logo: vazio }))).toBe(true)
  })

  it('campo que sumiu do formulário não é digitação da pessoa', () => {
    // Um `select` que troca os campos visíveis muda a forma do formulário
    // sozinho. Perguntar ali seria acusar quem não digitou.
    const inicial = mapa({ tipo: 'texto', corpo: 'oi' })
    expect(houveRascunho(mapa({ tipo: 'texto' }), inicial)).toBe(false)
  })

  it('campo novo em branco não é digitação', () => {
    const inicial = mapa({ tipo: 'texto' })
    expect(houveRascunho(mapa({ tipo: 'texto', corpo: '' }), inicial)).toBe(false)
  })
})

describe('a pergunta', () => {
  it('diz o que se perde, e não só "tem certeza?"', () => {
    // O texto é a parte útil da confirmação: quem lê "Tem certeza?" clica em OK
    // sem saber que estava prestes a perder o que escreveu.
    expect(PERGUNTA_DESCARTAR).toContain('descarta')
    expect(PERGUNTA_DESCARTAR).not.toContain('—')
  })
})
