'use client'

import { useEffect, useState } from 'react'

/**
 * A imagem da conversa, e o visor que abre por cima quando alguém clica nela.
 *
 * ---------------------------------------------------------------------------
 * Por que não continua sendo uma aba nova
 * ---------------------------------------------------------------------------
 *
 * A bolha abria a imagem com `target="_blank"`, e isso custa mais do que
 * parece num atendimento: sai da conversa, perde o lugar da rolagem, e volta
 * significa achar a aba certa. Quem atende olha uma foto para **responder
 * sobre ela**, a conversa precisa continuar atrás.
 *
 * Tem um segundo motivo, específico daqui: a mídia **recebida** vive num bucket
 * privado e a URL é assinada com cinco minutos de validade
 * (`repos/midia-recebida.ts`). Uma aba aberta com essa URL vira uma aba que
 * expira sozinha, e o que a pessoa vê é uma página de erro do Storage sem
 * explicação. Dentro da página a imagem já está carregada e o visor só a
 * amplia, nada é buscado de novo.
 *
 * ---------------------------------------------------------------------------
 * O que o visor precisa fazer para não irritar
 * ---------------------------------------------------------------------------
 *
 * Fechar no `Esc`, fechar no clique fora, e travar a rolagem do fundo enquanto
 * está aberto. Os três são o que separa um visor de um pop-up: sem o `Esc` a
 * pessoa procura o X; sem o clique fora ela clica e nada acontece; e sem travar
 * a rolagem o dedo no trackpad rola a conversa atrás da foto.
 */
export function ImagemDaConversa({ url, nome }: { url: string; nome: string }) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return

    const noTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', noTeclado)

    /*
     * Trava a rolagem do fundo e **devolve o valor que estava lá**, em vez de
     * assumir `''`. Outra coisa pode ter travado antes (um menu, um diálogo), e
     * limpar no chute destrancaria o que não é nosso.
     */
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', noTeclado)
      document.body.style.overflow = rolagemAnterior
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Ver a imagem"
        className="mb-1.5 block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={nome}
          className="max-h-56 w-full rounded-lg border border-line object-cover"
        />
      </button>

      {aberto && (
        <div
          /*
           * `dialog` com `aria-modal` para o leitor de tela anunciar que o
           * resto da página saiu de cena. Sem isso ele continuaria lendo a
           * conversa atrás, que é exatamente o que o visor está escondendo.
           */
          role="dialog"
          aria-modal="true"
          aria-label={nome}
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={nome}
            /*
             * `stopPropagation` para o clique **na foto** não fechar. Fechar ao
             * clicar fora é o gesto esperado; fechar ao clicar na própria
             * imagem seria um visor que some quando a pessoa tenta olhar.
             */
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-2xl"
          />

          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-[13px] text-white transition hover:border-white/50"
          >
            ✕
          </button>

          {/*
            O link para abrir fora fica **dentro** do visor, e não no lugar
            dele. Baixar e ver em tamanho real continuam sendo necessidades
            reais; o que mudou é que deixaram de ser o comportamento padrão de
            um clique.
          */}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-[11.5px] text-white transition hover:border-white/50"
          >
            Abrir em nova aba
          </a>
        </div>
      )}
    </>
  )
}
