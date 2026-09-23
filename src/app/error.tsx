'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DetalheDoErro } from '@/components/design/detalhe-do-erro'
import { voltaDoErro } from '@/core/volta-do-erro'

/**
 * Deu errado.
 *
 * Sem este arquivo, uma falha de banco derruba a árvore inteira e a pessoa fica
 * com a tela branca do Next, sem caminho de volta.
 *
 * ---------------------------------------------------------------------------
 * Por que "tentar de novo" tenta duas coisas diferentes
 * ---------------------------------------------------------------------------
 *
 * O `reset` do Next remonta **só o pedaço que quebrou**, mantendo a página
 * carregada. Isso é o certo quando a falha foi passageira, uma consulta que
 * demorou demais, e é o mais rápido.
 *
 * Mas quando o problema está no que o navegador já carregou, remontar falha de
 * novo, e de novo, e de novo. Foi o que um cliente relatou em 16/set/2026:
 * *"toda hora tem q dar o clique pro botão e depois tentar de novo, não vai
 * direto"*. Cada item do menu de Configurações quebrava, o `reset` fazia
 * parecer que tinha resolvido, e o item seguinte quebrava igual. A pessoa
 * aprendeu a fazer a dança de dois cliques em vez de reclamar, que é o pior
 * desfecho possível.
 *
 * Então a segunda tentativa **recarrega a página de verdade**, jogando fora
 * tudo o que o navegador tinha. É o que qualquer pessoa faria sozinha, e é o
 * que o botão deveria ter feito desde sempre. O rótulo muda junto: ninguém
 * clica duas vezes no mesmo botão esperando resultado diferente.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [jaTentou, setJaTentou] = useState(false)
  const volta = voltaDoErro(usePathname() ?? '')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center p-10 text-center">
      <div className="app-page-enter max-w-[430px]">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-lg font-bold text-perigo">!</span>
      <h1 className="text-[19px] font-bold">Alguma coisa quebrou aqui.</h1>
      <p className="mt-2 mb-5 text-[12.5px] leading-[1.65] text-muted">
        {jaTentou
          ? 'Ainda não foi. Recarregar a página joga fora o que ficou pela metade, e costuma resolver quando tentar de novo não resolveu.'
          : 'Nada do que você digitou se perdeu: rascunho de fluxo é salvo sozinho. Tentar de novo costuma resolver quando é falha de rede.'}
      </p>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => {
            if (jaTentou) {
              window.location.reload()
              return
            }
            setJaTentou(true)
            reset()
          }}
          className="app-primary-button px-5 py-2.5 text-[13px]"
        >
          {jaTentou ? 'Recarregar a página' : 'Tentar de novo'}
        </button>
        <Link href={volta.href} className="app-secondary-button px-5 py-2.5 text-[13px]">
          {volta.rotulo}
        </Link>
      </div>

      <DetalheDoErro erro={error} />
      {/*
        A promessa só vale porque agora ela é verdade. Este número é o `digest`,
        e desde o `instrumentation.ts` ele é gravado em `public.alertas` junto
        com a rota e a hora. Antes desta rodada o código não levava a lugar
        nenhum, e pedir para alguém copiá-lo era pedir trabalho em troca de
        nada.
      */}
      <p className="mt-2 text-[11px] text-dim">Mande este código para quem for consertar.</p>
      </div>
    </main>
  )
}
