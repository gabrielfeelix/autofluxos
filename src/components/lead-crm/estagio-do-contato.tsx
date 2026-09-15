'use client'

import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { Dropdown } from '@/components/design/dropdown'
import { ESTAGIOS, NOME_DO_ESTAGIO, type Estagio } from '@/core/crm'
import { acaoDefinirEstagio } from '@/server/acoes-crm'

/**
 * O estágio, no cabeçalho da ficha — e como controle, não como texto.
 *
 * O estágio anda sozinho pelos fatos (`core/crm.ts`): quem responde vira
 * `qualificado`, quem fecha vira `cliente`, quem some vira `inativo`. Mostrar
 * isso como etiqueta parada seria esconder que existe um ajuste na mão — e o
 * ajuste precisa existir, porque a régua acerta o caso comum e não o de todo
 * mundo. Como controle, ele diz as duas coisas ao mesmo tempo: em que pé a
 * pessoa está, e que dá para discordar.
 *
 * Otimista pelas três razões de sempre: é interno, é reversível num clique e
 * não é lote. A gravação vira evento na linha do tempo, marcado como manual —
 * é assim que se sabe depois qual estágio foi medido e qual foi opinião.
 */
export function EstagioDoContato({
  clienteId,
  contatoId,
  estagio,
}: {
  clienteId: string
  contatoId: string
  estagio: Estagio
}) {
  const otimista = useAcaoOtimista<Estagio>(estagio)

  return (
    <span className="flex flex-col">
      <Dropdown
        rotuloAcessivel="Estágio deste contato"
        valor={otimista.valor}
        aoMudar={(novo) =>
          otimista.agir(novo as Estagio, () =>
            acaoDefinirEstagio(clienteId, contatoId, novo as Estagio),
          )
        }
        /* 168px: a lista é medida pelo gatilho, e "qualificado" precisa caber
           inteiro — ver a régua de largura em `docs/HANDOFF-15-SET-CRM-FUNIL.md`. */
        className="w-[168px] text-[12.5px]"
        opcoes={ESTAGIOS.map((valor) => ({ valor, rotulo: NOME_DO_ESTAGIO[valor] }))}
      />
      {otimista.erro && (
        <span role="alert" className="mt-1 text-[10.5px] text-perigo">
          {otimista.erro}
        </span>
      )}
    </span>
  )
}
