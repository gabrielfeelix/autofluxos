'use client'

import { useState, type CSSProperties } from 'react'
import { ITENS_DE_INTEGRACAO, type Grupo } from './integracoes-do-site'
import v from './vitrine-de-integracoes.module.css'

/*
 * A vitrine de integrações (pedido do Gabriel, 28/out/2026, a partir da página
 * inicial da Colmeia, que mostra tudo com que conversa). Só logo oficial, e só
 * o que existe: o que ainda não tem conector aparece com "Em breve", como na
 * tela de Lojas da conta (`components/loja/conectar-loja.tsx`).
 *
 * Fontes: lojas em `conectar-loja.tsx`; pagamentos em
 * `ajustes/pagamentos/page.tsx`; cardápios no texto de `conectar-loja.tsx`;
 * Lead Ads e Click-to-WhatsApp em `docs/FUNCIONALIDADES.md` §13.
 */

const GRUPOS: { chave: Grupo | 'todas'; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'canais', rotulo: 'Canais e anúncios' },
  { chave: 'lojas', rotulo: 'Lojas virtuais' },
  { chave: 'pagamentos', rotulo: 'Pagamentos' },
  { chave: 'cardapios', rotulo: 'Cardápios' },
]

const PRONTAS = ITENS_DE_INTEGRACAO.filter((i) => !i.emBreve).length

/** Com `grupos`, mostra só aqueles e sem abas: é a vitrine recortada da página de cada nicho. */

export function VitrineDeIntegracoes({ grupos }: { grupos?: Grupo[] }) {
  const [grupo, setGrupo] = useState<Grupo | 'todas'>('todas')
  // O que já liga vem antes; "Em breve" fecha a lista.
  const visiveis = ITENS_DE_INTEGRACAO.filter((i) => (grupos ? grupos.includes(i.grupo) : grupo === 'todas' || i.grupo === grupo)).sort((a, b) => Number(!!a.emBreve) - Number(!!b.emBreve))

  return (
    <div className={v.vitrine}>
      {!grupos && (
      <div className={v.topo}>
        <div className={v.abas} role="tablist" aria-label="Tipo de integração">
          {GRUPOS.map((g) => (
            <button
              key={g.chave}
              type="button"
              role="tab"
              aria-selected={grupo === g.chave}
              aria-controls="grade-de-integracoes"
              className={v.aba}
              onClick={() => setGrupo(g.chave)}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        <p className={v.conta}>
          <b>{PRONTAS}</b> prontas para ligar hoje
        </p>
      </div>
      )}

      <ul id="grade-de-integracoes" role="tabpanel" className={v.grade} key={grupo}>
        {visiveis.map((item, i) => (
          <li key={item.nome} className={v.item} style={{ '--i': i } as CSSProperties} data-em-breve={item.emBreve ? '' : undefined}>
            <span className={v.marca}>{item.marca}</span>
            <span className={v.texto}>
              <strong>{item.nome}</strong>
              {item.emBreve ? <small className={v.selo}>Em breve</small> : <small>{item.detalhe}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

