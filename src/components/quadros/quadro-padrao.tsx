'use client'

import { useState, useTransition } from 'react'
import { PilulaInterruptor } from '@/components/inbox/pilulas'
import { acaoDefinirQuadroPadrao } from '@/server/acoes'

/**
 * A caixa "novo contato entra aqui" do cabeçalho do quadro (0043).
 *
 * **É a única parte visível da automação, e por isso ela diz o que faz e não
 * como se chama.** "Quadro padrão" não significa nada para quem abre a tela;
 * "novo contato entra aqui" responde a pergunta que a pessoa tem.
 *
 * **A caixa não liga mais a automação — ela escolhe o destino.** Lead novo cai
 * no funil sempre: sem ninguém marcar nada, vai para o quadro mais antigo da
 * conta. Marcar serve para dizer "prefiro aquele outro". A versão anterior era
 * opt-in e o resultado foi que, com cinco quadros em produção, nenhum estava
 * marcado — e lead nenhum entrava em lugar nenhum.
 *
 * Daí `recebePorSerOPrimeiro`: um quadro que recebe sem estar marcado precisa
 * dizer isso na tela. Caixa desmarcada num quadro que recebe do mesmo jeito é
 * a tela mentindo sobre o produto — e é justamente o tipo de mentira que faz
 * alguém concluir que o recurso está quebrado.
 *
 * O estado é otimista porque a marcação é um clique cujo efeito só aparece na
 * próxima mensagem que chegar — sem resposta imediata, a caixa parece não ter
 * funcionado e a pessoa clica de novo. Erro volta ao valor anterior e diz o
 * motivo, em vez de deixar a tela mentindo.
 */
export function QuadroPadrao({
  clienteId,
  quadroId,
  padraoInicial,
  recebePorSerOPrimeiro = false,
}: {
  clienteId: string
  quadroId: string
  padraoInicial: boolean
  /** Nenhum quadro marcado na conta e este é o mais antigo: recebe assim mesmo. */
  recebePorSerOPrimeiro?: boolean
}) {
  const [padrao, setPadrao] = useState(padraoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()

  // Trocar de quadro reusa o componente com outra prop: sem isto a caixa
  // continuaria mostrando a marcação do quadro anterior.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(padraoInicial)
  if (ultimoDoServidor !== padraoInicial) {
    setUltimoDoServidor(padraoInicial)
    setPadrao(padraoInicial)
  }

  function alternar(marcado: boolean) {
    setPadrao(marcado)
    setErro(null)
    comecar(async () => {
      const r = await acaoDefinirQuadroPadrao(clienteId, quadroId, marcado)
      if (!r.ok) {
        setPadrao(!marcado)
        setErro(r.erro ?? 'não deu para salvar')
      }
    })
  }

  // Recebe de fato: marcado, ou o mais antigo quando ninguém marcou nada.
  const recebendo = padrao || recebePorSerOPrimeiro

  return (
    /*
      **É um interruptor, e não uma caixa de formulário.** Ele nasceu como
      `<input type="checkbox">` dentro de um chip e ficava ao lado de um
      dropdown no mesmo cabeçalho — dois controles com a mesma função de
      "escolher" e dois desenhos diferentes. O interruptor do Inbox é o
      controle da casa para ligar e desligar coisa, e usar o mesmo aqui é o que
      faz as duas telas parecerem um produto só.
    */
    <PilulaInterruptor
      rotulo={erro ?? 'Novo contato entra aqui'}
      titulo={
        recebePorSerOPrimeiro && !padrao
          ? 'Contato novo entra aqui por ser o quadro mais antigo da conta. Marque outro quadro para mudar o destino.'
          : 'Quando alguém escreve pela primeira vez, o contato vira cartão na primeira etapa deste quadro. Só um quadro por conta pode receber.'
      }
      ligada={recebendo}
      desabilitada={pendente}
      aoAlternar={() => alternar(!recebendo)}
    />
  )
}
