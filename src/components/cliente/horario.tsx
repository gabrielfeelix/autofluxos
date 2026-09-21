'use client'

import { useState } from 'react'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { Dropdown } from '@/components/design/dropdown'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import {
  DIAS_DA_SEMANA,
  atendimentoAberto,
  motivoDeHojeFechado,
  proximaAbertura,
  type Excecao,
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

/**
 * De onde o expediente da Verandi sai.
 *
 * Fixo porque hoje o CRM que fala este contrato é um só. Quando houver outro,
 * isto vira escolha na tela; oferecer um campo de URL livre agora seria pedir
 * que alguém digite um endereço que só nós conhecemos.
 */
const URL_DO_CRM = 'https://verandi.4yu.com.br/api/v1/funcionamento'

/** Uma data solta, no formato que o `<input type="date">` já fala. */
const HOJE = () => new Date().toISOString().slice(0, 10)

export function HorarioDeAtendimentoForm({
  inicial,
  conexoes,
  salvar,
}: {
  inicial: HorarioDeAtendimento | null
  /** Credenciais do cliente, para escolher qual abre a agenda do CRM. */
  conexoes: { id: string; nome: string }[]
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

  const [excecoes, setExcecoes] = useState<Excecao[]>(inicial?.excecoes ?? [])
  /**
   * Puxar do CRM em vez de digitar.
   *
   * Quem usa a Verandi já cadastrou lá o expediente e os feriados. Digitar de
   * novo aqui cria uma segunda verdade, e as duas divergem no primeiro feriado
   * cadastrado de um lado só. Ligado, a semana e os feriados passam a ser
   * leitura: quem manda é a agenda.
   */
  const [doCrm, setDoCrm] = useState(inicial?.origem?.tipo === 'crm')
  const [conexaoId, setConexaoId] = useState(inicial?.origem?.conexaoId ?? conexoes[0]?.id ?? '')

  const horario: HorarioDeAtendimento = {
    fuso,
    dias,
    excecoes,
    origem: doCrm
      ? {
          tipo: 'crm',
          url: URL_DO_CRM,
          ...(conexaoId ? { conexaoId } : {}),
          ...(inicial?.origem?.sincronizadoEm
            ? { sincronizadoEm: inicial.origem.sincronizadoEm }
            : {}),
        }
      : { tipo: 'manual' },
  }
  const aberto = atendimentoAberto(horario)
  const volta = proximaAbertura(horario)
  const feriadoDeHoje = motivoDeHojeFechado(horario)

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
            <strong className="text-soft">O atendimento não tem horário.</strong> Quando o bot passa
            uma conversa para uma pessoa, ele diz “vou te passar para um atendente” a qualquer hora,
            inclusive às 3h da manhã.
          </p>
        ) : (
          <p className="text-[13px] leading-6 text-muted">
            Agora:{' '}
            <strong className={aberto ? 'text-ok' : 'text-aviso'}>
              {aberto ? 'aberto' : 'fechado'}
            </strong>
            {!aberto && (
              <>
                {'. '}Quem for transferido agora ouve{' '}
                <em className="text-soft">
                  “
                  {feriadoDeHoje
                    ? `hoje é ${feriadoDeHoje} e o atendimento está fechado`
                    : 'nosso atendimento está fechado agora'}
                  {volta ? `, voltamos ${volta}` : ''}”
                </em>
                .
              </>
            )}
          </p>
        )}
      </section>

      <div className="mb-4">
        <LinhaLigaDesliga
          titulo="Definir horário de atendimento"
          descricao="Sem isto, a conta é sempre aberta e o bot promete atendente a qualquer hora."
          marcada={ligado}
          aoMudar={setLigado}
          ajuda={
            <AjudaDoCampo
              titulo="Definir horário de atendimento"
              secao="duvidas"
              texto="Sem horário, o bot promete atendente a qualquer hora, inclusive às 3h da manhã."
              detalhes={
                <>
                  <p>
                    Com um horário preenchido, o bloco de “falar com humano” avisa sozinho quem
                    escrever fora do expediente, dizendo quando vocês voltam. Sem ele, a conta é
                    sempre aberta e esse aviso nunca acontece.
                  </p>
                  <p>
                    Mais de uma faixa no mesmo dia serve para almoço fechado. Faixa que termina
                    antes de começar é ignorada: melhor dizer que está fechado do que prometer
                    alguém que não vai responder.
                  </p>
                </>
              }
            />
          }
        />
      </div>

      {ligado && conexoes.length > 0 && (
        <section className="app-card mb-4 px-5 py-4">
          <LinhaLigaDesliga
            titulo="Puxar o horário da agenda (Verandi)"
            descricao="O expediente e os feriados passam a vir de lá, atualizados sozinhos."
            marcada={doCrm}
            aoMudar={setDoCrm}
            ajuda={
              <AjudaDoCampo
                titulo="Puxar o horário da agenda (Verandi)"
                secao="verandi"
                texto="O expediente e os feriados passam a vir da agenda, atualizados sozinhos algumas vezes por dia."
                detalhes={
                  <>
                    <p>
                      Marcando, o expediente e os feriados passam a vir da Verandi, atualizados
                      sozinhos algumas vezes por dia. A grade abaixo vira só leitura.
                    </p>
                    <p>
                      Sem isto, o mesmo horário fica cadastrado em dois lugares, e os dois discordam
                      no primeiro feriado que alguém cadastra só de um lado.
                    </p>
                  </>
                }
              />
            }
          />

          {doCrm && (
            <div className="mt-3 max-w-[280px]">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                Credencial da agenda
              </span>
              <Dropdown
                rotuloAcessivel="Credencial que abre a agenda"
                opcoes={conexoes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                valor={conexaoId}
                aoMudar={setConexaoId}
              />
              <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                {inicial?.origem?.sincronizadoEm
                  ? `Última leitura: ${new Date(inicial.origem.sincronizadoEm).toLocaleString('pt-BR')}`
                  : 'Ainda não foi lido. A primeira leitura acontece na próxima mensagem que chegar.'}
              </span>
            </div>
          )}
        </section>
      )}

      {ligado && (
        <>
          <div className="mb-4 max-w-[280px]">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Fuso horário
              <AjudaDoCampo
                titulo="Fuso horário"
                secao="duvidas"
                texto="Em que fuso as horas abaixo devem ser lidas. O servidor roda em UTC."
                detalhes={
                  <p>
                    O servidor roda em <strong>UTC</strong>, e as horas da grade abaixo são lidas
                    neste fuso. Sem escolher o certo, um estúdio de São Paulo abriria às 5h da manhã
                    para quem escreve.
                  </p>
                }
              />
            </span>
            <Dropdown
              rotuloAcessivel="Fuso horário do atendimento"
              opcoes={FUSOS}
              valor={fuso}
              aoMudar={setFuso}
            />
          </div>

          <ul className="app-card divide-y divide-line overflow-hidden">
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
                        disabled={doCrm}
                        onChange={(e) => mudarFaixa(dia, indice, 'de', e.currentTarget.value)}
                        className="app-field w-[104px] px-2.5 py-1.5 font-mono text-[12.5px]"
                      />
                      <span className="text-[12px] text-dim">até</span>
                      <input
                        type="time"
                        value={faixa.ate}
                        aria-label={`${nome}, fecha às`}
                        disabled={doCrm}
                        onChange={(e) => mudarFaixa(dia, indice, 'ate', e.currentTarget.value)}
                        className="app-field w-[104px] px-2.5 py-1.5 font-mono text-[12.5px]"
                      />
                      <button
                        type="button"
                        aria-label={`Remover faixa de ${nome}`}
                        disabled={doCrm}
                        onClick={() => remover(dia, indice)}
                        className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-rose-400/10 hover:text-perigo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={doCrm}
                  onClick={() => acrescentar(dia)}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
                >
                  + faixa
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={doCrm}
            onClick={repetirNaSemana}
            className="mt-3 text-[11.5px] text-muted underline underline-offset-2 transition hover:text-primary"
          >
            Repetir o primeiro horário de segunda a sexta
          </button>

          {/*
            Feriado é o dia em que a semana mente.

            A grade acima diz "toda quinta das 8h às 18h", e no dia 25 de
            dezembro isso é falso. Sem esta lista, o bot promete atendimento no
            Natal, ninguém responde, e a pessoa fica esperando. É a promessa
            mais cara que o produto sabe fazer.
          */}
          <h2 className="mt-7 mb-3 flex items-center text-[13px] font-bold">
            Feriados e dias fechados
            <AjudaDoCampo
              titulo="Feriados e dias fechados"
              secao="duvidas"
              texto="Fecham o dia inteiro, mesmo que a semana acima diga que abre."
              detalhes={
                <>
                  <p>
                    A grade acima diz “toda quinta das 8h às 18h”, e no dia 25 de dezembro isso é
                    falso. Um dia nesta lista fecha o dia inteiro, mesmo que a semana diga que abre.
                  </p>
                  <p>
                    O motivo aparece na conversa:{' '}
                    <em>“hoje é Natal e o atendimento está fechado”</em>. Sem esta lista, o bot
                    promete atendimento no Natal, ninguém responde, e a pessoa fica esperando.
                  </p>
                </>
              }
            />
          </h2>
          {doCrm && (
            <p className="mb-3 text-[11.5px] leading-5 text-dim">
              Vêm da agenda e são atualizados sozinhos. Para mudar, mexa na Verandi.
            </p>
          )}

          <ul className="app-card divide-y divide-line overflow-hidden">
            {excecoes.length === 0 && (
              <li className="px-4 py-3 text-[12px] text-dim">
                Nenhum dia cadastrado. Nos feriados o bot promete atendimento normalmente.
              </li>
            )}
            {excecoes.map((excecao, indice) => (
              <li key={indice} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <input
                  type="date"
                  value={excecao.data}
                  disabled={doCrm}
                  aria-label="Data fechada"
                  onChange={(e) =>
                    setExcecoes((atual) =>
                      atual.map((x, i) =>
                        i === indice ? { ...x, data: e.currentTarget.value } : x,
                      ),
                    )
                  }
                  className="app-field w-[150px] px-2.5 py-1.5 font-mono text-[12.5px] disabled:opacity-60"
                />
                <input
                  type="text"
                  value={excecao.motivo ?? ''}
                  disabled={doCrm}
                  placeholder="Natal, recesso, reforma…"
                  aria-label="Motivo"
                  onChange={(e) =>
                    setExcecoes((atual) =>
                      atual.map((x, i) =>
                        i === indice ? { ...x, motivo: e.currentTarget.value } : x,
                      ),
                    )
                  }
                  className="app-field min-w-0 flex-1 px-2.5 py-1.5 text-[12.5px] disabled:opacity-60"
                />
                {!doCrm && (
                  <button
                    type="button"
                    aria-label={`Remover ${excecao.data}`}
                    onClick={() => setExcecoes((atual) => atual.filter((_, i) => i !== indice))}
                    className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-rose-400/10 hover:text-perigo"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!doCrm && (
            <button
              type="button"
              onClick={() => setExcecoes((atual) => [...atual, { data: HOJE(), motivo: '' }])}
              className="mt-3 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
            >
              + dia fechado
            </button>
          )}
        </>
      )}
    </FormularioSalvar>
  )
}
