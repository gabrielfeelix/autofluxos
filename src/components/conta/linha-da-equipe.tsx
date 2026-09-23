'use client'

import { useState, useTransition } from 'react'
import { acaoDefinirPapelNaConta, acaoRemoverDaConta } from '@/server/acoes'
import { acaoPendenciasDoMembro } from '@/server/acoes-acesso'
import type { OpcaoDropdown } from '@/components/design/dropdown'
import { Dropdown } from '@/components/design/dropdown'
import { EditorDeAcesso, type MembroParaAcesso } from './editor-de-acesso'
import { ehPapelDaConta, resumoDoAcesso, rotuloDoPapel, type Politica } from '@/core/permissoes'
import { useConfirmar } from '@/components/design/confirmar'

type Membro = {
  id: string
  nome: string
  email: string
  papel: string
  presenca: string
  /** O acesso desta pessoa, para o editor abrir já preenchido (UI-18). */
  equipes?: string[]
  sobrescritas?: Partial<Politica>
}

/**
 * Uma pessoa da equipe, com o papel dela.
 *
 * Componente de cliente porque as duas ações **recusam com motivo**, "só quem
 * administra a conta mexe na equipe", "esta é a única pessoa dona da conta", e
 * um `<form>` cru jogaria o motivo fora: o clique pareceria não ter funcionado
 * justamente na recusa que precisa ser lida.
 */
export function LinhaDaEquipe({
  clienteId,
  membro,
  papeis,
  podeMexer,
  equipesDaConta = [],
}: {
  clienteId: string
  membro: Membro
  papeis: OpcaoDropdown[]
  podeMexer: boolean
  equipesDaConta?: { id: string; nome: string }[]
}) {
  const [erro, setErro] = useState<string | null>(null)
  const { confirmar, dialogo } = useConfirmar()
  const [papel, setPapel] = useState(membro.papel)
  const [editando, setEditando] = useState<MembroParaAcesso | null>(null)
  const [rodando, comecar] = useTransition()

  // O resumo sai da mesma regra do servidor (`escopoDe`), com o papel da tela:
  // trocar o papel no seletor já muda o resumo, sem esperar a volta.
  const resumo = resumoDoAcesso(
    {
      papel: ehPapelDaConta(papel) ? papel : null,
      usuarioId: membro.id,
      equipes: membro.equipes ?? [],
      sobrescritas: membro.sobrescritas ?? {},
    },
    Object.fromEntries(equipesDaConta.map((equipe) => [equipe.id, equipe.nome])),
  )

  const trocarPapel = (novo: string) => {
    const anterior = papel
    setErro(null)
    setPapel(novo)
    comecar(async () => {
      const r = await acaoDefinirPapelNaConta(clienteId, membro.id, novo)
      if (!r.ok) {
        setPapel(anterior)
        setErro(r.erro ?? 'não deu para trocar o papel')
      }
    })
  }

  /**
   * Remover **conta o que fica pendurado antes de perguntar** (RB-40).
   *
   * "Remover alguém da equipe exige decidir destino das atribuições e
   * atividades abertas; nunca deixar referências sem tratamento." Contar e
   * dizer o número é o mínimo: sem ele, a pessoa confirma sem saber que oito
   * conversas vão ficar sem dono, e descobre pela fila parada.
   */
  const remover = () => {
    setErro(null)
    comecar(async () => {
      const pendencias = await acaoPendenciasDoMembro(clienteId, membro.id)

      const resumo =
        pendencias.ok && (pendencias.conversas || pendencias.cartoes)
          ? ` Ficam sem dono: ${pendencias.conversas ?? 0} conversa(s) e ` +
            `${pendencias.cartoes ?? 0} cartão(ões) aberto(s). ` +
            'Reatribua antes, ou eles voltam para a fila de ninguém.'
          : ''

      confirmar({
        titulo: `Tirar ${membro.nome} desta conta?`,
        descricao: `A pessoa continua existindo no sistema.${resumo}`,
        rotulo: 'Tirar da conta',
        aoConfirmar: () => acaoRemoverDaConta(clienteId, membro.id),
      })
    })
  }

  return (
    <li className="border-b border-line px-5 py-4 last:border-0">
      {dialogo}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-2 text-[13.5px] font-semibold">
            <span
              title={membro.presenca === 'disponivel' ? 'disponível' : 'ausente'}
              className={`size-2 shrink-0 rounded-full ${membro.presenca === 'disponivel' ? 'bg-emerald-400' : 'bg-dim'}`}
            />
            <span className="truncate">{membro.nome}</span>
          </strong>
          <span className="mt-0.5 block truncate text-[11.5px] text-dim">{membro.email}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-4">
            {/* Com o seletor de papel ao lado, repetir o mesmo nome é ruído. */}
            {!(podeMexer && resumo.perfil === rotuloDoPapel(papel)) && (
              <span className="font-semibold text-muted">{resumo.perfil}</span>
            )}
            <span className="text-dim">{resumo.frases.join(' · ')}</span>
            {resumo.alertas.map((alerta) => (
              <span
                key={alerta}
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  alerta === 'sem alcance'
                    ? 'bg-aviso/15 text-aviso'
                    : 'bg-surface text-muted'
                }`}
              >
                {alerta}
              </span>
            ))}
          </span>
        </span>

        {podeMexer ? (
          <>
            <Dropdown
              rotuloAcessivel={`Papel de ${membro.nome}`}
              opcoes={papeis}
              valor={papel}
              aoMudar={trocarPapel}
              desabilitado={rodando}
              className="w-[190px]"
            />
            <button
              type="button"
              disabled={rodando}
              onClick={() =>
                setEditando({
                  id: membro.id,
                  nome: membro.nome,
                  papel,
                  equipes: membro.equipes ?? [],
                  sobrescritas: membro.sobrescritas ?? {},
                })
              }
              className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:text-claro disabled:opacity-50"
            >
              Acesso
            </button>
            <button
              type="button"
              disabled={rodando}
              onClick={remover}
              className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:bg-rose-400/[0.09] hover:text-perigo disabled:opacity-50"
            >
              {rodando ? '…' : 'Remover'}
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-muted">
            {papeis.find((opcao) => opcao.valor === papel)?.rotulo ?? papel}
          </span>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-1.5 text-[11px] leading-4 text-perigo">
          {erro}
        </p>
      )}

      {/* Monta só aberto: o editor guarda o rascunho em estado, e montado
          desde o início ele nasceria com o acesso vazio de antes do clique. */}
      {editando && (
        <EditorDeAcesso
          clienteId={clienteId}
          membro={editando}
          equipesDaConta={equipesDaConta}
          aoFechar={() => setEditando(null)}
        />
      )}
    </li>
  )
}
