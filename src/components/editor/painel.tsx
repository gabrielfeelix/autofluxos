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
      <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
        <p>Clique num bloco para editar.</p>
        <p className="mt-3 text-xs">
          Para ligar dois blocos, arraste da bolinha de baixo (ou da bolinha ao lado de uma opção)
          até o bloco de destino.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {NOMES[no.type]}
        </h3>
        <div className="flex items-center gap-2">
          {ehInicio ? (
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              início
            </span>
          ) : (
            <button
              onClick={aoDefinirInicio}
              className="text-[10px] text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              tornar início
            </button>
          )}
          <button onClick={aoApagar} className="text-[10px] text-red-600 underline">
            apagar
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
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Operador</span>
            <select
              value={no.data.operador}
              onChange={(e) => aoMudarDados({ operador: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
          <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400">
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
        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-400">Variáveis que este fluxo preenche:</p>
          <p className="mt-1 flex flex-wrap gap-1">
            {variaveis.map((v) => (
              <code
                key={v}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800"
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
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
      />
      {dica && <span className="mt-0.5 block text-[10px] text-zinc-400">{dica}</span>}
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
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{rotulo}</span>
      <textarea
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        rows={4}
        className="mt-1 w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
      />
      <span className="mt-0.5 block text-[10px] text-zinc-400">aceita {'{{variavel}}'}</span>
    </label>
  )
}

function Opcoes({ opcoes, aoMudar }: { opcoes: Opcao[]; aoMudar: (opcoes: Opcao[]) => void }) {
  const cheio = opcoes.length >= LIMITE_LISTA

  return (
    <div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Opções</span>

      <div className="mt-1 space-y-1.5">
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
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
            />
            <button
              onClick={() => aoMudar(opcoes.filter((o) => o.id !== opcao.id))}
              title="remover opção"
              className="rounded-lg border border-zinc-300 px-2 text-xs text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
        className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        + adicionar opção
      </button>

      <p className="mt-1.5 text-[10px] text-zinc-400">
        {opcoes.length === 0
          ? 'Sem opções, a pessoa responde escrevendo.'
          : opcoes.length <= LIMITE_BOTOES
            ? `${opcoes.length} de até ${LIMITE_BOTOES} — o WhatsApp mostra como botões.`
            : `${opcoes.length} opções — vira lista suspensa. Fluxo bom cabe em ${LIMITE_BOTOES} botões.`}
        {cheio && ` Limite do WhatsApp é ${LIMITE_LISTA}.`}
      </p>
      <p className="text-[10px] text-zinc-400">
        Cada opção tem a própria saída no bloco. Ligue todas — o validador cobra.
      </p>
    </div>
  )
}
