import { EsqueletoDoEditor } from '@/components/editor/esqueleto-do-editor'

/**
 * O editor tem esqueleto próprio. Sem este arquivo valia o da lista
 * (`fluxos/loading.tsx`), que tem outra forma, ver `EsqueletoDoEditor`.
 */
export default function Carregando() {
  return <EsqueletoDoEditor />
}
