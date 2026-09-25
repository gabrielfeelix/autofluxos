'use client'

import { Dropdown } from '@/components/design/dropdown'

import { useEffect, useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { ATIVIDADE_CRIADA, type AtividadeCriada } from '@/components/inbox/marcar-atividade'
import { horaDoRelogio } from '@/lib/quando'
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

  // "Marcar atividade" (cabeçalho da ficha, Inbox) avisa por evento quando o
  // banco confirma, em vez de recarregar a página para esta lista saber.
  useEffect(() => {
    const aoCriar = (evento: Event) => {
      const { atividade } = (evento as CustomEvent<AtividadeCriada>).detail
      if (atividade.contatoId !== contatoId) return
      setAtividades((atuais) => (atuais.some((a) => a.id === atividade.id) ? atuais : [...atuais, atividade]))
    }
    window.addEventListener(ATIVIDADE_CRIADA, aoCriar)
    return () => window.removeEventListener(ATIVIDADE_CRIADA, aoCriar)
  }, [contatoId])

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
            disabled={titulo.trim() === ''}
            className="app-secondary-button px-3 py-2 text-[12px] disabled:opacity-50"
          >
            Criar
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
                    {/*
                      A hora só aparece quando foi combinada. `prazo` é um
                      instante e sempre tem uma, então imprimi-la sempre faria
                      "14 de out, 12:00" para uma proposta que só tem dia.
                    */}
                    {atividade.horaMarcada && atividade.prazo && ` · ${horaDoRelogio(atividade.prazo)}`}
                    {atividade.responsavelNome && ` · ${atividade.responsavelNome}`}
                  </span>
                  {/*
                    O link da reunião e o endereço da visita ficam à vista: o
                    motivo de terem campo próprio é justamente não precisar
                    abrir nada para achá-los na hora de sair.
                  */}
                  {atividade.onde &&
                    (/^https?:\/\//.test(atividade.onde) ? (
                      <a
                        href={atividade.onde}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-0.5 block truncate text-[11px] text-primary underline"
                      >
                        {atividade.onde}
                      </a>
                    ) : (
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {atividade.onde}
                      </span>
                    ))}
                </span>
                <button
                  type="button"
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

  /**
   * Otimista desde 25/set: a linha aparece no clique com id provisório, que
   * troca pelo do banco quando ele responde. Antes esperava o servidor com
   * "…" no botão, e a linha criada ficava com um id que não dava para
   * concluir até recarregar a ficha.
   */
  function criar() {
    if (titulo.trim() === '') return
    setErro(null)
    const provisoria: Atividade = {
      id: `nova:${Date.now()}`,
      contatoId,
      cartaoId: cartaoId ?? null,
      tipo,
      titulo: titulo.trim(),
      nota: null,
      onde: null,
      horaMarcada: false,
      prazo: prazo ? `${prazo}T12:00:00.000Z` : null,
      responsavelId: null,
      responsavelNome: null,
      situacao: 'aberta',
      concluidaEm: null,
      motivoDoCancelamento: null,
      criadoEm: new Date().toISOString(),
    }
    const pedido = { contatoId, cartaoId: cartaoId ?? null, tipo, titulo, prazo }
    setAtividades((atuais) => [...atuais, provisoria])
    setTitulo('')
    setPrazo('')

    const desfazer = (motivo: string) => {
      setAtividades((atuais) => atuais.filter((a) => a.id !== provisoria.id))
      setTitulo(pedido.titulo)
      setPrazo(pedido.prazo)
      setErro(motivo)
    }
    depoisDaTela(() => acaoCriarAtividade(clienteId, pedido)).then(
      (r) => {
        if (!r.ok || !r.criada) return desfazer(r.erro ?? 'não deu para criar')
        const criada = r.criada
        setAtividades((atuais) =>
          atuais.map((a) => (a.id === provisoria.id ? { ...a, id: criada.id, prazo: criada.prazo } : a)),
        )
      },
      () => desfazer('sem conexão com o servidor'),
    )
  }

  function resolver(atividadeId: string, situacao: 'concluida' | 'cancelada') {
    setErro(null)
    const antes = atividades
    setAtividades((atuais) =>
      atuais.map((a) => (a.id === atividadeId ? { ...a, situacao } : a)),
    )

    depoisDaTela(() => acaoResolverAtividade(clienteId, atividadeId, situacao)).then(
      (r) => {
        if (!r.ok) {
          setAtividades(antes)
          setErro(r.erro ?? 'não deu')
        }
      },
      () => {
        setAtividades(antes)
        setErro('sem conexão com o servidor')
      },
    )
  }

  function reabrir(atividadeId: string) {
    setErro(null)
    const antes = atividades
    setAtividades((atuais) =>
      atuais.map((a) => (a.id === atividadeId ? { ...a, situacao: 'aberta' } : a)),
    )

    depoisDaTela(() => acaoReabrirAtividade(clienteId, atividadeId)).then(
      (r) => {
        if (!r.ok) {
          setAtividades(antes)
          setErro(r.erro ?? 'não deu')
        }
      },
      () => {
        setAtividades(antes)
        setErro('sem conexão com o servidor')
      },
    )
  }
}
