'use client'

import { useState } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { GrupoDeRadio } from '@/components/design/grupo-de-radio'
import { DIAS_SEM_CONVERSA, EVENTOS_DE_SEQUENCIA, type EventoDeSequencia } from '@/core/sequencias'

/**
 * O gatilho em cartões, com o texto inteiro (06/nov/2026). Era um seletor
 * espremido ao lado do nome, num modal de 420px, e as quatro opções saíam
 * cortadas no meio ("Quando alguém cli..."): ninguém escolhia lendo.
 */
const GATILHOS: Record<EventoDeSequencia, { titulo: string; descricao: string }> = {
  atendimento_encerrado: {
    titulo: 'Ao finalizar um atendimento',
    descricao: 'Entra quem teve o atendimento finalizado pela equipe.',
  },
  etiqueta_aplicada: {
    titulo: 'Ao receber uma etiqueta',
    descricao: 'Você escolhe a etiqueta logo abaixo.',
  },
  etapa_alcancada: {
    titulo: 'Ao chegar numa etapa do funil',
    descricao: 'Você escolhe a etapa logo abaixo.',
  },
  cliente_sumido: {
    titulo: 'Quando um cliente some',
    descricao: 'Quem já comprou e parou de falar há alguns dias.',
  },
}

export type EtiquetaNaLista = { id: string; nome: string }
export type EtapaNaLista = { id: string; rotulo: string }

/**
 * Os campos de uma sequência nova.
 *
 * É componente de cliente por um motivo só: **a etiqueta que dispara só existe
 * quando o gatilho é etiqueta.** Mostrar o campo sempre seria pedir algo que na
 * metade dos casos é ignorado, e um campo ignorado ensina a pessoa a não
 * confiar no formulário. Escondê-lo do servidor não dá, a escolha acontece
 * depois de a página ter sido desenhada.
 *
 * A etiqueta **de saída** aparece sempre, e é opcional: ela é o "virou cliente,
 * pode parar", e vale para os dois gatilhos.
 */
export function CamposDaSequencia({
  etiquetas,
  etapas,
}: {
  etiquetas: EtiquetaNaLista[]
  etapas: EtapaNaLista[]
}) {
  const [evento, setEvento] = useState<EventoDeSequencia>(EVENTOS_DE_SEQUENCIA[0])
  const porEtiqueta = evento === 'etiqueta_aplicada'
  const porEtapa = evento === 'etapa_alcancada'
  const porSumico = evento === 'cliente_sumido'

  return (
    <div className="grid gap-3.5">
      <label>
        <span className="mb-1 block text-[11px] font-semibold text-muted">Nome</span>
        <input
          name="nome"
          required
          maxLength={60}
          placeholder="Exemplo: Retomada de orçamento"
          aria-label="Nome da sequência"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
      </label>

      <div>
        <span className="mb-1 block text-[11px] font-semibold text-muted">Quem entra na sequência</span>
        <input type="hidden" name="evento" value={evento} />
        <GrupoDeRadio
          rotulo="O que inscreve alguém"
          valor={evento}
          aoEscolher={setEvento}
          opcoes={EVENTOS_DE_SEQUENCIA.map((item) => ({ valor: item, ...GATILHOS[item] }))}
        />
      </div>

      {porEtiqueta &&
        (etiquetas.length === 0 ? (
          <p className="text-[11.5px] leading-5 text-aviso/90">
            Crie uma etiqueta primeiro, em Configurações → Etiquetas. Sem ela este gatilho não tem o
            que observar.
          </p>
        ) : (
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-muted">
              Etiqueta que dispara
            </span>
            <Dropdown
              nome="etiquetaId"
              rotuloAcessivel="Etiqueta que dispara a sequência"
              opcoes={etiquetas.map((etiqueta) => ({ valor: etiqueta.id, rotulo: etiqueta.nome }))}
            />
          </div>
        ))}

      {porEtapa &&
        (etapas.length === 0 ? (
          <p className="text-[11.5px] leading-5 text-aviso/90">
            Crie um quadro primeiro, em Quadros. Sem etapa este gatilho não tem o que observar.
          </p>
        ) : (
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-muted">
              Etapa que dispara
            </span>
            <Dropdown
              nome="colunaId"
              rotuloAcessivel="Etapa do quadro que dispara a sequência"
              opcoes={etapas.map((etapa) => ({ valor: etapa.id, rotulo: etapa.rotulo }))}
            />
            <span className="mt-1 block text-[10.5px] leading-4 text-dim">
              Vale para quem chega pelo bloco de fluxo <strong>Etapa do funil</strong>. Mover o
              cartão à mão na tela de Funil de vendas não inscreve ninguém, inscrever alguém por um
              arrasto de arrumação seria mandar mensagem por engano.
            </span>
          </div>
        ))}

      {porSumico && (
        <label>
          <span className="mb-1 block text-[11px] font-semibold text-muted">
            Depois de quantos dias sem falar
          </span>
          <input
            name="diasSemConversa"
            type="number"
            min={DIAS_SEM_CONVERSA.minimo}
            max={DIAS_SEM_CONVERSA.maximo}
            defaultValue={DIAS_SEM_CONVERSA.padrao}
            aria-label="Dias sem conversa para entrar na régua"
            className="app-field w-full px-3 py-2.5 text-[12.5px]"
          />
          {/*
            As duas coisas que quem monta a régua precisa saber antes, e que só
            se descobre tarde demais: ela só alcança quem já comprou, e o
            primeiro passo vai precisar de modelo aprovado, quem está calado há
            sessenta dias está, por definição, fora da janela de 24h da Meta.
          */}
          <span className="mt-1 block text-[10.5px] leading-4 text-dim">
            Só alcança <strong>quem já comprou</strong>: correr atrás de quem nunca fechou é
            trabalho que ninguém faz. Cada pessoa entra uma vez a cada 4 meses, e o passo vai
            precisar de um modelo aprovado, quem está calado há tanto tempo está fora da janela de
            24 horas.
          </span>
        </label>
      )}

      <div>
        <span className="mb-1 block text-[11px] font-semibold text-muted">
          Etiqueta que tira da sequência (opcional)
        </span>
        <Dropdown
          nome="etiquetaDeSaidaId"
          rotuloAcessivel="Etiqueta que tira da sequência"
          valorInicial=""
          opcoes={[
            { valor: '', rotulo: 'Nenhuma', detalhe: 'só sai quem responder ou for atendido' },
            ...etiquetas.map((etiqueta) => ({ valor: etiqueta.id, rotulo: etiqueta.nome })),
          ]}
        />
      </div>
    </div>
  )
}
