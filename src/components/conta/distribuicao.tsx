'use client'

import { useState, useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { entraPorPadrao } from '@/core/rodizio'
import {
  acaoDefinirAtendente,
  acaoDefinirDistribuicao,
} from '@/server/acoes-distribuicao'

/**
 * Como esta conta reparte os leads novos.
 *
 * ---------------------------------------------------------------------------
 * Por que fica na tela da Equipe, e não numa seção própria
 * ---------------------------------------------------------------------------
 *
 * Distribuição só existe quando há mais de uma pessoa, e a lista de pessoas é
 * esta. Numa seção separada, a conta de um atendente só encontraria uma tela de
 * regras para uma equipe que ela não tem, e a conta de quatro teria que
 * atravessar o painel para ligar duas chaves que falam da gente que está ali em
 * cima.
 *
 * ---------------------------------------------------------------------------
 * O que a tela promete, e o que ela não esconde
 * ---------------------------------------------------------------------------
 *
 * Os controles por pessoa só aparecem com o balanceado ligado, porque no manual
 * eles não decidem nada, e controle que não faz nada ensina que a tela mente.
 * Mas o cartão inteiro continua visível, com a explicação do que o balanceado
 * faz: sumir com a seção deixaria a conta sem como descobrir que a distribuição
 * existe.
 */

export type PessoaNaDistribuicao = {
  id: string
  nome: string
  papel: string
  presenca: string
  /** `null` quando ninguém configurou, e aí vale o padrão do papel. */
  entraNoRodizio: boolean | null
  tetoSimultaneo: number | null
  /** Conversas abertas que já são dela, para a tela mostrar a carga real. */
  abertas: number
}

const MODOS = [
  {
    valor: 'manual',
    rotulo: 'Ninguém recebe sozinho',
    detalhe: 'a conversa fica em "Sem dono" até alguém assumir',
  },
  {
    valor: 'balanceado',
    rotulo: 'Quem tem menos conversa aberta',
    detalhe: 'o lead novo vai para quem está com a mão mais livre',
  },
]

export function Distribuicao({
  clienteId,
  distribuicao,
  exigeAssumir,
  pessoas,
  podeMexer,
}: {
  clienteId: string
  distribuicao: string
  exigeAssumir: boolean
  pessoas: PessoaNaDistribuicao[]
  podeMexer: boolean
}) {
  const [modo, setModo] = useState(distribuicao)
  const [trava, setTrava] = useState(exigeAssumir)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, salvar] = useTransition()

  const mudarConta = (ajustes: { distribuicao?: string; exigeAssumir?: boolean }) => {
    setErro(null)
    salvar(async () => {
      const r = await acaoDefinirDistribuicao(clienteId, {
        distribuicao: ajustes.distribuicao as 'manual' | 'balanceado' | undefined,
        exigeAssumir: ajustes.exigeAssumir,
      })
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para salvar')
        // Desfaz a aposta: o estado que sobra é o que o servidor aceitou.
        setModo(distribuicao)
        setTrava(exigeAssumir)
      }
    })
  }

  return (
    <section className="app-card mt-6 overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">Distribuição do atendimento</h2>
        <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-dim">
          Quem recebe a conversa quando o bot desiste e alguém precisa atender.
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-soft">Lead novo vai para</span>
          <Dropdown
            opcoes={MODOS}
            valor={modo}
            aoMudar={(valor) => {
              setModo(valor)
              mudarConta({ distribuicao: valor })
            }}
            desabilitado={!podeMexer || salvando}
            rotuloAcessivel="Como o lead novo é distribuído"
            className="max-w-[420px]"
          />
          {/*
            A carteira não é uma opção da lista porque ela não é escolha: vale
            sempre, nos dois modos. Dizê-la aqui evita a pergunta que viria na
            primeira semana, que é por que o cliente voltou para o mesmo
            vendedor.
          */}
          <span className="text-[11.5px] leading-5 text-dim">
            Quem já foi atendido por alguém volta sempre para essa pessoa, mesmo que a
            conversa anterior tenha sido resolvida meses atrás.
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={trava}
            disabled={!podeMexer || salvando}
            onChange={(evento) => {
              setTrava(evento.target.checked)
              mudarConta({ exigeAssumir: evento.target.checked })
            }}
            className="mt-0.5 size-4 shrink-0 accent-[var(--cor-primaria,#2f6bff)]"
          />
          <span>
            <span className="block text-[12.5px] font-semibold text-soft">
              Só quem assumiu pode responder
            </span>
            <span className="block text-[11.5px] leading-5 text-dim">
              Todo mundo continua vendo tudo. Quem não é o dono precisa clicar em
              assumir antes de escrever, e é isso que impede duas pessoas
              respondendo a mesma conversa ao mesmo tempo.
            </span>
          </span>
        </label>

        {erro && (
          <p role="alert" className="text-[11.5px] leading-5 text-perigo">
            {erro}
          </p>
        )}
      </div>

      {modo === 'balanceado' && (
        <div className="border-t border-line">
          <p className="px-5 pt-4 pb-2 text-[11.5px] leading-5 text-dim">
            Quem entra no rodízio. Quem está ausente fica de fora enquanto isso e
            mantém as conversas que já são dele.
          </p>
          <ul className="flex flex-col">
            {pessoas.map((pessoa) => (
              <LinhaDoAtendente
                key={pessoa.id}
                clienteId={clienteId}
                pessoa={pessoa}
                podeMexer={podeMexer}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * Uma pessoa, com as duas chaves que a colocam ou tiram da fila de recebimento.
 *
 * O estado é local a esta linha, e não um mapa lá em cima: mexer no teto de uma
 * pessoa não pode redesenhar a lista inteira, e um erro numa linha não deve
 * apagar o que a pessoa acabou de digitar na outra.
 */
function LinhaDoAtendente({
  clienteId,
  pessoa,
  podeMexer,
}: {
  clienteId: string
  pessoa: PessoaNaDistribuicao
  podeMexer: boolean
}) {
  const padrao = entraPorPadrao(pessoa.papel)
  const [entra, setEntra] = useState(pessoa.entraNoRodizio ?? padrao)
  const [teto, setTeto] = useState(String(pessoa.tetoSimultaneo ?? 0))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, salvar] = useTransition()

  const gravar = (proximo: { entra: boolean; teto: string }) => {
    setErro(null)
    salvar(async () => {
      const r = await acaoDefinirAtendente(clienteId, pessoa.id, {
        entraNoRodizio: proximo.entra,
        tetoSimultaneo: Number(proximo.teto) || 0,
      })
      if (!r.ok) setErro(r.erro ?? 'não deu para salvar')
    })
  }

  const ausente = pessoa.presenca !== 'disponivel'

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
      <label className="flex min-w-0 flex-1 items-center gap-2.5">
        <input
          type="checkbox"
          checked={entra}
          disabled={!podeMexer || salvando}
          onChange={(evento) => {
            setEntra(evento.target.checked)
            gravar({ entra: evento.target.checked, teto })
          }}
          className="size-4 shrink-0 accent-[var(--cor-primaria,#2f6bff)]"
        />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-soft">
            {pessoa.nome}
          </span>
          <span className="block text-[11px] text-dim">
            {pessoa.abertas} {pessoa.abertas === 1 ? 'conversa aberta' : 'conversas abertas'}
            {/*
              "Ausente" aparece junto da carga porque é a informação que explica
              por que a pessoa marcada não está recebendo nada. Sem ela, a chave
              ligada e a fila parada pareceriam defeito.
            */}
            {ausente && ' · ausente agora, fora do rodízio'}
          </span>
        </span>
      </label>

      <label className="flex shrink-0 items-center gap-2">
        <span className="text-[11.5px] text-dim">Teto</span>
        <input
          type="number"
          min={0}
          max={200}
          value={teto}
          disabled={!podeMexer || salvando || !entra}
          onChange={(evento) => setTeto(evento.target.value)}
          onBlur={() => gravar({ entra, teto })}
          title="Máximo de conversas abertas ao mesmo tempo. Zero é sem teto."
          className="app-field w-[86px] px-[13px] py-[7px] text-[13px]"
        />
        <span className="text-[11px] text-dim">{Number(teto) === 0 ? 'sem teto' : ''}</span>
      </label>

      {erro && (
        <p role="alert" className="w-full text-[11px] text-perigo">
          {erro}
        </p>
      )}
    </li>
  )
}
