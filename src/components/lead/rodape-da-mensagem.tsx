'use client'

import { useState } from 'react'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { useCitacao } from '@/components/lead/citacao'
import { acaoReagir } from '@/server/acoes-reacao'
import { acaoFavoritarMensagem } from '@/server/acoes-marcadores'

/**
 * O que fica pendurado embaixo da bolha: as reações e os três botões.
 *
 * ---------------------------------------------------------------------------
 * Por que as duas coisas moram no mesmo componente
 * ---------------------------------------------------------------------------
 *
 * Antes eram dois: `ReacoesNaBolha` desenhava no servidor e `AcoesDaMensagem`
 * clicava no cliente. Funcionava, e era lento de um jeito que a tela não tinha
 * como esconder: clicar no emoji mandava para o servidor, que mandava para a
 * Meta, que respondia, e só então o `revalidatePath` refazia a página e a
 * reação aparecia. Segundos, para um clique que o WhatsApp resolve na hora.
 *
 * Para a reação aparecer antes da resposta, quem a desenha tem que ser quem
 * a clicou. Por isso os dois viraram um.
 *
 * ---------------------------------------------------------------------------
 * Reagir é otimista, e enviar mensagem continua não sendo
 * ---------------------------------------------------------------------------
 *
 * `acao-otimista.ts` diz, com razão, que nada que sai do sistema deve ser
 * otimista: fingir que uma mensagem saiu é mentir sobre algo que outra pessoa
 * ia receber. **Reagir é a exceção, e ela é estreita de propósito:**
 *
 * - A reação é um comentário sobre uma mensagem que já existe, não uma
 *   afirmação nova na conversa.
 * - Se a Meta recusar, o emoji **volta** e o erro aparece ali do lado. A janela
 *   em que a tela mostrou algo que não existiu dura o tempo de uma requisição,
 *   e o estado que sobra é o certo.
 * - É o que o próprio WhatsApp faz. Esperar aqui não é honestidade: é uma tela
 *   que parece quebrada, e leva a pessoa a clicar de novo.
 *
 * Mandar texto, foto ou áudio segue esperando o servidor. A diferença é o que
 * está em jogo quando erra.
 */

/** Uma reação já grudada nesta mensagem, como o servidor a leu. */
type ReacaoNaBolha = {
  emoji: string
  de: 'entrada' | 'saida'
  id: string
}

/** Os seis do WhatsApp, na ordem dele. */
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

const BOTAO =
  'rounded-full border border-line bg-surface px-1.5 py-0.5 text-[10px] leading-none text-muted transition hover:border-primary/40 hover:text-primary'

export function RodapeDaMensagem({
  clienteId,
  contatoId,
  waMessageId,
  podeReagir,
  reacoes,
  nome,
  texto,
  deQuem,
  nossa,
  mensagemId,
  favorita,
}: {
  clienteId: string
  contatoId: string
  /** `null` = saída ainda não confirmada: sem id da Meta não dá para reagir nem citar. */
  waMessageId: string | null
  /** `false` = passou dos 30 dias. Só o reagir some; citar continua. */
  podeReagir: boolean
  reacoes: ReacaoNaBolha[]
  /** Como chamar quem está do outro lado, no `title` da reação dela. */
  nome: string | null
  texto: string | null
  /** Como nomear o autor na prévia da citação: "ao atendimento" ou o nome dela. */
  deQuem: string
  nossa: boolean
  /**
   * O id **interno** da mensagem (`messages.id`), que é o que a estrela guarda.
   *
   * Não é o `waMessageId`: o da Meta é texto, some na saída ainda não
   * confirmada e não tem chave estrangeira para nada. Ver a 0063.
   */
  mensagemId: string
  /** Se **eu** já guardei esta mensagem. */
  favorita: boolean
}) {
  const [aberto, setAberto] = useState(false)
  /** `null` fora do provedor, a tela que não monta citação ainda reage. */
  const citacao = useCitacao()

  /*
   * A nossa reação é o único pedaço deste rodapé que muda por clique daqui, e
   * por isso é o único que vira estado. A da outra pessoa chega por webhook e
   * continua sendo verdade do servidor.
   */
  const daOutraPessoa = reacoes.filter((r) => r.de === 'entrada')
  const nossaDoServidor = reacoes.find((r) => r.de === 'saida')?.emoji ?? null
  const { valor: minhaReacao, erro, agir, limparErro } = useAcaoOtimista<string | null>(nossaDoServidor)

  /*
   * A estrela tem otimismo próprio, e não divide o de `agir`.
   *
   * Um estado só para as duas faria o erro de uma aparecer do lado da outra, e
   * desfazer a reação ao falhar o favorito. São gestos independentes: dá para
   * reagir e guardar a mesma mensagem, na ordem que for.
   *
   * Guardar é otimista pela razão oposta à de enviar mensagem: nada sai do
   * sistema. Se o servidor recusar, a estrela volta e ninguém do outro lado
   * chegou a ver nada.
   */
  const {
    valor: guardada,
    erro: erroDaEstrela,
    agir: agirNaEstrela,
  } = useAcaoOtimista<boolean>(favorita)

  function reagir(emoji: string) {
    if (!waMessageId) return
    setAberto(false)

    /*
     * Clicar no emoji que já está lá **remove**, string vazia é como a Meta
     * desfaz uma reação. Sem isto, reagir de novo com o mesmo emoji seria uma
     * ação sem efeito visível, e não haveria caminho nenhum para tirar.
     */
    const escolhido = emoji === minhaReacao ? '' : emoji

    agir(escolhido === '' ? null : escolhido, () =>
      acaoReagir(clienteId, contatoId, { waMessageId, emoji: escolhido }),
    )
  }

  const chips = [
    ...daOutraPessoa.map((r) => ({ chave: r.id, emoji: r.emoji, dono: nome ?? 'cliente' })),
    ...(minhaReacao ? [{ chave: 'nossa', emoji: minhaReacao, dono: 'atendimento' }] : []),
  ]

  return (
    <span className={`-mt-1 flex flex-wrap items-center gap-1 ${nossa ? 'flex-row-reverse' : ''}`}>
      {/*
        As reações ficam **fora** da bolha, encostadas na borda de baixo, como
        no WhatsApp: a reação comenta a mensagem, não faz parte dela. Dentro,
        viraria parte do texto, e a diferença importa quando a mensagem é
        longa.
      */}
      {chips.map((chip) => (
        <span
          key={chip.chave}
          title={`${chip.dono} reagiu`}
          className="rounded-full border border-line bg-panel px-1.5 py-0.5 text-[11px] leading-none shadow-[0_1px_2px_rgba(19,25,34,0.055)]"
        >
          {chip.emoji}
        </span>
      ))}

      {waMessageId && (
        /*
         * A barra fica **sempre visível**, e não no hover.
         *
         * Havia aqui um comentário descrevendo uma barra que aparecia ao
         * passar o mouse, com `opacity` e `focus-within`, e esse CSS nunca
         * existiu. Ficar visível é o certo de qualquer jeito: quem usa no
         * celular não tem hover, e quem navega por teclado descobriria o botão
         * só depois de chegar nele.
         */
        <span className={`relative flex items-center gap-1 ${nossa ? 'flex-row-reverse' : ''}`}>
          {citacao && (
            <button
              type="button"
              onClick={() => citacao.citar({ waMessageId, texto, deQuem })}
              title="Responder citando"
              aria-label="Responder citando esta mensagem"
              className={BOTAO}
            >
              ↩
            </button>
          )}

          {podeReagir && (
            <button
              type="button"
              onClick={() => {
                limparErro()
                setAberto((a) => !a)
              }}
              title="Reagir"
              aria-label="Reagir a esta mensagem"
              aria-expanded={aberto}
              className={BOTAO}
            >
              ☺
            </button>
          )}

          {aberto && (
            <span
              role="menu"
              className={`absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-line bg-panel px-1.5 py-1 shadow-[0_4px_16px_rgba(19,25,34,0.099)] ${nossa ? 'right-0' : 'left-0'}`}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  onClick={() => reagir(emoji)}
                  title={emoji === minhaReacao ? 'Tirar a reação' : `Reagir com ${emoji}`}
                  className={`rounded-full px-1 py-0.5 text-[14px] leading-none transition hover:scale-125 ${emoji === minhaReacao ? 'bg-primary/25' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </span>
          )}
        </span>
      )}

      {/*
        A estrela mora **fora** do bloco guardado por `waMessageId`.

        Citar e reagir precisam do id da Meta; guardar não. Deixá-la lá dentro
        esconderia o botão exatamente na saída recém-escrita, que é uma das
        mensagens que mais se quer guardar.
      */}
      <button
        type="button"
        onClick={() =>
          agirNaEstrela(!guardada, () =>
            acaoFavoritarMensagem(clienteId, mensagemId, !guardada),
          )
        }
        title={guardada ? 'Tirar das guardadas' : 'Guardar esta mensagem'}
        aria-label={guardada ? 'Tirar esta mensagem das guardadas' : 'Guardar esta mensagem'}
        aria-pressed={guardada}
        className={`${BOTAO} ${guardada ? 'border-primary/40 text-primary' : ''}`}
      >
        {guardada ? '★' : '☆'}
      </button>

      {(erro || erroDaEstrela) && (
        <span className="max-w-[220px] text-[10px] leading-4 text-perigo" role="alert">
          {erro ?? erroDaEstrela}
        </span>
      )}
    </span>
  )
}
