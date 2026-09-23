'use client'

import { useCallback, useId, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { acaoImportarFluxoDeJson } from '@/server/acoes'

/**
 * Trazer uma automação de um arquivo.
 *
 * É o outro lado do "Exportar JSON" do editor, e mora aqui, na lista, porque é
 * onde uma automação nasce. O que entra **nasce rascunho, sem IA e sem
 * credencial**, igual ao que vem por link compartilhado: ver
 * `acaoImportarFluxoDeJson`.
 *
 * O arquivo é lido no navegador e mandado como texto para a ação. Não existe
 * upload nem arquivo guardado em lugar nenhum: o que interessa é o desenho, e
 * ele vira uma linha em `flows` na mesma requisição.
 *
 * `renderizar` troca o botão: no diálogo "Nova automação" o gatilho é o cartão
 * "Importar arquivo".
 */
export function ImportarJson({
  clienteId,
  renderizar,
}: {
  clienteId: string
  renderizar?: (abrir: () => void, rodando: boolean) => ReactNode
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const router = useRouter()

  // Pelo id, e não pela ref: o gatilho vem de fora (`renderizar`), e passar a
  // ref para ele contaria como ler a ref durante o desenho.
  const idDaEntrada = useId()
  const abrirArquivo = useCallback(() => document.getElementById(idDaEntrada)?.click(), [idDaEntrada])

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    comecar(async () => {
      try {
        const texto = await arquivo.text()
        const r = await acaoImportarFluxoDeJson(clienteId, texto)
        if (!r.ok || !r.fluxoId) {
          setErro(r.erro ?? 'não deu para importar este arquivo')
          return
        }
        // Abre no editor: quem importou precisa olhar o desenho antes de
        // publicar, e é justamente isso que a importação não faz sozinha.
        router.push(`/clientes/${clienteId}/fluxos/${r.fluxoId}`)
      } catch {
        setErro('não deu para ler este arquivo')
      } finally {
        // Sem isto, escolher o mesmo arquivo de novo não dispara `change` e a
        // tela parece travada depois de um erro.
        if (entrada.current) entrada.current.value = ''
      }
    })
  }

  return (
    <>
      <input
        ref={entrada}
        id={idDaEntrada}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(evento) => escolher(evento.target.files?.[0])}
      />
      {renderizar ? renderizar(abrirArquivo, rodando) : (
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={rodando}
        title="Trazer uma automação de um arquivo JSON exportado daqui"
        className="app-secondary-button px-3 py-2 text-[12.5px] disabled:opacity-50"
      >
        {rodando ? 'importando…' : 'Importar JSON'}
      </button>
      )}
      {erro && (
        <p role="alert" className="w-full text-right text-[11px] text-perigo">
          {erro}
        </p>
      )}
    </>
  )
}
