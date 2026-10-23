'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { GRADE_DE_CONEXOES } from '@/components/conexoes/cartao'
import { Alternador } from '@/components/design/alternador'
import { CampoDeBusca } from '@/components/design/campo-de-busca'

export type GrupoDeGateway = 'carteiras' | 'maquininhas' | 'bancos'

export type ItemDoCatalogo = {
  id: string
  nome: string
  grupo: GrupoDeGateway
  /** O que a busca casa além do nome: "pix cartão boleto stone". */
  termos: string
  cartao: ReactNode
}

/** `curto` é o do seletor, que precisa caber em 390 sem rolar; `rotulo`, o título da seção. */
const GRUPOS: { chave: GrupoDeGateway; rotulo: string; curto: string }[] = [
  { chave: 'carteiras', rotulo: 'Carteiras e gateways', curto: 'Carteiras' },
  { chave: 'maquininhas', rotulo: 'Maquininhas', curto: 'Maquininhas' },
  { chave: 'bancos', rotulo: 'Bancos', curto: 'Bancos' },
]

/** "Efí" casa "efi", "cartão" casa "cartao": quem busca não digita acento. */
function normal(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Onde o dono escolhe em que conta recebe: os cartões dos gateways, com busca
 * e os grupos que ele usa para pensar ("tenho maquininha", "meu banco é a
 * Efí"). Com dez opções, uma grade sem filtro vira caça; cada cartão é
 * montado no servidor, com o que só ele sabe (conectado, liberado, plano), e
 * aqui só se escolhe quais aparecem.
 */
export function CatalogoDeGateways({ itens }: { itens: ItemDoCatalogo[] }) {
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<GrupoDeGateway | 'todos'>('todos')

  const visiveis = useMemo(() => {
    const termo = normal(busca.trim())
    return itens.filter(
      (item) => (grupo === 'todos' || item.grupo === grupo) && (!termo || normal(`${item.nome} ${item.termos}`).includes(termo)),
    )
  }, [itens, busca, grupo])

  const opcoes = [
    { chave: 'todos' as const, rotulo: 'Todos' },
    ...GRUPOS.filter((g) => itens.some((i) => i.grupo === g.chave)).map((g) => ({ chave: g.chave, rotulo: g.curto })),
  ]

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CampoDeBusca
          valor={busca}
          aoDigitar={setBusca}
          aoEnviar={() => undefined}
          placeholder="Buscar por nome, Pix, cartão, boleto"
          rotulo="Buscar gateway de pagamento"
        />
        <div className="-mx-1 overflow-x-auto px-1">
          <Alternador rotulo="Tipo de conta" opcoes={opcoes} ativa={grupo} aoEscolher={setGrupo} />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="app-card px-5 py-6 text-center text-[12.5px] text-muted">
          Nenhuma conta com esse nome. Se a sua não está aqui, fale com a equipe da 4YU.
        </p>
      ) : grupo === 'todos' && !busca.trim() ? (
        <div className="flex flex-col gap-[26px]">
          {GRUPOS.map((g) => {
            const doGrupo = visiveis.filter((i) => i.grupo === g.chave)
            if (doGrupo.length === 0) return null
            return (
              <section key={g.chave} aria-label={g.rotulo}>
                <h2 className="mb-2.5 text-[11px] font-bold tracking-[0.06em] text-dim uppercase">{g.rotulo}</h2>
                <div className={GRADE_DE_CONEXOES}>
                  {doGrupo.map((i) => (
                    <div key={i.id} className="flex [&>*]:flex-1">
                      {i.cartao}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className={GRADE_DE_CONEXOES}>
          {visiveis.map((i) => (
            <div key={i.id} className="flex [&>*]:flex-1">
              {i.cartao}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
