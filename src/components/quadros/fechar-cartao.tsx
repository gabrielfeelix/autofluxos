'use client'

import { useRef, useState, useTransition } from 'react'
import { LIMITE_DO_TITULO } from '@/core/crm'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { acaoFecharCartao } from '@/server/acoes-crm'

/**
 * Ganhar e perder, no mesmo modal.
 *
 * O que muda entre os dois é uma assimetria de propósito: **ganhar aceita
 * seguir sem valor, perder não segue sem motivo**. O valor às vezes só se sabe
 * depois, e exigir um número faria alguém digitar 1 para poder fechar; o motivo
 * é a única razão de registrar a perda, opcional, ele produziria um relatório
 * com 80% de "não informado", que é o mesmo que não ter registrado nada.
 */
export function FecharCartao({
  clienteId,
  cartao,
  situacao,
  motivos,
  aoFechar,
  aoConcluir,
}: {
  clienteId: string
  cartao: { id: string; nome: string; titulo?: string | null; valor?: number | null } | null
  situacao: 'ganha' | 'perdida'
  motivos: { id: string; nome: string }[]
  aoFechar: () => void
  aoConcluir: (resultado: { abriuEm?: string }) => void
}) {
  /*
   * Os campos nascem do cartão, e quem os reseta é a `key` de quem renderiza
   * este modal, não um efeito. Copiar prop para estado dentro de `useEffect`
   * pinta uma vez com o valor do cartão anterior antes de corrigir, que aqui
   * seria o valor da venda passada aparecendo na venda nova.
   */
  const [titulo, setTitulo] = useState(cartao?.titulo ?? '')
  const [valor, setValor] = useState(
    cartao?.valor != null ? String(cartao.valor).replace('.', ',') : '',
  )
  const [motivo, setMotivo] = useState(motivos[0]?.nome ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  // Vive e morre com o formulário, pela mesma `key` que reseta os campos.
  const chave = useRef<string | null>(null)

  const ganhou = situacao === 'ganha'

  return (
    <Modal
      aberto={cartao !== null}
      aoFechar={aoFechar}
      titulo={ganhou ? `Ganhar, ${cartao?.nome ?? ''}` : `Perder, ${cartao?.nome ?? ''}`}
      descricao={
        ganhou
          ? 'O cartão fica no quadro, marcado como ganho, e o contato passa a ser cliente. Se este funil entrega a outro, o cartão de lá abre sozinho.'
          : 'O cartão fica no quadro, marcado como perdido. O contato continua na lista e na conversa, perder não apaga ninguém.'
      }
    >
      {ganhou ? (
        <div className="flex flex-col gap-3">
          <label>
            <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
              O que foi vendido
            </span>
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={LIMITE_DO_TITULO}
              placeholder="ex.: Plano trimestral"
              className="app-field w-full px-3 py-2.5 text-[12.5px]"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
              Valor <span className="font-normal normal-case">(opcional)</span>
            </span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="ex.: 1.500 ou 89,90"
              className="app-field w-full px-3 py-2.5 text-[12.5px]"
            />
          </label>
        </div>
      ) : (
        <div>
          <span className="mb-1 block text-[11.5px] font-semibold text-soft">Por que perdemos</span>
          <Dropdown
            rotuloAcessivel="Motivo da perda"
            valor={motivo}
            aoMudar={setMotivo}
            className="w-full"
            opcoes={motivos.map((m) => ({ valor: m.nome, rotulo: m.nome }))}
          />
          <span className="mt-1.5 block text-[11px] leading-4 text-dim">
            A lista é da conta, e é curta de propósito: motivo digitado à mão vira
            &ldquo;preço&rdquo;, &ldquo;Preço&rdquo; e &ldquo;achou caro&rdquo; como três coisas
            diferentes, e aí não dá para agrupar nada.
          </span>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
          Cancelar
        </button>
        <button
          type="button"
          disabled={rodando}
          onClick={salvar}
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
        >
          {rodando ? 'salvando…' : ganhou ? 'Marcar como ganho' : 'Marcar como perdido'}
        </button>
      </div>
    </Modal>
  )

  function salvar() {
    if (!cartao) return
    setErro(null)

    /*
     * A chave da operação: **uma por formulário aberto**, não uma por clique.
     *
     * É ela que faz o botão "tente de novo" do `catch` abaixo ser retry, e não
     * uma segunda conclusão. O caso é a resposta perdida: a requisição chegou,
     * o cartão foi concluído, e a resposta morreu na volta, daqui isso é
     * indistinguível de nunca ter chegado.
     *
     * Gerá-la a cada clique seria o mesmo que não ter nenhuma. Ela vive no
     * `ref` para sobreviver aos re-renders do formulário e morrer com ele.
     */
    if (!chave.current) chave.current = `fechar:${cartao.id}:${crypto.randomUUID()}`

    comecar(async () => {
      try {
        const r = await acaoFecharCartao(clienteId, cartao.id, situacao, {
          titulo,
          valor,
          motivo,
          chaveDaOperacao: chave.current ?? undefined,
        })
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para fechar')
          return
        }
        aoConcluir({ abriuEm: r.abriuEm })
      } catch {
        setErro('não deu para fechar agora, tente de novo')
      }
    })
  }
}
