'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { Modal } from '@/components/design/modal'
import { normalizar } from '@/core/engine/interpolar'

/**
 * A lista de contas de quem administra o painel.
 *
 * ---------------------------------------------------------------------------
 * O que estava errado, e não era só o visual
 * ---------------------------------------------------------------------------
 *
 * - **Clicar no nome não fazia nada.** O único alvo era um botão "Abrir painel"
 *   no canto; o nome, que é o que a mão procura, era texto morto. Agora o
 *   cartão inteiro é o link, e o botão sumiu — dois alvos para a mesma ação
 *   ocupavam espaço e ensinavam que um deles não funciona.
 * - **"Dono" não quer dizer nada aqui.** Esta tela é de quem administra: a
 *   pergunta dela é "quem consegue entrar nesta conta?", não qual é o papel
 *   formal de cada um no plugin de organização. O cartão passou a mostrar
 *   **acesso**, e o papel só aparece onde ele é decidido — na hora de ligar
 *   alguém, com a explicação do que cada um enxerga.
 * - **O aviso amarelo gritava e não ajudava.** "3 contas ainda não têm dono"
 *   ocupava o topo em cor de alerta e não dava o que fazer. Virou um filtro:
 *   um chip que mostra o número e, clicado, deixa só elas na tela.
 * - **A lista não dizia nada de cada conta.** Quinze cartões idênticos só
 *   respondem "existe". Agora cada um diz quantas automações tem e quantas
 *   estão no ar — que é como se distingue cliente atendendo de teste esquecido.
 *
 * ---------------------------------------------------------------------------
 * O desenho
 * ---------------------------------------------------------------------------
 *
 * Grade de cartões, e não lista em linha: com busca e filtro no topo, a grade
 * mostra três vezes mais contas na mesma dobra, e o olho varre por marca (a
 * logo) em vez de ler nome por nome.
 *
 * O link cobre o cartão por `inset-0` em vez de embrulhar o conteúdo: dentro
 * de `<a>` não pode haver `<button>`, e o botão de acesso precisa continuar
 * sendo botão. Ele fica acima na pilha (`z-10`), então o clique nele não abre
 * a conta.
 */

export type ContaDaLista = {
  id: string
  nome: string
  slug: string
  logoUrl: string
  membros: { id: string; nome: string; email: string; papel: string }[]
  fluxos: number
  noAr: number
}

export type UsuarioDaLista = { id: string; nome: string; email: string }

/**
 * O que cada papel **enxerga**, escrito para quem está escolhendo.
 *
 * O nome sozinho não decide nada: "dono" e "administrador" soam iguais para
 * quem nunca leu a documentação do plugin de organização. O que decide é a
 * segunda linha.
 */
const PAPEIS = [
  {
    valor: 'owner',
    rotulo: 'Dono',
    detalhe: 'o cliente. Enxerga tudo da conta dele e não sai sozinho.',
  },
  {
    valor: 'admin',
    rotulo: 'Administrador',
    detalhe: 'opera a conta por inteiro, inclusive convidar gente.',
  },
  {
    valor: 'member',
    rotulo: 'Equipe',
    detalhe: 'atende no inbox. Não mexe na configuração da conta.',
  },
] as const

const NOME_DO_PAPEL: Record<string, string> = {
  owner: 'dono',
  admin: 'administrador',
  member: 'equipe',
}

type Acao = (formData: FormData) => void | Promise<void>

/** As iniciais de quem tem acesso, empilhadas como numa foto de equipe. */
function Pessoas({ membros }: { membros: ContaDaLista['membros'] }) {
  if (membros.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-amber-300/90">
        <span aria-hidden className="size-1.5 rounded-full bg-amber-300/80" />
        ninguém entra nela
      </span>
    )
  }

  const mostrados = membros.slice(0, 3)

  return (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-1.5">
        {mostrados.map((membro) => (
          <span
            key={membro.id}
            title={`${membro.nome} · ${NOME_DO_PAPEL[membro.papel] ?? membro.papel} · ${membro.email}`}
            className="flex size-[22px] items-center justify-center rounded-full border border-[#0b1018] bg-white/[0.11] text-[9.5px] font-bold text-soft"
          >
            {iniciais(membro.nome)}
          </span>
        ))}
      </span>
      <span className="truncate text-[11.5px] text-dim">
        {membros.length === 1
          ? (membros[0]?.nome ?? '')
          : `${membros.length} pessoas com acesso`}
      </span>
    </span>
  )
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? '?'
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

function Cartao({
  conta,
  aoLigarPessoa,
}: {
  conta: ContaDaLista
  aoLigarPessoa: (() => void) | null
}) {
  return (
    <li className="group relative flex flex-col rounded-[14px] border border-white/[0.085] bg-[#0b1018] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.28)] transition hover:border-accent/45 hover:bg-[#0d1622]">
      {/* O link cobre o cartão inteiro; o botão de acesso vive acima dele. */}
      <Link
        href={`/clientes/${conta.id}`}
        className="absolute inset-0 rounded-[14px] focus-visible:ring-1 focus-visible:ring-accent/60 focus-visible:outline-none"
        aria-label={`Abrir o painel de ${conta.nome}`}
      />

      <div className="flex items-start gap-3">
        <LogoDoCliente cliente={{ nome: conta.nome, logoUrl: conta.logoUrl }} tamanho={38} />

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
            {conta.nome}
          </h2>
          {/* O slug, e não o id: id de banco na tela não diz nada a ninguém, e
              o slug é o que aparece no endereço. */}
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-dim">{conta.slug}</p>
        </div>

        <span
          aria-hidden
          className="translate-x-[-4px] text-[13px] text-dim opacity-0 transition group-hover:translate-x-0 group-hover:text-accent group-hover:opacity-100"
        >
          →
        </span>
      </div>

      <p className="mt-3.5 flex items-center gap-2 text-[11.5px] text-muted">
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${conta.noAr > 0 ? 'bg-emerald-400' : 'bg-white/20'}`}
        />
        {conta.fluxos === 0 ? (
          'nenhuma automação ainda'
        ) : (
          <>
            <span className="font-semibold text-soft">{conta.fluxos}</span>{' '}
            {conta.fluxos === 1 ? 'automação' : 'automações'}
            <span className="text-dim">·</span>
            <span className={conta.noAr > 0 ? 'text-emerald-300/90' : 'text-dim'}>
              {conta.noAr === 0 ? 'nenhuma no ar' : `${conta.noAr} no ar`}
            </span>
          </>
        )}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
        <Pessoas membros={conta.membros} />

        {aoLigarPessoa && (
          <button
            type="button"
            onClick={aoLigarPessoa}
            className="relative z-10 shrink-0 rounded-full border border-white/[0.09] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent/45 hover:text-accent"
          >
            + acesso
          </button>
        )}
      </div>
    </li>
  )
}

export function ContasAdmin({
  contas,
  usuarios,
  acaoVincular,
}: {
  contas: readonly ContaDaLista[]
  usuarios: readonly UsuarioDaLista[]
  acaoVincular: Acao
}) {
  const [termo, setTermo] = useState('')
  const [soSemAcesso, setSoSemAcesso] = useState(false)
  const [ligando, setLigando] = useState<ContaDaLista | null>(null)
  const [papel, setPapel] = useState<string>('owner')
  const [usuario, setUsuario] = useState<string>(usuarios[0]?.id ?? '')

  const semAcesso = contas.filter((conta) => conta.membros.length === 0).length

  const lista = useMemo(() => {
    const palavras = normalizar(termo).split(/\s+/).filter((p) => p !== '')

    return contas
      .filter((conta) => (soSemAcesso ? conta.membros.length === 0 : true))
      .filter((conta) => {
        const texto = normalizar(
          `${conta.nome} ${conta.slug} ${conta.membros.map((m) => `${m.nome} ${m.email}`).join(' ')}`,
        )
        return palavras.every((palavra) => texto.includes(palavra))
      })
      /*
       * Conta sem ninguém primeiro, e depois a que atende gente.
       *
       * Não é ordem alfabética por preguiça: quem abre esta tela abre para
       * resolver, e o que precisa de ação são as contas em que ninguém
       * consegue entrar. Entre iguais, quem tem automação no ar vem antes.
       */
      .slice()
      .sort((a, b) => {
        if ((a.membros.length === 0) !== (b.membros.length === 0)) {
          return a.membros.length === 0 ? -1 : 1
        }
        if (a.noAr !== b.noAr) return b.noAr - a.noAr
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })
  }, [contas, termo, soSemAcesso])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar por nome, endereço ou pessoa…"
          aria-label="Buscar conta"
          className="app-field h-[38px] min-w-[240px] flex-1 px-[13px] text-[13px]"
        />

        {semAcesso > 0 && (
          <button
            type="button"
            onClick={() => setSoSemAcesso((estado) => !estado)}
            aria-pressed={soSemAcesso}
            title="Contas em que nenhuma pessoa consegue entrar com login próprio"
            className={`h-[38px] shrink-0 rounded-[10px] border px-3 text-[12px] font-semibold transition ${
              soSemAcesso
                ? 'border-amber-300/50 bg-amber-300/[0.12] text-amber-200'
                : 'border-white/[0.09] text-muted hover:border-white/25 hover:text-soft'
            }`}
          >
            sem acesso
            <span className="ml-1.5 text-[11px] font-normal opacity-70">{semAcesso}</span>
          </button>
        )}

        <span className="shrink-0 text-[11.5px] text-dim">
          {lista.length} de {contas.length}
        </span>
      </div>

      {lista.length === 0 ? (
        <p className="app-card px-5 py-10 text-center text-[12.5px] text-dim">
          Nenhuma conta com isso.{' '}
          <button
            type="button"
            onClick={() => {
              setTermo('')
              setSoSemAcesso(false)
            }}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Limpar a busca
          </button>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((conta) => (
            <Cartao
              key={conta.id}
              conta={conta}
              aoLigarPessoa={
                usuarios.length > 0
                  ? () => {
                      setUsuario(usuarios[0]?.id ?? '')
                      setPapel('owner')
                      setLigando(conta)
                    }
                  : null
              }
            />
          ))}
        </ul>
      )}

      <Modal
        aberto={ligando !== null}
        aoFechar={() => setLigando(null)}
        titulo={ligando ? `Dar acesso a ${ligando.nome}` : 'Dar acesso'}
        descricao="A pessoa passa a entrar nesta conta com o login dela."
        largura={460}
      >
        {ligando && (
          <form action={acaoVincular} className="flex flex-col gap-4">
            <input type="hidden" name="contaId" value={ligando.id} />
            <input type="hidden" name="usuarioId" value={usuario} />
            <input type="hidden" name="papel" value={papel} />

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                Quem
              </span>
              <Dropdown
                rotuloAcessivel="Pessoa que recebe acesso"
                valor={usuario}
                aoMudar={setUsuario}
                opcoes={usuarios.map((u) => ({
                  valor: u.id,
                  rotulo: u.nome,
                  detalhe: u.email,
                }))}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                O que ela enxerga
              </span>
              <Dropdown
                rotuloAcessivel="Papel na conta"
                valor={papel}
                aoMudar={setPapel}
                opcoes={PAPEIS.map((p) => ({
                  valor: p.valor,
                  rotulo: p.rotulo,
                  detalhe: p.detalhe,
                }))}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLigando(null)}
                className="rounded-[10px] border border-white/[0.09] px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:border-white/25 hover:text-soft"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-[10px] bg-accent px-4 py-2 text-[12.5px] font-bold text-[#04202a] transition hover:brightness-110"
              >
                Dar acesso
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
