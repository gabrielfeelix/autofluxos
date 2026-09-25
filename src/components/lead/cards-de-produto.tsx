'use client'

import type { ProdutoNaMensagem } from '@/server/repos/leads'
import { ImagemDaConversa } from './visor-de-imagem'

/**
 * Os cards de produto como o cliente viu no WhatsApp: **um por mensagem**.
 *
 * O envio grava os cards numa linha só do histórico (ver `cloud-api.ts`, o id
 * é o do primeiro), e a Inbox mostrava tudo numa bolha, com as fotos em grade e
 * o texto dos três colado embaixo. Quem atende lia outra coisa que o cliente.
 * Aqui cada produto vira a sua bolha, com a foto, o título em negrito, a linha
 * de preço e o botão da loja separado por um fio, que é o `cta_url` da Meta.
 */
export function CardsDeProduto({
  produtos,
  nossa,
  hora,
  horaCompleta,
  autor,
  naoConfirmado,
}: {
  produtos: ProdutoNaMensagem[]
  nossa: boolean
  hora: string
  horaCompleta: string
  autor?: string | null
  naoConfirmado: boolean
}) {
  return (
    <div className={`flex w-full flex-col gap-1.5 ${nossa ? 'items-end' : 'items-start'}`}>
      {produtos.map((produto, i) => {
        const ultimo = i === produtos.length - 1
        return (
          <div
            key={`${produto.foto ?? produto.nome}-${i}`}
            className={`w-[272px] max-w-[78%] overflow-hidden font-texto ${
              nossa ? 'bolha-nossa rounded-[15px_15px_4px_15px]' : 'bolha-deles rounded-[15px_15px_15px_4px]'
            }`}
          >
            {produto.foto && (
              <div className="p-1.5 pb-0 [&_button]:mb-0">
                <ImagemDaConversa url={produto.foto} nome={produto.nome} produto />
              </div>
            )}
            <div className="px-3 pt-2 pb-1.5 [overflow-wrap:anywhere]">
              <p className="text-[14px] leading-[1.35] font-semibold">{produto.titulo}</p>
              {produto.detalhe && <p className="text-[13.5px] leading-[1.4]">{produto.detalhe}</p>}
              <p className="mt-0.5 text-right text-[11px] text-muted" title={horaCompleta}>
                {ultimo && autor ? `${autor} · ` : ''}
                {hora}
                {ultimo && naoConfirmado && <span className="ml-2 font-semibold text-soft">envio não confirmado</span>}
              </p>
            </div>
            {produto.link && (
              <a
                href={produto.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 border-t border-current/15 py-2 text-[13.5px] font-semibold transition hover:bg-current/5"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 4h6v6" />
                  <path d="M10 14 20 4" />
                  <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
                </svg>
                Ver na loja
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
