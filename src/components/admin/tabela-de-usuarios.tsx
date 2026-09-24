'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Avatar } from '@/components/design/avatar'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { acaoAdminExcluirUsuario, acaoAdminUsuario, type OperacaoDeUsuario } from '@/server/acoes-admin'
import { EditarUsuario, ExcluirUsuario, OrganizacoesDoUsuario, RedefinirSenha, ROTULO_DA_FUNCAO } from './modais-do-usuario'
import { acaoEntrarComo } from '@/server/acoes-conta'
import { dataCurta, horaExata, quando } from '@/lib/quando'
import { COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Selo } from './partes'

export type UsuarioNaTabela = {
  id: string
  nome: string
  email: string
  imagem: string | null
  adminDaPlataforma: boolean
  suspenso: boolean
  sessoesAtivas: number
  ultimoAcesso: string | null
  criadoEm: string
  organizacoes: { id: string; nome: string; funcao: string }[]
  voce: boolean
}

const ROTULO = ROTULO_DA_FUNCAO

type Aberto = { tipo: 'editar' | 'senha' | 'organizacoes' | 'excluir'; usuario: UsuarioNaTabela }

/**
 * Os logins da plataforma, em tabela.
 *
 * Cada ação muda a linha na hora e volta, com aviso, se o servidor recusar.
 * "Entrar como" é a exceção: ele navega para a organização da pessoa, então é
 * um formulário de verdade.
 */
export function TabelaDeUsuarios({
  usuarios: iniciais,
  cabecalhos,
  organizacoes,
}: {
  usuarios: UsuarioNaTabela[]
  cabecalhos: React.ReactNode
  /** Todas as organizações, para "pôr em outra organização". */
  organizacoes: { id: string; nome: string }[]
}) {
  const [usuarios, setUsuarios] = useState(iniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [, comecar] = useTransition()

  /** Muda a linha na hora e volta, com aviso, se a ação recusar. */
  const otimista = (usuario: UsuarioNaTabela, parcial: Partial<UsuarioNaTabela>, acao: () => Promise<{ ok: boolean; erro?: string }>) => {
    const anterior = usuarios.find((item) => item.id === usuario.id) ?? usuario
    setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, ...parcial } : item)))
    setAberto(null)
    comecar(async () => {
      const r = await acao().catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (!r.ok) {
        setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? anterior : item)))
        setAviso(r.erro ?? 'não deu para fazer isso')
      }
    })
  }

  const excluir = (usuario: UsuarioNaTabela) => {
    const antes = usuarios
    setUsuarios((lista) => lista.filter((item) => item.id !== usuario.id))
    setAberto(null)
    comecar(async () => {
      const r = await acaoAdminExcluirUsuario(usuario.id).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (!r.ok) {
        setUsuarios(antes)
        setAviso(r.erro ?? 'não deu para excluir')
      }
    })
  }

  const mudar = (usuario: UsuarioNaTabela, operacao: OperacaoDeUsuario, otimista: Partial<UsuarioNaTabela>) => {
    const anterior = usuario
    setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, ...otimista } : item)))
    comecar(async () => {
      try {
        const r = await acaoAdminUsuario(usuario.id, operacao)
        if (!r.ok) {
          setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? anterior : item)))
          setAviso(r.erro ?? 'não deu para fazer isso')
        }
      } catch {
        setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? anterior : item)))
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full min-w-[1000px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">{cabecalhos}</tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => {
              const vistas = usuario.organizacoes.slice(0, 2)
              const resto = usuario.organizacoes.slice(2)
              return (
                <tr key={usuario.id} className={`group border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                  <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                    <div className="flex items-center gap-3">
                      <Avatar nome={usuario.nome} imagem={usuario.imagem} tamanho={32} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-bold">
                          <span className="truncate">{usuario.nome}</span>
                          {usuario.voce && <Selo>você</Selo>}
                        </p>
                        <p className="truncate text-[11px] text-dim">{usuario.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {usuario.organizacoes.length === 0 ? (
                      <span className="text-[12px] text-aviso">nenhuma: entra e não vê nada</span>
                    ) : (
                      <span className="flex max-w-[380px] flex-wrap items-center gap-1">
                        {vistas.map((organizacao) => (
                          <Link
                            key={organizacao.id}
                            href={`/admin/organizacoes/${organizacao.id}/pessoas`}
                            className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] transition hover:border-primary/40"
                          >
                            <span className="truncate font-semibold text-soft">{organizacao.nome}</span>
                            <span className="shrink-0 text-dim">· {ROTULO[organizacao.funcao] ?? organizacao.funcao}</span>
                          </Link>
                        ))}
                        {resto.length > 0 && (
                          <span title={resto.map((organizacao) => `${organizacao.nome} (${ROTULO[organizacao.funcao]})`).join(', ')} className="rounded-full border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
                            +{resto.length}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{usuario.adminDaPlataforma ? <Selo tom="destaque">Administrador da plataforma</Selo> : <span className="text-[12px] text-muted">Usuário</span>}</td>
                  <td className="px-4 py-3">{usuario.suspenso ? <Selo tom="alerta">Suspenso</Selo> : <Selo tom="ok">Ativo</Selo>}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{usuario.sessoesAtivas === 0 ? <span className="text-dim">0</span> : usuario.sessoesAtivas}</td>
                  <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                    {usuario.ultimoAcesso ? <span title={horaExata(usuario.ultimoAcesso)}>{quando(usuario.ultimoAcesso)}</span> : <span className="text-dim">nunca entrou</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                    {dataCurta(usuario.criadoEm)}
                  </td>
                  <td className="px-2 py-2">
                    <PopoverDoQuadro rotulo={`Ações de ${usuario.nome}`} largura={240} className="quadro-icon-button" gatilho={<IconeDoQuadro tipo="menu" />}>
                      {!usuario.voce && !usuario.suspenso && usuario.organizacoes.length > 0 && (
                        <form action={acaoEntrarComo.bind(null, usuario.id)}>
                          <button type="submit" data-fechar-popover className="quadro-menu-item">
                            <span className="flex-1">
                              Entrar como
                              <span className="block text-[11px] font-normal text-dim">Sessão de 1 hora, registrada na auditoria</span>
                            </span>
                          </button>
                        </form>
                      )}
                      <button type="button" data-fechar-popover onClick={() => setAberto({ tipo: 'editar', usuario })} className="quadro-menu-item">
                        <span className="flex-1">Editar nome e e-mail</span>
                      </button>
                      <button type="button" data-fechar-popover onClick={() => setAberto({ tipo: 'organizacoes', usuario })} className="quadro-menu-item">
                        <span className="flex-1">
                          Organizações e função
                          <span className="block text-[11px] font-normal text-dim">Pôr, trocar a função, tirar</span>
                        </span>
                      </button>
                      <button type="button" data-fechar-popover onClick={() => setAberto({ tipo: 'senha', usuario })} className="quadro-menu-item">
                        <span className="flex-1">Redefinir a senha</span>
                      </button>
                      {!usuario.voce && (
                        <button
                          type="button"
                          data-fechar-popover
                          onClick={() => mudar(usuario, usuario.adminDaPlataforma ? 'tirar_admin' : 'tornar_admin', { adminDaPlataforma: !usuario.adminDaPlataforma })}
                          className="quadro-menu-item"
                        >
                          <span className="flex-1">{usuario.adminDaPlataforma ? 'Tirar da administração' : 'Tornar administrador da plataforma'}</span>
                        </button>
                      )}
                      {usuario.sessoesAtivas > 0 && (
                        <button type="button" data-fechar-popover onClick={() => mudar(usuario, 'derrubar_sessoes', { sessoesAtivas: 0 })} className="quadro-menu-item">
                          <span className="flex-1">Derrubar as sessões abertas</span>
                        </button>
                      )}
                      {!usuario.voce && (
                        <button
                          type="button"
                          data-fechar-popover
                          onClick={() => mudar(usuario, usuario.suspenso ? 'devolver' : 'suspender', { suspenso: !usuario.suspenso, sessoesAtivas: usuario.suspenso ? usuario.sessoesAtivas : 0 })}
                          className={`quadro-menu-item ${usuario.suspenso ? '' : 'text-perigo'}`}
                        >
                          <span className="flex-1">{usuario.suspenso ? 'Devolver o acesso' : 'Suspender o acesso'}</span>
                        </button>
                      )}
                      {!usuario.voce && (
                        <button type="button" data-fechar-popover onClick={() => setAberto({ tipo: 'excluir', usuario })} className="quadro-menu-item text-perigo">
                          <span className="flex-1">Excluir o login</span>
                        </button>
                      )}
                      {usuario.voce && <p className="px-3 py-2 text-[12px] text-dim">Este é o seu login.</p>}
                    </PopoverDoQuadro>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </RolagemDaTabela>
      {aberto?.tipo === 'editar' && (
        <EditarUsuario usuario={aberto.usuario} aoFechar={() => setAberto(null)} aoMudar={(parcial, acao) => otimista(aberto.usuario, parcial, acao)} />
      )}
      {aberto?.tipo === 'senha' && <RedefinirSenha usuario={aberto.usuario} aoFechar={() => setAberto(null)} aoPronto={() => setUsuarios((lista) => lista.map((item) => (item.id === aberto.usuario.id && !item.voce ? { ...item, sessoesAtivas: 0 } : item)))} />}
      {aberto?.tipo === 'organizacoes' && (
        <OrganizacoesDoUsuario
          usuario={aberto.usuario}
          todas={organizacoes}
          aoFechar={() => setAberto(null)}
          aoMudar={(lista) => setUsuarios((todos) => todos.map((item) => (item.id === aberto.usuario.id ? { ...item, organizacoes: lista } : item)))}
        />
      )}
      {aberto?.tipo === 'excluir' && <ExcluirUsuario usuario={aberto.usuario} aoFechar={() => setAberto(null)} aoExcluir={() => excluir(aberto.usuario)} />}
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}
