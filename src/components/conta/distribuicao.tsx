'use client'

import { useRef, useState, useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { entraPorPadrao } from '@/core/rodizio'
import {
  acaoDefinirAtendente,
  acaoDefinirDistribuicao,
  acaoPassarConversas,
} from '@/server/acoes-distribuicao'
import { Botao } from '@/components/design/botao'

/**
 * Como esta conta reparte os leads novos.
 *
 * ---------------------------------------------------------------------------
 * Por que tem tela própria, em Atendimento e IA
 * ---------------------------------------------------------------------------
 *
 * Morou na tela Pessoas até 02/out. Quem configura o atendimento procurava
 * aqui, ao lado do horário, e não lá: quem recebe a conversa quando o bot
 * passa adiante é regra de atendimento, não cadastro de gente.
 *
 * ---------------------------------------------------------------------------
 * O que a tela promete, e o que ela não esconde
 * ---------------------------------------------------------------------------
 *
 * Os controles por pessoa só aparecem com um modo automático, porque no manual
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
  {
    valor: 'rodizio',
    rotulo: 'Um de cada vez, em ordem',
    detalhe: 'cada lead vai para o próximo da lista, e a vez passa adiante',
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
  // Quem entra mora aqui em cima para a frase "todo lead vai para X" saber.
  const [entram, setEntram] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pessoas.map((p) => [p.id, p.entraNoRodizio ?? entraPorPadrao(p.papel)])),
  )
  const marcadas = pessoas.filter((p) => entram[p.id])
  const [erro, setErro] = useState<string | null>(null)
  // Sem travar os controles enquanto grava (25/set): a tela já mudou, e o
  // servidor não redesenha mais a página (`gestoSemRecarregar`).
  const [, salvar] = useTransition()

  const mudarConta = (ajustes: { distribuicao?: string; exigeAssumir?: boolean }) => {
    setErro(null)
    salvar(async () => {
      const r = await acaoDefinirDistribuicao(clienteId, {
        distribuicao: ajustes.distribuicao as 'manual' | 'balanceado' | 'rodizio' | undefined,
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
    <section className="app-card overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">Distribuição do atendimento</h2>
        <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-dim">
          Quem recebe a conversa quando o bot desiste e alguém precisa atender.
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-soft">Lead novo vai para</span>
          <Dropdown
            opcoes={MODOS}
            valor={modo}
            aoMudar={(valor) => {
              setModo(valor)
              mudarConta({ distribuicao: valor })
            }}
            desabilitado={!podeMexer}
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
        </div>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={trava}
            disabled={!podeMexer}
            onChange={(evento) => {
              setTrava(evento.target.checked)
              mudarConta({ exigeAssumir: evento.target.checked })
            }}
            className="mt-0.5 caixa-de-marcar"
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

      {modo !== 'manual' && (
        <div className="border-t border-line">
          <p className="px-5 pt-4 pb-2 text-[11.5px] leading-5 text-dim">
            Quem recebe. Quem está ausente fica de fora enquanto isso e mantém as
            conversas que já são dele.
          </p>
          <ul className="flex flex-col">
            {pessoas.map((pessoa) => (
              <LinhaDoAtendente
                key={pessoa.id}
                clienteId={clienteId}
                pessoa={pessoa}
                podeMexer={podeMexer}
                entra={entram[pessoa.id] ?? false}
                aoMudarEntra={(valor) => setEntram((atual) => ({ ...atual, [pessoa.id]: valor }))}
              />
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[12px] leading-5 text-soft">
            {marcadas.length === 0
              ? 'Ninguém marcado: os leads novos ficam em "Sem dono".'
              : marcadas.length === 1
                ? <>Todo lead novo vai para <strong>{marcadas[0]?.nome}</strong>.</>
                : `${marcadas.length} pessoas recebendo.`}
          </p>
        </div>
      )}
    </section>
  )
}

/**
 * Uma pessoa, com as duas chaves que a colocam ou tiram da fila de recebimento.
 *
 * O teto é local a esta linha: um erro numa linha não deve apagar o que a
 * pessoa acabou de digitar na outra. Quem entra sobe para o cartão, que diz
 * para quem os leads estão indo.
 */
function LinhaDoAtendente({
  clienteId,
  pessoa,
  podeMexer,
  entra,
  aoMudarEntra,
}: {
  clienteId: string
  pessoa: PessoaNaDistribuicao
  podeMexer: boolean
  entra: boolean
  aoMudarEntra: (valor: boolean) => void
}) {
  const [teto, setTeto] = useState(String(pessoa.tetoSimultaneo ?? 0))
  const [erro, setErro] = useState<string | null>(null)
  // O último par que o servidor aceitou: se a gravação falha, a tela volta
  // para ele, em vez de mostrar um valor que não está no banco.
  const gravado = useRef({ entra, teto })
  // Sem travar os controles enquanto grava (25/set): a tela já mudou, e o
  // servidor não redesenha mais a página (`gestoSemRecarregar`).
  const [, salvar] = useTransition()

  const gravar = (proximo: { entra: boolean; teto: string }) => {
    setErro(null)
    salvar(async () => {
      const r = await acaoDefinirAtendente(clienteId, pessoa.id, {
        entraNoRodizio: proximo.entra,
        tetoSimultaneo: Number(proximo.teto) || 0,
      })
      if (r.ok) {
        gravado.current = proximo
        return
      }
      setErro(r.erro ?? 'não deu para salvar')
      setTeto(gravado.current.teto)
      aoMudarEntra(gravado.current.entra)
    })
  }

  const ausente = pessoa.presenca !== 'disponivel'

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
      <label className="flex min-w-0 flex-1 items-center gap-2.5">
        <input
          type="checkbox"
          checked={entra}
          disabled={!podeMexer}
          onChange={(evento) => {
            aoMudarEntra(evento.target.checked)
            gravar({ entra: evento.target.checked, teto })
          }}
          className="caixa-de-marcar"
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
            {ausente && ' · ausente agora, não recebe'}
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
          disabled={!podeMexer || !entra}
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

/**
 * Passa as conversas para uma pessoa de uma vez: o caminho de quem acabou de
 * ligar a distribuição e tem um estoque de conversas sem dono de antes dela.
 */
export function PassarConversas({
  clienteId,
  pessoas,
  contagem: inicial,
  podeMexer,
}: {
  clienteId: string
  pessoas: { id: string; nome: string }[]
  contagem: { semDono: number; total: number; porDono: Record<string, number> }
  podeMexer: boolean
}) {
  const [para, setPara] = useState(pessoas[0]?.id ?? '')
  const [escopo, setEscopo] = useState<'sem-dono' | 'todas'>('sem-dono')
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [contagem, setContagem] = useState(inicial)
  const [passando, passar] = useTransition()
  // "Todas" é o que ainda não é da pessoa escolhida, e muda com ela.
  const naoSaoDela = contagem.total - (contagem.porDono[para] ?? 0)
  const n = escopo === 'sem-dono' ? contagem.semDono : naoSaoDela
  const nome = pessoas.find((p) => p.id === para)?.nome.split(' ')[0] ?? ''

  return (
    <section className="app-card overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">Passar conversas para alguém</h2>
        <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-dim">
          A pessoa vira dona dos contatos: as conversas aparecem com ela no Inbox e
          voltam para ela no próximo contato.
        </p>
      </header>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-soft">Para</span>
            <Dropdown
              opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))}
              valor={para}
              aoMudar={setPara}
              desabilitado={!podeMexer}
              rotuloAcessivel="Para quem passar as conversas"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-soft">Quais</span>
            <Dropdown
              opcoes={[
                { valor: 'sem-dono', rotulo: `Só as sem dono (${contagem.semDono})` },
                { valor: 'todas', rotulo: `Todas que ainda não são dela (${naoSaoDela})` },
              ]}
              valor={escopo}
              aoMudar={(valor) => setEscopo(valor as 'sem-dono' | 'todas')}
              desabilitado={!podeMexer}
              rotuloAcessivel="Quais conversas passar"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Botao
            variante="primario"
            disabled={!podeMexer || !para || n === 0 || passando}
            onClick={() => {
              setAviso(null)
              passar(async () => {
                const r = await acaoPassarConversas(clienteId, para, escopo).catch(() => ({
                  ok: false,
                  erro: 'sem conexão com o servidor',
                  passaram: 0,
                }))
                if (!r.ok) return setAviso({ tom: 'erro', texto: r.erro ?? 'não deu para passar' })
                setAviso({ tom: 'ok', texto: `${r.passaram ?? 0} ${r.passaram === 1 ? 'conversa passou' : 'conversas passaram'} para ${nome}.` })
                // Tudo o que passou agora é da pessoa: o número dela sobe e o resto zera.
                setContagem((atual) => {
                  const porDono = escopo === 'todas'
                    ? Object.fromEntries(Object.keys(atual.porDono).map((id) => [id, id === para ? atual.total : 0]))
                    : { ...atual.porDono, [para]: (atual.porDono[para] ?? 0) + (r.passaram ?? 0) }
                  return { ...atual, semDono: 0, porDono }
                })
              })
            }}
          >
            {passando ? 'Passando…' : n === 0 ? 'Nada para passar' : `Passar ${n} para ${nome}`}
          </Botao>
          {aviso && (
            <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={`text-[12px] ${aviso.tom === 'erro' ? 'text-perigo' : 'text-ok'}`}>
              {aviso.texto}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
