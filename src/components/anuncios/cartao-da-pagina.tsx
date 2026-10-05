'use client'

import { FotoDaPagina } from './foto-da-pagina'
import { CartaoDeConexao } from '@/components/conexoes/cartao'
import { Pilula } from '@/components/design/pilula'
import { useState, useTransition } from 'react'
import { acaoDesligarPagina, acaoImportarLeadsAntigos } from '@/server/acoes-lead-ads'

/**
 * Uma Página ligada, e se ela está mesmo pronta para receber lead.
 *
 * **O aviso de token faltando mora aqui, e não só no cartão de cima.** Página
 * ligada com token ausente é o estado que mais engana: a lista mostra a Página,
 * a pessoa conclui que está tudo certo, e nenhum lead entra. Dizer isso na
 * linha da Página é o que liga as duas metades na cabeça de quem olha.
 */
export function CartaoDaPagina({
  clienteId,
  pageId,
  nome,
  temToken,
  foto = null,
}: {
  clienteId: string
  pageId: string
  nome: string
  temToken: boolean
  foto?: string | null
}) {
  const [saindo, comecar] = useTransition()
  const [importando, importar] = useTransition()
  const [resultado, setResultado] = useState<string | null>(null)

  return (
    <CartaoDeConexao
      logo={<FotoDaPagina foto={foto} nome={nome} />}
      selo={
        temToken ? (
          <Pilula tom="ok">recebendo</Pilula>
        ) : (
          <Pilula titulo="Ligue a conta de anúncios para os leads desta página entrarem">falta o acesso</Pilula>
        )
      }
      titulo={nome !== '' ? nome : 'Página sem nome'}
      categoria="Página do Facebook"
      rodape={
        <>
          {/*
            Importar só aparece com o acesso ligado, porque sem token não há o
            que buscar, e um botão que só sabe dizer "ligue antes" é um botão
            que ensina a errar.
          */}
          {temToken && (
            <button
              type="button"
              disabled={importando}
              onClick={() =>
                importar(async () => {
                  const r = await acaoImportarLeadsAntigos(clienteId, pageId)
                  setResultado(r.ok ? (r.resumo ?? 'pronto') : (r.erro ?? 'não deu'))
                })
              }
              className="botao-secundario botao-sm"
              title="Traz os leads que já existiam antes de ligar, a Meta guarda 90 dias"
            >
              {importando ? 'Importando…' : 'Importar leads antigos'}
            </button>
          )}
          <button
            type="button"
            disabled={saindo}
            onClick={() => comecar(() => void acaoDesligarPagina(clienteId, pageId))}
            className="botao-secundario botao-sm"
          >
            {saindo ? 'Desligando…' : 'Desligar'}
          </button>
        </>
      }
    >
      {temToken
        ? 'Os leads dos formulários desta Página entram aqui, com o telefone e a campanha.'
        : 'Ligada, mas sem a conta da Meta os leads não entram.'}
      {/*
        O resultado fica no próprio cartão, e não some sozinho: quem importou
        precisa poder ler com calma quantos entraram, e conferir depois.
      */}
      {resultado !== null && <p className="mt-2 text-[11px] text-dim">{resultado}</p>}
    </CartaoDeConexao>
  )
}
