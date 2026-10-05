'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/design/modal'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import {
  ATIVIDADE_CRIADA,
  MarcarAtividade,
  type AtividadeCriada,
} from '@/components/inbox/marcar-atividade'
import { horaDoRelogio } from '@/lib/quando'
import { NOME_DO_TIPO, urgenciaDe, type Atividade, type Urgencia } from '@/core/atividades'
import { acaoReabrirAtividade, acaoResolverAtividade } from '@/server/acoes-atividades'
import { CabecalhoDoTipo } from './tipo-do-passo'
import { VazioDoCartao } from './vazio-do-cartao'
import { IlustracaoAtividades } from '@/components/design/ilustracoes'

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
 *
 * **Criar é um botão no cabeçalho, e não um formulário no topo.** O campo e o
 * dropdown sempre abertos ocupavam o lugar da lista, que é o que se vem ler, e
 * eram uma versão pobre do painel "Marcar atividade" (sem hora, sem onde, sem
 * responsável). Agora o botão abre o mesmo painel do Inbox e do alto da ficha:
 * um jeito só de marcar atividade no produto inteiro.
 */
const TOM: Record<Urgencia, string> = {
  vencida: 'bg-perigo/10 text-perigo',
  hoje: 'bg-amber-400/15 text-aviso',
  futura: 'bg-surface text-muted',
  'sem-prazo': 'bg-surface text-muted',
}

const ROTULO: Record<Urgencia, string> = {
  vencida: 'atrasada',
  hoje: 'hoje',
  futura: '',
  'sem-prazo': 'sem prazo',
}

export function Atividades({
  clienteId,
  contatoId,
  nome,
  atividadesIniciais,
  /** Calculado no servidor: data relativa no cliente diverge na hidratação. */
  agora,
}: {
  clienteId: string
  contatoId: string
  nome: string
  atividadesIniciais: Atividade[]
  agora: number
}) {
  const [atividades, setAtividades] = useState(atividadesIniciais)
  const [marcando, setMarcando] = useState(false)
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
    <section className="app-card overflow-hidden">
      <CabecalhoDoTipo
        titulo="Atividades da equipe"
        quemFaz="uma pessoa da equipe"
        contagem={abertas.length}
        descricao="Lembretes do que alguém precisa fazer: ligar, mandar proposta, visitar. Nada é enviado ao cliente."
        acao={
          <button
            type="button"
            onClick={() => setMarcando(true)}
            className="botao-primario botao-sm shrink-0"
          >
            + Atividade
          </button>
        }
      />

      {abertas.length === 0 ? (
        <VazioDoCartao ilustracao={<IlustracaoAtividades />}>
          Nada marcado para esta pessoa. Use <strong className="text-muted">+ Atividade</strong>{' '}
          para combinar o próximo passo.
        </VazioDoCartao>
      ) : (
        <ul>
          {abertas.map((atividade) => {
            const urgencia = urgenciaDe(atividade, agora)
            return (
              <li
                key={atividade.id}
                className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{atividade.titulo}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-dim">
                    <span
                      className={`rounded-full px-1.5 py-px text-[10.5px] font-semibold ${TOM[urgencia]}`}
                    >
                      {NOME_DO_TIPO[atividade.tipo]}
                      {ROTULO[urgencia] && ` · ${ROTULO[urgencia]}`}
                    </span>
                    {/*
                      A hora só aparece quando foi combinada. `prazo` é um
                      instante e sempre tem uma, então imprimi-la sempre faria
                      "14 de out, 12:00" para uma proposta que só tem dia.
                    */}
                    {atividade.horaMarcada && atividade.prazo && (
                      <span>{horaDoRelogio(atividade.prazo)}</span>
                    )}
                    {atividade.responsavelNome && <span>{atividade.responsavelNome}</span>}
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
                        className="mt-1 block truncate text-[11.5px] text-primary underline"
                      >
                        {atividade.onde}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-[11.5px] text-muted">
                        {atividade.onde}
                      </span>
                    ))}
                </span>
                <button
                  type="button"
                  onClick={() => resolver(atividade.id, 'concluida')}
                  className="botao-secundario botao-sm shrink-0"
                >
                  Concluir
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {resolvidas.length > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-5 py-3 text-[11.5px] font-semibold text-dim transition hover:text-muted">
            {resolvidas.length} resolvida{resolvidas.length === 1 ? '' : 's'}
          </summary>
          <ul className="flex flex-col pb-2">
            {resolvidas.map((atividade) => (
              <li key={atividade.id} className="flex items-center gap-2 px-5 py-1.5">
                <span className="flex-1 text-[12px] text-dim line-through">{atividade.titulo}</span>
                <button
                  type="button"
                  onClick={() => reabrir(atividade.id)}
                  className="text-[11px] text-dim underline transition hover:text-primary"
                >
                  Reabrir
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {erro && (
        <AvisoFlutuante tom="erro" aoSumir={() => setErro(null)}>
          {erro}
        </AvisoFlutuante>
      )}
      {/*
        O mesmo painel do Inbox e do alto da ficha. Ele avisa por
        `ATIVIDADE_CRIADA` quando o banco confirma, e o efeito acima põe a
        nova na lista sem recarregar.
      */}
      <Modal
        aberto={marcando}
        aoFechar={() => setMarcando(false)}
        titulo={`Marcar atividade para ${nome}`}
        descricao="É um lembrete para a equipe, e aparece nesta aba. Nada é enviado ao cliente."
      >
        <MarcarAtividade
          clienteId={clienteId}
          contatoId={contatoId}
          aoFechar={() => setMarcando(false)}
          aoFalhar={setErro}
        />
      </Modal>
    </section>
  )

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
