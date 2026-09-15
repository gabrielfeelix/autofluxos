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
  /*
   * A lista é estado local porque a etiqueta criada aqui precisa aparecer
   * **antes** de o servidor responder. Vinda de fora por prop, ela só
   * chegaria depois de a página ser refeita — que é a espera que este arquivo
   * inteiro existe para evitar.
   */
  const [lista, setLista] = useState(disponiveis)

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

    /*
     * **A etiqueta entra na lista já acesa, e o servidor confirma atrás.**
     *
     * O id provisório existe porque o de verdade só volta do banco. Ele vive
     * poucos milissegundos e é trocado pelo real na resposta — nunca chega a
     * ser enviado em nada, porque a única coisa que se faz com ele antes disso
     * é desenhar.
     */
    const provisorio = `novo-${Date.now()}`
    const otimista = { id: provisorio, nome, cor: 'cinza' as CorDeEtiqueta }

    setErro(null)
    setLista((atuais) => [...atuais, otimista])
    setMarcadas((atuais) => [...atuais, provisorio])
    setNova('')
    setCriando(false)

    comecar(async () => {
      const dados = new FormData()
      dados.set('nome', nome)
      dados.set('cor', 'cinza')

      const r = await acaoCriarEtiqueta(clienteId, {}, dados)

      if (r.erro || !r.etiqueta) {
        // Tira a aposta: uma etiqueta que o servidor recusou não pode ficar na
        // tela, senão ela some sozinha no próximo carregamento sem explicação.
        setLista((atuais) => atuais.filter((e) => e.id !== provisorio))
        setMarcadas((atuais) => atuais.filter((id) => id !== provisorio))
        setErro(r.erro ?? 'não deu para criar a etiqueta')
        return
      }

      const criada = r.etiqueta
      setLista((atuais) => atuais.map((e) => (e.id === provisorio ? criada : e)))
      setMarcadas((atuais) => atuais.map((id) => (id === provisorio ? criada.id : id)))

      // Já nasce aplicada a este contato: quem cria uma etiqueta olhando uma
      // conversa quer justamente marcá-la nela.
      const marcou = await acaoMarcarEtiqueta(clienteId, criada.id, [contatoId], true)
      if (!marcou.ok) {
        setMarcadas((atuais) => atuais.filter((id) => id !== criada.id))
      }
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((etiqueta) => {
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
                  : 'border-line bg-transparent text-dim hover:border-white/20 hover:text-muted'
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
          className="mt-2 w-full rounded-[8px] border border-dashed border-strong px-2.5 py-2 text-[11px] text-dim transition hover:border-primary/40 hover:text-primary"
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
