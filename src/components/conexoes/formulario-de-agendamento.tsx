'use client'

import { useState, useTransition } from 'react'
import { acaoAtivarFormulario } from '@/server/acoes-formularios'
import { CartaoDeConexao } from './cartao'
import { LogoWhatsApp } from '@/components/design/logos-de-marca'
import { Pilula } from '@/components/design/pilula'

export type NumeroDoFormulario = {
  canalId: string
  telefone: string | null
  status: 'inativo' | 'rascunho' | 'publicado' | 'erro'
  erro: string | null
}

/**
 * O formulário nativo de agendamento do WhatsApp, um por número.
 *
 * Mora ao lado do cartão da Verandi porque depende dela: a lista de dias e
 * horários vem da agenda na hora. Ativar sobe a chave pública no número, cria
 * e publica o formulário na Meta; a tela muda na hora e mostra o desfecho.
 */
export function CartaoDoFormularioDeAgendamento({ clienteId, numeros }: { clienteId: string; numeros: NumeroDoFormulario[] }) {
  const [estado, setEstado] = useState(numeros)
  const [ativando, setAtivando] = useState<string | null>(null)
  const [, comecar] = useTransition()

  const algumAtivo = estado.some((n) => n.status === 'publicado')

  function ativar(canalId: string) {
    setAtivando(canalId)
    setEstado((atual) => atual.map((n) => (n.canalId === canalId ? { ...n, erro: null } : n)))
    comecar(async () => {
      const resposta = await acaoAtivarFormulario(clienteId, canalId)
      setEstado((atual) =>
        atual.map((n) =>
          n.canalId === canalId ? (resposta.ok ? { ...n, status: 'publicado', erro: null } : { ...n, status: 'erro', erro: resposta.erro }) : n,
        ),
      )
      setAtivando(null)
    })
  }

  return (
    <CartaoDeConexao
      logo={<LogoWhatsApp />}
      selo={algumAtivo ? <Pilula tom="ok">ativo</Pilula> : <Pilula>não ativado</Pilula>}
      titulo="Formulário de agendamento"
      categoria="WhatsApp"
      rodape={
        estado.length === 0 ? (
          <p className="text-[11.5px] leading-5 text-dim">Conecte um número de WhatsApp em Canais para ativar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {estado.map((n) => (
              <li key={n.canalId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-soft">{n.telefone ?? 'Número sem telefone'}</span>
                  {n.status === 'publicado' ? (
                    <Pilula tom="ok">publicado</Pilula>
                  ) : (
                    <button
                      type="button"
                      disabled={ativando !== null}
                      onClick={() => ativar(n.canalId)}
                      className="botao-secundario botao-sm shrink-0"
                    >
                      {ativando === n.canalId ? 'Ativando…' : n.status === 'erro' ? 'Tentar de novo' : 'Ativar'}
                    </button>
                  )}
                </div>
                {n.erro && <p className="text-[11px] leading-4 text-perigo">{n.erro}</p>}
              </li>
            ))}
          </ul>
        )
      }
    >
      A pessoa escolhe dia e horário num formulário do próprio WhatsApp, com os horários livres da agenda. Use no bloco
      Agendar das automações.
    </CartaoDeConexao>
  )
}
