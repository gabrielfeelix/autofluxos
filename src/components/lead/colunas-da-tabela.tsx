'use client'

import { useEffect, useRef, useState } from 'react'

export type ColunaDaTabela = { chave: string; rotulo: string }

/**
 * Quais colunas da lista de contatos ficam na tela.
 *
 * Uma conta de agendamento coleta vinte variáveis, e a tabela ganhava uma
 * coluna por variável: o nome da pessoa ficava a três telas de rolagem
 * horizontal de qualquer coisa útil. Quem atende olha duas ou três dessas
 * colunas, e cada conta olha outras duas ou três.
 *
 * **Esconder é CSS, e não deixar de renderizar.** A tabela é montada no
 * servidor e a escolha é de quem está olhando, gravada neste navegador: fazer
 * o servidor saber dela obrigaria um cookie e tornaria a página dinâmica por
 * pessoa. Uma regra `display: none` por coluna escondida resolve sem nada
 * disso, e o CSV continua saindo inteiro, que é o que se espera de um download.
 *
 * A marcação vive nas células: cada `th` e cada `td` carrega
 * `data-coluna="<chave>"`, e o seletor casa a coluna inteira de uma vez.
 */
/**
 * A regra que apaga as colunas escolhidas.
 *
 * `JSON.stringify` cita a chave: nome de variável com aspas ou espaço quebraria
 * o seletor, e um seletor quebrado derruba a regra inteira, não só a dela.
 */
function regraDeEsconder(escondidas: string[]): string {
  const alvos = escondidas
    .map((coluna) => `#tabela-de-contatos [data-coluna=${JSON.stringify(coluna)}]`)
    .join(',')
  return `${alvos}{display:none}`
}

export function ColunasDaTabela({
  clienteId,
  colunas,
}: {
  clienteId: string
  colunas: ColunaDaTabela[]
}) {
  const chave = `autofluxos:colunas:${clienteId}`
  const [escondidas, setEscondidas] = useState<string[]>([])
  const [montado, setMontado] = useState(false)
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  /*
    A leitura só acontece depois de montar, e por isso existe `montado`: o
    servidor não tem `localStorage`, e pintar a tabela já sem as colunas no
    HTML seria dizer ao React uma coisa e ao navegador outra.
  */
  useEffect(() => {
    setMontado(true)
    try {
      const gravado = JSON.parse(localStorage.getItem(chave) ?? '[]')
      if (Array.isArray(gravado)) setEscondidas(gravado.filter((c) => typeof c === 'string'))
    } catch {
      // Sem nada gravado, ou gravado quebrado: mostra tudo, que é o padrão.
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

  const alternar = (coluna: string) => {
    setEscondidas((atuais) => {
      const proximas = atuais.includes(coluna)
        ? atuais.filter((outra) => outra !== coluna)
        : [...atuais, coluna]
      try {
        localStorage.setItem(chave, JSON.stringify(proximas))
      } catch {
        // Sem onde gravar, a escolha vale só para esta visita.
      }
      return proximas
    })
  }

  const ativas = colunas.length - escondidas.length

  return (
    <div ref={raiz} className="relative">
      {montado && escondidas.length > 0 && <style>{regraDeEsconder(escondidas)}</style>}

      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((estava) => !estava)}
        className="app-secondary-button px-3 py-1.5 text-[11.5px]"
        title="Escolher quais colunas aparecem nesta tabela"
      >
        Colunas
        {montado && escondidas.length > 0 && (
          <span className="ml-1.5 text-dim">
            {ativas}/{colunas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 z-50 mt-1 max-h-[320px] w-[240px] overflow-y-auto rounded-[10px] border border-line bg-panel py-1.5 shadow-xl">
          <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.06em] text-dim uppercase">
            Mostrar na tabela
          </p>
          {colunas.map((coluna) => (
            <label
              key={coluna.chave}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12px] text-soft transition hover:bg-surface-strong"
            >
              <input
                type="checkbox"
                checked={!escondidas.includes(coluna.chave)}
                onChange={() => alternar(coluna.chave)}
                className="size-3.5 accent-[#a78bfa]"
              />
              <span className="min-w-0 truncate">{coluna.rotulo}</span>
            </label>
          ))}

          {escondidas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEscondidas([])
                try {
                  localStorage.setItem(chave, '[]')
                } catch {
                  // Mesmo caso de `alternar`: sem gravar, vale para esta visita.
                }
              }}
              className="mt-1 w-full border-t border-line px-3 py-2 text-left text-[11.5px] font-semibold text-primary transition hover:bg-surface-strong"
            >
              Mostrar todas
            </button>
          )}
        </div>
      )}
    </div>
  )
}
