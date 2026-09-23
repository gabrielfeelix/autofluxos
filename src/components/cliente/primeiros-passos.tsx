'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * Os primeiros passos da conta, o onboarding que mora na tela de boas-vindas.
 *
 * **Não é a tela inteira, é uma coluna.** Um checklist em largura cheia diz que
 * a conta é um formulário a preencher; encostado na lateral, ele acompanha
 * enquanto o meio da tela já mostra o produto funcionando. É a mesma escolha que
 * Stripe, Shopify e RD Station fizeram, e pelo mesmo motivo.
 *
 * **Um passo aberto por vez, e é o próximo pendente.** Cinco blocos abertos
 * juntos viram uma parede de texto onde nenhum é a próxima coisa a fazer; e
 * abrir nada obrigaria a clicar para descobrir o que o passo quer.
 *
 * O primeiro passo já nasce feito, a conta existe, quem está lendo a criou. É
 * um truque velho e honesto: barra em zero parece castigo, e o primeiro
 * progresso é o que faz alguém querer o segundo.
 */

export type PassoDaConta = {
  chave: string
  titulo: string
  /** O que este passo é, em uma frase. Só aparece quando ele está aberto. */
  explica: string
  feito: boolean
  /** Um ou mais caminhos. Mais de um quando a escolha é do dono, ver `canal`. */
  acoes: { rotulo: string; href: string }[]
}

export function PrimeirosPassos({ passos }: { passos: PassoDaConta[] }) {
  const prontos = passos.filter((passo) => passo.feito).length
  const proximo = passos.find((passo) => !passo.feito)
  const [aberto, setAberto] = useState<string | null>(proximo?.chave ?? null)

  return (
    <section className="app-card overflow-hidden" aria-labelledby="titulo-passos">
      <header className="bg-primary px-5 py-4 text-white">
        <h2 id="titulo-passos" className="text-[15px] font-bold tracking-[-0.01em]">
          Comece a usar o AutoFluxos
        </h2>
        <p className="mt-1 text-[12.5px] text-white/85">
          {proximo
            ? `Falta${passos.length - prontos === 1 ? '' : 'm'} ${passos.length - prontos} ${passos.length - prontos === 1 ? 'passo' : 'passos'} para preparar seu atendimento.`
            : 'Tudo pronto, a conta está completa.'}
        </p>

        <div className="mt-3.5 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
            role="img"
            aria-label={`${prontos} de ${passos.length} passos prontos`}
          >
            <span
              className="block h-full rounded-full bg-white transition-[width] duration-500"
              style={{ width: `${Math.round((prontos / passos.length) * 100)}%` }}
            />
          </div>
          <span className="text-[11.5px] font-bold whitespace-nowrap text-white/90">
            {prontos} de {passos.length}
          </span>
        </div>
      </header>

      <ol>
        {passos.map((passo) => {
          const expandido = aberto === passo.chave && !passo.feito

          return (
            <li key={passo.chave} className="border-t border-line-soft first:border-0">
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : passo.chave)}
                aria-expanded={expandido}
                disabled={passo.feito}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition enabled:hover:bg-surface enabled:active:bg-surface-strong disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`grid size-[20px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    passo.feito ? 'bg-primary text-white' : 'border border-strong text-dim'
                  }`}
                >
                  {passo.feito ? '✓' : ''}
                </span>

                <span
                  className={`flex-1 text-[13.5px] font-semibold ${passo.feito ? 'text-muted' : ''}`}
                >
                  {passo.titulo}
                </span>

                {!passo.feito && (
                  <span aria-hidden className={`text-[11px] text-dim ${expandido ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                )}
              </button>

              {expandido && (
                <div className="px-5 pb-4 pl-[52px]">
                  <p className="text-[12.5px] leading-[1.6] text-muted">{passo.explica}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {passo.acoes.map((acao, indice) => (
                      <Link
                        key={acao.href}
                        href={acao.href}
                        className={
                          indice === 0
                            ? 'app-primary-button px-3.5 py-1.5 text-[12px]'
                            : 'app-secondary-button px-3.5 py-1.5 text-[12px]'
                        }
                      >
                        {acao.rotulo}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
