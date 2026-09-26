import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { lerFicha, listasDoRamo, marcadasDaLista, placarDaFicha } from '@/core/ficha-do-assistente'
import { PACOTES } from '@/core/nichos'
import { FichaDoAssistente } from './ficha-do-assistente'

const TEXTO = 'Estúdio Exemplo.\n\n== HORÁRIOS DE FUNCIONAMENTO ==\nSegunda a sexta.\n\n== NOSSA EQUIPE ==\nTrês professoras.'

function desenhar() {
  const { perguntas, pode } = PACOTES.aulas.ficha
  const ficha = lerFicha(TEXTO, perguntas)
  const listas = listasDoRamo(pode)
  const placar = placarDaFicha(ficha, perguntas)
  return renderToStaticMarkup(
    <FichaDoAssistente
      perguntas={perguntas}
      listas={listas}
      ficha={ficha}
      marcadas={{
        pode: marcadasDaLista(listas[0]!, ficha.listas.pode),
        nunca: marcadasDaLista(listas[1]!, ficha.listas.nunca),
        passar: marcadasDaLista(listas[2]!, ficha.listas.passar),
      }}
      placar={{ ...placar, faltam: placar.faltam.map((p) => p.titulo.toLowerCase()) }}
      salvar={async () => ({})}
      testar={async () => ({})}
    />,
  )
}

describe('a ficha na tela', () => {
  it('mostra o placar, as perguntas do ramo e o texto que já estava salvo', () => {
    const html = desenhar()
    expect(html).toContain(`O assistente responde 1 de ${PACOTES.aulas.ficha.perguntas.length} perguntas comuns`)
    expect(html).toContain('Tem aula experimental? Como funciona?')
    expect(html).toContain('Segunda a sexta.')
    // O bloco que a ficha não conhece aparece em "Mais alguma coisa", sem se perder.
    expect(html).toContain('== NOSSA EQUIPE ==')
  })

  it('as opções de segurança vêm marcadas e travadas', () => {
    const html = desenhar()
    expect(html).toMatch(/disabled="" name="lista:nunca" checked="" value="Pedir número de cartão, senha ou código"/)
  })
})
