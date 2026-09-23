'use client'

import { useEffect, useRef, useState } from 'react'

export type ColunaDaTabela = {
  chave: string
  rotulo: string
  /** Aparece sem ninguém pedir. As variáveis coletadas começam escondidas. */
  padrao: boolean
}

/**
 * Quais colunas da lista de contatos ficam na tela.
 *
 * Uma conta de agendamento coleta vinte variáveis, e a tabela ganhava uma
 * coluna por variável: o nome da pessoa ficava a três telas de rolagem
 * horizontal de qualquer coisa útil. Por isso a tabela **começa enxuta** (as
 * colunas `padrao`) e cada pessoa liga as variáveis que quer ver.
 *
 * **Mostrar e esconder é CSS, e não deixar de renderizar.** A tabela é montada
 * no servidor e a escolha é de quem está olhando, gravada neste navegador. As
 * células opcionais já saem do servidor com `hidden` (sem piscar a tabela
 * cheia antes de o navegador ler a escolha), e a regra daqui, que vem com o id
 * da tabela e por isso ganha da classe, liga ou desliga cada coluna.
 *
 * A marcação vive nas células: cada `th` e cada `td` carrega
 * `data-coluna="<chave>"`, e o seletor casa a coluna inteira de uma vez.
 */
function regra(colunas: string[], valor: 'none' | 'table-cell'): string {
  if (colunas.length === 0) return ''
  // `JSON.stringify` cita a chave: nome de variável com aspas ou espaço
  // quebraria o seletor, e um seletor quebrado derruba a regra inteira.
  const alvos = colunas.map((coluna) => `#tabela-de-contatos [data-coluna=${JSON.stringify(coluna)}]`).join(',')
  return `${alvos}{display:${valor}}`
}

export function ColunasDaTabela({
  clienteId,
  colunas,
}: {
  clienteId: string
  colunas: ColunaDaTabela[]
}) {
  // Chave nova: a antiga guardava as **escondidas** (tudo começava visível).
  // Quem tinha escolha gravada volta para a tabela enxuta, de propósito.
  const chave = `autofluxos:colunas-visiveis:${clienteId}`
  // `null` é "nunca escolheu": vale o padrão.
  const [escolha, setEscolha] = useState<string[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const gravado = JSON.parse(localStorage.getItem(chave) ?? 'null')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe depois de montar
      if (Array.isArray(gravado)) setEscolha(gravado.filter((c) => typeof c === 'string'))
    } catch {
      // Gravado quebrado: vale o padrão.
    }
  }, [chave])

  useEffect(() => {
    if (!aberto) return
    const foraDaqui = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    const escapou = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', escapou)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', escapou)
    }
  }, [aberto])

  const padrao = colunas.filter((c) => c.padrao).map((c) => c.chave)
  const visiveis = escolha ?? padrao
  const gravar = (proximas: string[] | null) => {
    setEscolha(proximas)
    try {
      if (proximas === null) localStorage.removeItem(chave)
      else localStorage.setItem(chave, JSON.stringify(proximas))
    } catch {
      // Sem onde gravar, a escolha vale só para esta visita.
    }
  }
  const alternar = (coluna: string) =>
    gravar(visiveis.includes(coluna) ? visiveis.filter((outra) => outra !== coluna) : [...visiveis, coluna])

  const ligadas = colunas.filter((c) => !c.padrao && visiveis.includes(c.chave)).map((c) => c.chave)
  const desligadas = colunas.filter((c) => c.padrao && !visiveis.includes(c.chave)).map((c) => c.chave)
  const mudouDoPadrao = escolha !== null && (ligadas.length > 0 || desligadas.length > 0)
  const escondidas = colunas.filter((c) => !visiveis.includes(c.chave)).length
  const essenciais = colunas.filter((c) => c.padrao)
  const coletadas = colunas.filter((c) => !c.padrao)

  return (
    <div ref={raiz} className="relative">
      {(ligadas.length > 0 || desligadas.length > 0) && (
        <style>{regra(ligadas, 'table-cell') + regra(desligadas, 'none')}</style>
      )}

      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((estava) => !estava)}
        className="quadro-tool"
        title={escondidas > 0 ? `${escondidas} coluna(s) ainda fora da tabela` : 'Escolher quais colunas aparecem nesta tabela'}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M9.5 4.5v15M14.5 4.5v15" />
        </svg>
        Colunas
        {/* Quantas ainda dá para ligar, não quantas já foram ligadas: "+1"
            com vinte variáveis escondidas fazia parecer que só havia uma. */}
        {escondidas > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded bg-primary px-1 text-[10px] font-semibold text-white tabular-nums">
            +{escondidas > 99 ? '99' : escondidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute left-0 z-50 mt-1 max-h-[360px] w-[260px] overflow-y-auto rounded-[10px] border border-line bg-panel py-1.5 shadow-xl">
          <Grupo titulo="Principais" colunas={essenciais} visiveis={visiveis} alternar={alternar} />
          {coletadas.length > 0 && (
            <Grupo
              titulo="Coletadas pelos fluxos"
              colunas={coletadas}
              visiveis={visiveis}
              alternar={alternar}
              borda
            />
          )}
          {mudouDoPadrao && (
            <button
              type="button"
              onClick={() => gravar(null)}
              className="mt-1 w-full border-t border-line px-3 py-2 text-left text-[12.5px] font-semibold text-primary transition hover:bg-surface-strong"
            >
              Voltar ao padrão
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Grupo({
  titulo,
  colunas,
  visiveis,
  alternar,
  borda = false,
}: {
  titulo: string
  colunas: ColunaDaTabela[]
  visiveis: string[]
  alternar: (coluna: string) => void
  borda?: boolean
}) {
  return (
    <div className={borda ? 'mt-1 border-t border-line pt-1.5' : ''}>
      <p className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-dim uppercase">{titulo}</p>
      {colunas.map((coluna) => (
        <label
          key={coluna.chave}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-soft transition hover:bg-surface-strong"
        >
          <input
            type="checkbox"
            checked={visiveis.includes(coluna.chave)}
            onChange={() => alternar(coluna.chave)}
            className="size-3.5 accent-[var(--primary)]"
          />
          <span className="min-w-0 truncate">{coluna.rotulo}</span>
        </label>
      ))}
    </div>
  )
}
