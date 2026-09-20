import { Dica } from './dica'

/**
 * O "?" ao lado do título de uma seção.
 *
 * **A explicação sai do corpo e entra aqui.** Blocos como o diário traziam a
 * regra escrita solta ao lado do botão ("Fica só aqui. Não vai para o WhatsApp
 * nem para nenhuma automação."), e essa frase empurrava o "Cancelar" para a
 * linha de baixo, cortado. O aviso é verdadeiro e precisa existir: quem escreve
 * uma anotação precisa saber que ela não vira mensagem. Mas é algo que se lê
 * uma vez, não a cada visita, e por isso mora atrás de um "?" em vez de ocupar
 * a linha para sempre.
 *
 * Usa o `Dica` do produto: aparece no hover **e no foco pelo teclado**, com a
 * mesma tipografia e o mesmo atraso das outras dicas. `alinhar` existe para o
 * caso de o título estar encostado na borda direita, onde um balão centrado
 * vazaria para fora da página.
 */
export function AjudaDoCampo({
  texto,
  alinhar = 'centro',
}: {
  texto: string
  alinhar?: 'centro' | 'direita'
}) {
  return (
    <Dica texto={texto} alinhar={alinhar}>
      <button
        type="button"
        aria-label={texto}
        className="flex size-[15px] items-center justify-center rounded-full border border-line text-[9.5px] font-bold text-dim transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        ?
      </button>
    </Dica>
  )
}
