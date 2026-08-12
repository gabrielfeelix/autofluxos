import type { Cliente } from '@/server/repos/clientes'

/** As duas primeiras letras que sobram do nome, para quando não há logo. */
export function iniciaisDe(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1)

  if (palavras.length === 0) return nome.slice(0, 2).toUpperCase()
  if (palavras.length === 1) return palavras[0]!.slice(0, 2).toUpperCase()
  return (palavras[0]![0]! + palavras[palavras.length - 1]![0]!).toUpperCase()
}

/**
 * A cara do cliente no painel: a logo dele, ou as iniciais.
 *
 * `object-contain` e não `cover`: logo cortada no meio deixa de ser a logo. O
 * quadrado sobra em volta e tudo bem — vale mais mostrar a marca inteira do que
 * preencher o círculo.
 *
 * Sem `next/image` de propósito. O endereço vem do bucket do Supabase e mudaria
 * de host por cliente; configurar `remotePatterns` para um domínio de terceiro
 * que a gente já controla não paga o que custa, e a imagem é de 44px.
 */
export function LogoDoCliente({
  cliente,
  tamanho = 44,
}: {
  cliente: Pick<Cliente, 'nome' | 'logoUrl'>
  tamanho?: number
}) {
  const lado = { width: tamanho, height: tamanho }

  if (cliente.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cliente.logoUrl}
        alt={`Logo de ${cliente.nome}`}
        style={lado}
        className="shrink-0 rounded-[12px] border border-white/[0.1] bg-white/[0.04] object-contain p-1"
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ ...lado, fontSize: Math.max(10, Math.round(tamanho * 0.28)) }}
      className="flex shrink-0 items-center justify-center rounded-[12px] border border-white/[0.11] bg-[linear-gradient(135deg,#243244,#151d29)] font-bold text-[#9aa6b8]"
    >
      {iniciaisDe(cliente.nome)}
    </span>
  )
}
