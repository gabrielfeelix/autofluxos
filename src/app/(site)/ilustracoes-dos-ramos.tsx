import type { ReactNode } from 'react'
import x from './site.module.css'

/*
 * As ilustrações dos ramos na vitrine da home. Mesma receita nas quatro:
 * traço escuro, a cor do ramo (`--cor` no botão), um tom claro dela, amarelo
 * e verde de apoio, sombra no chão e brilhos. Desenhadas em 120x120.
 */

const T = x.ilTraco
const COR = `${x.ilCor} ${T}`
const CLARO = `${x.ilClaro} ${T}`
const BRANCO = `${x.ilBranco} ${T}`
const AMARELO = `${x.ilAmarelo} ${T}`
const FOLHA = `${x.ilFolha} ${T}`

function Brilho({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <path
      className={x.ilAmarelo}
      d={`M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`}
    />
  )
}

function Sombra() {
  return <ellipse className={x.ilSombra} cx="60" cy="106" rx="40" ry="5" />
}

function Aulas() {
  return (
    <>
      <Sombra />
      <g transform="rotate(-6 58 56)">
        <rect className={BRANCO} x="28" y="22" width="60" height="64" rx="10" />
        <path className={COR} d="M28 42V32a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v10Z" />
        <path className={T} d="M43 15v13M73 15v13" fill="none" />
        {[0, 1, 2].map((c) =>
          [0, 1].map((l) =>
            c === 2 && l === 1 ? null : (
              <rect key={`${c}${l}`} className={x.ilClaro} x={37 + c * 15} y={51 + l * 15} width="11" height="9" rx="2.5" />
            ),
          ),
        )}
        <circle className={COR} cx="73" cy="70" r="9" />
        <path d="m68.5 70 3 3 5.5-6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(14 36 92)">
        <path className={T} d="M18 92h36" fill="none" strokeWidth="4.5" />
        <rect className={COR} x="12" y="80" width="10" height="24" rx="3" />
        <rect className={CLARO} x="20" y="84" width="5" height="16" rx="2" />
        <rect className={COR} x="50" y="80" width="10" height="24" rx="3" />
        <rect className={CLARO} x="47" y="84" width="5" height="16" rx="2" />
      </g>
      <rect className={CLARO} x="92" y="60" width="16" height="38" rx="6" />
      <path className={x.ilBranco} d="M95 74h10v18a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3Z" opacity="0.7" />
      <rect className={COR} x="94.5" y="53" width="11" height="8" rx="2.5" />
      <Brilho cx={18} cy={30} r={7} />
      <Brilho cx={104} cy={36} r={4.5} />
    </>
  )
}

function Loja() {
  return (
    <>
      <Sombra />
      <rect className={BRANCO} x="60" y="16" width="38" height="68" rx="8" />
      <rect className={CLARO} x="66" y="26" width="26" height="22" rx="4" />
      <circle className={x.ilCor} cx="79" cy="37" r="5" />
      <path className={T} d="M66 56h20M66 62h14" fill="none" />
      <rect className={COR} x="66" y="70" width="26" height="8" rx="4" />
      <path className={COR} d="M18 50h48l-4 50H22Z" />
      <path className={x.ilClaro} d="M19.2 50h45.6l-.5 7H19.8Z" opacity="0.55" />
      <path className={T} d="M18 50h48l-4 50H22Z" fill="none" />
      <path className={T} d="M31 50v-7a11 11 0 0 1 22 0v7" fill="none" />
      <circle cx="31" cy="60" r="2.6" fill="#fff" />
      <circle cx="53" cy="60" r="2.6" fill="#fff" />
      <g transform="rotate(-14 30 76)">
        <rect className={AMARELO} x="22" y="70" width="18" height="12" rx="3" />
        <circle cx="26" cy="76" r="1.6" fill="#0c1838" />
      </g>
      <circle className={AMARELO} cx="100" cy="94" r="9" />
      <circle className={T} cx="100" cy="94" r="5" fill="none" />
      <Brilho cx={20} cy={28} r={6.5} />
      <Brilho cx={106} cy={66} r={4} />
    </>
  )
}

function Restaurante() {
  return (
    <>
      <Sombra />
      <path className={x.ilVapor} d="M44 22c-4-4 4-7 0-12M56 22c-4-4 4-7 0-12" fill="none" />
      <path className={AMARELO} d="M16 38Q52 26 88 42L50 100Z" />
      <path className={x.ilCrosta} d="M16 38Q52 26 88 42" fill="none" />
      <path className={T} d="M16 38Q52 26 88 42L50 100Z" fill="none" />
      {[
        [40, 46, 6],
        [62, 50, 5.5],
        [52, 66, 5],
        [49, 83, 4],
      ].map(([cx, cy, r]) => (
        <g key={`${cx}${cy}`}>
          <circle className={COR} cx={cx} cy={cy} r={r} />
          <circle cx={cx! - 1.6} cy={cy! - 1.6} r={1.3} fill="#fff" opacity="0.7" />
        </g>
      ))}
      <ellipse className={FOLHA} cx="70" cy="62" rx="5" ry="2.6" transform="rotate(-30 70 62)" />
      <ellipse className={FOLHA} cx="34" cy="56" rx="4.5" ry="2.4" transform="rotate(25 34 56)" />
      <path className={BRANCO} d="M82 58h24l-3.5 42h-17Z" />
      <path className={x.ilCor} d="M83.6 72h20.8l-1 12H84.6Z" />
      <path className={T} d="M82 58h24l-3.5 42h-17Z" fill="none" />
      <rect className={COR} x="79" y="51" width="30" height="8" rx="3" />
      <path className={T} d="M97 51l5-15h6" fill="none" />
      <Brilho cx={104} cy={22} r={5} />
    </>
  )
}

function Comercio() {
  return (
    <>
      <Sombra />
      <rect className={CLARO} x="34" y="12" width="52" height="14" rx="4" />
      <path className={T} d="M44 19h20M68 19h8" fill="none" />
      <rect className={BRANCO} x="20" y="44" width="80" height="58" rx="4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect className={i % 2 === 0 ? x.ilCor : x.ilBranco} x={16 + i * 17.6} y="30" width="17.6" height="15" />
          <path className={`${i % 2 === 0 ? x.ilCor : x.ilBranco} ${T}`} d={`M${16 + i * 17.6} 45a8.8 8.8 0 0 0 17.6 0`} />
        </g>
      ))}
      <rect className={T} x="16" y="30" width="88" height="15" rx="2" fill="none" />
      <rect className={CLARO} x="28" y="60" width="34" height="26" rx="3" />
      <path className={T} d="M28 76h34" fill="none" />
      <rect className={COR} x="33" y="64" width="6" height="12" rx="1.5" />
      <rect className={AMARELO} x="42" y="67" width="7" height="9" rx="1.5" />
      <rect className={COR} x="52" y="63" width="5" height="13" rx="1.5" />
      <rect className={COR} x="70" y="60" width="22" height="42" rx="2" />
      <rect className={BRANCO} x="74" y="65" width="14" height="16" rx="2" />
      <circle cx="87" cy="88" r="1.8" fill="#fff" />
      <path className={COR} d="M100 88h12l-2 14h-8Z" />
      <ellipse className={FOLHA} cx="103" cy="80" rx="3.5" ry="7" transform="rotate(-20 103 80)" />
      <ellipse className={FOLHA} cx="109" cy="81" rx="3.5" ry="7" transform="rotate(22 109 81)" />
      <Brilho cx={14} cy={20} r={6} />
      <Brilho cx={104} cy={16} r={4} />
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
    <svg className={x.ilustracao} viewBox="0 0 120 120" width="118" height="118" aria-hidden>
      <Desenho />
    </svg>
  )
}
