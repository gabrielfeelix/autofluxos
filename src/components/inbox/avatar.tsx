/**
 * As iniciais de quem está do outro lado, com o ponto vermelho de quem espera.
 *
 * **Mora em arquivo próprio porque é usado dos dois lados da fronteira**: a
 * linha da fila (`components/inbox/fila.tsx`, cliente) e o cabeçalho da
 * conversa (`inbox/page.tsx`, servidor). Sem `'use client'` de propósito —
 * não tem estado nem efeito, então serve aos dois sem obrigar ninguém a virar
 * componente de cliente.
 */
export function Avatar({ nome, alerta }: { nome: string | null; alerta: boolean }) {
  const iniciais = (nome ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.05] text-[10px] font-bold text-[#b9c2d0]">
      {iniciais}
      {alerta && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#0c1118] bg-rose-400" />}
    </span>
  )
}
