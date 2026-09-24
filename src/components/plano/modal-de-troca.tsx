'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Caixa } from '@/components/design/caixa'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { diaPorExtenso, proximaVirada } from '@/core/contrato-do-plano'
import type { PrevisaoDaTroca } from '@/core/troca-de-plano'

type Carregado = { ok: boolean; erro?: string; previsao?: PrevisaoDaTroca }

const reais = (valor: number) => `R$ ${valor.toLocaleString('pt-BR')}`

/**
 * A confirmação de toda troca de plano, na organização e na administração.
 *
 * Abre com a previsão pronta quando a tela já tem o uso (o normal: abre na
 * hora), ou medindo pelo servidor (`carregar`), e mostra, nesta ordem: o preço de antes e de
 * depois, o que impede a troca, o que entra, o que sai (com o que está em uso)
 * e o aviso de consumo. Bloqueio desliga o botão; recurso em uso que sai pede
 * "entendi". O servidor confere tudo de novo ao confirmar.
 *
 * Quem abre cuida do resto de forma otimista: `aoConfirmar` fecha o modal e
 * muda a tela na hora, e volta atrás se o servidor recusar.
 */
export function ModalDeTroca({
  quem,
  paraNome,
  previsao: pronta,
  carregar,
  aoFechar,
  aoConfirmar,
  conexoesHref,
}: {
  quem: 'organizacao' | 'administracao'
  paraNome: string
  /** A previsão já calculada na tela. Sem ela, o modal mede pelo servidor. */
  previsao?: PrevisaoDaTroca
  carregar?: () => Promise<Carregado>
  aoFechar: () => void
  aoConfirmar: (confirmacao: { ciente: boolean; motivo: string }) => void
  /** Onde desconectar números, quando o bloqueio é esse (só na organização). */
  conexoesHref?: string
}) {
  const [estado, setEstado] = useState<Carregado | null>(pronta ? { ok: true, previsao: pronta } : null)
  const [ciente, setCiente] = useState(false)
  const [motivo, setMotivo] = useState('')

  // Mede uma vez, ao abrir: o pai re-renderiza com a troca otimista, e medir
  // de novo a cada render mudaria o modal embaixo de quem está lendo.
  const carregarAoAbrir = useRef(carregar)
  useEffect(() => {
    if (!carregarAoAbrir.current) return
    let vivo = true
    carregarAoAbrir.current()
      .then((r) => vivo && setEstado(r))
      .catch(() => vivo && setEstado({ ok: false, erro: 'sem conexão com o servidor' }))
    return () => {
      vivo = false
    }
  }, [])

  const previsao = estado?.previsao
  const impacto = previsao?.impacto
  const desce = impacto?.sentido === 'desce'
  const bloqueado = (impacto?.bloqueios.length ?? 0) > 0
  const podeConfirmar = Boolean(impacto) && !bloqueado && (!impacto!.exigeCiencia || ciente)

  const titulo = !impacto ? `Mudar para ${paraNome}` : desce ? `Descer para ${paraNome}` : `Subir para ${paraNome}`
  const virada = diaPorExtenso(proximaVirada(new Date()))
  const descricao =
    quem === 'organizacao'
      ? 'O pedido vai para a 4YU, que confirma com você antes de mudar a cobrança.'
      : desce
        ? `A descida vale na virada do mês, em ${virada}, e fica na auditoria da organização.`
        : 'A subida vale na hora e fica na auditoria da organização.'

  return (
    <Modal aberto aoFechar={aoFechar} titulo={titulo} descricao={descricao} largura={500}>
      {!estado ? (
        <div className="flex flex-col gap-3" aria-busy>
          <div className="h-16 animate-pulse rounded-[12px] bg-surface" />
          <div className="h-24 animate-pulse rounded-[12px] bg-surface" />
        </div>
      ) : !previsao || !impacto ? (
        <p role="alert" className="rounded-[10px] border border-perigo/30 bg-perigo/[0.06] px-3 py-2.5 text-[12.5px] leading-5 text-perigo">
          {estado.erro ?? 'não deu para calcular o que muda'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] text-dim">{previsao.de.nome}</p>
              <p className="text-[15px] font-bold tabular-nums">{reais(previsao.de.preco)}</p>
            </div>
            <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-dim">
              <path d="M3.5 9h11M10.5 5l4 4-4 4" />
            </svg>
            <div className="min-w-0 text-right">
              <p className="text-[11px] text-dim">{previsao.para.nome}</p>
              <p className="text-[15px] font-bold tabular-nums">{reais(previsao.para.preco)}</p>
            </div>
            <p className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ${impacto.diferenca > 0 ? 'bg-primary-weak text-primary' : 'bg-emerald-400/[0.1] text-ok'}`}>
              {impacto.diferenca === 0 ? 'mesmo preço' : `${reais(Math.abs(impacto.diferenca))} a ${impacto.diferenca > 0 ? 'mais' : 'menos'}`}
            </p>
          </div>

          {impacto.bloqueios.map((bloqueio) => (
            <div key={bloqueio} className="rounded-[12px] border border-perigo/30 bg-perigo/[0.06] px-4 py-3 text-[12.5px] leading-5 text-perigo">
              <p className="font-semibold">Não dá para trocar ainda</p>
              <p className="mt-0.5">{bloqueio}</p>
              {conexoesHref && (
                <Link href={conexoesHref} className="mt-2 inline-block font-semibold underline underline-offset-2">
                  Abrir conexões
                </Link>
              )}
            </div>
          ))}

          {impacto.ganha.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-soft">Entra no plano</p>
              <ul className="flex flex-col gap-1">
                {impacto.ganha.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12.5px] leading-5 text-muted">
                    <span aria-hidden className="mt-[1px] font-bold text-ok">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {impacto.perde.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-soft">Sai do plano</p>
              <ul className="flex flex-col gap-1.5">
                {impacto.perde.map((perda) => (
                  <li key={perda.recurso} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12.5px] leading-5">
                    <span className="flex items-start gap-2 text-muted">
                      <span aria-hidden className="font-bold text-perigo">−</span>
                      {perda.rotulo}
                    </span>
                    {perda.emUso ? (
                      <span className="rounded-full bg-amber-400/[0.12] px-2 py-0.5 text-[11px] font-semibold text-aviso">em uso: {perda.emUso}</span>
                    ) : (
                      <span className="text-[11px] text-dim">não está em uso</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {impacto.avisos.map((aviso) => (
            <p key={aviso} className="rounded-[12px] border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12.5px] leading-5 text-soft">
              {aviso}
            </p>
          ))}

          {desce && (
            <p className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px] leading-5 text-muted">
              <strong className="font-semibold text-soft">Vale em {virada}.</strong> Até lá, tudo continua funcionando: é o prazo para salvar e exportar.
              {impacto.perde.length > 0 && ' Na virada, o que sai fica só leitura, com a configuração guardada, e religa se a organização subir de novo. Nada é apagado.'}
              {quem === 'organizacao' && ' Avisamos 7 dias e 1 dia antes.'}
            </p>
          )}

          {quem === 'administracao' && !bloqueado && (
            <label>
              <RotuloCampo>Motivo (vai para a auditoria)</RotuloCampo>
              <textarea
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Exemplo: pedido do cliente por telefone"
                className="app-field resize-y px-[13px] py-[11px] text-[13px] leading-6"
              />
            </label>
          )}

          {impacto.exigeCiencia && !bloqueado && (
            <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-5 text-soft">
              <Caixa marcada={ciente} aoMudar={setCiente} rotuloAcessivel="Entendi o que muda" />
              <span>
                {impacto.perde.some((perda) => perda.emUso)
                  ? impacto.avisos.length > 0
                    ? 'Entendi o que sai do plano e que o consumo fica acima dele.'
                    : 'Entendi o que sai do plano.'
                  : 'Entendi que o consumo fica acima do plano.'}
              </span>
            </label>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
          {bloqueado ? 'Fechar' : 'Cancelar'}
        </button>
        {!bloqueado && (
          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => aoConfirmar({ ciente, motivo })}
            className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quem === 'organizacao' ? 'Enviar pedido' : desce ? `Agendar para ${virada}` : `Mudar para ${paraNome}`}
          </button>
        )}
      </div>
    </Modal>
  )
}
