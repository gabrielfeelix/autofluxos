import type { ReactNode } from 'react'
import x from './site.module.css'

/*
 * As ilustrações dos ramos na vitrine da home: traço escuro, a cor do ramo e
 * um tom claro dela, no mesmo desenho para os quatro. A cor vem de `--cor` no
 * botão, então a mesma ilustração muda de tom se o ramo mudar de cor.
 */

const T = x.ilTraco
const COR = `${x.ilCor} ${T}`
const CLARO = `${x.ilClaro} ${T}`
const BRANCO = `${x.ilBranco} ${T}`

function Aulas() {
  return (
    <>
      <rect className={BRANCO} x="32" y="26" width="58" height="58" rx="8" />
      <path className={COR} d="M32 44V34a8 8 0 0 1 8-8h42a8 8 0 0 1 8 8v10Z" />
      <path className={T} d="M46 20v12M76 20v12" fill="none" />
      {[46, 61, 76].map((cx) => (
        <circle key={`a${cx}`} className={x.ilClaro} cx={cx} cy="56" r="3.5" />
      ))}
      {[46, 61].map((cx) => (
        <circle key={`b${cx}`} className={x.ilClaro} cx={cx} cy="70" r="3.5" />
      ))}
      <circle className={COR} cx="76" cy="70" r="7.5" />
      <path d="m72.5 70 2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path className={T} d="M22 90h34" fill="none" strokeWidth="4" />
      <rect className={COR} x="17" y="80" width="9" height="20" rx="2.5" />
      <rect className={COR} x="52" y="80" width="9" height="20" rx="2.5" />
    </>
  )
}

function Loja() {
  return (
    <>
      <rect className={CLARO} x="58" y="34" width="36" height="34" rx="4" />
      <path className={T} d="M58 46h36M76 34v12" fill="none" />
      <path className={T} d="M98 26l-4 4M100 36h-5M90 22v5" fill="none" />
      <path className={COR} d="M26 50h46l-4 44H30Z" />
      <path className={T} d="M39 50v-6a10 10 0 0 1 20 0v6" fill="none" />
      <circle cx="39" cy="58" r="2.4" fill="#fff" />
      <circle cx="59" cy="58" r="2.4" fill="#fff" />
      <path d="M40 76h18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    </>
  )
}

function Restaurante() {
  return (
    <>
      <path className={CLARO} d="M24 34 86 46 46 94Z" />
      <path d="M24 34 86 46" className={x.ilCorTraco} fill="none" />
      <path className={T} d="M24 34 86 46 46 94Z" fill="none" />
      <circle className={COR} cx="48" cy="50" r="5.5" />
      <circle className={COR} cx="64" cy="60" r="5" />
      <circle className={COR} cx="50" cy="72" r="4.5" />
      <path className={BRANCO} d="M76 62h22l-3 32H79Z" />
      <rect className={COR} x="73" y="56" width="28" height="7" rx="2.5" />
      <path className={T} d="M91 56l4-14" fill="none" />
    </>
  )
}

function Comercio() {
  return (
    <>
      <rect className={CLARO} x="40" y="18" width="40" height="11" rx="3" />
      <rect className={BRANCO} x="24" y="44" width="72" height="50" rx="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect className={i % 2 === 0 ? x.ilCor : x.ilBranco} x={20 + i * 16} y="32" width="16" height="14" />
          <path className={`${i % 2 === 0 ? x.ilCor : x.ilBranco} ${T}`} d={`M${20 + i * 16} 46a8 8 0 0 0 16 0`} />
        </g>
      ))}
      <rect className={T} x="20" y="32" width="80" height="14" fill="none" />
      <rect className={CLARO} x="32" y="60" width="24" height="18" rx="2" />
      <path className={T} d="M44 60v18M32 69h24" fill="none" />
      <rect className={CLARO} x="66" y="64" width="20" height="30" rx="2" />
      <circle cx="81" cy="80" r="1.8" fill="#0c1838" />
    </>
  )
}

const DESENHOS: Record<string, () => ReactNode> = {
  'aulas-e-horarios': Aulas,
  'loja-virtual': Loja,
  'restaurantes-e-delivery': Restaurante,
  comercio: Comercio,
}

export function IlustracaoDoRamo({ slug }: { slug: string }) {
  const Desenho = DESENHOS[slug]
  if (!Desenho) return null
  return (
    <svg className={x.ilustracao} viewBox="0 0 120 120" width="88" height="88" aria-hidden>
      <Desenho />
    </svg>
  )
}
