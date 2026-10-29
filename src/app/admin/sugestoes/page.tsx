import { BarraDeLista } from '@/components/design/barra-de-lista'
import { lerParametros, Numero, SemResultado, TelaDaAdministracao } from '@/components/admin/partes'
import { CartaoDeSugestao } from '@/components/admin/cartao-de-sugestao'
import { ehSituacaoDaSugestao, ROTULO_DA_SITUACAO, SITUACOES_DA_SUGESTAO } from '@/core/sugestoes'
import { dataCurta, dataEHoraComRelativo } from '@/lib/quando'
import { listarSugestoes } from '@/server/repos/sugestoes'

export const dynamic = 'force-dynamic'

const BASE = '/admin/sugestoes'

const DIA = 24 * 60 * 60 * 1000

/** O relógio da página, lido uma vez por render (ver `quadros/page.tsx`). */
function agoraDoServidor(): number {
  return Date.now()
}

function contar(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/**
 * O que os clientes mandaram pelo "Sentiu falta de algo?", da mais nova para
 * a mais antiga. Lido da auditoria (`sugeriu_melhoria`), sem tabela própria:
 * ver `core/sugestoes.ts`. A triagem (nova, planejada, feita, descartada) é
 * outro ato na mesma auditoria, e se marca em cada cartão.
 *
 * São cartões e não tabela porque o miolo é texto livre, de uma linha a vários
 * parágrafos, e numa célula de tabela ele vira reticências.
 */
export default async function Sugestoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const agora = agoraDoServidor()
  const todas = await listarSugestoes()

  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const situacao = ehSituacaoDaSugestao(parametros.situacao) ? parametros.situacao : ''
  const tela = parametros.tela ?? ''
  const lista = todas
    .filter((s) => !situacao || s.situacao === situacao)
    .filter((s) => !tela || s.nomeDaTela === tela)
    .filter((s) => !busca || [s.organizacaoNome, s.quem, s.email, s.texto, s.nomeDaTela].some((t) => t.toLocaleLowerCase('pt-BR').includes(busca)))
  const temFiltro = !!(busca || situacao || tela)

  const novas = todas.filter((s) => s.situacao === 'nova').length
  const planejadas = todas.filter((s) => s.situacao === 'planejada').length
  const feitas = todas.filter((s) => s.situacao === 'feita').length
  const doMes = todas.filter((s) => agora - Date.parse(s.quando) < 30 * DIA).length
  const daSemana = todas.filter((s) => agora - Date.parse(s.quando) < 7 * DIA).length
  const organizacoes = new Set(todas.map((s) => s.organizacaoId).filter(Boolean)).size

  // As telas por quantas vezes aparecem: a mais pedida primeiro no filtro.
  const porTela = new Map<string, number>()
  for (const s of todas) porTela.set(s.nomeDaTela, (porTela.get(s.nomeDaTela) ?? 0) + 1)
  const telas = [...porTela.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))

  return (
    <TelaDaAdministracao
      titulo="Sugestões"
      descricao="O que os clientes pediram pelo “Sentiu falta de algo?”, com a tela em que estavam. Marque cada uma como planejada, feita ou descartada; quem escreveu nunca vê essa marcação."
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="Novas"
          valor={novas}
          detalhe={novas === 0 ? 'Todas já foram lidas' : 'Esperando a 4YU ler'}
          tom={novas > 0 ? 'aviso' : 'ok'}
          href={`${BASE}?situacao=nova`}
        />
        <Numero rotulo="Últimos 30 dias" valor={doMes} detalhe={`${daSemana} na semana · ${contar(organizacoes, 'organização', 'organizações')} no total`} />
        <Numero rotulo="Planejadas" valor={planejadas} detalhe="Entraram no plano do produto" href={`${BASE}?situacao=planejada`} />
        <Numero rotulo="Feitas" valor={feitas} detalhe="Já estão no ar" tom={feitas > 0 ? 'ok' : 'normal'} href={`${BASE}?situacao=feita`} />
      </div>

      <BarraDeLista
        base={BASE}
        parametros={parametros}
        busca={{ chave: 'busca', placeholder: 'Exemplo: funil, atividade, nome da organização', rotulo: 'Buscar sugestão' }}
        grupos={[
          { chave: 'situacao', titulo: 'Situação', opcoes: SITUACOES_DA_SUGESTAO.map((valor) => ({ valor, rotulo: ROTULO_DA_SITUACAO[valor] })) },
          ...(telas.length > 1 ? [{ chave: 'tela', titulo: 'Tela', opcoes: telas.map(([nome, n]) => ({ valor: nome, rotulo: `${nome} (${n})` })) }] : []),
        ]}
        resumo={temFiltro ? `${lista.length} de ${todas.length}` : contar(todas.length, 'sugestão', 'sugestões')}
      />

      {lista.length === 0 ? (
        todas.length === 0 ? (
          <div className="app-card px-6 py-16 text-center">
            <p className="text-[14px] font-bold text-ink">Nenhum cliente mandou sugestão ainda</p>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] leading-[1.55] text-muted">
              Elas chegam pelo “Sentiu falta de algo?”, no topo de qualquer tela do sistema. Cada uma aparece aqui na hora, com quem escreveu e a tela em que estava.
            </p>
          </div>
        ) : (
          <SemResultado titulo="Nenhuma sugestão com esses filtros" limpar={BASE} />
        )
      ) : (
        <ol className="flex flex-col gap-3">
          {lista.map((s) => (
            <CartaoDeSugestao
              key={s.id}
              sugestao={{
                id: s.id,
                organizacaoId: s.organizacaoId,
                organizacaoNome: s.organizacaoNome,
                quem: s.quem,
                email: s.email,
                imagem: s.imagem,
                tela: s.tela,
                nomeDaTela: s.nomeDaTela,
                texto: s.texto,
                situacao: s.situacao,
                quando: s.quando,
                quandoEscrito: dataEHoraComRelativo(s.quando, agora),
                triagem: s.triadaEm ? `${ROTULO_DA_SITUACAO[s.situacao]} por ${s.triadaPor.split('@')[0]} em ${dataCurta(s.triadaEm)}` : '',
              }}
            />
          ))}
        </ol>
      )}
    </TelaDaAdministracao>
  )
}
