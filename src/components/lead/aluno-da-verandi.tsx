'use client'

import { useEffect, useState } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { acaoAlunoNaVerandi } from '@/server/acoes-ponte-verandi'
import type { AlunoNaVerandi } from '@/server/ponte-verandi'

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

  const aluno = lido?.contatoId === contatoId ? lido.aluno : null
  if (!aluno) return null

  const fixos = aluno.horariosFixos.map((h) => `${DIAS[h.diaSemana] ?? ''} ${h.hora}`).join(', ')
  return (
    <section className="mt-5 rounded-[12px] border border-line bg-surface/50 p-3" aria-label="Na Verandi">
      <header className="flex items-center gap-2">
        <h3 className="text-[12px] font-bold text-soft">Na Verandi</h3>
        {aluno.situacao && <Pilula tom={tomDaSituacao(aluno.situacao, aluno.ativa)}>{aluno.situacao}</Pilula>}
        <span className="flex-1" />
        <a href={aluno.link} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-primary hover:underline">
          Abrir
        </a>
      </header>
      <dl className="mt-2 space-y-1.5 text-[12px] leading-5">
        {fixos && (
          <div className="flex gap-2">
            <dt className="w-[86px] shrink-0 text-dim">Horários</dt>
            <dd className="min-w-0 text-soft">{fixos}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-[86px] shrink-0 text-dim">Próximas</dt>
          <dd className="min-w-0 text-soft">
            {aluno.proximas.length === 0
              ? 'nenhuma aula marcada'
              : aluno.proximas.map((p) => `${diaCurto(p.data)} ${p.hora}`).join(' · ')}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[86px] shrink-0 text-dim">Reposições</dt>
          <dd className={aluno.reposicoesAbertas > 0 ? 'font-semibold text-ink' : 'text-soft'}>
            {aluno.reposicoesAbertas === 0
              ? 'nenhuma em aberto'
              : `${aluno.reposicoesAbertas} para marcar`}
          </dd>
        </div>
        {aluno.ultimaPresenca && (
          <div className="flex gap-2">
            <dt className="w-[86px] shrink-0 text-dim">Última aula</dt>
            <dd className="text-soft">{diaCurto(aluno.ultimaPresenca)}</dd>
          </div>
        )}
        {aluno.licenca && (
          <div className="flex gap-2">
            <dt className="w-[86px] shrink-0 text-dim">Licença</dt>
            <dd className="text-soft">
              desde {diaCurto(aluno.licenca.inicio)}
              {aluno.licenca.voltaPrevista ? `, volta ${diaCurto(aluno.licenca.voltaPrevista)}` : ''}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
