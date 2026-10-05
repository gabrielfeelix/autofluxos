'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { acaoArquivarEquipe, acaoCriarEquipe } from '@/server/acoes-acesso'
import { useConfirmar } from '@/components/design/confirmar'
import { IlustracaoEquipe } from '@/components/design/ilustracoes'
import { Avatar } from '@/components/design/avatar'
import { CabecalhoDaTela, Contagem, type TopoDaTela } from '@/components/design/cabecalho-da-tela'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { FUNDO_DA_LINHA, Tabela, Th } from '@/components/design/tabela'

type Equipe = { id: string; nome: string; pessoas: number }
type Membro = { nome: string; imagem: string | null; semAlcance: boolean }

/**
 * As equipes da conta (RB-40), a aba "Equipes" de Configurações › Pessoas.
 *
 * Equipe é o que dá sentido ao escopo "da equipe": sem nenhuma, esse escopo
 * alcança zero registros e vira um jeito confuso de dizer "não pode". Por isso
 * ela mora **na mesma tela** das pessoas, numa aba ao lado, e não numa página
 * própria: quem descobre que precisa de equipe é quem está editando permissão.
 *
 * Criar é o botão do topo, como "+ Adicionar usuário" na outra aba, e não um campo
 * solto no meio do cartão.
 *
 * Arquivar em vez de apagar: há oportunidade e histórico apontando para ela, e
 * apagar em cascata transformaria "a equipe Norte fechou isso" em "ninguém
 * fechou isso" (RB-24).
 */
export function GerenciarEquipes({
  clienteId,
  equipes: iniciais,
  perda = {},
  topo,
  abaixoDoTopo,
}: {
  clienteId: string
  equipes: Equipe[]
  /** Por equipe, quem está nela e se fica sem alcance nenhum sem ela (E15). */
  perda?: Record<string, Membro[]>
  topo: TopoDaTela
  abaixoDoTopo?: ReactNode
}) {
  const [equipes, setEquipes] = useState(iniciais)
  const [criando, setCriando] = useState(false)
  const { confirmar, dialogo } = useConfirmar()

  const arquivar = (equipe: Equipe) => {
    const pessoas = perda[equipe.id] ?? []
    const semAlcance = pessoas.filter((pessoa) => pessoa.semAlcance).map((pessoa) => pessoa.nome)
    const aviso =
      pessoas.length === 0
        ? ''
        : ` Perdem o escopo desta equipe: ${pessoas.map((pessoa) => pessoa.nome).join(', ')}.` +
          (semAlcance.length > 0
            ? ` Ficam sem alcance nenhum, porque não estão em outra equipe: ${semAlcance.join(', ')}.`
            : '')
    confirmar({
      titulo: `Arquivar a equipe ${equipe.nome}?`,
      descricao: `O histórico continua legível.${aviso}`,
      rotulo: 'Arquivar equipe',
      aoConfirmar: async () => {
        const r = await acaoArquivarEquipe(clienteId, equipe.id)
        if (r.ok) setEquipes((lista) => lista.filter((item) => item.id !== equipe.id))
        return r
      },
    })
  }

  const botaoDeArquivar = (equipe: Equipe) => (
    <button type="button" onClick={() => arquivar(equipe)} className="botao-secundario botao-sm">
      Arquivar
    </button>
  )

  return (
    <>
      {dialogo}
      <CabecalhoDaTela
        trilha={topo.trilha}
        titulo={topo.titulo}
        contagem={<Contagem>{equipes.length} {equipes.length === 1 ? 'equipe' : 'equipes'}</Contagem>}
        descricao={topo.descricao}
        acoes={
          <>
            {topo.acoes}
            <button type="button" onClick={() => setCriando(true)} className="botao-primario botao-md">
              + Criar equipe
            </button>
          </>
        }
      />
      {abaixoDoTopo}

      {criando && (
        <CriarEquipe
          aoFechar={() => setCriando(false)}
          enviar={async (nome) => {
            const r = await acaoCriarEquipe(clienteId, nome)
            if (r.ok && r.id) setEquipes((lista) => [...lista, { id: r.id!, nome, pessoas: 0 }])
            return r
          }}
        />
      )}

      {equipes.length === 0 ? (
        <div className="app-card px-5 py-12 text-center">
          <IlustracaoEquipe />
          <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhuma equipe ainda</p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-xs leading-5 text-dim">
            Sem equipe, o escopo &ldquo;da equipe dela&rdquo; não alcança nada, crie uma antes
            de usá-lo no acesso.
          </p>
          <button type="button" onClick={() => setCriando(true)} className="botao-secundario botao-md mt-5">
            + Criar equipe
          </button>
        </div>
      ) : (
        <>
          <ul className="app-card divide-y divide-line overflow-hidden md:hidden">
            {equipes.map((equipe) => (
              <li key={equipe.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold">{equipe.nome}</p>
                  <p className="truncate text-[11.5px] text-dim">{nomesDa(perda[equipe.id], equipe.pessoas)}</p>
                </div>
                {botaoDeArquivar(equipe)}
              </li>
            ))}
          </ul>
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <Tabela largura={640}>
              <thead>
                <tr className="border-b border-line">
                  <Th>Equipe</Th>
                  <Th>Pessoas</Th>
                  <Th className="w-28">
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {equipes.map((equipe) => {
                  const membros = perda[equipe.id] ?? []
                  return (
                    <tr key={equipe.id} className={`group border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                      <td className="px-4 py-3">
                        <p className="truncate text-[13px] font-bold">{equipe.nome}</p>
                        <p className="text-[11px] text-dim tabular-nums">
                          {equipe.pessoas} {equipe.pessoas === 1 ? 'pessoa' : 'pessoas'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {membros.length === 0 ? (
                          <span className="text-[12px] text-dim">ninguém ainda</span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="flex -space-x-2">
                              {membros.slice(0, 4).map((membro) => (
                                <span key={membro.nome} className="rounded-full ring-2 ring-panel">
                                  <Avatar nome={membro.nome} imagem={membro.imagem} tamanho={26} />
                                </span>
                              ))}
                            </div>
                            <span className="min-w-0 truncate text-[12px] text-muted">{nomesDa(membros, equipe.pessoas)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{botaoDeArquivar(equipe)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabela>
          </div>
        </>
      )}
    </>
  )
}

/** "Ana, Bruno e mais 2", ou a contagem quando os nomes não vieram. */
function nomesDa(membros: Membro[] | undefined, total: number): string {
  if (!membros || membros.length === 0) return total === 0 ? 'ninguém ainda' : `${total} ${total === 1 ? 'pessoa' : 'pessoas'}`
  const nomes = membros.map((membro) => membro.nome.split(' ')[0])
  if (nomes.length === 1) return nomes[0]!
  if (nomes.length <= 3) return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
}

function CriarEquipe({
  aoFechar,
  enviar,
}: {
  aoFechar: () => void
  enviar: (nome: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Criar equipe"
      descricao="Uma pessoa pode estar em mais de uma equipe: quem cobre duas praças não precisa de uma função nova. Quem entra em cada uma se escolhe no acesso da pessoa."
      largura={440}
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          const limpo = nome.trim()
          if (limpo === '') return
          setErro(null)
          comecar(async () => {
            try {
              const r = await enviar(limpo)
              if (!r.ok) setErro(r.erro ?? 'não deu para criar a equipe')
              else aoFechar()
            } catch {
              setErro('sem conexão com o servidor')
            }
          })
        }}
      >
        <label>
          <RotuloCampo>Nome</RotuloCampo>
          <input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
            autoFocus
            placeholder="Exemplo: Vendas"
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
        {erro && (
          <p role="alert" className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-1 flex gap-2.5">
          <button type="button" onClick={aoFechar} className="botao-secundario botao-md flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={enviando || nome.trim() === ''} className="botao-primario botao-md flex-[1.35]">
            {enviando ? 'Criando…' : 'Criar equipe'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
