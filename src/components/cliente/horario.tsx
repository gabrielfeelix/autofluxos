'use client'

import { useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { Dropdown } from '@/components/design/dropdown'
import {
  DIAS_DA_SEMANA,
  atendimentoAberto,
  proximaAbertura,
  type Faixa,
  type HorarioDeAtendimento,
} from '@/core/horario'

/**
 * O expediente do atendimento humano.
 *
 * **A tela mostra o efeito, não só o formulário.** O campo que decide se o bot
 * promete atendimento às 3h da manhã não pode ser preenchido no escuro: o
 * quadro do topo diz, com a configuração da tela, se agora está aberto e o que
 * a pessoa do outro lado ouviria. Sem isso, o único jeito de conferir seria
 * esperar dar meia-noite.
 */

/**
 * Fusos, e só os que fazem sentido aqui.
 *
 * Uma lista completa da IANA são mais de trezentos nomes, e a chance de alguém
 * escolher o errado numa lista desse tamanho é maior que a de precisar de um
 * que não está aqui. Cliente fora destes fala com a gente.
 */
const FUSOS = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília (São Paulo)' },
  { valor: 'America/Manaus', rotulo: 'Manaus' },
  { valor: 'America/Rio_Branco', rotulo: 'Rio Branco' },
  { valor: 'America/Belem', rotulo: 'Belém' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha' },
  { valor: 'Europe/Lisbon', rotulo: 'Lisboa' },
]

const COMERCIAL: Faixa[] = [{ de: '08:00', ate: '18:00' }]

export function HorarioDeAtendimentoForm({
  inicial,
  salvar,
}: {
  inicial: HorarioDeAtendimento | null
  salvar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
}) {
  /**
   * `null` no banco quer dizer **atende sempre**, e a tela precisa dizer isso
   * com todas as letras. Um formulário vazio pareceria "ninguém atende nunca",
   * que é o oposto do que está gravado.
   */
  const [ligado, setLigado] = useState(inicial !== null)
  const [fuso, setFuso] = useState(inicial?.fuso ?? 'America/Sao_Paulo')
  const [dias, setDias] = useState<Faixa[][]>(
    inicial?.dias ?? [[], COMERCIAL, COMERCIAL, COMERCIAL, COMERCIAL, COMERCIAL, []],
  )

  const horario: HorarioDeAtendimento = { fuso, dias }
  const aberto = atendimentoAberto(horario)
  const volta = proximaAbertura(horario)

  const mudarFaixa = (dia: number, indice: number, campo: 'de' | 'ate', valor: string) =>
    setDias((atual) =>
      atual.map((faixas, i) =>
        i === dia ? faixas.map((f, j) => (j === indice ? { ...f, [campo]: valor } : f)) : faixas,
      ),
    )

  const acrescentar = (dia: number) =>
    setDias((atual) =>
      atual.map((faixas, i) => (i === dia ? [...faixas, { de: '08:00', ate: '18:00' }] : faixas)),
    )

  const remover = (dia: number, indice: number) =>
    setDias((atual) =>
      atual.map((faixas, i) => (i === dia ? faixas.filter((_, j) => j !== indice) : faixas)),
    )

  /** Copia o primeiro dia que tem faixa para segunda a sexta. É o caso comum. */
  const repetirNaSemana = () => {
    const modelo = dias.find((faixas) => faixas.length > 0) ?? COMERCIAL
    setDias((atual) =>
      atual.map((faixas, i) => (i >= 1 && i <= 5 ? modelo.map((f) => ({ ...f })) : faixas)),
    )
  }

  return (
    <FormularioSalvar action={salvar} rotulo="Salvar horário">
      {/* O que vai para o servidor é o objeto inteiro, montado aqui. Um
          formulário com um campo por faixa por dia seria trinta campos com
          nomes calculados, e o servidor teria que remontar o mesmo objeto. */}
      <input type="hidden" name="horario" value={ligado ? JSON.stringify(horario) : ''} />

      <section
        className={`app-card mb-4 px-5 py-4 ${ligado && !aberto ? 'border-amber-400/25' : ''}`}
        aria-live="polite"
      >
        {!ligado ? (
          <p className="text-[13px] leading-6 text-muted">
            <strong className="text-soft">O atendimento não tem horário.</strong> Quando o bot
            passa uma conversa para uma pessoa, ele diz “vou te passar para um atendente” a
            qualquer hora — inclusive às 3h da manhã.
          </p>
        ) : (
          <p className="text-[13px] leading-6 text-muted">
            Agora:{' '}
            <strong className={aberto ? 'text-emerald-300' : 'text-amber-300'}>
              {aberto ? 'aberto' : 'fechado'}
            </strong>
            {!aberto && (
              <>
                {' '}— quem for transferido agora ouve{' '}
                <em className="text-soft">
                  “nosso atendimento está fechado{volta ? `, voltamos ${volta}` : ''}”
                </em>
                .
              </>
            )}
          </p>
        )}
      </section>

      <label className="mb-4 flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={ligado}
          onChange={(evento) => setLigado(evento.currentTarget.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        <span className="text-[13px] font-semibold">Definir horário de atendimento</span>
      </label>

      {ligado && (
        <>
          <div className="mb-4 max-w-[280px]">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Fuso horário
            </span>
            <Dropdown
              rotuloAcessivel="Fuso horário do atendimento"
              opcoes={FUSOS}
              valor={fuso}
              aoMudar={setFuso}
            />
            <span className="mt-1 block text-[10.5px] leading-4 text-dim">
              O servidor roda em UTC. Sem isto, um estúdio de São Paulo abriria às 5h.
            </span>
          </div>

          <ul className="app-card divide-y divide-white/[0.045] overflow-hidden">
            {DIAS_DA_SEMANA.map((nome, dia) => (
              <li key={nome} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-[74px] shrink-0 pt-1.5 text-[12.5px] font-semibold capitalize">
                  {nome}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {(dias[dia] ?? []).length === 0 && (
                    <span className="pt-1.5 text-[12px] text-dim">fechado</span>
                  )}

                  {(dias[dia] ?? []).map((faixa, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={faixa.de}
                        aria-label={`${nome}, abre às`}
                        onChange={(e) => mudarFaixa(dia, indice, 'de', e.currentTarget.value)}
                        className="app-field w-[104px] px-2.5 py-1.5 font-mono text-[12.5px]"
                      />
                      <span className="text-[12px] text-dim">até</span>
                      <input
                        type="time"
                        value={faixa.ate}
                        aria-label={`${nome}, fecha às`}
                        onChange={(e) => mudarFaixa(dia, indice, 'ate', e.currentTarget.value)}
                        className="app-field w-[104px] px-2.5 py-1.5 font-mono text-[12.5px]"
                      />
                      <button
                        type="button"
                        aria-label={`Remover faixa de ${nome}`}
                        onClick={() => remover(dia, indice)}
                        className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-rose-400/10 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => acrescentar(dia)}
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
                >
                  + faixa
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={repetirNaSemana}
            className="mt-3 text-[11.5px] text-muted underline underline-offset-2 transition hover:text-accent"
          >
            Repetir o primeiro horário de segunda a sexta
          </button>

          <p className="mt-3 text-[11.5px] leading-5 text-dim">
            Mais de uma faixa no mesmo dia serve para almoço fechado. Faixa que termina antes de
            começar é ignorada — melhor dizer que está fechado do que prometer alguém que não vai
            responder.
          </p>
        </>
      )}
    </FormularioSalvar>
  )
}
