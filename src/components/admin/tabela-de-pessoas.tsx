'use client'

import { useState, useTransition } from 'react'
import { EditorDeAcesso, type MembroParaAcesso } from '@/components/conta/editor-de-acesso'
import { Avatar } from '@/components/design/avatar'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { RemoverComDestino } from '@/components/conta/remover-com-destino'
import { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Selo } from './partes'
import { dataCurta, horaExata, quando } from '@/lib/quando'

/** O seletor de função na linha, mais baixo que o do formulário. */
const DROPDOWN_COMPACTO = '[&_.app-dropdown-trigger]:min-h-9! [&_.app-dropdown-trigger]:py-1.5! [&_.app-dropdown-trigger]:text-[12.5px]'

export type PessoaNaTabela = {
  id: string
  nome: string
  email: string
  funcao: string
  equipes: string[]
  suspensa: boolean
  voce: boolean
  desde: string
  ultimoAcesso: string | null
  /** Quem pede pode mudar a função e tirar esta pessoa? Decidido no servidor. */
  podeEditar: boolean
}

type Resultado = { ok?: boolean; erro?: string }

/**
 * A tabela de pessoas de uma organização, a mesma na administração e em
 * Configurações > Pessoas.
 *
 * A troca de função é **otimista**: a linha muda na hora e volta, com aviso,
 * se o servidor recusar. Quem decide quem aparece e quem pode ser editado é o
 * servidor (regra de hierarquia); aqui só se desenha o que veio.
 */
export function TabelaDePessoas({
  clienteId,
  pessoas: iniciais,
  funcoes,
  trocarFuncao,
  pendencias,
  remover,
  darAcesso,
  acesso,
}: {
  remover?: (clienteId: string, usuarioId: string, destino: string | null) => Promise<{ ok: boolean; erro?: string }>
  /** Sem ela, a tabela não mostra o botão (quem pede não dá acesso). */
  darAcesso?: (formData: FormData) => Promise<{ ok?: boolean; erro?: string; pessoa?: { id: string; nome: string; email: string; funcao: string } }>
  clienteId: string
  pessoas: PessoaNaTabela[]
  /** As funções que quem pede pode atribuir, na ordem da hierarquia. */
  funcoes: { valor: string; rotulo: string; detalhe?: string }[]
  trocarFuncao: (usuarioId: string, funcao: string) => Promise<Resultado>
  pendencias: (usuarioId: string) => Promise<{ ok: boolean; conversas?: number; cartoes?: number; atividades?: number; erro?: string }>
  /**
   * O ajuste fino de acesso (as exceções por pessoa), só na organização. Cada
   * pessoa editável traz o que o editor precisa para abrir já preenchido.
   */
  acesso?: { equipesDaConta: { id: string; nome: string }[]; porPessoa: Record<string, MembroParaAcesso> }
}) {
  const [pessoas, setPessoas] = useState(iniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const [dando, setDando] = useState(false)
  const [ajustando, setAjustando] = useState<MembroParaAcesso | null>(null)
  const [removendo, setRemovendo] = useState<{ pessoa: PessoaNaTabela; pendencias: { conversas: number; cartoes: number; atividades: number } } | null>(null)
  const rotulo = new Map(funcoes.map((funcao) => [funcao.valor, funcao.rotulo]))

  const trocar = (pessoa: PessoaNaTabela, funcao: string) => {
    const anterior = pessoa.funcao
    setPessoas((lista) => lista.map((item) => (item.id === pessoa.id ? { ...item, funcao } : item)))
    comecar(async () => {
      try {
        const r = await trocarFuncao(pessoa.id, funcao)
        if (r.erro || r.ok === false) {
          setPessoas((lista) => lista.map((item) => (item.id === pessoa.id ? { ...item, funcao: anterior } : item)))
          setAviso(r.erro ?? 'não deu para trocar a função')
        } else if (funcao === 'proprietario') {
          // A posse passou: quem era dono vira Administrador, e quem pediu
          // desce junto. A lista acompanha sem recarregar: a nova dona e os
          // administradores deixam de ser editáveis por quem pediu.
          setPessoas((lista) =>
            lista.map((item) => {
              if (item.id === pessoa.id) return { ...item, podeEditar: false }
              const funcaoNova = item.funcao === 'proprietario' ? 'administrador' : item.funcao
              return { ...item, funcao: funcaoNova, podeEditar: item.podeEditar && funcaoNova !== 'administrador' }
            }),
          )
        }
      } catch {
        setPessoas((lista) => lista.map((item) => (item.id === pessoa.id ? { ...item, funcao: anterior } : item)))
        setAviso('sem conexão com o servidor')
      }
    })
  }

  const pedirRemocao = (pessoa: PessoaNaTabela) => {
    comecar(async () => {
      const r = await pendencias(pessoa.id)
      if (!r.ok) {
        setAviso(r.erro ?? 'não deu para conferir o que fica com esta pessoa')
        return
      }
      setRemovendo({ pessoa, pendencias: { conversas: r.conversas ?? 0, cartoes: r.cartoes ?? 0, atividades: r.atividades ?? 0 } })
    })
  }

  const ajustarDa = (pessoa: PessoaNaTabela) =>
    pessoa.podeEditar && acesso?.porPessoa[pessoa.id] ? (
      <button
        type="button"
        onClick={() => setAjustando(acesso.porPessoa[pessoa.id] ?? null)}
        className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-muted transition hover:bg-surface hover:text-ink"
      >
        Ajustar acesso
      </button>
    ) : null

  const removerDa = (pessoa: PessoaNaTabela) =>
    pessoa.podeEditar ? (
      <button
        type="button"
        onClick={() => pedirRemocao(pessoa)}
        title={`Tirar ${pessoa.nome} da organização`}
        aria-label={`Tirar ${pessoa.nome} da organização`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
      >
        <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2.5 4h10M6 4V2.6h3V4M3.8 4l.6 8.6h6.2l.6-8.6" />
        </svg>
      </button>
    ) : null

  const cabecalho = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-dim tabular-nums">
        {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
      </p>
      {darAcesso && (
        <button type="button" onClick={() => setDando(true)} className="app-primary-button px-4 py-2 text-[12.5px]">
          + Dar acesso
        </button>
      )}
    </div>
  )

  const modal = dando && darAcesso && (
    <DarAcesso
      funcoes={funcoes}
      aoFechar={() => setDando(false)}
      enviar={async (dados) => {
        const r = await darAcesso(dados)
        if (r.pessoa) {
          const nova = r.pessoa
          setPessoas((lista) => [
            ...lista.filter((pessoa) => pessoa.id !== nova.id),
            { ...nova, equipes: [], suspensa: false, voce: false, desde: new Date().toISOString(), ultimoAcesso: null, podeEditar: true },
          ])
        }
        return r
      }}
    />
  )

  if (pessoas.length === 0) {
    return (
      <>
        {cabecalho}
        <div className="app-card px-5 py-12 text-center">
          <p className="text-[13px] font-bold">Ninguém com acesso ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-dim">Enquanto isso, só o Suporte 4YU abre esta organização.</p>
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
    {cabecalho}
    {modal}
    <ul className="app-card divide-y divide-line overflow-hidden md:hidden">
      {pessoas.map((pessoa) => (
        <li key={pessoa.id} className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Avatar nome={pessoa.nome} imagem={null} tamanho={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <span className="truncate">{pessoa.nome}</span>
                {pessoa.voce && <Selo>você</Selo>}
              </p>
              <p className="truncate text-[11.5px] text-dim">{pessoa.email}</p>
            </div>
            {pessoa.suspensa && <Selo tom="alerta">Suspensa</Selo>}
            {removerDa(pessoa)}
          </div>
          <div className="mt-3 flex items-center gap-2 pl-12">
            {pessoa.podeEditar && funcoes.some((funcao) => funcao.valor === pessoa.funcao) ? (
              <Dropdown
                rotuloAcessivel={`Função de ${pessoa.nome}`}
                valor={pessoa.funcao}
                aoMudar={(valor) => valor !== pessoa.funcao && trocar(pessoa, valor)}
                opcoes={funcoes}
                className={`min-w-0 flex-1 ${DROPDOWN_COMPACTO}`}
              />
            ) : (
              <span className="flex-1">
                <Selo tom={pessoa.funcao === 'proprietario' ? 'destaque' : 'neutro'}>{rotulo.get(pessoa.funcao) ?? rotuloPadrao(pessoa.funcao)}</Selo>
              </span>
            )}
            {ajustarDa(pessoa)}
          </div>
          <p className="mt-2 pl-12 text-[11.5px] text-dim">
            {pessoa.equipes.length === 0 ? 'sem equipe' : pessoa.equipes.join(', ')} ·{' '}
            {pessoa.ultimoAcesso ? `entrou ${quando(pessoa.ultimoAcesso)}` : 'nunca entrou'}
          </p>
        </li>
      ))}
    </ul>
    <div className="app-card hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
      <RolagemDaTabela>
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${CLASSE_DO_CABECALHO} ${COLUNA_FIXA} z-[3] bg-panel`}>Pessoa</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Função</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Equipe</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Status</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Último acesso</th>
              <th scope="col" className={`${CLASSE_DO_CABECALHO} hidden 2xl:table-cell`}>Desde</th>
              <th scope="col" className="w-12 px-2 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((pessoa) => (
              <tr key={pessoa.id} className={`group border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                  <div className="flex items-center gap-3">
                    <Avatar nome={pessoa.nome} imagem={null} tamanho={32} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-bold">
                        <span className="truncate">{pessoa.nome}</span>
                        {pessoa.voce && <Selo>você</Selo>}
                      </p>
                      <p className="truncate text-[11px] text-dim">{pessoa.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {pessoa.podeEditar && funcoes.some((funcao) => funcao.valor === pessoa.funcao) ? (
                    <Dropdown
                      rotuloAcessivel={`Função de ${pessoa.nome}`}
                      valor={pessoa.funcao}
                      aoMudar={(valor) => valor !== pessoa.funcao && trocar(pessoa, valor)}
                      opcoes={funcoes}
                      className={`w-[152px] ${DROPDOWN_COMPACTO}`}
                    />
                  ) : (
                    <Selo tom={pessoa.funcao === 'proprietario' ? 'destaque' : 'neutro'}>{rotulo.get(pessoa.funcao) ?? rotuloPadrao(pessoa.funcao)}</Selo>
                  )}
                </td>
                <td className="max-w-48 px-4 py-3 text-[12px] text-muted">
                  {pessoa.equipes.length === 0 ? <span className="text-dim">sem equipe</span> : <span className="block truncate">{pessoa.equipes.join(', ')}</span>}
                </td>
                <td className="px-4 py-3">{pessoa.suspensa ? <Selo tom="alerta">Suspensa</Selo> : <Selo tom="ok">Ativa</Selo>}</td>
                <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                  <span title={`Na organização desde ${dataCurta(pessoa.desde)}`}>
                    {pessoa.ultimoAcesso ? <span title={horaExata(pessoa.ultimoAcesso)}>{quando(pessoa.ultimoAcesso)}</span> : <span className="text-dim">nunca entrou</span>}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-[12px] whitespace-nowrap text-muted 2xl:table-cell">
                  {dataCurta(pessoa.desde)}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {ajustarDa(pessoa)}
                    {removerDa(pessoa)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RolagemDaTabela>
    </div>
      {removendo && (
        <RemoverComDestino
          clienteId={clienteId}
          membro={{ id: removendo.pessoa.id, nome: removendo.pessoa.nome }}
          pendencias={removendo.pendencias}
          pessoas={pessoas.filter((pessoa) => pessoa.id !== removendo.pessoa.id).map(({ id, nome }) => ({ id, nome }))}
          remover={remover}
          aoFechar={(removido?: boolean) => {
            if (removido) setPessoas((lista) => lista.filter((pessoa) => pessoa.id !== removendo.pessoa.id))
            setRemovendo(null)
          }}
        />
      )}
      {ajustando && acesso && (
        <EditorDeAcesso clienteId={clienteId} membro={ajustando} equipesDaConta={acesso.equipesDaConta} aoFechar={() => setAjustando(null)} />
      )}
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </>
  )
}

function DarAcesso({
  funcoes,
  aoFechar,
  enviar,
}: {
  funcoes: { valor: string; rotulo: string; detalhe?: string }[]
  aoFechar: () => void
  enviar: (dados: FormData) => Promise<{ ok?: boolean; erro?: string }>
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()
  const padrao = funcoes.some((funcao) => funcao.valor === 'atendente') ? 'atendente' : (funcoes[funcoes.length - 1]?.valor ?? '')
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Dar acesso"
      descricao="E-mail que já tem login só ganha acesso a esta organização. E-mail novo cria o login com a senha provisória abaixo: combine com a pessoa e peça para trocar no primeiro acesso."
      largura={460}
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          const dados = new FormData(evento.currentTarget)
          setErro(null)
          comecar(async () => {
            try {
              const r = await enviar(dados)
              if (r.erro || r.ok === false) setErro(r.erro ?? 'não deu para dar acesso')
              else aoFechar()
            } catch {
              setErro('sem conexão com o servidor')
            }
          })
        }}
      >
        <label>
          <RotuloCampo>E-mail</RotuloCampo>
          <input name="email" type="email" required autoFocus placeholder="Exemplo: ana@studiovega.com.br" className="app-field px-[13px] py-[11px] text-[13.5px]" />
        </label>
        <label>
          <RotuloCampo>Nome (só para login novo)</RotuloCampo>
          <input name="nome" placeholder="Exemplo: Ana Souza" className="app-field px-[13px] py-[11px] text-[13.5px]" />
        </label>
        <label>
          <RotuloCampo>Senha provisória (só para login novo, mín. 10 caracteres)</RotuloCampo>
          <input name="senha" type="password" minLength={10} autoComplete="new-password" className="app-field px-[13px] py-[11px] text-[13.5px]" />
        </label>
        <label>
          <RotuloCampo>Função</RotuloCampo>
          <Dropdown nome="funcao" rotuloAcessivel="Função" valorInicial={padrao} opcoes={funcoes} />
        </label>
        {erro && (
          <p role="alert" className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-1 flex gap-2.5">
          <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]">
            {enviando ? 'Dando acesso…' : 'Dar acesso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function rotuloPadrao(funcao: string): string {
  return { proprietario: 'Proprietário', administrador: 'Administrador', gestor: 'Gestor', atendente: 'Atendente' }[funcao] ?? funcao
}
