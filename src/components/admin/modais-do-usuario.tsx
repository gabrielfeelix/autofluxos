'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import {
  acaoAdminDefinirFuncao,
  acaoAdminEditarUsuario,
  acaoAdminImpedimentosDoUsuario,
  acaoAdminPorNaOrganizacao,
  acaoAdminRedefinirSenha,
  acaoAdminRemoverPessoa,
} from '@/server/acoes-admin'
import type { UsuarioNaTabela } from './tabela-de-usuarios'

export const ROTULO_DA_FUNCAO: Record<string, string> = { proprietario: 'Proprietário', administrador: 'Administrador', gestor: 'Gestor', atendente: 'Atendente' }
const FUNCOES = Object.entries(ROTULO_DA_FUNCAO).map(([valor, rotulo]) => ({ valor, rotulo }))
const CAMPO = 'app-field px-[13px] py-[10px] text-[13.5px]'

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <p role="alert" className="rounded-[10px] border border-perigo/30 bg-perigo/[0.06] px-3 py-2.5 text-[12.5px] leading-5 text-perigo">
      {texto}
    </p>
  )
}

function Botoes({ aoFechar, rotulo, desligado, perigo }: { aoFechar: () => void; rotulo: string; desligado?: boolean; perigo?: boolean }) {
  return (
    <div className="mt-1 flex gap-2.5">
      <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
        Cancelar
      </button>
      <button
        type="submit"
        disabled={desligado}
        className={
          perigo
            ? 'flex-[1.35] rounded-[10px] border border-rose-400/40 bg-rose-400/[0.16] px-4 py-2.5 text-[13px] font-bold text-perigo transition hover:bg-rose-400/[0.24] disabled:cursor-not-allowed disabled:opacity-40'
            : 'app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {rotulo}
      </button>
    </div>
  )
}

/** Nome e e-mail. Otimista: a linha muda na hora e volta se o servidor recusar. */
export function EditarUsuario({ usuario, aoFechar, aoMudar }: { usuario: UsuarioNaTabela; aoFechar: () => void; aoMudar: (parcial: Partial<UsuarioNaTabela>, acao: () => Promise<{ ok: boolean; erro?: string }>) => void }) {
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Editar ${usuario.nome}`} descricao="O e-mail é o que a pessoa usa para entrar. Avise antes de trocar." largura={460}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          const dados = new FormData(evento.currentTarget)
          const nome = String(dados.get('nome') ?? '').trim()
          const email = String(dados.get('email') ?? '').trim().toLowerCase()
          aoMudar({ nome, email }, () => acaoAdminEditarUsuario(usuario.id, { nome, email }))
        }}
      >
        <label>
          <RotuloCampo>Nome</RotuloCampo>
          <input name="nome" required maxLength={120} defaultValue={usuario.nome} placeholder="Exemplo: Ana Souza" className={CAMPO} />
        </label>
        <label>
          <RotuloCampo>E-mail</RotuloCampo>
          <input name="email" type="email" required defaultValue={usuario.email} placeholder="Exemplo: ana@empresa.com.br" className={CAMPO} />
        </label>
        <Botoes aoFechar={aoFechar} rotulo="Salvar" />
      </form>
    </Modal>
  )
}

function senhaAleatoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (byte) => letras[byte % letras.length]).join('')
}

/**
 * Senha provisória, como no Dar acesso: sem e-mail transacional ainda, quem
 * redefine combina a senha com a pessoa fora daqui. As sessões abertas caem.
 */
export function RedefinirSenha({ usuario, aoFechar, aoPronto }: { usuario: UsuarioNaTabela; aoFechar: () => void; aoPronto: (erro: string | null) => void }) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feita, setFeita] = useState(false)

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Redefinir a senha de ${usuario.nome}`} descricao="A senha provisória vale na hora e derruba as sessões abertas. Passe para a pessoa por um canal seu." largura={460}>
      {feita ? (
        <div className="flex flex-col gap-3.5">
          <p className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px] leading-5 text-soft">
            Senha redefinida. Passe para {usuario.nome}: <strong className="font-mono text-ink select-all">{senha}</strong>
          </p>
          <button type="button" onClick={aoFechar} className="app-primary-button px-4 py-2.5 text-[13px]">
            Pronto
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={async (evento) => {
            evento.preventDefault()
            setErro(null)
            setEnviando(true)
            const r = await acaoAdminRedefinirSenha(usuario.id, senha).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
            setEnviando(false)
            if (!r.ok) return setErro(r.erro ?? 'não deu para redefinir')
            setFeita(true)
            aoPronto(null)
          }}
        >
          <label>
            <RotuloCampo>Senha provisória</RotuloCampo>
            <span className="flex gap-2">
              <input value={senha} onChange={(evento) => setSenha(evento.target.value)} required minLength={10} autoComplete="new-password" placeholder="Exemplo: 10 caracteres ou mais" className={`${CAMPO} min-w-0 flex-1 font-mono`} />
              <button type="button" onClick={() => setSenha(senhaAleatoria())} className="app-secondary-button shrink-0 px-3.5 text-[12.5px]">
                Gerar
              </button>
            </span>
          </label>
          <Erro texto={erro} />
          <Botoes aoFechar={aoFechar} rotulo={enviando ? 'Redefinindo…' : 'Redefinir senha'} desligado={enviando || senha.length < 10} />
        </form>
      )}
    </Modal>
  )
}

/**
 * As organizações do login: pôr numa com função, trocar a função, tirar.
 * Otimista linha a linha; o Suporte está no nível 5, então troca qualquer
 * função, e dar Proprietário passa a posse (o dono anterior vira Administrador).
 */
export function OrganizacoesDoUsuario({
  usuario,
  todas,
  aoFechar,
  aoMudar,
}: {
  usuario: UsuarioNaTabela
  todas: { id: string; nome: string }[]
  aoFechar: () => void
  aoMudar: (organizacoes: UsuarioNaTabela['organizacoes']) => void
}) {
  const [lista, setLista] = useState(usuario.organizacoes)
  const [erro, setErro] = useState<string | null>(null)
  const livres = todas.filter((organizacao) => !lista.some((item) => item.id === organizacao.id))
  const [nova, setNova] = useState(livres[0]?.id ?? '')
  const [funcaoNova, setFuncaoNova] = useState('atendente')

  const aplicar = async (proxima: UsuarioNaTabela['organizacoes'], acao: () => Promise<{ ok: boolean; erro?: string }>) => {
    const antes = lista
    setErro(null)
    setLista(proxima)
    aoMudar(proxima)
    const r = await acao().catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
    if (!r.ok) {
      setLista(antes)
      aoMudar(antes)
      setErro(r.erro ?? 'não deu para fazer isso')
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Organizações de ${usuario.nome}`} descricao="A função vale só naquela organização. Dar Proprietário passa a posse: o dono anterior vira Administrador." largura={560}>
      <div className="flex flex-col gap-3.5">
        {lista.length === 0 ? (
          <p className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">Em nenhuma organização: entra e não vê nada.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[12px] border border-line">
            {lista.map((organizacao) => (
              <li key={organizacao.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                <Link href={`/admin/organizacoes/${organizacao.id}/pessoas`} className="min-w-0 flex-1 truncate text-[13px] font-semibold hover:text-primary">
                  {organizacao.nome}
                </Link>
                <Dropdown
                  className="w-[160px]"
                  rotuloAcessivel={`Função em ${organizacao.nome}`}
                  valor={organizacao.funcao}
                  aoMudar={(funcao) =>
                    aplicar(
                      lista.map((item) => (item.id === organizacao.id ? { ...item, funcao } : item)),
                      () => acaoAdminDefinirFuncao(organizacao.id, usuario.id, funcao),
                    )
                  }
                  opcoes={FUNCOES}
                />
                <button
                  type="button"
                  onClick={() => aplicar(lista.filter((item) => item.id !== organizacao.id), () => acaoAdminRemoverPessoa(organizacao.id, usuario.id, null))}
                  className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-perigo"
                >
                  Tirar
                </button>
              </li>
            ))}
          </ul>
        )}

        {livres.length > 0 && (
          <div className="rounded-[12px] border border-line bg-surface px-3.5 py-3">
            <p className="mb-2 text-[12px] font-semibold text-soft">Pôr em outra organização</p>
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown className="min-w-[180px] flex-1" rotuloAcessivel="Organização" valor={nova} aoMudar={setNova} opcoes={livres.map((organizacao) => ({ valor: organizacao.id, rotulo: organizacao.nome }))} />
              <Dropdown className="w-[160px]" rotuloAcessivel="Função" valor={funcaoNova} aoMudar={setFuncaoNova} opcoes={FUNCOES} />
              <button
                type="button"
                disabled={!nova}
                onClick={() => {
                  const alvo = livres.find((organizacao) => organizacao.id === nova)
                  if (!alvo) return
                  setNova(livres.find((organizacao) => organizacao.id !== nova)?.id ?? '')
                  aplicar([...lista, { id: alvo.id, nome: alvo.nome, funcao: funcaoNova }], () => acaoAdminPorNaOrganizacao(usuario.id, alvo.id, funcaoNova))
                }}
                className="app-secondary-button px-4 py-2 text-[12.5px] disabled:opacity-50"
              >
                Pôr
              </button>
            </div>
          </div>
        )}
        <Erro texto={erro} />
        <button type="button" onClick={aoFechar} className="app-secondary-button px-4 py-2.5 text-[13px]">
          Fechar
        </button>
      </div>
    </Modal>
  )
}

/** Excluir o login: bloqueado enquanto ele for o único Proprietário de alguma organização. */
export function ExcluirUsuario({ usuario, aoFechar, aoExcluir }: { usuario: UsuarioNaTabela; aoFechar: () => void; aoExcluir: () => void }) {
  const [soDele, setSoDele] = useState<{ id: string; nome: string }[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    acaoAdminImpedimentosDoUsuario(usuario.id)
      .then((r) => vivo && (r.ok ? setSoDele(r.soDele ?? []) : setErro(r.erro ?? 'não deu para conferir')))
      .catch(() => vivo && setErro('sem conexão com o servidor'))
    return () => {
      vivo = false
    }
  }, [usuario.id])

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Excluir ${usuario.nome}?`} descricao="O login some e a pessoa sai de todas as organizações. Não tem volta; suspender é o caminho reversível." largura={460}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          aoExcluir()
        }}
      >
        {soDele === null && !erro && <div className="h-14 animate-pulse rounded-[12px] bg-surface" aria-busy />}
        {soDele && soDele.length > 0 && (
          <div className="rounded-[12px] border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-[12.5px] leading-5 text-soft">
            <p className="font-semibold">É o único Proprietário de {soDele.length === 1 ? 'uma organização' : `${soDele.length} organizações`}</p>
            <p className="mt-0.5 text-muted">Passe a posse para outra pessoa antes de excluir.</p>
            <ul className="mt-2 flex flex-col gap-1">
              {soDele.map((organizacao) => (
                <li key={organizacao.id}>
                  <Link href={`/admin/organizacoes/${organizacao.id}/pessoas`} className="font-semibold text-primary underline-offset-2 hover:underline">
                    {organizacao.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {soDele && soDele.length === 0 && (
          <p className="text-[12.5px] leading-5 text-muted">
            Contatos com {usuario.nome} de responsável ficam sem responsável. A auditoria guarda o nome.
          </p>
        )}
        <Erro texto={erro} />
        <Botoes aoFechar={aoFechar} rotulo={`Excluir ${usuario.nome}`} desligado={!soDele || soDele.length > 0} perigo />
      </form>
    </Modal>
  )
}

