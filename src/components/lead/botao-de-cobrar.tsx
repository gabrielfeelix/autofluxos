'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { NOME_DO_GATEWAY, type Ambiente, type Gateway } from '@/channels/pagamento'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeCobrar } from '@/components/lead/icones-da-barra'
import { acaoCobrarNaConversa } from '@/server/acoes-cobrancas'

export type CobrarNaConversa =
  | {
      conectado: true
      gateway: Gateway
      ambiente: Ambiente
      /** O Asaas exige CPF ou CNPJ, e a ficha não tem: o campo já nasce aberto. */
      pedeDocumento: boolean
    }
  /** Plano e permissão ok, sem conta de recebimento: o painel leva a conectar. */
  | { conectado: false }

/**
 * O botão **Cobrar** da caixa de resposta (cobrança no chat, etapa C).
 *
 * Valor e descrição, e a cobrança sai na conversa em duas mensagens: o resumo
 * com o botão do link, e o Pix copia e cola sozinho, para a pessoa tocar,
 * copiar e colar no banco. Vence em 24 horas (decisão 3 do plano).
 *
 * O valor é o que a pessoa digitou, conferido no servidor. Nada aqui define o
 * valor final: o navegador só manda o texto.
 *
 * No celular o painel se prende às laterais da tela, e não ao botão: preso ao
 * botão, ele passava da borda direita e a conversa rolava de lado.
 */
export function BotaoDeCobrar({
  clienteId,
  contatoId,
  cobrar,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  cobrar: CobrarNaConversa
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [documento, setDocumento] = useState('')
  const [pedeDocumento, setPedeDocumento] = useState(cobrar.conectado && cobrar.pedeDocumento)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function noEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await acaoCobrarNaConversa(clienteId, contatoId, {
        valor,
        descricao,
        documento: pedeDocumento ? documento : undefined,
      })
      if (r.ok) {
        setAberto(false)
        setValor('')
        setDescricao('')
        setDocumento('')
        setPedeDocumento(false)
      } else {
        setErro(r.erro)
        if (r.pedeDocumento) setPedeDocumento(true)
      }
    } catch {
      setErro('Não foi possível cobrar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const pronto = valor.trim() !== '' && descricao.trim() !== '' && (!pedeDocumento || documento.trim() !== '')

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Cobrar" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => setAberto((a) => !a)}
          aria-label="Cobrar nesta conversa"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeCobrar />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Cobrar"
          className="fixed inset-x-3 bottom-28 z-30 rounded-[12px] border border-line bg-panel p-3 shadow-[0_10px_30px_rgba(19,25,34,0.11)] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-[340px]"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold">Cobrar nesta conversa</p>
            {cobrar.conectado && cobrar.ambiente === 'teste' && (
              <span className="rounded-full bg-aviso/10 px-2 py-0.5 text-[10.5px] font-semibold text-aviso">teste</span>
            )}
          </div>
          {!cobrar.conectado ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] leading-5 text-soft">
                Mande Pix copia e cola e link de cartão ou boleto por aqui. Quando o pagamento cai, a
                cobrança vira paga sozinha.
              </p>
              <p className="text-[12px] leading-5 text-dim">
                Primeiro conecte a conta onde você recebe, no Mercado Pago ou no Asaas. O dinheiro vai
                direto para ela, sem porcentagem para o AutoFluxos.
              </p>
              <Link href={`/clientes/${clienteId}/ajustes/pagamentos`} className="botao-primario botao-md w-full">
                Conectar conta de recebimento
              </Link>
            </div>
          ) : (
            <>
            {/*
              `div`, e não `form`: o painel vive dentro do formulário da resposta,
              e formulário dentro de formulário quebra a hidratação. Enter aqui
              cobra, nunca envia a mensagem que está sendo escrita.
            */}
            <div
              className="flex flex-col gap-2"
              onKeyDown={(evento) => {
                if (evento.key !== 'Enter') return
                evento.preventDefault()
                evento.stopPropagation()
                if (pronto) void enviar()
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-soft">Valor</span>
                <span className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[12.5px] text-dim">R$</span>
                  <input
                    inputMode="decimal"
                    autoFocus
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Exemplo: 109,80"
                    className="app-field h-9 w-full pr-2.5 pl-8 text-[13px] tabular-nums"
                  />
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-soft">Descrição</span>
                <input
                  value={descricao}
                  maxLength={200}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Exemplo: Mensalidade de novembro"
                  className="app-field h-9 w-full px-2.5 text-[13px]"
                />
              </label>
              {pedeDocumento && (
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-semibold text-soft">CPF ou CNPJ de quem paga</span>
                  <input
                    inputMode="numeric"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="Exemplo: 529.982.247-25"
                    className="app-field h-9 w-full px-2.5 text-[13px] tabular-nums"
                  />
                  <span className="text-[11px] leading-4 text-dim">
                    O {NOME_DO_GATEWAY[cobrar.gateway]} exige. Fica salvo na ficha para a próxima.
                  </span>
                </label>
              )}

              {erro && (
                <p role="alert" className="text-[12px] leading-5 text-perigo">
                  {erro}
                </p>
              )}

              <p className="text-[11.5px] leading-4 text-dim">
                Sai nesta conversa com Pix copia e cola e link para cartão ou boleto. Vence em 24 horas. Recebe na
                conta do {NOME_DO_GATEWAY[cobrar.gateway]}.
              </p>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!pronto || enviando}
                className="botao-primario botao-md w-full"
              >
                {enviando ? 'Gerando o Pix…' : 'Enviar cobrança'}
              </button>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
