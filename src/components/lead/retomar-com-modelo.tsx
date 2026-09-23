'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/design/dropdown'
import { acaoListarTemplates, acaoRetomarComModelo } from '@/server/acoes-transmissoes'
import type { Template } from '@/server/repos/templates'

/**
 * A saída de quem chegou depois das 24h.
 *
 * ---------------------------------------------------------------------------
 * O que estava aqui antes, e por que era um beco
 * ---------------------------------------------------------------------------
 *
 * A tela dizia "retomar exige um modelo aprovado pela Meta, que este produto
 * ainda não manda" e acabava ali. Duas coisas erradas: o produto passou a
 * mandar, e mesmo quando não mandava, uma tela que explica o impedimento sem
 * oferecer caminho nenhum é pior do que não explicar. A pessoa lê, concorda, e
 * continua sem poder falar com o cliente.
 *
 * Agora são duas saídas, e qual aparece depende do que a conta tem:
 *
 * - **com modelo aprovado**: escolhe qual e manda, sem sair da conversa. É o
 *   caso comum de quem já usa transmissão;
 * - **sem nenhum**: o caminho para criar, porque é o que falta. Mandar a pessoa
 *   "procurar em Transmissões" seria devolver o beco com mais passos.
 *
 * ---------------------------------------------------------------------------
 * Só os aprovados aparecem
 * ---------------------------------------------------------------------------
 *
 * Modelo em análise não entrega, e oferecê-lo aqui produziria uma recusa da
 * Meta depois do clique. A lista é conferida de novo no servidor, porque a Meta
 * pausa modelo por qualidade sem avisar e esta tela pode estar aberta há meia
 * hora.
 */
export function RetomarComModelo({
  clienteId,
  contatoId,
  nome,
  embutido = false,
}: {
  clienteId: string
  contatoId: string
  nome: string
  /** Dentro do compositor (8.2): sem a borda e o respiro de caixa própria. */
  embutido?: boolean
}) {
  const moldura = embutido ? 'mb-2.5' : 'border-t border-line px-[18px] py-3.5'
  const router = useRouter()
  const [aprovados, setAprovados] = useState<Template[] | null>(null)
  const [escolhido, setEscolhido] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [enviando, comecar] = useTransition()

  useEffect(() => {
    let vivo = true
    void acaoListarTemplates(clienteId)
      .then((lista) => {
        if (!vivo) return
        const soAprovados = lista.filter((t) => t.status === 'aprovado')
        setAprovados(soAprovados)
        setEscolhido((atual) => atual || (soAprovados[0]?.id ?? ''))
      })
      .catch(() => {
        if (vivo) setAprovados([])
      })
    return () => {
      vivo = false
    }
  }, [clienteId])

  const corpo = aprovados?.find((t) => t.id === escolhido)?.componentes.corpo ?? null
  const previa = corpo ? corpo.replace(/\{\{\d+\}\}/g, nome) : null

  function enviar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoRetomarComModelo(clienteId, contatoId, escolhido)
      if (!r.ok) {
        setErro(r.erro ?? 'Não deu para retomar.')
        return
      }
      /*
       * A janela **reabre** quando o cliente responder, não agora. Por isso a
       * tela não troca para o campo de texto: ela confirma o envio e espera. O
       * contrário faria a pessoa escrever um parágrafo que a Meta recusaria.
       */
      setPronto(true)
      router.refresh()
    })
  }

  if (pronto) {
    return (
      <div className={moldura}>
        <p className="text-[12.5px] leading-5 text-dim">
          <strong className="text-muted">Modelo enviado.</strong> Quando {nome} responder, a janela
          de 24h reabre e você volta a escrever livremente por aqui.
        </p>
      </div>
    )
  }

  return (
    <div className={moldura}>
      <p className="text-[12.5px] leading-5 text-dim">
        <strong className="text-muted">Passaram 24h desde a última mensagem de {nome}.</strong> O
        WhatsApp só deixa retomar com um modelo aprovado pela Meta.
      </p>

      {aprovados === null ? (
        <p className="mt-2 text-[12.5px] text-dim">Vendo os modelos…</p>
      ) : aprovados.length === 0 ? (
        /*
          Sem modelo aprovado, o que falta é criar um. O link leva direto para a
          aba certa: "vá em Transmissões e procure" é a versão com mais passos
          do mesmo beco.
        */
        <p className="mt-2 text-[12.5px] leading-5 text-dim">
          Esta conta ainda não tem nenhum modelo aprovado.{' '}
          <a
            href={`/clientes/${clienteId}/transmissoes?aba=modelos`}
            className="font-semibold text-primary hover:underline"
          >
            Criar um modelo
          </a>
          . A Meta costuma revisar em até 24h, e os modelos da biblioteca dela saem na hora.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="min-w-[190px] flex-1">
            <Dropdown
              opcoes={aprovados.map((t) => ({
                valor: t.id,
                rotulo: t.nome.replace(/_/g, ' '),
              }))}
              valor={escolhido}
              aoMudar={setEscolhido}
              rotuloAcessivel="Modelo para retomar a conversa"
            />
          </div>
          {/*
            O que vai sair, para quem, antes do clique (X05): as variáveis do
            modelo viram o nome do contato, como o servidor faz ao enviar.
          */}
          {previa && (
            <p className="order-last w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-muted">
              <span className="mb-0.5 block text-[11px] font-bold text-dim">Para {nome}:</span>
              {previa}
            </p>
          )}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !escolhido}
            className="app-primary-button shrink-0 px-4 py-2.5 text-[13px] disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Retomar'}
          </button>
        </div>
      )}

      {erro && <p className="mt-2 text-[12.5px] leading-5 text-perigo">{erro}</p>}
    </div>
  )
}
