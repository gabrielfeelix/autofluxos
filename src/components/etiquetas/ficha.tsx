import { CLASSE_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'

/**
 * Uma etiqueta desenhada.
 *
 * Componente de servidor e sem estado: ela aparece na lista de contatos, na
 * ficha do lead, no painel do Inbox e na tela de configurações. Quatro cópias
 * do mesmo `<span>` divergem na terceira vez que alguém mexe no raio da borda.
 */
export function FichaDeEtiqueta({
  nome,
  cor,
  titulo,
}: {
  nome: string
  cor: CorDeEtiqueta
  titulo?: string
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${CLASSE_DA_COR[cor]}`}
    >
      {nome}
    </span>
  )
}
