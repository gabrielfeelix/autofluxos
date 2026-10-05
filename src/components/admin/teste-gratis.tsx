'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import { DIAS_DE_TESTE } from '@/core/planos'
import { acaoAdminEncerrarTeste, acaoAdminIniciarTeste } from '@/server/acoes-admin'

/**
 * O teste grátis da organização (0128). Fica na aba Plano porque é contrato:
 * põe a conta no plano do teste por alguns dias, e trocar de plano encerra.
 */
export function TesteGratis({ organizacaoId, inicial, planoDoTeste }: { organizacaoId: string; inicial: string | null; planoDoTeste: string }) {
  const [ate, setAte] = useState(inicial)
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [rodando, comecar] = useTransition()

  const iniciar = () =>
    comecar(async () => {
      const r = await acaoAdminIniciarTeste(organizacaoId)
      if (!r.ok || !r.ate) {
        setMensagem({ tom: 'erro', texto: r.erro ?? 'Não deu para iniciar.' })
        return
      }
      setAte(r.ate)
      setMensagem({ tom: 'ok', texto: `A conta está no ${planoDoTeste} até ${dataCurta(r.ate)}.` })
    })

  const encerrar = () =>
    comecar(async () => {
      const anterior = ate
      setAte(null)
      const r = await acaoAdminEncerrarTeste(organizacaoId)
      if (!r.ok) {
        setAte(anterior)
        setMensagem({ tom: 'erro', texto: r.erro ?? 'Não deu para encerrar.' })
        return
      }
      setMensagem({ tom: 'ok', texto: 'Teste encerrado. A conta segue no plano atual.' })
    })

  return (
    <section aria-labelledby="titulo-teste-gratis" className="app-card px-5 py-4">
      <h2 id="titulo-teste-gratis" className="text-[14px] font-bold">
        Teste grátis
      </h2>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">
        {ate
          ? `Em teste no ${planoDoTeste} até ${dataCurta(ate)}. Se vencer sem plano escolhido, IA, transmissões, integrações e API pausam; nada é apagado.`
          : `Libera o ${planoDoTeste} por ${DIAS_DE_TESTE} dias, sem cartão. Escolher um plano encerra o teste.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ate ? (
          <Botao variante="secundario" disabled={rodando} onClick={encerrar}>
            {rodando ? 'Encerrando…' : 'Encerrar teste'}
          </Botao>
        ) : (
          <Botao variante="secundario" disabled={rodando} onClick={iniciar}>
            {rodando ? 'Iniciando…' : `Iniciar teste de ${DIAS_DE_TESTE} dias`}
          </Botao>
        )}
        {mensagem && (
          <span role="status" className={`text-[12px] ${mensagem.tom === 'erro' ? 'text-perigo' : 'text-muted'}`}>
            {mensagem.texto}
          </span>
        )}
      </div>
    </section>
  )
}

function dataCurta(aaaammdd: string): string {
  const [ano, mes, dia] = aaaammdd.split('-')
  return `${dia}/${mes}/${ano}`
}
