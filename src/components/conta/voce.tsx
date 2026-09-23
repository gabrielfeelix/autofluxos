'use client'

import Link from 'next/link'
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { Avatar } from '@/components/design/avatar'
import { CampoDeSenha } from '@/components/design/campo-de-senha'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { BotaoDeTema } from '@/components/design/tema'
import { acaoSair } from '@/server/acoes-conta'
import { acaoEditarPerfil, acaoTrocarSenha } from '@/server/acoes-perfil'

/**
 * "Você": o perfil de quem está usando, no rodapé da barra (tarefa 7.5).
 *
 * O rodapé dizia o nome da **empresa** e nunca quem estava usando. E quem tem
 * acesso de atendimento não entra em Configurações (7.2), então nome, foto e
 * senha próprios não podiam morar lá. O perfil é da pessoa, não da conta.
 *
 * O nome e a foto ficam num contexto porque aparecem em dois lugares (o botão
 * do rodapé e o painel) e salvar precisa mudar os dois na hora, antes de o
 * servidor responder, sem recarregar a página.
 */

type Perfil = { nome: string; imagem: string | null }

const ContextoDoPerfil = createContext<{
  perfil: Perfil
  mudar: (perfil: Perfil | null) => void
} | null>(null)

export function PerfilDaSessao({ inicial, children }: { inicial: Perfil; children: ReactNode }) {
  // Otimista por cima do que o servidor mandou; nulo = vale o do servidor.
  const [otimista, setOtimista] = useState<Perfil | null>(null)
  return (
    <ContextoDoPerfil.Provider value={{ perfil: otimista ?? inicial, mudar: setOtimista }}>
      {children}
    </ContextoDoPerfil.Provider>
  )
}

/** O perfil atual, ou nulo fora do provedor (a tela de carregamento). */
export function usePerfil(): Perfil | null {
  return useContext(ContextoDoPerfil)?.perfil ?? null
}

export function PainelVoce({
  email,
  papel,
  suporte,
  configuracoesHref,
  outrasContas,
  children,
}: {
  email: string
  /** "Proprietário · MGM Pilates". Ignorado quando `suporte`. */
  papel: string
  suporte: boolean
  /** Só para quem pode abrir Configurações (7.2). */
  configuracoesHref: string | null
  outrasContas: number
  /** Disponível/Ausente e Avisos, que vêm prontos do servidor. */
  children: ReactNode
}) {
  const contexto = useContext(ContextoDoPerfil)
  const perfil = contexto?.perfil ?? { nome: '', imagem: null }
  const [aberto, setAberto] = useState<'perfil' | 'senha' | null>(null)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <Avatar nome={perfil.nome} imagem={perfil.imagem} tamanho={52} />
        <span className="min-w-0">
          <strong className="block truncate text-[14.5px] font-bold">{perfil.nome}</strong>
          <span className="block truncate text-[12px] text-dim">{email}</span>
          {suporte ? (
            <span className="mt-1 inline-block rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-bold text-info">
              Suporte 4YU
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-muted">{papel}</span>
          )}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-0.5 border-t border-line pt-3">
        <Linha aoClicar={() => setAberto('perfil')}>Editar perfil</Linha>
        <Linha aoClicar={() => setAberto('senha')}>Trocar senha</Linha>
      </div>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
        {children}
        <BotaoDeTema recolhida={false} />
      </div>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
        {configuracoesHref && <Linha href={configuracoesHref}>Configurações da conta</Linha>}
        {outrasContas > 1 && <Linha href="/contas">Trocar de conta</Linha>}
        <form action={acaoSair}>
          <button
            type="submit"
            className="flex w-full rounded-[10px] px-2 py-2 text-left text-[13px] font-semibold text-dim transition hover:bg-perigo/10 hover:text-perigo"
          >
            Sair
          </button>
        </form>
      </div>

      {aberto === 'perfil' && contexto && (
        <EditarPerfil perfil={perfil} mudar={contexto.mudar} aoFechar={() => setAberto(null)} />
      )}
      {aberto === 'senha' && <TrocarSenha aoFechar={() => setAberto(null)} />}
    </div>
  )
}

function Linha({ href, aoClicar, children }: { href?: string; aoClicar?: () => void; children: ReactNode }) {
  const classe =
    'flex w-full items-center justify-between rounded-[10px] px-2 py-2 text-left text-[13px] font-semibold text-muted transition hover:bg-surface hover:text-ink'
  if (href) {
    return (
      <Link href={href} className={classe}>
        {children}
        <span aria-hidden className="text-dim">›</span>
      </Link>
    )
  }
  return (
    <button type="button" onClick={aoClicar} className={classe}>
      {children}
      <span aria-hidden className="text-dim">›</span>
    </button>
  )
}

/**
 * Recorta no centro, reduz para 256 px e devolve webp. A foto chega pequena ao
 * servidor (dezenas de KB) e quadrada, que é o que o círculo mostra.
 */
async function recortarQuadrada(arquivo: File): Promise<File> {
  const url = URL.createObjectURL(arquivo)
  try {
    const imagem = await new Promise<HTMLImageElement>((resolver, rejeitar) => {
      const i = new Image()
      i.onload = () => resolver(i)
      i.onerror = () => rejeitar(new Error('não deu para ler a imagem'))
      i.src = url
    })
    const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight)
    const tela = document.createElement('canvas')
    tela.width = 256
    tela.height = 256
    tela
      .getContext('2d')!
      .drawImage(
        imagem,
        (imagem.naturalWidth - lado) / 2,
        (imagem.naturalHeight - lado) / 2,
        lado,
        lado,
        0,
        0,
        256,
        256,
      )
    const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, 'image/webp', 0.9))
    if (!blob) throw new Error('não deu para preparar a foto')
    return new File([blob], 'foto.webp', { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function EditarPerfil({
  perfil,
  mudar,
  aoFechar,
}: {
  perfil: Perfil
  mudar: (perfil: Perfil | null) => void
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(perfil.nome)
  const [foto, setFoto] = useState<{ arquivo: File; previa: string } | null>(null)
  const [tirarFoto, setTirarFoto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const imagemNaTela = foto?.previa ?? (tirarFoto ? null : perfil.imagem)

  const escolher = async (arquivo: File | undefined) => {
    setErro(null)
    if (!arquivo) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      setErro('a foto precisa ser jpg, png ou webp')
      return
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro('a foto passa de 2 MB')
      return
    }
    try {
      const quadrada = await recortarQuadrada(arquivo)
      setFoto({ arquivo: quadrada, previa: URL.createObjectURL(quadrada) })
      setTirarFoto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não deu para ler a imagem')
    }
  }

  const salvar = () => {
    if (nome.trim() === '') {
      setErro('o nome não pode ficar vazio')
      return
    }
    setErro(null)
    const anterior = perfil
    // Otimista: o rodapé e o painel mudam já; o servidor grava por trás.
    mudar({ nome: nome.trim(), imagem: imagemNaTela })
    const dados = new FormData()
    dados.set('nome', nome)
    if (foto) dados.set('foto', foto.arquivo)
    if (tirarFoto) dados.set('tirarFoto', '1')
    comecar(async () => {
      const r = await acaoEditarPerfil(dados)
      if (!r.ok) {
        mudar(anterior)
        setErro(r.erro)
        return
      }
      mudar({ nome: r.nome, imagem: r.imagem })
      aoFechar()
    })
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Editar perfil" descricao="Seu nome e sua foto, em todas as contas em que você entra.">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar nome={nome || perfil.nome} imagem={imagemNaTela} tamanho={64} />
          <div className="flex flex-col items-start gap-1.5">
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-muted transition hover:text-ink">
              {imagemNaTela ? 'Trocar foto' : 'Escolher foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => escolher(e.target.files?.[0])}
              />
            </label>
            {imagemNaTela && (
              <button
                type="button"
                onClick={() => {
                  setFoto(null)
                  setTirarFoto(true)
                }}
                className="text-[11.5px] font-semibold text-dim underline-offset-2 hover:underline"
              >
                Tirar foto
              </button>
            )}
            <span className="text-[11px] text-dim">jpg, png ou webp, até 2 MB</span>
          </div>
        </div>

        <label>
          <RotuloCampo>Nome</RotuloCampo>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            autoFocus
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>

        {erro && (
          <p role="alert" className="text-[12px] leading-5 text-perigo">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={rodando}
            className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-ink transition hover:bg-primary-strong disabled:opacity-50"
          >
            {rodando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState(false)
  const [rodando, comecar] = useTransition()

  const enviar = (dados: FormData) => {
    setErro(null)
    comecar(async () => {
      const r = await acaoTrocarSenha(dados)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setFeito(true)
    })
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Trocar senha" descricao="Vale para todas as contas em que você entra com este e-mail.">
      {feito ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-5 text-muted">Senha trocada. Use a nova no próximo acesso.</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-ink transition hover:bg-primary-strong"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            enviar(new FormData(e.currentTarget))
          }}
          className="flex flex-col gap-4"
        >
          <CampoDeSenha rotulo="Senha atual" nome="atual" autoComplete="current-password" autoFocus />
          <CampoDeSenha rotulo="Senha nova (mín. 10 caracteres)" nome="nova" autoComplete="new-password" minimo={10} />
          {erro && (
            <p role="alert" className="text-[12px] leading-5 text-perigo">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={rodando}
              className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-ink transition hover:bg-primary-strong disabled:opacity-50"
            >
              {rodando ? 'Trocando…' : 'Trocar senha'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
