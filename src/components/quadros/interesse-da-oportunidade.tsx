'use client'

import { Dropdown } from '@/components/design/dropdown'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import type { Produto } from '@/core/produtos'
import { selecionaveis } from '@/core/produtos'
import { acaoDefinirInteresse, acaoListarProdutos } from '@/server/acoes-produtos'

/**
 * No que esta negociação está interessada (0079).
 *
 * **Um dropdown que salva ao escolher**, como Estágio e Responsável. Antes era
 * um texto com um botão "Escolher" que abria um dropdown com Salvar e
 * Cancelar: três passos para uma escolha que se desfaz em um clique, e o botão
 * tinha a cara dos "Marcar como ganha/perdida" logo abaixo.
 *
 * **O catálogo chega quando o campo aparece**, e não com o quadro: o campo só
 * existe no painel de um negócio aberto e na página do negócio, então é uma
 * leitura por negócio aberto, nunca uma por cartão do quadro.
 *
 * **O nome de hoje aparece mesmo quando o item foi arquivado depois.** Quem
 * vinculou "Plano Antigo" em março continua lendo "Plano Antigo", porque
 * esconder o vínculo faria a tela dizer "sem interesse" sobre uma negociação
 * que tem um. Arquivar tira da escolha, não da leitura (RB-24).
 */
export function InteresseDaOportunidade({
  clienteId,
  cartaoId,
  produtoId,
  produtoNome,
}: {
  clienteId: string
  cartaoId: string
  produtoId: string | null
  produtoNome: string | null
}) {
  const [catalogo, setCatalogo] = useState<Produto[] | null>(null)
  const [erroDoCatalogo, setErroDoCatalogo] = useState<string | null>(null)
  const otimista = useAcaoOtimista<string>(produtoId ?? '')

  useEffect(() => {
    let valeu = true
    acaoListarProdutos(clienteId)
      .then((r) => {
        if (!valeu) return
        if (r.ok) setCatalogo(r.produtos)
        else setErroDoCatalogo(r.erro)
      })
      .catch(() => {
        if (valeu) setErroDoCatalogo('não deu para ler o catálogo')
      })
    return () => {
      valeu = false
    }
  }, [clienteId])

  // O item já vinculado entra na lista mesmo arquivado, e mesmo antes de o
  // catálogo chegar: sem isso o campo abriria dizendo "Não informado".
  const opcoes: { id: string; nome: string; arquivado: boolean }[] = [
    ...(catalogo ? selecionaveis(catalogo) : []),
    ...(catalogo ?? []).filter((p) => p.id === produtoId && p.arquivadoEm !== null),
  ].map((p) => ({ id: p.id, nome: p.nome, arquivado: p.arquivadoEm !== null }))
  if (produtoId && produtoNome && !opcoes.some((p) => p.id === produtoId)) {
    opcoes.push({ id: produtoId, nome: produtoNome, arquivado: false })
  }

  if (catalogo !== null && opcoes.length === 0) {
    return (
      <span className="text-[12px] leading-5 text-dim">
        Nenhum produto cadastrado.{' '}
        <Link href={`/clientes/${clienteId}/loja/catalogo`} className="font-semibold text-primary hover:underline">
          Cadastrar no catálogo
        </Link>
      </span>
    )
  }

  return (
    <span className="flex flex-col">
      <Dropdown
        valor={otimista.valor}
        desabilitado={otimista.pendente}
        aoMudar={(novo) => otimista.agir(novo, () => acaoDefinirInteresse(clienteId, cartaoId, novo))}
        rotuloAcessivel="Produto ou serviço de interesse"
        className="w-full"
        opcoes={[
          { valor: '', rotulo: 'Não informado' },
          ...opcoes.map((produto) => ({
            valor: produto.id,
            rotulo: produto.nome + (produto.arquivado ? ' (arquivado)' : ''),
          })),
        ]}
      />
      {(otimista.erro ?? erroDoCatalogo) && (
        <span role="alert" className="mt-1 text-[10.5px] leading-4 text-perigo">
          {otimista.erro ?? erroDoCatalogo}
        </span>
      )}
    </span>
  )
}
