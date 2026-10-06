'use client'

import { LIMITE_DO_VALOR, type Componentes, type ValoresDasLacunas } from '@/core/templates'

/**
 * Um campo por lacuna do modelo, para quem envia a uma pessoa só (Retomar e
 * Agendar).
 *
 * O rótulo é o trecho do texto em volta da lacuna, e não "{{2}}": quem atende
 * não sabe o que é a variável 2, mas lê "seu pedido ___ saiu" e sabe o que
 * escrever.
 */
export function CamposDasLacunas({
  componentes,
  valores,
  aoMudar,
}: {
  componentes: Componentes
  valores: ValoresDasLacunas
  aoMudar: (valores: ValoresDasLacunas) => void
}) {
  const campos = [
    ...valores.cabecalho.map((valor, i) => ({
      onde: 'cabecalho' as const,
      i,
      valor,
      trecho: componentes.cabecalho?.tipo === 'texto' ? trechoDaLacuna(componentes.cabecalho.texto, i + 1) : '',
    })),
    ...valores.corpo.map((valor, i) => ({ onde: 'corpo' as const, i, valor, trecho: trechoDaLacuna(componentes.corpo, i + 1) })),
  ]
  if (campos.length === 0) return null

  function mudar(onde: 'cabecalho' | 'corpo', i: number, valor: string) {
    const lista = [...valores[onde]]
    lista[i] = valor
    aoMudar({ ...valores, [onde]: lista })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-muted">
        {campos.length === 1 ? 'Preencha o campo do modelo' : 'Preencha os campos do modelo'}
      </span>
      {campos.map((c) => (
        <label key={`${c.onde}-${c.i}`} className="flex flex-col gap-0.5">
          <span className="truncate text-[11px] text-dim" title={c.trecho}>
            {c.onde === 'cabecalho' ? 'Título: ' : ''}
            {c.trecho}
          </span>
          <input
            value={c.valor}
            maxLength={LIMITE_DO_VALOR[c.onde]}
            onChange={(e) => mudar(c.onde, c.i, e.target.value)}
            aria-invalid={c.valor.trim() === ''}
            className="app-field px-2.5 py-1.5 text-[12.5px]"
          />
        </label>
      ))}
    </div>
  )
}

/** "Olá {{1}}, seu pedido {{2}} saiu" e n = 2 viram "…seu pedido ___ saiu". */
export function trechoDaLacuna(texto: string, n: number): string {
  const marca = `{{${n}}}`
  const onde = texto.indexOf(marca)
  if (onde < 0) return ''
  const antes = texto.slice(Math.max(0, onde - 28), onde)
  const depois = texto.slice(onde + marca.length, onde + marca.length + 20)
  const limpo = (s: string) => s.replace(/\{\{\d+\}\}/g, '…').replace(/\s+/g, ' ')
  return `${onde > 28 ? '…' : ''}${limpo(antes).trimStart()}___${limpo(depois).trimEnd()}${onde + marca.length + 20 < texto.length ? '…' : ''}`
}

/** As lacunas ainda vazias, para travar o Enviar. */
export function faltaPreencher(valores: ValoresDasLacunas): boolean {
  return [...valores.cabecalho, ...valores.corpo].some((v) => v.trim() === '')
}
