'use client'

import { useState } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { EVENTOS_DE_SEQUENCIA, ROTULO_DO_EVENTO } from '@/core/sequencias'

export type EtiquetaNaLista = { id: string; nome: string }

/**
 * Os campos de uma sequência nova.
 *
 * É componente de cliente por um motivo só: **a etiqueta que dispara só existe
 * quando o gatilho é etiqueta.** Mostrar o campo sempre seria pedir algo que na
 * metade dos casos é ignorado, e um campo ignorado ensina a pessoa a não
 * confiar no formulário. Escondê-lo do servidor não dá — a escolha acontece
 * depois de a página ter sido desenhada.
 *
 * A etiqueta **de saída** aparece sempre, e é opcional: ela é o "virou cliente,
 * pode parar", e vale para os dois gatilhos.
 */
export function CamposDaSequencia({ etiquetas }: { etiquetas: EtiquetaNaLista[] }) {
  const [evento, setEvento] = useState<string>(EVENTOS_DE_SEQUENCIA[0])
  const porEtiqueta = evento === 'etiqueta_aplicada'

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      <input
        name="nome"
        required
        maxLength={60}
        placeholder="Nome (ex.: Retomada de orçamento)"
        aria-label="Nome da sequência"
        className="app-field px-3 py-2.5 text-[12.5px]"
      />

      <Dropdown
        nome="evento"
        rotuloAcessivel="O que inscreve alguém"
        valorInicial={EVENTOS_DE_SEQUENCIA[0]}
        aoMudar={setEvento}
        valor={evento}
        opcoes={EVENTOS_DE_SEQUENCIA.map((item) => ({
          valor: item,
          rotulo: ROTULO_DO_EVENTO[item],
        }))}
      />

      {porEtiqueta &&
        (etiquetas.length === 0 ? (
          <p className="text-[11.5px] leading-5 text-amber-200/90 md:col-span-2">
            Crie uma etiqueta primeiro, em Configurações → Etiquetas. Sem ela este gatilho não tem o
            que observar.
          </p>
        ) : (
          <label className="md:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold text-muted">
              Etiqueta que dispara
            </span>
            <Dropdown
              nome="etiquetaId"
              rotuloAcessivel="Etiqueta que dispara a sequência"
              opcoes={etiquetas.map((etiqueta) => ({ valor: etiqueta.id, rotulo: etiqueta.nome }))}
            />
          </label>
        ))}

      <label className="md:col-span-2">
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
      </label>
    </div>
  )
}
