import { horaExata, quando } from '@/lib/quando'
import { acaoMarcarAlertaVisto, acaoMarcarTodosOsAlertasVistos } from '@/server/acoes-alertas'
import { type Alerta, listarAlertas } from '@/server/repos/alertas'

export const dynamic = 'force-dynamic'

/**
 * O que quebrou.
 *
 * **Por que esta tela existe.** `alertar()` era um POST num webhook de Discord
 * e a variável desse webhook nunca foi preenchida — então durante meses o
 * produto teve um mecanismo de aviso completo que não avisava ninguém. Falha no
 * processamento do webhook do WhatsApp, recusa da Cloud API e cofre que não
 * devolve credencial caíam num `console.error` que some do log da Vercel em
 * algumas horas.
 *
 * Agora o alerta vira linha em `public.alertas` (0039) e esta é a tela dela. O
 * webhook continua existindo e toca por cima quando a variável existir.
 *
 * **"Visto" e não "resolvido".** A tela não sabe se o problema acabou — sabe se
 * alguém leu. Prometer "resolvido" num botão que só muda uma data seria a
 * interface afirmando uma coisa que ela não tem como verificar.
 */
export default async function Alertas() {
  const alertas = await listarAlertas({ limite: 200 })
  const abertos = alertas.filter((a) => a.vistoEm === null).length

  return (
    <main className="w-full max-w-[1280px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Alertas</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Falhas que o produto registrou sozinho: webhook que não processou, entrega recusada
            pela Meta, credencial que o cofre não devolveu. Some depois de 90 dias.
          </p>
        </div>

        {abertos > 0 && (
          <form action={acaoMarcarTodosOsAlertasVistos}>
            <button
              type="submit"
              className="rounded-[9px] border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:bg-white/[0.04] hover:text-white"
            >
              Marcar {abertos} como {abertos === 1 ? 'visto' : 'vistos'}
            </button>
          </form>
        )}
      </header>

      {alertas.length === 0 ? (
        <section className="app-card border-dashed px-8 py-12 text-center">
          <p className="text-[14px] font-semibold text-soft">Nada quebrou</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
            Esta tela vazia é a notícia boa. Ela enche sozinha quando o webhook do WhatsApp falhar,
            a Cloud API recusar uma entrega ou o cofre não devolver uma credencial.
          </p>
        </section>
      ) : (
        <ul className="app-card divide-y divide-white/[0.045] overflow-hidden">
          {alertas.map((alerta) => (
            <li key={alerta.id}>
              <Linha alerta={alerta} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function Linha({ alerta }: { alerta: Alerta }) {
  const aberto = alerta.vistoEm === null
  const contexto = Object.entries(alerta.contexto)

  return (
    <article className={`px-4 py-3.5 md:px-5 ${aberto ? '' : 'opacity-55'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {aberto && (
          <span
            aria-label="não visto"
            className="size-[7px] shrink-0 rounded-full bg-amber-400"
          />
        )}
        <h2 className="text-[13.5px] font-semibold text-soft">{alerta.titulo}</h2>

        {/*
         * O ambiente só aparece quando NÃO é produção. Um selo em toda linha
         * vira ruído; a informação que muda a decisão é "isto aqui é de uma
         * branch de teste, pode respirar".
         */}
        {alerta.ambiente !== 'production' && (
          <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] text-dim">
            {alerta.ambiente}
          </span>
        )}

        <time
          dateTime={alerta.criadoEm}
          title={horaExata(alerta.criadoEm)}
          className="ml-auto shrink-0 text-[11.5px] text-dim"
        >
          {quando(alerta.criadoEm)}
        </time>
      </div>

      {contexto.length > 0 && (
        <dl className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
          {contexto.map(([chave, valor]) => (
            <div key={chave} className="flex gap-1.5 text-[11.5px]">
              <dt className="text-dim">{chave}:</dt>
              <dd className="font-mono text-muted">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}

      {/*
       * `<details>` e não um acordeão de React: o detalhe é um stack de erro
       * que quase ninguém abre, e quem abre quer poder selecionar e copiar. O
       * elemento nativo faz as duas coisas sem estado nenhum.
       */}
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-dim transition hover:text-accent">
          <span className="group-open:hidden">Ver o detalhe</span>
          <span className="hidden group-open:inline">Esconder</span>
        </summary>
        <pre className="mt-2 max-h-[280px] overflow-auto rounded-[9px] border border-white/[0.06] bg-black/25 p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-muted">
          {alerta.detalhe}
        </pre>
      </details>

      {aberto && (
        <form action={acaoMarcarAlertaVisto} className="mt-2.5">
          <input type="hidden" name="id" value={alerta.id} />
          <button
            type="submit"
            className="text-[11.5px] font-semibold text-dim transition hover:text-accent"
          >
            Marcar como visto
          </button>
        </form>
      )}
    </article>
  )
}
