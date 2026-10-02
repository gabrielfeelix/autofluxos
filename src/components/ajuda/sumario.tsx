'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { acharArtigo } from './artigos'

/**
 * "Nesta página": os subtítulos do artigo, com o que está na tela aceso.
 *
 * Lê os `h2[id]` do corpo depois de montar, porque os subtítulos moram dentro
 * dos corpos e não no catálogo. Artigo com menos de dois subtítulos não ganha
 * sumário: uma lista de um item é ruído.
 */
export function Sumario() {
  const [itens, setItens] = useState<{ id: string; texto: string }[]>([])
  const [ativo, setAtivo] = useState<string>()

  useEffect(() => {
    const titulos = [...document.querySelectorAll<HTMLElement>('.artigo-de-ajuda h2[id]')]
    setItens(titulos.map((titulo) => ({ id: titulo.id, texto: titulo.textContent ?? '' })))
    if (titulos.length < 2) return
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((entrada) => entrada.isIntersecting)
        if (visivel) setAtivo(visivel.target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    titulos.forEach((titulo) => observador.observe(titulo))
    return () => observador.disconnect()
  }, [])

  if (itens.length < 2) return null

  return (
    <nav aria-label="Nesta página" className="text-[13px]">
      <p className="mb-3 font-semibold text-ink">Nesta página</p>
      <ul className="space-y-0.5 border-l border-line">
        {itens.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`-ml-px block border-l-2 py-1.5 pl-3 leading-[1.4] transition ${
                ativo === item.id
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.texto}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Os endereços antigos eram âncoras de uma página só (`/ajuda#datas`), e
 * existem em links do produto e em mensagens já mandadas. Na home, um hash que
 * é id de artigo leva ao artigo.
 */
export function RedirecionarAncoraAntiga() {
  const router = useRouter()
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && acharArtigo(id)) router.replace(`/ajuda/${id}`)
  }, [router])
  return null
}
