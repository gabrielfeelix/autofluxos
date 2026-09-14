'use client'

import { useState, useTransition } from 'react'
import { CLASSE_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'
import { acaoCriarEtiqueta, acaoMarcarEtiqueta } from '@/server/acoes'

export type EtiquetaEscolhivel = { id: string; nome: string; cor: CorDeEtiqueta }

/**
 * Aplicar e tirar etiquetas de um contato, clicando.
 *
 * **Todas as etiquetas da conta aparecem, as aplicadas acesas.** A alternativa
 * — um botão "adicionar" que abre uma lista — esconde justamente a informação
 * que a tela existe para dar: quais **não** estão aplicadas. Com poucas
 * etiquetas, que é o caso real, mostrar tudo custa menos que um clique a mais.
 *
 * O estado é otimista porque a ação é uma escrita minúscula e o custo de errar
 * é uma ficha acesa por um segundo. Esperar o servidor faria cada clique
 * parecer que não funcionou.
 */
export function SeletorDeEtiquetas({
  clienteId,
  contatoId,
  disponiveis,
  aplicadas,
}: {
  clienteId: string
  contatoId: string
  disponiveis: EtiquetaEscolhivel[]
  aplicadas: string[]
}) {
  const [marcadas, setMarcadas] = useState<string[]>(aplicadas)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const [criando, setCriando] = useState(false)
  const [nova, setNova] = useState('')

  const alternar = (etiquetaId: string) => {
    const aplicar = !marcadas.includes(etiquetaId)
    setErro(null)
    setMarcadas((atuais) =>
      aplicar ? [...atuais, etiquetaId] : atuais.filter((id) => id !== etiquetaId),
    )

    comecar(async () => {
      const r = await acaoMarcarEtiqueta(clienteId, etiquetaId, [contatoId], aplicar)
      if (!r.ok) {
        // Desfaz o otimismo: uma ficha acesa que o servidor recusou é pior do
        // que a recusa aparecer, porque ela mente até alguém recarregar.
        setMarcadas((atuais) =>
          aplicar ? atuais.filter((id) => id !== etiquetaId) : [...atuais, etiquetaId],
        )
        setErro(r.erro ?? 'não deu para mudar a etiqueta')
      }
    })
  }

  /*
   * Criar aqui, e não em Configurações.
   *
   * A etiqueta nasce **no momento em que alguém precisa dela** — olhando uma
   * conversa e pensando "isso é um orçamento". Mandar essa pessoa para outra
   * tela para criar e voltar é a mesma volta que fazia ninguém anotar nada
   * antes da `NotaRapida` existir: quem tem que ir e voltar, não vai.
   *
   * A cor não é perguntada. Seis cores e nenhuma delas muda o que a etiqueta
   * faz — decidir entre elas no meio de um atendimento é escolha que só
   * atrasa. Nasce `cinza` e quem quiser pintar tem a tela de Configurações,
   * que continua existindo para gerenciar.
   */
  const criar = () => {
    const nome = nova.trim()
    if (nome === '') return

    setErro(null)
    comecar(async () => {
      const dados = new FormData()
      dados.set('nome', nome)
      dados.set('cor', 'cinza')

      const r = await acaoCriarEtiqueta(clienteId, {}, dados)
      if (r.erro) {
        setErro(r.erro)
        return
      }
      setNova('')
      setCriando(false)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {disponiveis.map((etiqueta) => {
          const acesa = marcadas.includes(etiqueta.id)
          return (
            <button
              key={etiqueta.id}
              type="button"
              aria-pressed={acesa}
              onClick={() => alternar(etiqueta.id)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                acesa
                  ? CLASSE_DA_COR[etiqueta.cor]
                  : 'border-white/[0.08] bg-transparent text-dim hover:border-white/20 hover:text-muted'
              }`}
            >
              {etiqueta.nome}
            </button>
          )
        })}
      </div>

      {criando ? (
        <div className="mt-2 flex gap-1.5">
          <input
            autoFocus
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') criar()
              if (e.key === 'Escape') {
                setNova('')
                setCriando(false)
              }
            }}
            placeholder="Nome da etiqueta"
            aria-label="Nome da nova etiqueta"
            className="app-field min-w-0 flex-1 px-2.5 py-1.5 text-[11px]"
          />
          <button
            type="button"
            onClick={criar}
            className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px]"
          >
            Criar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="mt-2 w-full rounded-[8px] border border-dashed border-white/[0.12] px-2.5 py-2 text-[11px] text-dim transition hover:border-accent/40 hover:text-accent"
        >
          + Etiqueta
        </button>
      )}

      {erro && (
        <p role="alert" className="mt-1.5 text-[10.5px] leading-4 text-rose-300">
          {erro}
        </p>
      )}
    </div>
  )
}
