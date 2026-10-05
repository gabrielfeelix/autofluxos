'use client'

import { tituloDoModelo } from '@/core/titulo-da-biblioteca'
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

  const modelo = aprovados?.find((t) => t.id === escolhido) ?? null
  // As lacunas viram o nome do contato, como o servidor faz ao enviar.
  const comNome = (texto: string) => texto.replace(/\{\{\d+\}\}/g, nome)
  const componentes = modelo?.componentes ?? null
  const previa = componentes?.corpo.trim() ? comNome(componentes.corpo) : null

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
        {/*
          Não diz "passaram 24h": com coexistência, a mensagem que a pessoa
          mandou antes de o número ser conectado vem do histórico e não abre
          janela, e a frase mentia numa conversa de horas atrás (MGM,
          30/set/2026). A janela só conta o que chegou por aqui.
        */}
        <strong className="text-muted">Janela de 24h fechada.</strong> Ela abre quando {nome} escreve
        para este número por aqui, e vale 24h. Fora dela, o WhatsApp só deixa retomar com um modelo
        aprovado pela Meta.
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
                rotulo: tituloDoModelo(t.nome),
                // O começo da mensagem embaixo do nome: "Boas-vindas" e "Teste"
                // não dizem o que vai sair, o texto diz.
                ...(t.componentes.corpo.trim()
                  ? { detalhe: comNome(t.componentes.corpo).replace(/\s+/g, ' ').trim().slice(0, 90) }
                  : {}),
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
          {componentes && (
            <div className="order-last w-full rounded-[12px] border border-line bg-surface px-3 py-2.5">
              <span className="mb-1.5 block text-[11px] font-bold text-dim">Como chega para {nome}</span>
              {previa ? (
                <div className="ml-auto w-fit max-w-[min(420px,88%)]">
                  {/* O mesmo balão de mensagem enviada da conversa. */}
                  <div className="rounded-[16px] rounded-br-[6px] bg-primary px-3.5 py-2.5 text-[13px] leading-[1.45] text-white">
                    {componentes.cabecalho?.tipo === 'texto' && (
                      <strong className="mb-1 block">{comNome(componentes.cabecalho.texto)}</strong>
                    )}
                    {componentes.cabecalho && componentes.cabecalho.tipo !== 'texto' && (
                      <span className="mb-1.5 block rounded-[8px] bg-white/15 px-2 py-3 text-center text-[11.5px]">
                        {componentes.cabecalho.tipo === 'imagem' ? 'Imagem' : componentes.cabecalho.tipo === 'video' ? 'Vídeo' : 'Documento'}
                      </span>
                    )}
                    <span className="block whitespace-pre-line">{previa}</span>
                    {componentes.rodape && (
                      <span className="mt-1 block text-[11.5px] text-white/70">{componentes.rodape}</span>
                    )}
                  </div>
                  {componentes.botoes && componentes.botoes.length > 0 && (
                    <div className="mt-1 flex flex-col gap-1">
                      {componentes.botoes.map((botao, i) => (
                        <span
                          key={`${botao.texto}-${i}`}
                          className="rounded-[12px] border border-line bg-panel px-3 py-1.5 text-center text-[12.5px] font-semibold text-primary"
                        >
                          {botao.texto}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="block text-[12px] text-dim">
                  Sem prévia: a Meta não devolveu o texto deste modelo agora. O envio funciona
                  igual.
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !escolhido}
            className="botao-primario botao-md shrink-0"
          >
            {enviando ? 'Enviando…' : 'Retomar'}
          </button>
        </div>
      )}

      {erro && <p className="mt-2 text-[12.5px] leading-5 text-perigo">{erro}</p>}
    </div>
  )
}
