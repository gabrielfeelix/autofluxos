'use client'

import {
  LIMITE_BOTOES,
  LIMITE_LISTA,
  LIMITE_ROTULO,
  OPERADORES,
  type No,
  type Opcao,
} from '@/core/flow/schema'
import { NOMES } from './nos'

/**
 * O formulário do bloco selecionado. Tudo que é específico de um cliente é
 * digitado aqui e vai parar no JSON do fluxo — nunca no código.
 */
export function Painel({
  no,
  ehInicio,
  variaveis,
  aoMudarDados,
  aoDefinirInicio,
  aoApagar,
}: {
  no: No | null
  ehInicio: boolean
  variaveis: string[]
  aoMudarDados: (dados: Record<string, unknown>) => void
  aoDefinirInicio: () => void
  aoApagar: () => void
}) {
  if (!no) {
    return (
      <div className="m-4 rounded-[14px] border border-dashed border-white/10 px-[18px] py-[34px] text-center text-[12.5px] leading-6 text-dim">
        Selecione um bloco na área de desenho
        <br />
        ou adicione um novo pelo catálogo.
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.05] text-[13px] text-accent">{NOMES[no.type].slice(0, 1)}</span>
          {NOMES[no.type]}
        </h3>
        <div className="flex items-center gap-2">
          {ehInicio ? (
            <span className="rounded-lg border border-accent/30 bg-accent/[0.12] px-2.5 py-1 text-[10px] font-bold text-accent">
              INÍCIO
            </span>
          ) : (
            <button
              onClick={aoDefinirInicio}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
            >
              Tornar início
            </button>
          )}
          <button onClick={aoApagar} className="rounded-lg border border-rose-400/30 px-2.5 py-1 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-400/10">
            Apagar
          </button>
        </div>
      </div>

      {no.type === 'mensagem' && (
        <Area rotulo="Texto" valor={no.data.texto} aoMudar={(texto) => aoMudarDados({ texto })} />
      )}

      {no.type === 'pergunta' && (
        <>
          <Area rotulo="Pergunta" valor={no.data.texto} aoMudar={(texto) => aoMudarDados({ texto })} />
          <Linha
            rotulo="Guardar resposta em"
            valor={no.data.salvarEm ?? ''}
            dica="nome sem espaço nem acento, ex: nome, prazo"
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
          <Opcoes
            opcoes={no.data.opcoes}
            aoMudar={(opcoes) => aoMudarDados({ opcoes })}
          />
        </>
      )}

      {no.type === 'condicao' && (
        <>
          <Linha
            rotulo="Variável"
            valor={no.data.variavel}
            aoMudar={(variavel) => aoMudarDados({ variavel })}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Operador</span>
            <select
              value={no.data.operador}
              onChange={(e) => aoMudarDados({ operador: e.target.value })}
              className="app-field px-3 py-2.5 text-[13px]"
            >
              {OPERADORES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          {no.data.operador !== 'vazio' && no.data.operador !== 'preenchido' && (
            <Linha rotulo="Valor" valor={no.data.valor} aoMudar={(valor) => aoMudarDados({ valor })} />
          )}
        </>
      )}

      {no.type === 'salvar-campo' && (
        <>
          <Linha rotulo="Campo" valor={no.data.campo} aoMudar={(campo) => aoMudarDados({ campo })} />
          <Linha
            rotulo="Valor"
            valor={no.data.valor}
            dica="aceita {{variavel}}"
            aoMudar={(valor) => aoMudarDados({ valor })}
          />
        </>
      )}

      {no.type === 'ia' && (
        <>
          <Area
            rotulo="Instrução para a IA"
            valor={no.data.instrucao}
            aoMudar={(instrucao) => aoMudarDados({ instrucao })}
          />
          <Linha
            rotulo="Guardar resposta em"
            valor={no.data.salvarEm ?? ''}
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
          <p className="rounded-[10px] border border-violet-400/20 bg-violet-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-violet-300">
            IA é plano à parte (Etapa 2). Enquanto o cliente não tiver contratado, o simulador
            mostra a chamada mas não chama modelo nenhum.
          </p>
        </>
      )}

      {no.type === 'handoff' && (
        <>
          <Area
            rotulo="Mensagem antes de passar"
            valor={no.data.mensagem}
            aoMudar={(mensagem) => aoMudarDados({ mensagem })}
          />
          <Linha
            rotulo="Motivo (interno)"
            valor={no.data.motivo}
            dica="aparece no painel; aceita {{variavel}}"
            aoMudar={(motivo) => aoMudarDados({ motivo })}
          />
        </>
      )}

      {variaveis.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[10px] font-bold tracking-[0.05em] text-muted uppercase">Variáveis deste fluxo</p>
          <p className="mt-1 text-[11px] text-dim">Use essas variáveis nos textos com chaves duplas.</p>
          <p className="mt-1 flex flex-wrap gap-1">
            {variaveis.map((v) => (
              <code
                key={v}
                className="rounded-[7px] border border-accent/[0.22] bg-accent/[0.09] px-2 py-1 font-mono text-[10px] text-[#8de2fa]"
              >{`{{${v}}}`}</code>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  dica,
  aoMudar,
}: {
  rotulo: string
  valor: string
  dica?: string
  aoMudar: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="app-field px-3 py-2.5 text-[13px]"
      />
      {dica && <span className="mt-1 block text-[10.5px] text-dim">{dica}</span>}
    </label>
  )
}

function Area({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">{rotulo}</span>
      <textarea
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        rows={4}
        className="app-field resize-y px-3 py-2.5 text-[13px] leading-5"
      />
      <span className="mt-1 block text-[10.5px] text-dim">aceita {'{{variavel}}'}</span>
    </label>
  )
}

function Opcoes({ opcoes, aoMudar }: { opcoes: Opcao[]; aoMudar: (opcoes: Opcao[]) => void }) {
  const cheio = opcoes.length >= LIMITE_LISTA

  return (
    <div>
      <div className="mb-1.5 flex items-baseline">
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Opções</span>
        <span className="ml-auto font-mono text-[10px] text-dim">{opcoes.length}/{LIMITE_LISTA}</span>
      </div>

      <div className="space-y-1.5">
        {opcoes.map((opcao, i) => (
          <div key={opcao.id} className="flex gap-1.5">
            <input
              value={opcao.rotulo}
              maxLength={LIMITE_ROTULO}
              onChange={(e) => {
                const copia = [...opcoes]
                copia[i] = { ...opcao, rotulo: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <button
              onClick={() => aoMudar(opcoes.filter((o) => o.id !== opcao.id))}
              title="remover opção"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        disabled={cheio}
        onClick={() =>
          aoMudar([...opcoes, { id: crypto.randomUUID().slice(0, 8), rotulo: 'Nova opção' }])
        }
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
      >
        + adicionar opção
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        {opcoes.length === 0
          ? 'Sem opções, a pessoa responde escrevendo.'
          : opcoes.length <= LIMITE_BOTOES
            ? `${opcoes.length} de até ${LIMITE_BOTOES} — o WhatsApp mostra como botões.`
            : `${opcoes.length} opções — vira lista suspensa. Fluxo bom cabe em ${LIMITE_BOTOES} botões.`}
        {cheio && ` Limite do WhatsApp é ${LIMITE_LISTA}.`}
      </p>
      <p className="text-[10.5px] leading-4 text-dim">
        Cada opção tem a própria saída no bloco. Ligue todas — o validador cobra.
      </p>
    </div>
  )
}
