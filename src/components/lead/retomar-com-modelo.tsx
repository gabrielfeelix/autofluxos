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
        <div className="mt-2.5 flex flex-col gap-2">
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

          {/*
            A caixa de escrever, travada com o texto do modelo: é o que vai
            sair, no lugar onde a mensagem normalmente se escreve. O Enviar
            mora onde o Enviar moraria. O nome do contato, que entra no lugar
            das lacunas, vem destacado para se ver o que muda de uma pessoa
            para outra.
          */}
          <div className="rounded-[16px] border border-strong bg-panel">
            <span className="flex items-center gap-1.5 px-3.5 pt-2.5 text-[11px] font-semibold text-dim">
              <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10.5" width="14" height="10" rx="2" />
                <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
              </svg>
              Texto do modelo aprovado, não dá para editar
            </span>
            <div className="max-h-[180px] overflow-y-auto px-3.5 pt-1.5 pb-2.5 text-[13.5px] leading-[1.5] text-soft">
              {componentes?.cabecalho?.tipo === 'texto' && (
                <strong className="mb-0.5 block text-ink">
                  <ComLacunas texto={componentes.cabecalho.texto} nome={nome} />
                </strong>
              )}
              {componentes?.cabecalho && componentes.cabecalho.tipo !== 'texto' && (
                <span className="mb-1 block text-[12px] text-dim">
                  Com {componentes.cabecalho.tipo === 'imagem' ? 'imagem' : componentes.cabecalho.tipo === 'video' ? 'vídeo' : 'documento'} no topo
                </span>
              )}
              {componentes?.corpo.trim() ? (
                <span className="block whitespace-pre-line">
                  <ComLacunas texto={componentes.corpo} nome={nome} />
                </span>
              ) : (
                <span className="block text-[12.5px] text-dim">
                  Sem prévia: a Meta não devolveu o texto deste modelo agora. O envio funciona igual.
                </span>
              )}
              {componentes?.rodape && <span className="mt-1 block text-[12px] text-dim">{componentes.rodape}</span>}
            </div>
            <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
              {/*
                "Verificar a conta" sozinho parecia um aviso do sistema pedindo
                para quem atende verificar algo. É o botão que vai junto na
                mensagem do cliente, e a frase diz isso.
              */}
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {componentes?.botoes && componentes.botoes.length > 0 && (
                  <span className="text-[11px] text-dim">
                    {componentes.botoes.length === 1 ? 'Vai com o botão' : 'Vai com os botões'}
                  </span>
                )}
                {componentes?.botoes?.map((botao, i) => (
                  <span
                    key={`${botao.texto}-${i}`}
                    title="O cliente vê este botão embaixo da mensagem"
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-muted"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {botao.tipo === 'URL' ? (
                        <>
                          <path d="M14 4h6v6" />
                          <path d="M20 4 11 13" />
                          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                        </>
                      ) : botao.tipo === 'PHONE_NUMBER' ? (
                        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
                      ) : (
                        <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
                      )}
                    </svg>
                    {botao.texto}
                  </span>
                ))}
              </span>
              <button
                type="button"
                onClick={enviar}
                disabled={enviando || !escolhido}
                className="botao-primario botao-sm shrink-0"
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && <p className="mt-2 text-[12.5px] leading-5 text-perigo">{erro}</p>}
    </div>
  )
}

/** O texto com as lacunas trocadas pelo nome, que vem destacado. */
function ComLacunas({ texto, nome }: { texto: string; nome: string }) {
  return (
    <>
      {texto.split(/(\{\{\d+\}\})/g).map((parte, i) =>
        /^\{\{\d+\}\}$/.test(parte) ? (
          <mark key={i} className="rounded-[4px] bg-primary/10 px-0.5 font-semibold text-primary">
            {nome}
          </mark>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  )
}
