import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { GraficoDiario } from '@/components/relatorios/grafico-diario'
import { CaixaDoBloco, ListaEmBarras, MapaDeHorarios, Rosca, Satisfacao, Vazio } from '@/components/relatorios/graficos'
import { PainelDeBlocos, type Bloco } from '@/components/relatorios/painel-de-blocos'
import { BarraDoPeriodo, Cartao, Mudanca, MudancaDeTempo, MudancaEmPontos } from '@/components/relatorios/pecas'
import { comoDinheiro } from '@/core/crm'
import { taxaDeAutomacao, terminadas } from '@/core/desfecho-da-conversa'
import { pode } from '@/core/permissoes'
import { comoDuracao, completarDias, hojeEmSaoPaulo, lerPeriodo, periodoAnterior } from '@/core/relatorios'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'
import { acharCliente } from '@/server/repos/clientes'
import { arranjoDaAnalise } from '@/server/preferencias'
import {
  atendimentosPorPessoa,
  conversasPorCanal,
  faixasDeEspera,
  horariosDoPeriodo,
  origemDosContatos,
  responsaveisDoEscopo,
  serieDoPeriodo,
  totaisDoPeriodo,
} from '@/server/repos/relatorios'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * Relatórios (plano de UX de 23/09, tarefa 11.1).
 *
 * A home responde "o que precisa de mim agora"; esta tela responde "como o
 * período andou". Por isso os números que moravam na home vieram para cá, com
 * período escolhível e comparação com o período anterior do mesmo tamanho.
 *
 * **O escopo vai para a consulta.** Quem atende só os próprios contatos vê os
 * números deles, e nunca o agregado da conta (H05). A tela diz isso no topo,
 * para ninguém comparar o próprio número com o da conta achando que é o mesmo.
 *
 * Sem exportação nesta rodada, de propósito (decisão do plano).
 */

const PASSOS_DA_AJUDA: PassoDaAjuda[] = [
  {
    titulo: 'Escolha o período',
    texto: '7, 30 ou 90 dias até hoje, ou um intervalo seu. Cada dia é o dia de Brasília.',
  },
  {
    titulo: 'Compare',
    texto: 'Cada número mostra quanto mudou em relação ao período anterior, do mesmo tamanho e logo antes.',
  },
  {
    titulo: 'Passe o mouse',
    texto: 'Cada gráfico mostra o número exato de um dia, de um horário ou de uma fatia.',
  },
  {
    titulo: 'Personalize',
    texto: 'Em Personalizar, esconda o que não usa e mude a ordem dos blocos. Fica guardado neste aparelho.',
  },
]

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'atender', 'proprios')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="relatorios">
        <SemAcesso clienteId={clienteId} oQue="Relatórios" />
      </ClienteShell>
    )
  }
  const escopo = filtroDoAcesso(acesso, 'atender')
  const podeVerValor = pode(acesso.regras, 'ler_valores', 'proprios')

  const hoje = hojeEmSaoPaulo()
  const periodo = lerPeriodo(await searchParams, hoje)
  const anterior = periodoAnterior(periodo)

  const responsaveis = await responsaveisDoEscopo(clienteId, escopo)
  const contaInteira = responsaveis === null
  // O pool fala uma conexão por vez: em sequência, e não em `Promise.all`.
  const atual = await totaisDoPeriodo(clienteId, periodo, responsaveis)
  const antes = await totaisDoPeriodo(clienteId, anterior, responsaveis)
  const serie = completarDias(await serieDoPeriodo(clienteId, periodo, responsaveis), periodo.de, periodo.ate, (dia) => ({
    dia,
    contatosNovos: 0,
    conversas: 0,
    foramParaPessoa: 0,
  }))
  const pessoas = contaInteira ? await atendimentosPorPessoa(clienteId, periodo, responsaveis) : []
  const equipe = pessoas.length >= 2 ? await membrosDaConta(clienteId) : []

  const base = `/clientes/${cliente.id}/relatorios`
  const cruzaAno = periodo.de.slice(0, 4) !== periodo.ate.slice(0, 4)
  const automacao = taxaDeAutomacao(atual.desfechos)
  const automacaoAntes = taxaDeAutomacao(antes.desfechos)

  const horarios = await horariosDoPeriodo(clienteId, periodo, responsaveis)
  const canais = await conversasPorCanal(clienteId, periodo, responsaveis)
  const espera = await faixasDeEspera(clienteId, periodo, responsaveis)
  const origens = await origemDosContatos(clienteId, periodo, responsaveis)
  const arranjo = await arranjoDaAnalise('atendimento')

  const blocos: Bloco[] = [
    {
      id: 'numeros',
      titulo: 'Números do período',
      largura: 'inteira',
      conteudo: (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Cartao
            titulo="Conversas"
            vazio={atual.conversas === 0 && 'Sem conversas no período'}
            valor={String(atual.conversas)}
            tendencia={serie.map((d) => d.conversas)}
            comparacao={<Mudanca atual={atual.conversas} antes={antes.conversas} />}
            definicao="Conversas que começaram no período, em qualquer canal ligado a uma automação da conta."
          />
          <Cartao
            titulo="Contatos novos"
            vazio={atual.contatosNovos === 0 && 'Sem contatos novos'}
            valor={String(atual.contatosNovos)}
            tendencia={serie.map((d) => d.contatosNovos)}
            comparacao={<Mudanca atual={atual.contatosNovos} antes={antes.contatosNovos} />}
            definicao="Pessoas que falaram com a organização pela primeira vez no período (o dia em que o contato foi criado)."
          />
          <Cartao
            titulo="Resolvidas pela automação"
            vazio={automacao === null && 'Nenhuma conversa terminou'}
            valor={automacao === null ? 'sem dado' : `${automacao}%`}
            medidor={automacao}
            detalhe={
              automacao === null
                ? 'nenhuma conversa terminou ainda'
                : `${atual.desfechos.bot} de ${terminadas(atual.desfechos)} que terminaram`
            }
            comparacao={<MudancaEmPontos atual={automacao} antes={automacaoAntes} melhorQuando="sobe" />}
            definicao="Das conversas do período que já terminaram, quantas a automação resolveu sozinha, sem passar por ninguém da equipe. As que ainda estão acontecendo ficam fora da conta."
          />
          <Cartao
            titulo="Espera pela equipe"
            vazio={
              atual.tempos.medianaAteResponder === null &&
              (atual.tempos.entraramNaFila === 0
                ? 'Ninguém pediu atendimento'
                : 'Ainda sem resposta da equipe')
            }
            valor={atual.tempos.medianaAteResponder === null ? 'sem dado' : comoDuracao(atual.tempos.medianaAteResponder)}
            detalhe={
              atual.tempos.entraramNaFila === 0
                ? 'ninguém pediu uma pessoa'
                : `mediana · média ${comoDuracao(atual.tempos.mediaAteResponder)} · ${atual.tempos.responderam} de ${atual.tempos.entraramNaFila} respondidas`
            }
            tendencia={serie.map((d) => d.foramParaPessoa)}
            comparacao={<MudancaDeTempo atual={atual.tempos.medianaAteResponder} antes={antes.tempos.medianaAteResponder} />}
            definicao="Do momento em que a conversa foi para a equipe até a primeira resposta enviada. A mediana é o atendimento típico; a média mostra se alguém esperou muito mais. Conversa sem resposta ainda não entra na conta. A linha miúda é quantas foram para a equipe a cada dia."
          />
        </div>
      ),
    },
    { id: 'por-dia', titulo: 'Por dia', largura: 'dois-tercos', conteudo: <GraficoDiario serie={serie} cruzaAno={cruzaAno} /> },
    {
      id: 'desfechos',
      titulo: 'Como terminaram',
      largura: 'terco',
      conteudo: (
        <CaixaDoBloco titulo="Como as conversas terminaram" subtitulo="As quatro partes somam todas as conversas do período.">
          {atual.conversas === 0 ? (
            <Vazio>Nenhuma conversa começou neste período.</Vazio>
          ) : (
            <Rosca
              totalRotulo="conversas"
              fatias={[
                {
                  chave: 'bot',
                  rotulo: 'Resolvidas pela automação',
                  n: atual.desfechos.bot,
                  cor: 'var(--serie-1)',
                  dica: 'Terminaram sem passar por ninguém da equipe.',
                },
                {
                  chave: 'prevista',
                  rotulo: 'Atendidas pela equipe',
                  n: atual.desfechos.prevista,
                  cor: 'var(--serie-3)',
                  dica: 'O fluxo previa passar para uma pessoa, ou alguém assumiu pelo Inbox.',
                },
                {
                  chave: 'falha',
                  rotulo: 'Interrompidas por erro',
                  n: atual.desfechos.falha,
                  cor: 'var(--serie-2)',
                  alerta: true,
                  dica: 'Pararam por um problema técnico e foram para a equipe. O motivo está na conversa, no Inbox.',
                },
                {
                  chave: 'aberta',
                  rotulo: 'Ainda acontecendo',
                  n: atual.desfechos.aberta,
                  cor: 'var(--serie-outros)',
                  dica: 'Não terminaram, então ficam fora da taxa da automação.',
                },
              ]}
            />
          )}
        </CaixaDoBloco>
      ),
    },
    {
      id: 'horarios',
      titulo: 'Quando chegam',
      largura: 'dois-tercos',
      conteudo: (
        <CaixaDoBloco
          titulo="Quando as conversas chegam"
          subtitulo="Dia da semana e hora em que cada conversa começou, no horário de Brasília. Mostra quando vale ter alguém olhando o Inbox."
        >
          <MapaDeHorarios celulas={horarios} unidade={['conversa', 'conversas']} />
        </CaixaDoBloco>
      ),
    },
    {
      id: 'canais',
      titulo: 'Por onde chegam',
      largura: 'terco',
      conteudo: (
        <CaixaDoBloco titulo="Por onde chegam" subtitulo="Conversas do período, pelo canal da automação que atendeu.">
          {canais.length === 0 ? (
            <Vazio>Nenhuma conversa começou neste período.</Vazio>
          ) : canais.length === 1 ? (
            // Uma fatia só é um anel inteiro que não compara nada: o número diz mais.
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-[34px] leading-none font-bold tracking-[-0.03em] tabular-nums text-ink">100%</p>
              <p className="mt-2 text-[13px] text-soft">
                das {canais[0]!.n.toLocaleString('pt-BR')} conversas vieram pelo{' '}
                <strong className="font-semibold text-ink">{NOME_DO_CANAL[canais[0]!.canal] ?? canais[0]!.canal}</strong>
              </p>
              <div
                className="mt-4 h-2.5 rounded-full"
                style={{ background: COR_DO_CANAL[canais[0]!.canal] ?? 'var(--primary)' }}
                aria-hidden
              />
              <p className="mt-auto pt-5 text-[12px] leading-5 text-dim">
                Com outro canal ligado, este bloco mostra a divisão entre eles.{' '}
                <Link href={`/clientes/${cliente.id}/ajustes/integracoes`} className="font-semibold text-primary hover:underline">
                  Ver canais
                </Link>
              </p>
            </div>
          ) : (
            <Rosca
              totalRotulo="conversas"
              fatias={canais
                .sort((a, b) => b.n - a.n)
                .map((c) => ({
                  chave: c.canal,
                  rotulo: NOME_DO_CANAL[c.canal] ?? c.canal,
                  n: c.n,
                  cor: COR_DO_CANAL[c.canal] ?? 'var(--serie-outros)',
                }))}
            />
          )}
        </CaixaDoBloco>
      ),
    },
    ...(pessoas.length >= 2
      ? [
          {
            id: 'equipe',
            titulo: 'Quem atendeu',
            largura: 'metade' as const,
            conteudo: (
              <ListaEmBarras
                titulo="Quem atendeu"
                subtitulo="Conversas que foram para a equipe, pelo responsável do contato."
                ranking
                valorPermitido
                valorEmDinheiro={false}
                rotuloQuantidade="Atendimentos"
                rotuloValor="Resolvidos"
                unidade={['atendimento', 'atendimentos']}
                vazio="Ninguém da equipe atendeu no período."
                linhas={pessoas.map((p) => ({
                  chave: p.usuarioId,
                  rotulo: equipe.find((m) => m.id === p.usuarioId)?.nome || 'alguém que saiu da organização',
                  n: p.atendimentos,
                  valor: p.fechados,
                  detalhe: `${p.fechados} de ${p.atendimentos} resolvidos`,
                }))}
              />
            ),
          },
        ]
      : []),
    {
      id: 'origem',
      titulo: 'De onde vêm os contatos',
      largura: 'metade',
      conteudo: (
        <ListaEmBarras
          titulo="De onde vêm os contatos"
          subtitulo="Contatos novos do período, pela campanha do primeiro anúncio em que clicaram."
          unidade={['contato novo', 'contatos novos']}
          vazio="Nenhum contato novo no período."
          linhas={origens.map((o) => ({
            chave: o.anuncio ? `a:${o.campanha ?? ''}` : 'direto',
            rotulo: o.anuncio ? o.campanha || 'Anúncio sem campanha' : 'Chegou sem anúncio',
            n: o.n,
            apagada: !o.anuncio,
          }))}
        />
      ),
    },
    {
      id: 'satisfacao',
      titulo: 'Satisfação (NPS)',
      largura: 'terco',
      conteudo: (
        <CaixaDoBloco
          titulo="Satisfação (NPS)"
          subtitulo={<MudancaEmPontos atual={atual.satisfacao.nps} antes={antes.satisfacao.nps} melhorQuando="sobe" />}
        >
          <Satisfacao nps={atual.satisfacao.nps} media={atual.satisfacao.media} porNota={atual.satisfacao.porNota} />
        </CaixaDoBloco>
      ),
    },
    {
      id: 'espera',
      titulo: 'Quanto esperaram',
      largura: 'terco',
      conteudo: (
        <ListaEmBarras
          titulo="Quanto esperaram"
          subtitulo="Da ida para a equipe até a primeira resposta, conversa por conversa."
          manterOrdem
          unidade={['conversa', 'conversas']}
          vazio="Ninguém pediu uma pessoa no período."
          linhas={
            atual.tempos.entraramNaFila === 0
              ? []
              : [
                  { chave: '5', rotulo: 'Até 5 minutos', n: espera.ate5 },
                  { chave: '15', rotulo: '5 a 15 minutos', n: espera.ate15 },
                  { chave: '60', rotulo: '15 minutos a 1 hora', n: espera.ate60 },
                  { chave: '4h', rotulo: '1 a 4 horas', n: espera.ate4h },
                  { chave: 'mais', rotulo: 'Mais de 4 horas', n: espera.mais },
                  { chave: 'sem', rotulo: 'Sem resposta ainda', n: espera.semResposta, apagada: true },
                ]
          }
        />
      ),
    },
    {
      id: 'fechamentos',
      titulo: 'Fechamentos',
      largura: 'terco',
      conteudo: (
        <CaixaDoBloco
          titulo="Fechamentos"
          subtitulo={<Mudanca atual={atual.fechamentos.ganhos} antes={antes.fechamentos.ganhos} />}
        >
          {atual.fechamentos.ganhos + atual.fechamentos.perdidos === 0 ? (
            <Vazio>Nenhum negócio fechado no período.</Vazio>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="text-[34px] leading-none font-bold tracking-[-0.03em] tabular-nums text-ink">
                {atual.fechamentos.ganhos}{' '}
                <span className="text-[15px] font-semibold tracking-normal text-dim">
                  {atual.fechamentos.ganhos === 1 ? 'ganho' : 'ganhos'}
                </span>
              </p>
              {podeVerValor && atual.fechamentos.valor !== null && (
                <p className="mt-1.5 text-[14px] font-semibold tabular-nums text-soft">{comoDinheiro(atual.fechamentos.valor)}</p>
              )}
              <div className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                <div className="bg-primary" style={{ flex: atual.fechamentos.ganhos }} />
                <div className="bg-strong" style={{ flex: atual.fechamentos.perdidos }} />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] tabular-nums">
                <span className="text-soft">
                  <strong className="text-ink">{atual.fechamentos.ganhos}</strong> ganhos
                </span>
                <span className="text-dim">
                  <strong className="text-soft">{atual.fechamentos.perdidos}</strong>{' '}
                  {atual.fechamentos.perdidos === 1 ? 'perdido' : 'perdidos'}
                </span>
              </div>
              <Link
                href={`/clientes/${cliente.id}/relatorios/vendas`}
                className="mt-auto pt-5 text-[12.5px] font-semibold text-primary hover:underline"
              >
                Ver funil, ranking e receita em Vendas →
              </Link>
            </div>
          )}
        </CaixaDoBloco>
      ),
    },
  ]

  return (
    <ClienteShell cliente={cliente} ativa="relatorios">
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Relatórios</h1>
          <AjudaDaTela
            titulo="Como ler os relatórios"
            resumo="Números do atendimento no período escolhido, comparados com o período anterior."
            passos={PASSOS_DA_AJUDA}
          >
            <p>
              <strong className="text-ink">Os dias são os de Brasília.</strong> Uma conversa das 22h conta no dia em que
              aconteceu, mesmo que o servidor já esteja no dia seguinte.
            </p>
            <p>
              <strong className="text-ink">Cada número tem um ?</strong> com a definição exata do que ele conta.
            </p>
          </AjudaDaTela>
        </div>
        <p className="mt-1.5 text-[13px] leading-6 text-dim">
          {contaInteira
            ? 'Como o atendimento andou no período.'
            : escopo.tipo === 'proprios'
              ? 'Só os contatos que estão com você. Os números da organização inteira ficam com quem gerencia.'
              : 'Só os contatos das suas equipes.'}
        </p>

        <div className="mt-4">
          <PainelDeBlocos
            pagina="atendimento"
            arranjoInicial={arranjo}
            barra={<BarraDoPeriodo base={base} periodo={periodo} anterior={anterior} hoje={hoje} />}
            blocos={blocos}
          />
        </div>
      </main>
    </ClienteShell>
  )
}

const NOME_DO_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', telegram: 'Telegram' }
const COR_DO_CANAL: Record<string, string> = {
  whatsapp: 'var(--marca-whatsapp)',
  instagram: 'var(--marca-instagram)',
  telegram: 'var(--marca-telegram)',
}
