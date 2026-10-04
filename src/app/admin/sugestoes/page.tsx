import Link from 'next/link'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { lerParametros, SemResultado, Selo, TelaDaAdministracao } from '@/components/admin/partes'
import { dataEHoraComRelativo } from '@/lib/quando'
import { listarSugestoes } from '@/server/repos/sugestoes'

export const dynamic = 'force-dynamic'

const BASE = '/admin/sugestoes'

/** O relógio da página, lido uma vez por render (ver `quadros/page.tsx`). */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * O que os clientes mandaram pelo "Sentiu falta de algo?", da mais nova para
 * a mais antiga. Lido da auditoria (`sugeriu_melhoria`), sem tabela própria:
 * ver `core/sugestoes.ts`.
 *
 * É lista e não tabela porque o miolo é texto livre, de uma linha a vários
 * parágrafos, e numa célula de tabela ele vira reticências.
 */
export default async function Sugestoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const agora = agoraDoServidor()
  const todas = await listarSugestoes()
  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const lista = busca
    ? todas.filter((s) => [s.organizacaoNome, s.quem, s.email, s.texto, s.tela].some((t) => t.toLocaleLowerCase('pt-BR').includes(busca)))
    : todas
  const organizacoes = new Set(todas.map((s) => s.organizacaoId).filter(Boolean)).size

  return (
    <TelaDaAdministracao
      titulo="Sugestões"
      descricao="O que os clientes pediram pelo “Sentiu falta de algo?”, com a tela em que estavam. Quem escreveu está a um clique: a organização abre aqui mesmo."
    >
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: funil, atividade, nome da organização', rotulo: 'Buscar sugestão' }}
          grupos={[]}
          resumo={
            busca
              ? `${lista.length} de ${todas.length}`
              : `${todas.length} ${todas.length === 1 ? 'sugestão' : 'sugestões'} · ${organizacoes} ${organizacoes === 1 ? 'organização' : 'organizações'}`
          }
        />
      </div>
      {lista.length === 0 ? (
        <SemResultado titulo={busca ? 'Nenhuma sugestão com essa busca' : 'Nenhum cliente mandou sugestão ainda'} limpar={busca ? BASE : undefined} />
      ) : (
        <ol className="app-card divide-y divide-line">
          {lista.map((s) => (
            <li key={s.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
                {s.organizacaoId ? (
                  <Link href={`/admin/organizacoes/${s.organizacaoId}`} className="font-bold text-ink hover:text-primary hover:underline">
                    {s.organizacaoNome}
                  </Link>
                ) : (
                  <strong className="font-bold text-ink">{s.organizacaoNome}</strong>
                )}
                <span className="text-muted" title={s.email}>
                  {s.quem}
                </span>
                <Selo title="A tela em que a pessoa estava">{s.tela}</Selo>
                <time dateTime={s.quando} className="ml-auto text-[11.5px] text-dim tabular-nums">
                  {dataEHoraComRelativo(s.quando, agora)}
                </time>
              </div>
              <p className="mt-2 text-[13px] leading-[1.6] whitespace-pre-wrap text-soft">{s.texto}</p>
            </li>
          ))}
        </ol>
      )}
    </TelaDaAdministracao>
  )
}
