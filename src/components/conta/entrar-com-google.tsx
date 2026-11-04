'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { acaoEntrarComGoogle } from '@/server/acoes-conta'

/**
 * "Continuar com Google", em cima do formulário de senha.
 *
 * O "G" é o oficial, recortado do pacote de marca do Google
 * (`signin-assets.zip`), e o texto segue a diretriz deles: "Continuar com
 * Google", sem mudar a cor nem o desenho da marca.
 */
export function EntrarComGoogle({ erro: erroInicial }: { erro?: string }) {
  const [estado, enviar, pendente] = useActionState(async () => acaoEntrarComGoogle(), { erro: erroInicial })

  return (
    <div className="flex flex-col gap-3.5">
      <form action={enviar}>
        <button
          type="submit"
          disabled={pendente}
          className="botao-secundario botao-md w-full justify-center gap-2.5"
        >
          <Image src="/logos/marcas/google.png" alt="" width={18} height={18} aria-hidden />
          {pendente ? 'Abrindo o Google...' : 'Continuar com Google'}
        </button>
      </form>
      {estado?.erro && (
        <p role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-perigo">
          {estado.erro}
        </p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-dim" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        ou com e-mail
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  )
}
