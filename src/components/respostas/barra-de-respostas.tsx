'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { CampoDeBusca } from '@/components/design/campo-de-busca'
import { Dropdown } from '@/components/design/dropdown'

/** Quanto esperar a pessoa parar de digitar antes de buscar (o mesmo de Contatos). */
const ESPERA_DA_BUSCA = 400

type Filtro = {
  fluxo: string | null
  busca: string
  desfecho: string | null
  resposta: string
  valor: string
}

/**
 * A automação e a busca da tela Respostas, que valem sem botão "Filtrar".
 *
 * Antes era um `form` GET: escolher a automação no seletor não fazia nada até
 * alguém clicar em Filtrar, e a busca só andava com Enter. Agora escolher a
 * automação já troca a lista, e a busca anda enquanto a pessoa digita, como em
 * Contatos.
 *
 * **Fica fora do `Suspense` da tabela de propósito**, pelo mesmo motivo de
 * `BarraDeContatos`: a tabela remonta a cada filtro, e o campo de busca lá
 * dentro perderia o foco e o texto no meio da digitação.
 */
export function BarraDeRespostas({
  base,
  automacoes,
  filtro,
}: {
  /** `/clientes/<id>/respostas`. */
  base: string
  automacoes: { id: string; nome: string }[]
  filtro: Filtro
}) {
  const router = useRouter()
  const [carregando, comecar] = useTransition()
  const [busca, setBusca] = useState(filtro.busca)
  const espera = useRef<number | null>(null)

  // Busca que chega de fora (voltar do navegador, "Limpar") manda no campo.
  const [buscaDaUrl, setBuscaDaUrl] = useState(filtro.busca)
  if (buscaDaUrl !== filtro.busca) {
    setBuscaDaUrl(filtro.busca)
    setBusca(filtro.busca)
  }

  useEffect(
    () => () => {
      if (espera.current) window.clearTimeout(espera.current)
    },
    [],
  )

  /** Vai para o mesmo endereço com outro filtro, sempre na primeira página. */
  function ir(novo: Partial<Filtro>) {
    const alvo = { ...filtro, ...novo }
    const parametros = new URLSearchParams()
    if (alvo.fluxo) parametros.set('fluxo', alvo.fluxo)
    if (alvo.busca) parametros.set('busca', alvo.busca)
    if (alvo.desfecho) parametros.set('desfecho', alvo.desfecho)
    if (alvo.fluxo && alvo.resposta && alvo.valor) {
      parametros.set('resposta', alvo.resposta)
      parametros.set('valor', alvo.valor)
    }
    const consulta = parametros.toString()
    comecar(() =>
      router.push(`${base}${consulta ? `?${consulta}` : ''}`, {
        scroll: false,
      }),
    )
  }

  function digitar(valor: string) {
    setBusca(valor)
    if (espera.current) window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => {
      if (valor.trim() !== filtro.busca) ir({ busca: valor.trim() })
    }, ESPERA_DA_BUSCA)
  }

  const filtrando =
    Boolean(filtro.fluxo) || filtro.busca !== '' || filtro.desfecho !== null || filtro.valor !== ''

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" aria-busy={carregando}>
      <span className="w-full shrink-0 sm:w-[260px]">
        <Dropdown
          valor={filtro.fluxo ?? ''}
          // A resposta filtrada é de uma pergunta desta automação: trocar de
          // automação leva o filtro junto, senão ele sobraria valendo nada.
          aoMudar={(fluxo) => ir({ fluxo: fluxo || null, resposta: '', valor: '' })}
          rotuloAcessivel="Automação"
          className="w-full text-[12.5px]"
          opcoes={[
            { valor: '', rotulo: 'Todas as automações' },
            ...automacoes.map((automacao) => ({
              valor: automacao.id,
              rotulo: automacao.nome,
            })),
          ]}
        />
      </span>
      <CampoDeBusca
        valor={busca}
        aoDigitar={digitar}
        aoEnviar={() => {
          if (espera.current) window.clearTimeout(espera.current)
          ir({ busca: busca.trim() })
        }}
        placeholder="Buscar por nome ou telefone"
        rotulo="Buscar resposta por nome ou telefone"
      />
      {filtrando && (
        <Link
          href={base}
          className="text-[11.5px] font-semibold text-primary hover:underline"
          scroll={false}
        >
          Limpar
        </Link>
      )}
    </div>
  )
}
