'use client'

import { Dropdown } from '@/components/design/dropdown'

import { useState, useTransition } from 'react'
import {
  NOME_DO_TIPO,
  TIPOS_DE_ATIVIDADE,
  urgenciaDe,
  type Atividade,
  type TipoDeAtividade,
  type Urgencia,
} from '@/core/atividades'
import {
  acaoCriarAtividade,
  acaoReabrirAtividade,
  acaoResolverAtividade,
} from '@/server/acoes-atividades'

/**
 * As atividades de um contato (UI-13, T5.3).
 *
 * ---------------------------------------------------------------------------
 * A frase que esta tela precisa dizer, e diz
 * ---------------------------------------------------------------------------
 *
 * **Lembrete não é envio** (RB-33). O rodapé escreve isso porque a confusão é
 * genuína e cara: numa tela de CRM ligada ao WhatsApp, "lembrar de ligar
 * quinta" parece que alguma coisa vai sair no WhatsApp quinta. Não vai, e
 * quem quiser isso usa "Agendar mensagem", que é outro botão, com outra
 * permissão.
 *
 * As cores da urgência acompanham a palavra, nunca a substituem: "vencida"
 * está escrita, e quem não distingue vermelho continua lendo.
 */
const TOM: Record<Urgencia, string> = {
  vencida: 'border-rose-400/50 text-rose-700',
  hoje: 'border-amber-400/50 text-amber-700',
  futura: 'border-line text-dim',
  'sem-prazo': 'border-line text-dim',
}

const ROTULO: Record<Urgencia, string> = {
  vencida: 'vencida',
  hoje: 'hoje',
  futura: '',
  'sem-prazo': 'sem prazo',
}

export function Atividades({
  clienteId,
  contatoId,
  cartaoId,
  atividadesIniciais,
  /** Calculado no servidor: data relativa no cliente diverge na hidratação. */
  agora,
}: {
  clienteId: string
  contatoId: string
  cartaoId?: string | null
  atividadesIniciais: Atividade[]
  agora: number
}) {
  const [atividades, setAtividades] = useState(atividadesIniciais)
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoDeAtividade>('tarefa')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const abertas = atividades.filter((a) => a.situacao === 'aberta')
  const resolvidas = atividades.filter((a) => a.situacao !== 'aberta')

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          criar()
        }}
        className="flex flex-col gap-2"
      >
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="o que precisa ser feito"
          aria-label="O que precisa ser feito"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
        <div className="flex gap-2">
          {/*
            O `Dropdown` do produto, não o `<select>` do sistema: a lista nativa
            abre com a tipografia e o azul do sistema operacional, que não são
            os nossos, e no print ficava uma faixa azul-royal no meio de uma tela
            que não tem essa cor em lugar nenhum.

            O prazo continua `<input type="date">`, e isso é deliberado: o
            calendário nativo traz teclado, formato local e acessibilidade que um
            calendário próprio teria de reconstruir inteiro. A aparência do campo
            fechado é nossa; só a folhinha que abre é do navegador.
          */}
          <span className="flex-1">
            <Dropdown
              valor={tipo}
              aoMudar={(novo) => setTipo(novo as TipoDeAtividade)}
              rotuloAcessivel="Tipo da atividade"
              className="w-full text-[12px]"
              opcoes={TIPOS_DE_ATIVIDADE.map((t) => ({ valor: t, rotulo: NOME_DO_TIPO[t] }))}
            />
          </span>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            aria-label="Prazo"
            className="app-field flex-1 px-2 py-2 text-[12px]"
          />
          <button
            type="submit"
            disabled={rodando || titulo.trim() === ''}
            className="app-secondary-button px-3 py-2 text-[12px] disabled:opacity-50"
          >
            {rodando ? '…' : 'Criar'}
          </button>
        </div>
        <span className="text-[10.5px] leading-4 text-dim">
          Sem data é <strong>algum dia</strong>, e não fica vencida por isso.
        </span>
      </form>

      {erro && (
        <p role="alert" className="text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      {abertas.length === 0 ? (
        <p className="py-3 text-center text-[11.5px] leading-5 text-dim">
          Nada marcado para esta pessoa.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {abertas.map((atividade) => {
            const urgencia = urgenciaDe(atividade, agora)
            return (
              <li
                key={atividade.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${TOM[urgencia]}`}
              >
                <span className="flex-1">
                  <span className="block text-[12.5px] text-fg">{atividade.titulo}</span>
                  <span className="block text-[10.5px] leading-4">
                    {NOME_DO_TIPO[atividade.tipo]}
                    {ROTULO[urgencia] && ` · ${ROTULO[urgencia]}`}
                    {atividade.responsavelNome && ` · ${atividade.responsavelNome}`}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={rodando}
                  onClick={() => resolver(atividade.id, 'concluida')}
                  className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04] disabled:opacity-50"
                >
                  Concluir
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {resolvidas.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[11px] text-dim">
            {resolvidas.length} resolvida{resolvidas.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {resolvidas.map((atividade) => (
              <li key={atividade.id} className="flex items-center gap-2 px-1 py-1">
                <span className="flex-1 text-[11.5px] text-dim line-through">
                  {atividade.titulo}
                </span>
                <button
                  type="button"
                  disabled={rodando}
                  onClick={() => reabrir(atividade.id)}
                  className="text-[10.5px] text-dim underline disabled:opacity-50"
                >
                  reabrir
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/*
        RB-33 escrita na tela: numa tela de CRM ligada ao WhatsApp, "lembrar de
        ligar quinta" parece que alguma coisa sai no WhatsApp quinta.
      */}
      <p className="rounded-lg border border-line bg-surface px-3 py-2 text-[10.5px] leading-4 text-dim">
        Isto é um lembrete para a equipe. <strong>Nada é enviado ao cliente.</strong>{' '}
        Para mandar mensagem numa hora marcada, use <em>Agendar mensagem</em>.
      </p>
    </div>
  )

  function criar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarAtividade(clienteId, {
        contatoId,
        cartaoId: cartaoId ?? null,
        tipo,
        titulo,
        prazo,
      })
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para criar')
        return
      }
      // A lista vem do servidor no próximo render; aqui basta limpar o
      // formulário para o gesto não parecer ignorado.
      setTitulo('')
      setPrazo('')
      const criada: Atividade = {
        id: `nova:${crypto.randomUUID()}`,
        contatoId,
        cartaoId: cartaoId ?? null,
        tipo,
        titulo: titulo.trim(),
        nota: null,
        prazo: prazo ? `${prazo}T12:00:00.000Z` : null,
        responsavelId: null,
        responsavelNome: null,
        situacao: 'aberta',
        concluidaEm: null,
        motivoDoCancelamento: null,
        criadoEm: new Date(agora).toISOString(),
      }
      setAtividades((atuais) => [...atuais, criada])
    })
  }

  function resolver(atividadeId: string, situacao: 'concluida' | 'cancelada') {
    setErro(null)
    const antes = atividades
    setAtividades((atuais) =>
      atuais.map((a) => (a.id === atividadeId ? { ...a, situacao } : a)),
    )

    comecar(async () => {
      const r = await acaoResolverAtividade(clienteId, atividadeId, situacao)
      if (!r.ok) {
        setAtividades(antes)
        setErro(r.erro ?? 'não deu')
      }
    })
  }

  function reabrir(atividadeId: string) {
    setErro(null)
    const antes = atividades
    setAtividades((atuais) =>
      atuais.map((a) => (a.id === atividadeId ? { ...a, situacao: 'aberta' } : a)),
    )

    comecar(async () => {
      const r = await acaoReabrirAtividade(clienteId, atividadeId)
      if (!r.ok) {
        setAtividades(antes)
        setErro(r.erro ?? 'não deu')
      }
    })
  }
}
