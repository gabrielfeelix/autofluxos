export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`${compacta ? 'size-6 rounded-[7px]' : 'size-7 rounded-lg'} flex shrink-0 items-center justify-center bg-[linear-gradient(135deg,var(--accent),#7c6cff)]`}
      >
        <span className={`${compacta ? 'size-2' : 'size-2.5'} rotate-45 rounded-[2px] bg-[#080b10]`} />
      </span>
      <span className={`${compacta ? 'text-sm' : 'text-[15.5px]'} font-bold tracking-[-0.01em]`}>
        AutoFluxos
      </span>
    </div>
  )
}
