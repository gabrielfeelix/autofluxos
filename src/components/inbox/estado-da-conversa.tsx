'use client'

import { useState, useTransition } from 'react'
import { PRAZOS_DE_ADIAMENTO, type PrazoDeAdiamento } from '@/core/adiamento'
import { acaoAdiarConversa, acaoDefinirEstadoDaConversa } from '@/server/acoes'

/**
 * Resolver e adiar, no cabeçalho da conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que estes dois e não um menu de estados
 * ---------------------------------------------------------------------------
 *
 * São as duas respostas para "acabei de olhar esta conversa": **terminou** ou
 * **volto nisso depois**. Um seletor com os três estados obrigaria a escolher
 * numa lista o que são dois gestos distintos — e o terceiro estado (aberta) é
 * o que já está na tela, não uma escolha.
 *
 * Adiar tem prazos fixos em vez de calendário: quatro escolhas, nenhuma delas
 * exige pensar em data. Data livre é o que se acrescenta quando alguém sentir
 * falta, não o que se começa oferecendo.
 *
 * ---------------------------------------------------------------------------
 * O que acontece depois
 * ---------------------------------------------------------------------------
 *
 * As duas tiram a conversa da fila aberta — e **nenhuma das duas some com
 * ninguém**: se a pessoa escrever de novo, o gatilho da 0049 reabre a conversa
 * sozinho, antes de qualquer tela ser consultada. É o que torna resolver um
 * gesto barato: errar custa nada, porque a próxima mensagem desfaz.
 */
export function EstadoDaConversa({
  clienteId,
  contatoId,
  estado,
}: {
  clienteId: string
  contatoId: string
  estado: 'aberta' | 'adiada' | 'resolvida'
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [rodando, comecar] = useTransition()

  const agir = (acao: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null)
    setMenuAberto(false)
    comecar(async () => {
      const r = await acao()
      if (!r.ok) setErro(r.erro ?? 'não deu para mudar a conversa')
    })
  }

  /*
   * Fora da fila aberta, o único gesto que falta é voltar. Oferecer "adiar"
   * numa conversa já adiada seria oferecer o que ela já é.
   */
  if (estado !== 'aberta') {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {erro && <span className="text-[10.5px] text-rose-300">{erro}</span>}
        <button
          type="button"
          disabled={rodando}
          onClick={() => agir(() => acaoDefinirEstadoDaConversa(clienteId, contatoId, 'aberta'))}
          className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px] disabled:opacity-50"
        >
          {rodando ? '…' : 'Reabrir'}
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      {erro && <span className="max-w-[160px] truncate text-[10.5px] text-rose-300">{erro}</span>}

      <button
        type="button"
        disabled={rodando}
        onClick={() => setMenuAberto((aberto) => !aberto)}
        aria-expanded={menuAberto}
        title="Tirar da fila agora e trazer de volta depois"
        className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px] disabled:opacity-50"
      >
        Depois
      </button>

      <button
        type="button"
        disabled={rodando}
        onClick={() => agir(() => acaoDefinirEstadoDaConversa(clienteId, contatoId, 'resolvida'))}
        title="Sai da fila. Se a pessoa escrever de novo, volta sozinha."
        className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px] disabled:opacity-50"
      >
        {rodando ? '…' : 'Resolver'}
      </button>

      {menuAberto && (
        <>
          {/*
            A camada que fecha ao clicar fora. Sem ela o menu só fecha
            escolhendo algo, e quem abriu por engano fica preso nele.
          */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setMenuAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute top-full right-0 z-50 mt-1.5 w-[168px] overflow-hidden rounded-[10px] border border-white/[0.1] bg-[#131923] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            {(Object.keys(PRAZOS_DE_ADIAMENTO) as PrazoDeAdiamento[]).map((prazo) => (
              <button
                key={prazo}
                type="button"
                onClick={() => agir(() => acaoAdiarConversa(clienteId, contatoId, prazo))}
                className="block w-full border-b border-white/[0.06] px-3 py-2 text-left text-[11.5px] text-soft transition last:border-0 hover:bg-white/[0.05] hover:text-white"
              >
                {PRAZOS_DE_ADIAMENTO[prazo].rotulo}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
