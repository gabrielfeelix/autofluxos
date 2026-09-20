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
import {
  acaoCriarSegmento,
  acaoPrevisualizarSegmento,
  acaoSalvarSegmento,
  type RespostaDaPrevia,
} from '@/server/acoes-segmentos'

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
}: {
  clienteId: string
  /** Ausente = criando um segmento novo. */
  segmentoId?: string
  nomeInicial?: string
  regraInicial?: Segmento
  aoSalvar?: () => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [juncao, setJuncao] = useState<'todas' | 'qualquer'>(regraInicial?.juncao ?? 'todas')
  const [condicoes, setCondicoes] = useState<Condicao[]>(regraInicial?.condicoes ?? [])
  const [comModelo, setComModelo] = useState(true)
  const [previa, setPrevia] = useState<RespostaDaPrevia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const regra: Segmento = { juncao, condicoes }

  return (
    <div className="flex flex-col gap-4">
      <label>
        <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
          Nome do segmento
        </span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: clientes sem comprar há 90 dias"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            Quem entra
          </span>
          <select
            value={juncao}
            onChange={(e) => setJuncao(e.target.value as 'todas' | 'qualquer')}
            aria-label="Como as condições se combinam"
            className="app-field px-2 py-1 text-[11.5px]"
          >
            <option value="todas">todas as condições</option>
            <option value="qualquer">qualquer condição</option>
          </select>
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
          className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04]"
        >
          + condição
        </button>

        {condicoes.length === 0 && (
          <p className="mt-2 text-[11px] leading-4 text-dim">
            Sem condição nenhuma, o segmento é <strong>todos os contatos</strong>.
          </p>
        )}
      </div>

      <div className="border-t border-line pt-3">
        <label className="mb-2 flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={comModelo}
            onChange={(e) => setComModelo(e.target.checked)}
          />
          <span>
            O envio usa modelo aprovado
            <span className="block text-[10.5px] leading-4 text-dim">
              Com modelo, quem está fora da janela de 24h ainda pode receber. Sem
              modelo, o envio é texto livre e a janela é a lei.
            </span>
          </span>
        </label>

        <button
          type="button"
          disabled={rodando}
          onClick={previsualizar}
          className="app-secondary-button px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          {rodando ? 'calculando…' : 'Ver prévia'}
        </button>
      </div>

      {previa?.ok && <Prevalencia previa={previa} />}
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

      <button
        type="button"
        disabled={rodando || nome.trim() === ''}
        onClick={salvar}
        className="app-primary-button px-4 py-2.5 text-[13px] disabled:opacity-50"
      >
        {segmentoId ? 'Salvar segmento' : 'Criar segmento'}
      </button>

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
      setPrevia(await acaoPrevisualizarSegmento(clienteId, regra, { comModelo }))
    })
  }

  function salvar() {
    setErro(null)
    comecar(async () => {
      const r = segmentoId
        ? await acaoSalvarSegmento(clienteId, segmentoId, nome, regra)
        : await acaoCriarSegmento(clienteId, nome, regra)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para salvar')
        return
      }
      aoSalvar?.()
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
    <div className="flex flex-wrap gap-2">
      <select
        value={condicao.campo}
        onChange={(e) => {
          const novo = acharCampo(e.target.value)
          // Trocar de campo pode invalidar o operador: "contém" não existe em
          // data. Cair no primeiro válido evita um estado que o servidor
          // recusaria sem a pessoa entender por quê.
          const operadorValido = novo && OPERADORES_POR_TIPO[novo.tipo].includes(condicao.operador)
          aoMudar({
            campo: e.target.value,
            operador: operadorValido
              ? condicao.operador
              : ((novo ? OPERADORES_POR_TIPO[novo.tipo][0] : 'igual') as Operador),
            valor: '',
          })
        }}
        aria-label="Campo"
        className="app-field min-w-0 flex-[1.4] px-2 py-2 text-[12px]"
      >
        {CAMPOS.map((c) => (
          <option key={c.chave} value={c.chave}>
            {c.rotulo}
          </option>
        ))}
      </select>

      <select
        value={condicao.operador}
        onChange={(e) => aoMudar({ ...condicao, operador: e.target.value as Operador })}
        aria-label="Operador"
        className="app-field min-w-0 flex-1 px-2 py-2 text-[12px]"
      >
        {operadores.map((op) => (
          <option key={op} value={op}>
            {ROTULO_DO_OPERADOR[op]}
          </option>
        ))}
      </select>

      {precisaDeValor &&
        (campo?.tipo === 'opcao' && campo.opcoes ? (
          <select
            value={condicao.valor ?? ''}
            onChange={(e) => aoMudar({ ...condicao, valor: e.target.value })}
            aria-label="Valor"
            className="app-field min-w-0 flex-1 px-2 py-2 text-[12px]"
          >
            <option value="">escolha</option>
            {campo.opcoes.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={condicao.valor ?? ''}
            onChange={(e) => aoMudar({ ...condicao, valor: e.target.value })}
            placeholder={campo?.tipo === 'data' ? 'aaaa-mm-dd ou dias' : 'valor'}
            aria-label="Valor"
            className="app-field min-w-0 flex-1 px-2 py-2 text-[12px]"
          />
        ))}

      {condicao.operador === 'entre' && (
        <input
          value={condicao.ate ?? ''}
          onChange={(e) => aoMudar({ ...condicao, ate: e.target.value })}
          placeholder="até"
          aria-label="Fim do intervalo"
          className="app-field w-[90px] px-2 py-2 text-[12px]"
        />
      )}

      <button
        type="button"
        onClick={aoRemover}
        aria-label="Remover condição"
        className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition hover:bg-white/[0.04]"
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
