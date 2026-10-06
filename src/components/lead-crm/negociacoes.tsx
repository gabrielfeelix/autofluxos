'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { comoDinheiro, lerValor, LIMITE_DO_TITULO, type Situacao } from '@/core/crm'
import { comoParado, estaParado } from '@/core/quadros'
import { FecharCartao } from '@/components/quadros/fechar-cartao'
import { acaoDescreverCartao, acaoReabrirCartao } from '@/server/acoes-crm'
import { useAoSalvar, useEdicao } from './modo-de-edicao'
import { IconeDaSecao, iconeFunil } from './icones'
import { VazioDoCartao } from './vazio-do-cartao'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'
import { CampoDeDinheiro } from '@/components/design/campo-de-dinheiro'
import { Modal } from '@/components/design/modal'
import { Dropdown } from '@/components/design/dropdown'
import Link from 'next/link'
import { ORIGENS_DO_NEGOCIO } from '@/core/origens-do-negocio'
import { acaoCriarNegocioAvulso } from '@/server/acoes-negocio'

/** Um cartão desta pessoa, como `quadrosDoContato` devolve. */
export type NegociacaoDoContato = {
  cartaoId: string
  quadro: string
  etapa: string
  entrouEm: string
  titulo: string | null
  valor: number | null
  situacao: Situacao
  /** De onde veio este negócio (0127). */
  origem?: string | null
  /** Quantos arquivos estão guardados nele. */
  arquivos?: number
  /** Acabou de ser criado nesta aba: ainda sem id do servidor. */
  pendente?: boolean
}

type Funil = { id: string; nome: string; primeiraEtapa: string }

/**
 * As negociações da pessoa, na ficha dela.
 *
 * **Vêm antes de etiqueta e anotação** porque respondem a pergunta cara ,
 * quanto essa pessoa vale e em que pé está cada conversa de venda , enquanto
 * as outras duas são apoio. A ficha abria em "Etiquetas", que é o mesmo defeito
 * que o Inbox já tinha corrigido na coluna dele.
 *
 * Ganhar e perder usam o **mesmo modal do quadro** (`FecharCartao`): mesma
 * assimetria (ganhar segue sem valor, perder não segue sem motivo) e mesma
 * lista fechada de motivos. Duas telas com dois modais de fechar venda viram,
 * em um mês, duas regras de fechar venda.
 *
 * Depois de fechar, `router.refresh()`: o que muda aqui é mais do que o
 * cartão (o estágio anda, a linha do tempo ganha uma linha, o "já rendeu"
 * muda). Fechar não é otimista (dispara o cliente e o funil seguinte), mas a
 * linha vira GANHA ou PERDIDA no "ok", sem esperar o redesenho.
 *
 * Reabrir é otimista desde 25/set: a linha volta a ter Ganhar e Perder no
 * clique, e volta ao que era se o servidor recusar. Não recarrega a ficha.
 */
export function Negociacoes({
  clienteId,
  contatoId,
  funis,
  nome,
  negociacoes: doServidor,
  motivos,
}: {
  clienteId: string
  contatoId: string
  /** Onde um negócio novo pode abrir; o padrão vem primeiro. */
  funis: Funil[]
  /** O nome da pessoa, para o título do modal dizer de quem é a venda. */
  nome: string
  negociacoes: NegociacaoDoContato[]
  motivos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const { editando, versao } = useEdicao()
  /*
   * Os negócios criados nesta aba entram na lista no clique, por cima dos do
   * servidor, sem recarregar a ficha. Um mesmo id que o servidor já mandou
   * sai daqui para não aparecer duas vezes.
   */
  const [criadas, setCriadas] = useState<NegociacaoDoContato[]>([])
  const [criando, setCriando] = useState(false)
  const idsDoServidor = new Set(doServidor.map((n) => n.cartaoId))
  const negociacoes = [...criadas.filter((n) => !idsDoServidor.has(n.cartaoId)), ...doServidor]
  const podeCriar = funis.length > 0
  const botaoDeCriar = podeCriar && (
    <button
      type="button"
      onClick={() => setCriando(true)}
      className="ml-auto text-[12px] font-semibold text-primary hover:underline"
    >
      + Novo negócio
    </button>
  )
  const modalDeCriar = (
    <Modal
      aberto={criando}
      aoFechar={() => setCriando(false)}
      titulo="Novo negócio"
      descricao="Um negócio a mais com esta pessoa: pode ser no mesmo funil de outro que já está aberto."
    >
      {criando && (
        <NovaNegociacao
          funis={funis}
          aoCancelar={() => setCriando(false)}
          aoCriar={async (dados) => {
            const r = await acaoCriarNegocioAvulso(clienteId, contatoId, dados)
            if (!r.ok) return r.erro
            const funil = funis.find((f) => f.id === dados.quadroId)
            const lido = lerValor(dados.valor)
            setCriadas((atuais) => [
              {
                cartaoId: r.id,
                quadro: funil?.nome ?? '',
                etapa: funil?.primeiraEtapa ?? '',
                entrouEm: new Date().toISOString(),
                titulo: dados.titulo.trim(),
                valor: lido.ok ? lido.valor : null,
                situacao: 'aberta',
                origem: dados.origem || null,
                arquivos: 0,
              },
              ...atuais,
            ])
            setCriando(false)
            return null
          }}
        />
      )}
    </Modal>
  )
  const [fechando, setFechando] = useState<{
    cartao: NegociacaoDoContato
    situacao: Exclude<Situacao, 'aberta'>
  } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** A situação que esta aba acabou de dar a cada cartão, por cima da do servidor. */
  const [situacoes, setSituacoes] = useState<ReadonlyMap<string, Situacao>>(new Map())
  const situacaoDe = (n: NegociacaoDoContato) => situacoes.get(n.cartaoId) ?? n.situacao
  const marcar = (cartaoId: string, situacao: Situacao | undefined) =>
    setSituacoes((antes) => {
      const novo = new Map(antes)
      if (situacao) novo.set(cartaoId, situacao)
      else novo.delete(cartaoId)
      return novo
    })

  if (negociacoes.length === 0) {
    return (
      <section className="app-card overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFunil}</IconeDaSecao>
        Negócios
        {botaoDeCriar}
      </h2>
        <VazioDoCartao ilustracao={<IlustracaoQuadros />}>
          Nenhum negócio com esta pessoa ainda. Abra um para acompanhar o que ela está
          comprando, em que etapa está e quanto vale.
          {podeCriar && (
            <button type="button" onClick={() => setCriando(true)} className="botao-secundario botao-sm mt-1">
              Novo negócio
            </button>
          )}
        </VazioDoCartao>
        {modalDeCriar}
      </section>
    )
  }

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFunil}</IconeDaSecao>
        Negócios
        {botaoDeCriar}
      </h2>

      <ul>
        {negociacoes.map((negociacao) => {
          const situacao = situacaoDe(negociacao)
          const aberta = situacao === 'aberta'
          const parada = aberta && estaParado(negociacao.entrouEm)
          return (
            <li key={negociacao.cartaoId} className="border-b border-line px-[18px] py-3.5 last:border-0">
              <span className="block text-[10.5px] tracking-[0.04em] text-dim uppercase">
                {negociacao.quadro}
              </span>
              <strong className="mt-0.5 block text-[12.5px] font-semibold text-soft">
                {negociacao.etapa}{' '}
                <span className={parada ? 'font-normal text-aviso' : 'font-normal text-dim'}>
                  · {comoParado(negociacao.entrouEm)}
                </span>
              </strong>

              {editando ? (
                <EdicaoDaNegociacao key={versao} clienteId={clienteId} negociacao={negociacao} />
              ) : (
                <Link
                  href={`/clientes/${clienteId}/negocios/${negociacao.cartaoId}`}
                  className="mt-1.5 block text-[12.5px] leading-5 hover:text-primary"
                  title="Abrir os detalhes do negócio"
                >
                  <span className="underline decoration-line decoration-dotted underline-offset-2">
                    {negociacao.titulo || 'Sem título'}
                  </span>
                  {negociacao.valor !== null && (
                    <span className="font-semibold"> · {comoDinheiro(negociacao.valor)}</span>
                  )}
                </Link>
              )}
              {!editando && (negociacao.origem || (negociacao.arquivos ?? 0) > 0) && (
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-dim">
                  {negociacao.origem && (
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-semibold text-muted">
                      {negociacao.origem}
                    </span>
                  )}
                  {(negociacao.arquivos ?? 0) > 0 && (
                    <span>
                      {negociacao.arquivos} {negociacao.arquivos === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  )}
                </span>
              )}

              {aberta ? (
                <span className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFechando({ cartao: negociacao, situacao: 'ganha' })}
                    className="rounded-[9px] border border-emerald-400/30 bg-emerald-400/[0.1] px-3 py-1.5 text-[11.5px] font-bold text-ok transition hover:bg-emerald-400/[0.18]"
                  >
                    Ganhar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechando({ cartao: negociacao, situacao: 'perdida' })}
                    className="botao-secundario botao-sm"
                  >
                    Perder
                  </button>
                </span>
              ) : (
                <span className="mt-2.5 flex items-center gap-2.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${
                      situacao === 'ganha'
                        ? 'border-emerald-400/25 bg-emerald-400/[0.09] text-ok'
                        : 'border-line bg-surface text-muted'
                    }`}
                  >
                    {situacao === 'ganha' ? 'GANHA' : 'PERDIDA'}
                  </span>
                  {/* Fechar é um clique, e errar o clique é rotina, mesma
                      frase e mesma ação do menu do cartão. */}
                  <button
                    type="button"
                    onClick={() => reabrir(negociacao.cartaoId)}
                    className="text-[11.5px] text-muted underline decoration-dotted underline-offset-2 transition hover:text-primary disabled:opacity-50"
                  >
                    Reabrir
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {aviso && (
        <p role="status" className="border-t border-line px-[18px] py-2.5 text-[11.5px] leading-5 text-muted">
          {aviso}
        </p>
      )}

      {modalDeCriar}

      {/* A `key` reseta os campos do modal entre uma venda e outra, ver o
          comentário em `fechar-cartao.tsx`. */}
      {fechando && (
        <FecharCartao
          key={`${fechando.cartao.cartaoId}-${fechando.situacao}`}
          clienteId={clienteId}
          cartao={{
            id: fechando.cartao.cartaoId,
            nome,
            titulo: fechando.cartao.titulo,
            valor: fechando.cartao.valor,
          }}
          situacao={fechando.situacao}
          motivos={motivos}
          aoFechar={() => setFechando(null)}
          aoConcluir={(resultado) => {
            marcar(fechando.cartao.cartaoId, fechando.situacao)
            setFechando(null)
            setAviso(
              resultado.abriuEm
                ? `Ganha. O cartão seguinte abriu em ${resultado.abriuEm}.`
                : null,
            )
            router.refresh()
          }}
        />
      )}
    </section>
  )

  function reabrir(cartaoId: string) {
    setAviso(null)
    const antes = situacoes.get(cartaoId)
    marcar(cartaoId, 'aberta')
    depoisDaTela(() => acaoReabrirCartao(clienteId, cartaoId)).then(
      (r) => {
        if (!r.ok) {
          marcar(cartaoId, antes)
          setAviso(r.erro ?? 'não deu para reabrir')
        }
      },
      () => {
        marcar(cartaoId, antes)
        setAviso('sem conexão com o servidor: a venda continua fechada')
      },
    )
  }
}

/**
 * Título e valor da negociação, no modo de edição da ficha. Etapa, ganho e
 * perda continuam nos botões e no funil: são decisões, não correções de texto.
 */
function EdicaoDaNegociacao({ clienteId, negociacao }: { clienteId: string; negociacao: NegociacaoDoContato }) {
  const valorInicial = negociacao.valor == null ? '' : String(negociacao.valor).replace('.', ',')
  const [titulo, setTitulo] = useState(negociacao.titulo ?? '')
  const [valor, setValor] = useState(valorInicial)

  useAoSalvar(`negociacao-${negociacao.cartaoId}`, async () => {
    if (titulo.trim() === (negociacao.titulo ?? '').trim() && valor.trim() === valorInicial) return null
    if (valor.trim() !== '') {
      const lido = lerValor(valor)
      if (!lido.ok) return `${negociacao.quadro}: ${lido.motivo}`
    }
    const r = await acaoDescreverCartao(clienteId, negociacao.cartaoId, { titulo: titulo.trim(), valor: valor.trim() })
    return r.ok ? null : `${negociacao.quadro}: ${r.erro ?? 'não deu para salvar'}`
  })

  return (
    <span className="mt-2 flex flex-wrap gap-2">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={LIMITE_DO_TITULO}
        aria-label={`Título do negócio em ${negociacao.quadro}`}
        placeholder="Exemplo: Plano anual"
        className="app-field min-w-0 flex-[2] px-2.5 py-1.5 text-[12.5px]"
      />
      <span className="flex w-[140px] min-w-0 flex-1">
        <CampoDeDinheiro
          valor={valor}
          aoMudar={setValor}
          aria-label={`Valor do negócio em ${negociacao.quadro}`}
          placeholder="0,00"
          className="app-field px-2.5 py-1.5 text-[12.5px]"
        />
      </span>
    </span>
  )
}

function NovaNegociacao({
  funis,
  aoCriar,
  aoCancelar,
}: {
  funis: Funil[]
  /** Devolve a frase de erro, ou `null` se criou. */
  aoCriar: (dados: { quadroId: string; titulo: string; valor: string; origem: string }) => Promise<string | null>
  aoCancelar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState('')
  const [quadroId, setQuadroId] = useState(funis[0]?.id ?? '')
  const [origem, setOrigem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    if (titulo.trim() === '') {
      setErro('dê um nome ao negócio')
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      const falhou = await aoCriar({ quadroId, titulo, valor, origem })
      if (falhou) setErro(falhou)
    } catch {
      setErro('sem conexão com o servidor')
    } finally {
      setSalvando(false)
    }
  }

  const rotulo = 'mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void criar()
      }}
      className="flex flex-col gap-3"
    >
      <label>
        <span className={rotulo}>O que está negociando</span>
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={LIMITE_DO_TITULO}
          placeholder="Exemplo: Mesa de jantar"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={rotulo}>
            Valor <span className="font-normal normal-case">(opcional)</span>
          </span>
          <CampoDeDinheiro valor={valor} aoMudar={setValor} placeholder="0,00" className="app-field px-3 py-2.5 text-[12.5px]" />
        </label>
        <div>
          <span className={rotulo}>De onde veio</span>
          <Dropdown
            rotuloAcessivel="De onde veio este negócio"
            valor={origem}
            aoMudar={setOrigem}
            className="w-full"
            opcoes={[{ valor: '', rotulo: 'Não informada' }, ...ORIGENS_DO_NEGOCIO.map((o) => ({ valor: o, rotulo: o }))]}
          />
        </div>
      </div>
      {funis.length > 1 && (
        <div>
          <span className={rotulo}>Funil</span>
          <Dropdown
            rotuloAcessivel="Funil do negócio"
            valor={quadroId}
            aoMudar={setQuadroId}
            className="w-full"
            opcoes={funis.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          />
          <span className="mt-1 block text-[11px] text-dim">
            Abre na primeira etapa: {funis.find((f) => f.id === quadroId)?.primeiraEtapa}.
          </span>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      <span className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className="botao-secundario botao-md">
          Cancelar
        </button>
        <button type="submit" disabled={salvando} className="botao-primario botao-md">
          {salvando ? 'Criando…' : 'Criar negócio'}
        </button>
      </span>
    </form>
  )
}
