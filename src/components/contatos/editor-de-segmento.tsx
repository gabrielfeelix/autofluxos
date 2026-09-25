'use client'

import { useState, useTransition } from 'react'
import {
  CAMPOS,
  OPERADORES_POR_TIPO,
  FRASE_DO_MOTIVO,
  SEM_VALOR,
  acharCampo,
  type Condicao,
  type MotivoDaExclusao,
  type Operador,
  type Segmento,
} from '@/core/segmentos'
import { Dropdown } from '@/components/design/dropdown'
import {
  acaoCriarSegmento,
  acaoPrevisualizarSegmento,
  acaoSalvarSegmento,
  type RespostaDaPrevia,
} from '@/server/acoes-segmentos'
import type { SegmentoSalvo } from '@/server/repos/segmentos'

/**
 * O editor de segmento, com prévia explicável (UI-14, RB-39).
 *
 * ---------------------------------------------------------------------------
 * Por que a prévia mostra três números e não um
 * ---------------------------------------------------------------------------
 *
 * "52 pessoas" é o número que engana. A pergunta de quem vai disparar é outra:
 * **quantas vão receber, e por que as outras não.** Um segmento pode casar com
 * 52 e entregar 11, porque estar no segmento não autoriza mensagem (RB-39): a
 * janela de 24h, o modelo aprovado e o número de WhatsApp decidem isso, e
 * decidem de novo no instante do envio.
 *
 * Por isso a prévia separa correspondentes, elegíveis e excluídos **por
 * motivo**, e mostra uma amostra de nomes: um número sozinho é o que ninguém
 * confere antes de confirmar.
 *
 * ---------------------------------------------------------------------------
 * Por que os campos vêm de uma lista e o valor nunca vira SQL
 * ---------------------------------------------------------------------------
 *
 * O `select` é populado de `CAMPOS`, e o operador de `OPERADORES_POR_TIPO`. O
 * servidor revalida as duas coisas de qualquer jeito, porque esconder um campo
 * aqui não impede ninguém de mandar a condição direto.
 */
export function EditorDeSegmento({
  clienteId,
  segmentoId,
  nomeInicial = '',
  regraInicial,
  aoSalvar,
  aoEnviar,
  erroInicial,
  aoCancelar,
}: {
  clienteId: string
  /** Ausente = criando um segmento novo. */
  segmentoId?: string
  nomeInicial?: string
  regraInicial?: Segmento
  /** Recebe o segmento como ficou gravado, para a tabela mudar sem recarregar. */
  aoSalvar?: (segmento: SegmentoSalvo) => void
  /**
   * Quem abriu o editor grava por conta própria, sem esperar aqui: a tabela de
   * segmentos fecha o editor e mostra a linha no clique (25/set). Sem isto, o
   * editor espera o servidor como antes.
   */
  aoEnviar?: (pedido: { nome: string; regra: Segmento }) => void
  /** O motivo de uma recusa anterior, quando o editor reabre por causa dela. */
  erroInicial?: string | null
  aoCancelar?: () => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [juncao, setJuncao] = useState<'todas' | 'qualquer'>(regraInicial?.juncao ?? 'todas')
  const [condicoes, setCondicoes] = useState<Condicao[]>(regraInicial?.condicoes ?? [])
  const [comModelo, setComModelo] = useState(true)
  const [previa, setPrevia] = useState<RespostaDaPrevia | null>(null)
  /** A regra que produziu a prévia na tela. Mudou depois? A prévia é velha. */
  const [regraDaPrevia, setRegraDaPrevia] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(erroInicial ?? null)
  const [rodando, comecar] = useTransition()

  const regra: Segmento = { juncao, condicoes }
  const assinatura = JSON.stringify({ regra, comModelo })
  const previaVelha = previa !== null && regraDaPrevia !== assinatura

  return (
    <div className="flex flex-col gap-5">
      <label>
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
          Nome do segmento
        </span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          placeholder="Exemplo: clientes sem comprar há 90 dias"
          className="app-field w-full px-[13px] py-[11px] text-[13.5px]"
        />
      </label>

      <div>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            Quem entra
          </span>
          {condicoes.length === 0 ? (
            <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-[11px] font-semibold text-aviso">
              Todos os contatos
            </span>
          ) : (
            <>
              <span className="text-[12px] text-dim">quem cumpre</span>
              <div className="w-52">
                <Dropdown
                  rotuloAcessivel="Como as condições se combinam"
                  valor={juncao}
                  aoMudar={(v) => setJuncao(v as 'todas' | 'qualquer')}
                  opcoes={[
                    { valor: 'todas', rotulo: 'todas as condições' },
                    { valor: 'qualquer', rotulo: 'qualquer condição' },
                  ]}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {condicoes.map((condicao, i) => (
            <LinhaDaCondicao
              key={i}
              condicao={condicao}
              aoMudar={(nova) =>
                setCondicoes((atuais) => atuais.map((c, j) => (j === i ? nova : c)))
              }
              aoRemover={() => setCondicoes((atuais) => atuais.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setCondicoes((atuais) => [
              ...atuais,
              { campo: CAMPOS[0].chave, operador: 'igual', valor: '' },
            ])
          }
          className="app-secondary-button mt-2.5 h-9 px-3.5 text-[12.5px]"
        >
          + Adicionar condição
        </button>

        {condicoes.length === 0 && (
          <p className="mt-2 text-[11px] leading-4 text-dim">
            Sem condição nenhuma, o segmento é <strong>todos os contatos</strong>.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
        <label className="flex max-w-[420px] items-start gap-2.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={comModelo}
            onChange={(e) => setComModelo(e.target.checked)}
            className="mt-0.5 accent-[var(--color-primary)]"
          />
          <span>
            O envio usa modelo aprovado
            <span className="block text-[11px] leading-4 text-dim">
              Com modelo, quem está fora da janela de 24h ainda pode receber. Sem
              modelo, o envio é texto livre e a janela é a lei.
            </span>
          </span>
        </label>

        <button
          type="button"
          disabled={rodando}
          onClick={previsualizar}
          className="app-secondary-button h-9 px-3.5 text-[12.5px] disabled:opacity-50"
        >
          {rodando ? 'Calculando…' : 'Ver quem entra'}
        </button>
      </div>

      {/*
        A prévia é de uma regra. Mudar condição, junção ou o modelo depois
        dela deixa os números valendo para outra coisa (8.4, X12): eles ficam
        na tela, apagados e com o aviso, até alguém pedir a prévia de novo.
      */}
      {previa?.ok && previaVelha && (
        <p role="status" className="text-[11.5px] leading-5 font-semibold text-aviso">
          A regra mudou depois desta prévia. Os números abaixo estão desatualizados: clique em
          Ver prévia de novo.
        </p>
      )}
      {previa?.ok && (
        <div className={previaVelha ? 'opacity-45' : undefined}>
          <Prevalencia previa={previa} />
        </div>
      )}
      {previa && !previa.ok && (
        <p role="alert" className="text-[11.5px] leading-5 text-perigo">
          {previa.erro}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {aoCancelar && (
          <button type="button" onClick={aoCancelar} disabled={rodando} className="app-secondary-button h-9 px-4 text-[13px]">
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={rodando || nome.trim() === ''}
          onClick={salvar}
          className="app-primary-button h-9 px-4 text-[13px] disabled:opacity-50"
        >
          {segmentoId ? 'Salvar segmento' : 'Criar segmento'}
        </button>
      </div>

      {segmentoId && (
        <p className="text-[10.5px] leading-4 text-dim">
          Salvar muda a regra daqui para a frente. As transmissões já
          confirmadas <strong>não mudam</strong>: a lista delas foi congelada no
          momento da confirmação.
        </p>
      )}
    </div>
  )

  function previsualizar() {
    setErro(null)
    comecar(async () => {
      const pedida = assinatura
      setPrevia(await acaoPrevisualizarSegmento(clienteId, regra, { comModelo }))
      setRegraDaPrevia(pedida)
    })
  }

  function salvar() {
    setErro(null)
    if (aoEnviar) return aoEnviar({ nome, regra })
    comecar(async () => {
      const r = segmentoId
        ? await acaoSalvarSegmento(clienteId, segmentoId, nome, regra)
        : await acaoCriarSegmento(clienteId, nome, regra)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para salvar')
        return
      }
      if (r.segmento) aoSalvar?.(r.segmento)
    })
  }
}

function LinhaDaCondicao({
  condicao,
  aoMudar,
  aoRemover,
}: {
  condicao: Condicao
  aoMudar: (nova: Condicao) => void
  aoRemover: () => void
}) {
  const campo = acharCampo(condicao.campo)
  const operadores = campo ? OPERADORES_POR_TIPO[campo.tipo] : []
  const precisaDeValor = !SEM_VALOR.includes(condicao.operador)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-surface-strong/40 p-2">
      <div className="min-w-[180px] flex-[1.4]">
        <Dropdown
          rotuloAcessivel="Campo"
          valor={condicao.campo}
          aoMudar={(valor) => {
            const novo = acharCampo(valor)
            // Trocar de campo pode invalidar o operador: "contém" não existe em
            // data. Cair no primeiro válido evita um estado que o servidor
            // recusaria sem a pessoa entender por quê.
            const operadorValido = novo && OPERADORES_POR_TIPO[novo.tipo].includes(condicao.operador)
            aoMudar({
              campo: valor,
              operador: operadorValido
                ? condicao.operador
                : ((novo ? OPERADORES_POR_TIPO[novo.tipo][0] : 'igual') as Operador),
              valor: '',
            })
          }}
          opcoes={CAMPOS.map((c) => ({ valor: c.chave, rotulo: c.rotulo.charAt(0).toUpperCase() + c.rotulo.slice(1) }))}
        />
      </div>

      <div className="min-w-[150px] flex-1">
        <Dropdown
          rotuloAcessivel="Operador"
          valor={condicao.operador}
          aoMudar={(valor) => {
            const operador = valor as Operador
            // "Há mais de N dias" guarda um número; "depois de" guarda uma data.
            // Trocar entre os dois leva o valor junto só se ele ainda servir.
            const emDias = (op: Operador) => op === 'ha_mais_de_dias' || op === 'ha_menos_de_dias'
            const mudouDeEspecie = campo?.tipo === 'data' && emDias(operador) !== emDias(condicao.operador)
            aoMudar(mudouDeEspecie ? { ...condicao, operador, valor: '', ate: undefined } : { ...condicao, operador })
          }}
          opcoes={operadores.map((op) => ({ valor: op, rotulo: ROTULO_DO_OPERADOR[op] }))}
        />
      </div>

      {precisaDeValor &&
        (campo?.tipo === 'opcao' && campo.opcoes ? (
          <div className="min-w-[150px] flex-1">
            <Dropdown
              rotuloAcessivel="Valor"
              valor={condicao.valor ?? ''}
              aoMudar={(valor) => aoMudar({ ...condicao, valor })}
              opcoes={[{ valor: '', rotulo: 'Escolha' }, ...campo.opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao }))]}
            />
          </div>
        ) : (
          <input
            value={condicao.valor ?? ''}
            onChange={(e) => aoMudar({ ...condicao, valor: e.target.value })}
            placeholder={campo?.tipo === 'data' ? 'Exemplo: 30 (dias) ou 2026-01-31' : 'Exemplo: Maringá'}
            aria-label="Valor"
            className="app-field h-10 min-w-[150px] flex-1 px-3 text-[13px]"
          />
        ))}

      {condicao.operador === 'entre' && (
        <input
          value={condicao.ate ?? ''}
          onChange={(e) => aoMudar({ ...condicao, ate: e.target.value })}
          placeholder="até"
          aria-label="Fim do intervalo"
          className="app-field h-10 w-[100px] px-3 text-[13px]"
        />
      )}

      <button
        type="button"
        onClick={aoRemover}
        aria-label="Remover condição"
        title="Remover condição"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[16px] text-dim transition hover:bg-surface-strong hover:text-perigo"
      >
        ×
      </button>
    </div>
  )
}

const ROTULO_DO_OPERADOR: Record<Operador, string> = {
  igual: 'é',
  diferente: 'não é',
  contem: 'contém',
  maior: 'maior que',
  menor: 'menor que',
  entre: 'entre',
  preenchido: 'está preenchido',
  nao_informado: 'não informado',
  ha_mais_de_dias: 'há mais de (dias)',
  ha_menos_de_dias: 'há menos de (dias)',
}

function Prevalencia({ previa }: { previa: Extract<RespostaDaPrevia, { ok: true }> }) {
  const { correspondentes, elegiveis, excluidos, gratuitas, custoNaoConfirmado } = previa.previa
  const motivos = Object.entries(excluidos).filter(([, quantos]) => quantos > 0) as [
    MotivoDaExclusao,
    number,
  ][]

  return (
    <section className="app-card px-4 py-3">
      <p className="mb-2 text-[11.5px] leading-5 text-dim">
        Quem entra: <strong>{previa.explicacao}</strong>
      </p>

      <div className="flex flex-wrap gap-4 text-[12.5px]">
        <span>
          <strong className="text-[16px] tabular-nums">{correspondentes}</strong>
          <span className="block text-[10.5px] text-dim">correspondem</span>
        </span>
        <span>
          <strong className="text-[16px] tabular-nums">{elegiveis}</strong>
          <span className="block text-[10.5px] text-dim">podem receber agora</span>
        </span>
        <span>
          <strong className="text-[16px] tabular-nums">{correspondentes - elegiveis}</strong>
          <span className="block text-[10.5px] text-dim">excluídos</span>
        </span>
      </div>

      {motivos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {motivos.map(([motivo, quantos]) => (
            <li key={motivo} className="text-[11px] leading-4 text-dim">
              {quantos} · {FRASE_DO_MOTIVO[motivo]}
            </li>
          ))}
        </ul>
      )}

      {/*
        O custo é dito em três valores, e não dois: fora das 72h da porta de
        entrada o preço depende da categoria do modelo, e afirmar "paga" seria
        prometer um número que ninguém calculou.
      */}
      <p className="mt-2 text-[11px] leading-4 text-dim">
        {gratuitas > 0 && `${gratuitas} sairiam sem custo. `}
        {custoNaoConfirmado > 0 && `${custoNaoConfirmado} com custo não confirmado.`}
      </p>

      {previa.amostra.length > 0 && (
        <p className="mt-2 text-[11px] leading-4 text-dim">
          Por exemplo: {previa.amostra.map((c) => c.nome ?? 'sem nome').join(', ')}
          {previa.previa.correspondentes > previa.amostra.length && '…'}
        </p>
      )}

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        A elegibilidade é conferida <strong>de novo no instante do envio</strong>:
        a janela de 24h fecha sozinha, e quem é elegível agora pode não ser
        quando a mensagem sair.
      </p>
    </section>
  )
}
