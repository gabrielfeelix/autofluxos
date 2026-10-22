'use client'

import { useEffect, useState } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { resumoDaMarcacao, type HorarioLivre } from '@/core/formulario-de-agendamento'
import { acaoResponderLead } from '@/server/acoes'
import {
  acaoAlunoNaVerandi,
  acaoDesmarcarAulaPeloInbox,
  acaoMarcarAulaPeloInbox,
  type AulaMarcada,
} from '@/server/acoes-ponte-verandi'
import type { AlunoNaVerandi } from '@/server/ponte-verandi'
import { MarcarAulaNaVerandi } from './marcar-aula-na-verandi'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** `2026-10-23` vira `sex 23/10`. */
function diaCurto(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!m) return data
  const dia = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12)).getUTCDay()
  return `${DIAS[dia]} ${m[3]}/${m[2]}`
}

function tomDaSituacao(situacao: string | null, ativa: boolean): TomDaPilula {
  if (!ativa) return 'neutro'
  const s = (situacao ?? '').toLowerCase()
  if (s.includes('falt') || s.includes('venc') || s.includes('risco')) return 'aviso'
  return 'ok'
}

/**
 * Quem a pessoa é na Verandi, dentro da conversa e da ficha (a ponte): os
 * horários dela, as próximas aulas, quantas reposições tem para marcar e
 * quando veio pela última vez. É o que a recepção abriria outra aba para ver
 * antes de responder "posso trocar minha aula?".
 *
 * Busca depois de abrir, para não atrasar a conversa; sem Verandi ligada ou
 * sem cadastro, não aparece nada.
 *
 * Marca e desmarca daqui mesmo (Marcar aula, Desmarcar), e a lista muda na
 * hora: volta se a Verandi recusar.
 */
export function AlunoDaVerandi({ clienteId, contatoId }: { clienteId: string; contatoId: string }) {
  // Guardado com o contato de quem é: trocar de conversa não mostra o aluno da anterior.
  const [lido, setLido] = useState<{ contatoId: string; aluno: AlunoNaVerandi | null } | null>(null)

  useEffect(() => {
    let vivo = true
    acaoAlunoNaVerandi(clienteId, contatoId)
      .then((aluno) => vivo && setLido({ contatoId, aluno }))
      .catch(() => vivo && setLido({ contatoId, aluno: null }))
    return () => {
      vivo = false
    }
  }, [clienteId, contatoId])

  const [marcando, setMarcando] = useState(false)
  const [erroAoMarcar, setErroAoMarcar] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [desmarcar, setDesmarcar] = useState<string | null>(null)
  const [todas, setTodas] = useState(false)

  const aluno = lido?.contatoId === contatoId ? lido.aluno : null
  if (!aluno) return null

  const trocar = (novo: AlunoNaVerandi) => setLido({ contatoId, aluno: novo })

  const marcar = (h: HorarioLivre) => {
    const antes = aluno
    const reposicao = antes.reposicaoDeId !== null
    setErroAoMarcar(null)
    setMarcando(false)
    setAviso({ tipo: 'marcando', horario: h, reposicao })
    // Otimista: a aula entra na lista agora, e sai se a Verandi recusar.
    trocar({
      ...antes,
      proximas: [...antes.proximas, { participacaoId: `marcando-${h.sessaoId}`, data: h.data, hora: h.hora, servico: h.servico, podeRepor: true }].sort(
        (a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora),
      ),
      reposicoesAbertas: reposicao ? Math.max(0, antes.reposicoesAbertas - 1) : antes.reposicoesAbertas,
      reposicaoDeId: null,
    })
    acaoMarcarAulaPeloInbox(clienteId, contatoId, h.sessaoId)
      .catch((): AulaMarcada => ({ ok: false, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }))
      .then((r) => {
        if (!r.ok) {
          trocar(antes)
          setAviso(null)
          setErroAoMarcar(r.erro)
          setMarcando(true)
          return
        }
        setLido((atual) =>
          atual && atual.aluno
            ? {
                ...atual,
                aluno: {
                  ...atual.aluno,
                  proximas: atual.aluno.proximas.map((p) =>
                    p.participacaoId === `marcando-${h.sessaoId}` ? { ...p, participacaoId: r.participacaoId } : p,
                  ),
                },
              }
            : atual,
        )
        setAviso({ tipo: 'marcada', horario: h, reposicao: r.reposicao, confirmaSozinho: r.confirmaSozinho, janelaAberta: r.janelaAberta })
        // A próxima reposição (se houver outra) vem da Verandi, não de um chute daqui.
        acaoAlunoNaVerandi(clienteId, contatoId)
          .then((novo) => novo && setLido((atual) => (atual?.contatoId === contatoId ? { contatoId, aluno: novo } : atual)))
          .catch(() => undefined)
      })
  }

  const confirmarDesmarcar = (participacaoId: string) => {
    const antes = aluno
    const aula = antes.proximas.find((p) => p.participacaoId === participacaoId)
    if (!aula) return
    setDesmarcar(null)
    setAviso(null)
    trocar({ ...antes, proximas: antes.proximas.filter((p) => p.participacaoId !== participacaoId) })
    acaoDesmarcarAulaPeloInbox(clienteId, contatoId, participacaoId)
      .catch(() => ({ ok: false as const, erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }))
      .then((r) => {
        if (!r.ok) {
          trocar(antes)
          setAviso({ tipo: 'erro', texto: r.erro })
          return
        }
        if (r.temCredito) {
          setLido((atual) =>
            atual && atual.aluno ? { ...atual, aluno: { ...atual.aluno, reposicoesAbertas: atual.aluno.reposicoesAbertas + 1 } } : atual,
          )
        }
        setAviso({
          tipo: 'desmarcada',
          texto: `${diaCurto(aula.data)} ${aula.hora} desmarcada. ${r.temCredito ? 'Ficou uma reposição para marcar.' : 'Fora do prazo, sem reposição.'}`,
        })
        acaoAlunoNaVerandi(clienteId, contatoId)
          .then((novo) => novo && setLido((atual) => (atual?.contatoId === contatoId ? { contatoId, aluno: novo } : atual)))
          .catch(() => undefined)
      })
  }

  const fixos = fixosAgrupados(aluno.horariosFixos)
  const visiveis = todas ? aluno.proximas : aluno.proximas.slice(0, 3)
  const ultima = aluno.ultimaPresenca ? partesDaData(aluno.ultimaPresenca) : null
  // Todas da mesma modalidade: ela vai uma vez no título, e não em cada linha.
  const servicos = [...new Set(aluno.proximas.map((p) => p.servico ?? ''))]
  const servicoUnico = servicos.length === 1 && servicos[0] ? servicos[0] : null

  return (
    <section className="mt-5 rounded-[12px] border border-line bg-surface/50 p-3" aria-label="Na Verandi">
      <header className="flex items-center gap-2">
        <h3 className="whitespace-nowrap text-[12px] font-bold text-soft">Na Verandi</h3>
        {aluno.situacao && <Pilula tom={tomDaSituacao(aluno.situacao, aluno.ativa)}>{aluno.situacao}</Pilula>}
        <span className="flex-1" />
        <a href={aluno.link} target="_blank" rel="noreferrer" className="whitespace-nowrap text-[11.5px] font-semibold text-primary hover:underline">
          Abrir
        </a>
      </header>

      {fixos && (
        <p className="mt-2 text-[11.5px] leading-4 text-dim">
          Horário fixo <span className="font-semibold text-soft">{fixos}</span>
        </p>
      )}

      {aluno.licenca && (
        <p className="mt-2 rounded-[8px] border border-amber-400/40 bg-panel px-2.5 py-1.5 text-[11.5px] leading-4 text-aviso">
          De licença desde {diaCurto(aluno.licenca.inicio)}
          {aluno.licenca.voltaPrevista ? `, volta ${diaCurto(aluno.licenca.voltaPrevista)}` : ''}
        </p>
      )}

      <p className="mt-3 flex items-baseline gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-dim">
        Próximas aulas
        {servicoUnico && <span className="truncate font-semibold normal-case tracking-normal">· {servicoUnico}</span>}
      </p>
      {aluno.proximas.length === 0 ? (
        <p className="mt-1 text-[12px] text-soft">Nenhuma aula marcada.</p>
      ) : (
        <ul className="mt-1.5 grid gap-1">
          {visiveis.map((p) => {
            const pendente = p.participacaoId.startsWith('marcando-')
            const perguntando = desmarcar === p.participacaoId
            const { semana, dia } = partesDaData(p.data)
            return (
              <li key={p.participacaoId} className={`rounded-[9px] border bg-panel px-1.5 py-1.5 ${perguntando ? 'border-rose-400/40' : 'border-line-soft'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex w-[38px] shrink-0 flex-col items-center rounded-[7px] bg-surface py-0.5 leading-tight">
                    <span className="text-[9.5px] font-bold uppercase text-dim">{semana}</span>
                    <span className="text-[11.5px] font-bold tabular-nums text-ink">{dia}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className={`text-[12.5px] font-bold tabular-nums ${pendente ? 'text-dim' : 'text-ink'}`}>{p.hora}</span>
                    {pendente ? (
                      <span className="truncate text-[11px] text-dim">marcando…</span>
                    ) : (
                      !servicoUnico && p.servico && <span className="truncate text-[11px] text-dim">{p.servico}</span>
                    )}
                  </span>
                  {!pendente && !perguntando && (
                    <button
                      type="button"
                      onClick={() => setDesmarcar(p.participacaoId)}
                      aria-label={`Desmarcar ${diaCurto(p.data)} ${p.hora}`}
                      title="Desmarcar"
                      className="grid size-6 shrink-0 place-items-center rounded-[7px] text-dim transition-colors hover:bg-rose-400/[0.12] hover:text-perigo"
                    >
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
                {perguntando && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-1.5 text-[11px] leading-4">
                    <span className={`flex-1 ${p.podeRepor ? 'text-soft' : 'text-aviso'}`}>
                      {p.podeRepor ? 'Desmarcar e deixar reposição?' : 'Fora do prazo: desmarca sem reposição.'}
                    </span>
                    <button type="button" onClick={() => setDesmarcar(null)} className="font-semibold text-dim hover:text-ink">
                      Voltar
                    </button>
                    <button type="button" onClick={() => confirmarDesmarcar(p.participacaoId)} className="font-semibold text-perigo hover:underline">
                      Desmarcar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {aluno.proximas.length > 3 && (
        <button type="button" onClick={() => setTodas(!todas)} className="mt-1 text-[11px] font-semibold text-dim hover:text-ink">
          {todas ? 'Mostrar menos' : `Mais ${aluno.proximas.length - 3} ${aluno.proximas.length - 3 === 1 ? 'aula' : 'aulas'}`}
        </button>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <div className={`rounded-[9px] border bg-panel px-2.5 py-1.5 ${aluno.reposicoesAbertas > 0 ? 'border-primary/40' : 'border-line-soft'}`}>
          <p className={`text-[15px] font-bold tabular-nums leading-5 ${aluno.reposicoesAbertas > 0 ? 'text-primary' : 'text-ink'}`}>{aluno.reposicoesAbertas}</p>
          <p className="text-[10.5px] leading-4 text-dim">{aluno.reposicoesAbertas === 1 ? 'reposição a marcar' : 'reposições a marcar'}</p>
        </div>
        <div className="rounded-[9px] border border-line-soft bg-panel px-2.5 py-1.5">
          <p className="text-[15px] font-bold tabular-nums leading-5 text-ink">
            {ultima ? (
              <>
                {ultima.dia} <span className="text-[11px] font-semibold text-dim">{ultima.semana}</span>
              </>
            ) : (
              'nenhuma'
            )}
          </p>
          <p className="text-[10.5px] leading-4 text-dim">{ultima ? 'última aula' : 'aula feita ainda'}</p>
        </div>
      </div>

      {aviso && (
        <AvisoDaAgenda
          key={'horario' in aviso ? aviso.horario.sessaoId : aviso.tipo}
          aviso={aviso}
          clienteId={clienteId}
          contatoId={contatoId}
          nome={aluno.nome}
          onFechar={() => setAviso(null)}
        />
      )}

      {marcando ? (
        <MarcarAulaNaVerandi
          clienteId={clienteId}
          contatoId={contatoId}
          reposicao={aluno.reposicaoDeId !== null}
          modalidade={aluno.modalidade?.nome || null}
          erroAoMarcar={erroAoMarcar}
          onMarcar={marcar}
          onFechar={() => {
            setMarcando(false)
            setErroAoMarcar(null)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setMarcando(true)
            setAviso(null)
            setErroAoMarcar(null)
          }}
          className="botao-primario botao-sm mt-3 w-full"
        >
          {aluno.reposicaoDeId ? 'Marcar reposição' : 'Marcar aula'}
        </button>
      )}
    </section>
  )
}

/** `2026-10-27` vira `ter` e `27/10`, para o bloco de data. */
function partesDaData(data: string): { semana: string; dia: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!m) return { semana: '', dia: data }
  return { semana: DIAS[new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12)).getUTCDay()]!, dia: `${m[3]}/${m[2]}` }
}

/** Os horários fixos juntos pela hora: `ter e qui, 07:00`, `seg, 07:00 · qua, 18:30`. */
function fixosAgrupados(fixos: AlunoNaVerandi['horariosFixos']): string {
  const porHora = new Map<string, number[]>()
  for (const f of fixos) porHora.set(f.hora, [...(porHora.get(f.hora) ?? []), f.diaSemana])
  return [...porHora.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, dias]) => {
      const nomes = [...new Set(dias)].sort().map((d) => DIAS[d] ?? '')
      const juntos = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0]
      return `${juntos}, ${hora}`
    })
    .join(' · ')
}

type Aviso =
  | { tipo: 'marcando'; horario: HorarioLivre; reposicao: boolean }
  | { tipo: 'marcada'; horario: HorarioLivre; reposicao: boolean; confirmaSozinho: boolean; janelaAberta: boolean }
  | { tipo: 'desmarcada'; texto: string }
  | { tipo: 'erro'; texto: string }

/** O texto da confirmação: `Olá, Ana! Sua aula está marcada para sexta, 23/10 às 07:00, Pilates solo com Marina.` */
function textoDaConfirmacao(h: HorarioLivre, nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0]
  const resumo = resumoDaMarcacao(h)
  return `${primeiro ? `Olá, ${primeiro}! ` : ''}Sua aula está marcada para ${resumo.charAt(0).toLowerCase()}${resumo.slice(1)} Se não puder vir, é só avisar por aqui.`
}

/**
 * O que aconteceu na agenda, logo abaixo da lista. Depois de marcar, oferece a
 * confirmação na conversa quando dá: dentro das 24 horas e sem a automação
 * "Aula marcada", que já confirmaria sozinha.
 */
function AvisoDaAgenda({
  aviso,
  clienteId,
  contatoId,
  nome,
  onFechar,
}: {
  aviso: Aviso
  clienteId: string
  contatoId: string
  nome: string
  onFechar: () => void
}) {
  const [envio, setEnvio] = useState<'parado' | 'enviando' | 'enviado' | { erro: string }>('parado')

  if (aviso.tipo === 'erro' || aviso.tipo === 'desmarcada') {
    return (
      <p
        role="status"
        className={`mt-2.5 rounded-[9px] border px-2.5 py-2 text-[11.5px] leading-4 ${
          aviso.tipo === 'erro' ? 'border-rose-400/40 bg-panel text-perigo' : 'border-line-soft bg-panel text-soft'
        }`}
      >
        {aviso.texto}
      </p>
    )
  }

  const texto = textoDaConfirmacao(aviso.horario, nome)
  const mandar = () => {
    setEnvio('enviando')
    const dados = new FormData()
    dados.set('texto', texto)
    acaoResponderLead(clienteId, contatoId, dados)
      .then((r) => setEnvio(r.ok ? 'enviado' : { erro: r.erro ?? 'A mensagem não saiu.' }))
      .catch(() => setEnvio({ erro: 'A mensagem não saiu.' }))
  }

  return (
    <div role="status" className="mt-2.5 rounded-[9px] border border-emerald-400/50 bg-panel px-2.5 py-2">
      <div className="flex items-baseline gap-2">
        <p className="text-[12px] font-semibold text-ink">
          {aviso.tipo === 'marcando' ? 'Marcando…' : aviso.reposicao ? 'Reposição marcada' : 'Aula marcada'}
        </p>
        <span className="flex-1" />
        {aviso.tipo === 'marcada' && (
          <button type="button" onClick={onFechar} className="text-[11px] font-semibold text-dim hover:text-ink">
            Fechar
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[11.5px] leading-4 text-soft">{resumoDaMarcacao(aviso.horario)}</p>
      {aviso.tipo === 'marcada' &&
        (aviso.confirmaSozinho ? (
          <p className="mt-1.5 text-[11px] leading-4 text-dim">A automação de aula marcada confirma com o aluno.</p>
        ) : !aviso.janelaAberta ? (
          <p className="mt-1.5 text-[11px] leading-4 text-dim">Fora das 24 horas: a confirmação não pode sair como mensagem livre.</p>
        ) : envio === 'enviado' ? (
          <p className="mt-1.5 text-[11px] font-semibold leading-4 text-ok">Confirmação enviada na conversa.</p>
        ) : (
          <div className="mt-2">
            <p className="rounded-[8px] bg-surface px-2 py-1.5 text-[11.5px] leading-4 text-soft">{texto}</p>
            {typeof envio === 'object' && <p className="mt-1 text-[11px] leading-4 text-perigo">{envio.erro}</p>}
            <button type="button" disabled={envio === 'enviando'} onClick={mandar} className="botao-secundario botao-sm mt-2 w-full">
              {envio === 'enviando' ? 'Enviando…' : 'Mandar confirmação na conversa'}
            </button>
          </div>
        ))}
    </div>
  )
}
