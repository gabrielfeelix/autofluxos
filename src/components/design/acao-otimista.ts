'use client'

import { useState, useTransition } from 'react'

/**
 * O clique muda a tela agora; o servidor confirma atrás.
 *
 * ---------------------------------------------------------------------------
 * Por que isto existe
 * ---------------------------------------------------------------------------
 *
 * Medido em 13/set/2026: o banco responde em ~200ms e a aplicação em ~130ms,
 * os dois em São Paulo. Mesmo assim criar uma etiqueta levava segundos. A
 * causa não era infraestrutura — era `revalidatePath`, que refaz a página
 * inteira no servidor (no Inbox são sete consultas) **antes** de a tela mudar.
 * Uma escrita de vinte milissegundos virava dois segundos de espera.
 *
 * O `SeletorDeEtiquetas` já resolvia isso à mão, e o comentário de lá dizia o
 * essencial: *"Esperar o servidor faria cada clique parecer que não
 * funcionou."* Estava certo, e estava num componente só. Este hook é aquele
 * padrão virando o jeito padrão de escrever botão neste produto.
 *
 * ---------------------------------------------------------------------------
 * Quando NÃO usar
 * ---------------------------------------------------------------------------
 *
 * Otimismo é uma aposta de que a escrita vai dar certo, e ela custa quando
 * erra: a tela mostrou, por um instante, um estado que não existiu.
 *
 * - **Nada que saia do sistema.** Enviar mensagem no WhatsApp não pode ser
 *   otimista: fingir que saiu é mentir sobre algo que outra pessoa ia receber.
 * - **Nada destrutivo.** Apagar contato, remover da conta. Desfazer na tela
 *   não desfaz o susto, e o certo ali é confirmar antes.
 * - **Nada demorado por natureza.** Importar planilha é lote, não clique.
 *
 * Para esses, o certo é a Camada 4: mostrar que está acontecendo.
 */

export type ResultadoDaAcao = { ok?: boolean; erro?: string }

/**
 * Aplica `otimista`, chama a ação, e **desfaz se ela recusar**.
 *
 * O estado devolvido é o que a tela deve desenhar: `valor` já contém a aposta.
 * `pendente` existe para desabilitar o botão — não para trocar o rótulo por
 * "…", que reintroduziria na tela a espera que este hook existe para esconder.
 *
 * @param inicial o valor que veio do servidor.
 */
export function useAcaoOtimista<T>(inicial: T) {
  const [valor, setValor] = useState<T>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()

  /**
   * `anterior` é capturado **antes** de aplicar o otimismo, e não relido do
   * estado dentro do `catch`: quando a resposta chega, `valor` já é o novo, e
   * desfazer para ele seria não desfazer nada.
   */
  const agir = (otimista: T, acao: () => Promise<ResultadoDaAcao>) => {
    const anterior = valor
    setErro(null)
    setValor(otimista)

    comecar(async () => {
      try {
        const r = await acao()
        // `ok` ausente com `erro` ausente é sucesso: várias ações deste
        // produto devolvem só `{ erro }` quando falham.
        if (r?.erro || r?.ok === false) {
          setValor(anterior)
          setErro(r.erro ?? 'não deu para salvar')
        }
      } catch {
        // Rede caiu no meio. A escrita pode ter acontecido — mas a tela não
        // pode afirmar o que não sabe, e o servidor é quem tem a resposta na
        // próxima leitura.
        setValor(anterior)
        setErro('sem conexão com o servidor')
      }
    })
  }

  return { valor, erro, pendente, agir, limparErro: () => setErro(null) }
}
