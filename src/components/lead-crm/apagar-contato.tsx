'use client'

import { useState, useTransition } from 'react'
import { AcaoDaFicha } from './acoes-da-ficha'

/**
 * Apagar o contato, no mesmo formato dos vizinhos.
 *
 * Era um botão com borda e rótulo ao lado de "Agendar", "Anotar" e "Etiquetar",
 * que são ícone em cima e palavra embaixo: quatro ações na mesma fileira, três
 * com uma forma e a quarta com outra, o que faz a quarta parecer de outro
 * lugar. Aqui é o mesmo item, com o vermelho aparecendo no hover.
 *
 * **A confirmação continua obrigatória** e diz o que some junto, porque não
 * existe desfazer: a conversa não está copiada em lugar nenhum. O pedido de
 * exclusão da LGPD passa por este botão.
 */
export function ApagarContato({
  acao,
  pergunta,
  titulo,
}: {
  acao: () => Promise<{ ok: boolean; erro?: string }>
  pergunta: string
  titulo?: string
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <span className="relative inline-flex flex-col items-center">
      <AcaoDaFicha
        rotulo={rodando ? 'Apagando…' : 'Apagar'}
        tom="perigo"
        titulo={titulo}
        aoClicar={() => {
          setErro(null)
          if (!confirm(pergunta)) return
          comecar(async () => {
            const r = await acao()
            if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
          })
        }}
        icone={
          <>
            <path d="M5 7h14" />
            <path d="M10 7V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V7" />
            <path d="M6.5 7l.7 11a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
          </>
        }
      />
      {erro && (
        <span role="alert" className="absolute top-full mt-0.5 text-[10.5px] whitespace-nowrap text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
